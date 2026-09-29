// Кампании и текущая игровая сессия: список, создание, удаление, загрузка, коммит хода, создание героя.
// Состояние кампании — свёртка журнала (docs/06-data-model.md); здесь оно держится в сигналах, а пишется только через `commitTurn`.
import { signal } from '@preact/signals';
import { Draft, effectiveCommits, foldCommits, revertCommit, rngAfter } from '../engine/commits';
import { initialState } from '../engine/reducer';
import { createRng, rngFromState, type Rng } from '../engine/rng';
import type { Commit, CommitKind, Entity, GameState } from '../engine/types';
import { LocalAdapter } from '../net/local';
import { StorageConflictError, type CampaignMeta, type StorageAdapter } from '../net/storage';
import { fail, ok, type Lang, type Result } from '../rules/api';
import { rulesModule } from './rules';

let storage: StorageAdapter = new LocalAdapter();

/** Подменяет хранилище (тесты). */
export function useStorage(adapter: StorageAdapter): void {
  storage = adapter;
}

/** `null` — список ещё не загружен. */
export const campaigns = signal<CampaignMeta[] | null>(null);
/** Ошибка доступа к хранилищу (приватный режим, запрет IndexedDB): показывается на титульном экране. */
export const storageError = signal<string | null>(null);

export interface Session {
  meta: CampaignMeta;
  state: GameState;
  /** Генератор, продолженный с последнего коммита. */
  rng: Rng;
  /** Последние коммиты журнала. */
  commits: Commit[];
}

export const session = signal<Session | null>(null);

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function refreshCampaigns(): Promise<void> {
  try {
    campaigns.value = await storage.listCampaigns();
    storageError.value = null;
  } catch (e) {
    campaigns.value = [];
    storageError.value = errorMessage(e);
  }
}

function randomSeed(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface NewCampaign {
  title: string;
  variant: string;
  lang: Lang;
}

/** Создаёт пустую кампанию в фазе создания героя; возвращает её id. */
export async function createCampaign(input: NewCampaign): Promise<string> {
  const now = Date.now();
  const meta: CampaignMeta = {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    title: input.title.trim(),
    rules: { id: rulesModule.id, version: rulesModule.version, variant: input.variant },
    narrationLang: input.lang,
    seed: randomSeed(),
    phase: 'creation',
    headSeq: 0,
    createdAt: now,
    updatedAt: now,
  };
  await storage.createCampaign(meta);
  await refreshCampaigns();
  return meta.id;
}

export async function deleteCampaign(id: string): Promise<void> {
  await storage.deleteCampaign(id);
  if (session.peek()?.meta.id === id) session.value = null;
  await refreshCampaigns();
}

/** Загружает кампанию в `session`. `false` — такой кампании нет. */
export async function openSession(id: string): Promise<boolean> {
  const snapshot = await storage.loadCampaign(id);
  if (!snapshot) {
    session.value = null;
    return false;
  }
  session.value = { meta: snapshot.meta, state: snapshot.state, rng: rngAfter(snapshot.meta.seed, snapshot.commits), commits: snapshot.commits };
  return true;
}

export function closeSession(): void {
  session.value = null;
}

export interface CommitOptions {
  phase?: CampaignMeta['phase'];
  promptVersion?: string;
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Ход или действие: события собираются в черновике `Draft`, потом уходят в журнал одним коммитом (атомарно вместе с проекцией).
 * `build` может быть асинхронным (ход Мастера). Вызовы выполняются строго по очереди: пока идёт ход, другие ждут.
 * Если `build` бросит исключение или отклонится, ничего не записывается: ни события, ни продвижение генератора кубов.
 */
export function commitTurn(kind: CommitKind, build: (draft: Draft, session: Session) => void | Promise<void>, opts: CommitOptions = {}): Promise<Session> {
  const run = queue.then(() => doCommit(kind, build, opts));
  queue = run.catch(() => undefined);
  return run;
}

async function doCommit(kind: CommitKind, build: (draft: Draft, session: Session) => void | Promise<void>, opts: CommitOptions): Promise<Session> {
  const current = session.peek();
  if (!current) throw new Error('Нет открытой кампании');
  const draft = new Draft(current.state, current.rng, crypto.randomUUID());
  await build(draft, current); // ход Мастера сюда приходит асинхронно: черновик живёт, пока идёт разговор с моделью
  const commit = draft.toCommit(current.meta.headSeq + 1, kind, Date.now(), opts.promptVersion);
  try {
    const meta = await storage.commit(current.meta.id, commit, { state: draft.state, ...(opts.phase ? { phase: opts.phase } : {}) });
    const next: Session = { meta, state: draft.state, rng: rngFromState(commit.rngState), commits: [...current.commits, commit] };
    if (session.peek()?.meta.id === meta.id) session.value = next;
    return next;
  } catch (e) {
    if (e instanceof StorageConflictError) await openSession(current.meta.id); // другая вкладка продвинула журнал: берём её состояние
    throw e;
  }
}

/** Что можно отменить: ход Мастера и бытовое действие игрока. Создание героя и служебные коммиты не отменяются. */
const UNDOABLE: readonly CommitKind[] = ['turn', 'ui_action'];

/** Последний действующий (не отменённый) коммит, который можно откатить. */
export function lastUndoable(commits: readonly Commit[]): Commit | undefined {
  return effectiveCommits(commits).findLast((c) => UNDOABLE.includes(c.kind));
}

/**
 * Что повторит `/retry`: последний действующий коммит должен быть ходом Мастера; вернётся его реплика игрока или открытие игры.
 * Если после хода было бытовое действие, повторять нечего: сначала его откатывают.
 */
export function lastRetryAction(commits: readonly Commit[]): { kind: 'player'; text: string } | { kind: 'opening' } | null {
  const last = effectiveCommits(commits).at(-1);
  if (!last || last.kind !== 'turn') return null;
  const intent = last.events.find((e) => e.t === 'intent');
  return intent ? { kind: 'player', text: intent.text } : { kind: 'opening' };
}

/**
 * Откат последнего хода или бытового действия (`/undo`). Пишет коммит `revert`, состояние пересчитывается по журналу,
 * а генератор кубов возвращается на начало отменённого шага: повторный ход бросит те же кубы. Вызывает очередь коммитов, как ход.
 * Возвращает отменённый коммит; `null`, если отменять нечего.
 */
export function undoLastAction(): Promise<Commit | null> {
  const run = queue.then(async () => {
    const current = session.peek();
    if (!current) return null;
    const full = await storage.loadCampaign(current.meta.id, { recent: Number.MAX_SAFE_INTEGER });
    if (!full) return null;
    const target = lastUndoable(full.commits);
    if (!target) return null;
    const effective = effectiveCommits(full.commits);
    const before = effective[effective.findIndex((c) => c.seq === target.seq) - 1];
    const rngState = before?.rngState ?? createRng(full.meta.seed).state();
    const commit = revertCommit(full.meta.headSeq + 1, target.seq, crypto.randomUUID(), Date.now(), rngState);
    const state = foldCommits(initialState(full.meta.rules), [...full.commits, commit]);
    try {
      const meta = await storage.commit(current.meta.id, commit, { state });
      if (session.peek()?.meta.id === meta.id) session.value = { meta, state, rng: rngFromState(rngState), commits: [...current.commits, commit] };
      return target;
    } catch (e) {
      if (e instanceof StorageConflictError) await openSession(current.meta.id);
      throw e;
    }
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Создаёт героя из шаблона и переводит кампанию в игру. */
export async function createHero(input: { templateId: string; name: string; skills: Record<string, number> }): Promise<Result<Entity>> {
  const current = session.peek();
  if (!current) return fail('Нет открытой кампании');
  if (current.meta.phase !== 'creation') return fail(current.meta.narrationLang === 'ru' ? 'Герой уже создан' : 'The hero already exists');
  const built = rulesModule.creation.build({
    variant: current.meta.rules.variant,
    templateId: input.templateId,
    name: input.name,
    ownerUid: 'local',
    lang: current.meta.narrationLang,
    skills: input.skills,
  });
  if (!built.ok) return built;
  await commitTurn('system', (d) => d.emit({ t: 'entity.created', entity: built.value }), { phase: 'play' });
  return ok(built.value);
}

/** Просит браузер не вытеснять данные при нехватке места (иначе IndexedDB может очиститься). */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Герой игрока: первый персонаж-игрок в состоянии кампании. */
export function heroOf(state: GameState): Entity | undefined {
  return Object.values(state.entities).find((e) => e.kind === 'pc');
}

export function variantName(variant: string, lang: Lang): string {
  return rulesModule.variants.find((v) => v.id === variant)?.name[lang] ?? variant;
}
