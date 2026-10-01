// Хроника (лента записей), её прокрутка и действия, которые пишут в неё: реплика игрока → Мастер, смена настроек.
import { signal } from '@preact/signals';
import { BRAND_NAME } from '../brand';
import { locale, t, type Key } from '../i18n';
import { cleanNarration } from '../dm/narration';
import { TurnError } from '../dm/types';
import { LlmError } from '../llm/types';
import { getPalette, type Token } from '../theme/palettes';
import { effectiveCommits } from '../engine/commits';
import type { Commit } from '../engine/types';
import { lastRetryAction, session, undoLastAction, type Session } from './campaigns';
import { entriesFromCommits, lastSuggestions, resolveChoice } from './chronicleLog';
import { dmConfig } from './dmConfig';
import * as llm from './llm';
import { ask, beginRequest, busy, endRequest, lastError, lastUsage } from './master';
import { paletteId } from './settings';
import { takeTurn, type PlayerAction } from './turn';

/** Запись хроники: ключ словаря (перерисуется при смене языка), готовый текст или заглушка «Мастер думает». */
export type Entry =
  | { key: Key; params?: Record<string, string>; fg: Token }
  /** `md` — текст Мастера: разбирается как Markdown (модели иногда отвечают с разметкой). */
  | { text: string; fg: Token; md?: boolean }
  | { pending: true; fg: Token };

export const INTRO: Entry[] = [
  { key: 'intro.p1', params: { name: BRAND_NAME }, fg: 'dm' },
  { text: '', fg: 'dm' },
  { key: 'intro.p2', fg: 'dm' },
  { text: '', fg: 'dm' },
  { key: 'intro.roll', fg: 'success' },
  { text: '', fg: 'dm' },
  { key: 'intro.p3', fg: 'accent' },
];

export const chronicle = signal<Entry[]>(INTRO);

let chronicleOwner = 'chat';

/**
 * Лента принадлежит черновому чату (`chat`) или кампании (`campaign:<id>`). При смене владельца она заменяется вступлением
 * и прокручивается в конец; тот же владелец (вернулись из другого экрана) свою ленту не теряет.
 */
export function enterChronicle(owner: string, entries: Entry[]): void {
  if (owner === chronicleOwner) return;
  chronicleOwner = owner;
  failedAction = null; // неудавшийся ход относился к прежней ленте
  chronicle.value = entries;
  scrollOffset.value = 0;
}
/** На сколько строк хроника прокручена вверх от низа (0 — внизу, следим за новым текстом). */
export const scrollOffset = signal(0);
/** Кадр анимации «Мастер думает»; тикает только пока Мастер отвечает. */
export const thinkingTick = signal(0);

export const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function push(...entries: Entry[]): void {
  chronicle.value = [...chronicle.value, { text: '', fg: 'dm' }, ...entries];
}

export function errorText(e: unknown): string {
  const kind = e instanceof LlmError ? e.kind : 'other';
  const detail = e instanceof LlmError && kind === 'other' ? `: ${e.message}` : '';
  return `${t(`errors.${kind}` as Key)}${detail}`;
}

/** Применяет палитру и, если `announce`, пишет об этом в хронику. */
export function setPalette(id: string, announce = true): void {
  paletteId.value = id;
  if (announce) push({ key: 'msg.palette', params: { name: getPalette(id).name[locale.value] }, fg: 'system' });
}

export function setLang(next: 'ru' | 'en'): void {
  locale.value = next;
  push({ key: 'msg.lang', fg: 'system' });
}

/** Реплика игрока → модель; ответ стримится в последнюю запись хроники. */
export async function askMaster(text: string): Promise<void> {
  const missing = llm.problems.value;
  if (missing.length > 0) {
    push({ key: 'msg.notConfigured', params: { problems: missing.map((p) => t(`problems.${p}` as Key)).join(', ') }, fg: 'warning' });
    return;
  }
  if (busy.value) {
    push({ key: 'msg.busy', fg: 'warning' });
    return;
  }
  scrollOffset.value = 0; // своя реплика — к концу ленты
  thinkingTick.value = 0;
  // Пустая строка между репликой игрока и ответом Мастера.
  push({ text: `${t('input.prompt')} ${text}`, fg: 'player' }, { text: '', fg: 'dm' }, { pending: true, fg: 'dm' });
  const index = chronicle.value.length - 1;
  const replace = (body: string, fg: Token = 'dm') => {
    chronicle.value = chronicle.value.map((e, i) => (i === index ? { text: body, fg, ...(fg === 'dm' ? { md: true } : {}) } : e));
  };
  try {
    const answer = await ask(text, { onText: (full) => replace(full) });
    replace(answer);
  } catch (e) {
    if (e instanceof LlmError && e.kind === 'aborted') replace(t('msg.aborted'), 'warning');
    else replace(errorText(e), 'failure');
  }
}

/** Вступление и записи кампании: заголовок, подсказка и всё, что записано в журнале. */
export function campaignEntries(current: Session): Entry[] {
  const hero = Object.values(current.state.entities).find((e) => e.kind === 'pc')?.name ?? '—';
  const started = effectiveCommits(current.commits).some((c) => c.kind === 'turn');
  return [
    { key: 'game.intro', params: { title: current.meta.title, hero }, fg: 'accent' },
    { text: '', fg: 'dm' },
    { key: started ? 'game.tryIt' : 'game.begin', fg: 'fgDim' },
    ...entriesFromCommits(current.commits, t('input.prompt')),
  ];
}

/** Перестроить ленту открытой кампании по журналу (после бытового действия). Чужую ленту не трогаем. */
export function refreshCampaignChronicle(): void {
  const now = session.peek();
  if (now && chronicleOwner === `campaign:${now.meta.id}`) chronicle.value = campaignEntries(now);
}

/** Ход, который не удался или был прерван: `/retry` отправит его заново. Сбрасывается успешным ходом, откатом и сменой кампании. */
let failedAction: PlayerAction | null = null;

function notConfigured(): boolean {
  const missing = llm.problems.value;
  if (missing.length === 0) return false;
  push({ key: 'msg.notConfigured', params: { problems: missing.map((p) => t(`problems.${p}` as Key)).join(', ') }, fg: 'warning' });
  return true;
}

/** Откат в журнале: ошибка хранилища (конфликт вкладок, нехватка места) показывается игроку, а не теряется. `null` — отката не было. */
async function undoSafely(): Promise<Commit | null | undefined> {
  try {
    return await undoLastAction();
  } catch (e) {
    refreshCampaignChronicle(); // при конфликте вкладок сессия уже перечитана
    push({ key: 'msg.undoFailed', params: { reason: e instanceof Error ? e.message : String(e) }, fg: 'warning' });
    return undefined;
  }
}

/** `/undo`: отменить последний ход Мастера или бытовое действие; повторяется, пока есть что отменять. */
export async function undoTurn(): Promise<void> {
  if (busy.value) return void push({ key: 'msg.busy', fg: 'warning' });
  if (!session.peek()) return;
  const undone = await undoSafely();
  if (undone === undefined) return;
  failedAction = null;
  if (!undone) return void push({ key: 'msg.nothingToUndo', fg: 'warning' });
  scrollOffset.value = 0;
  refreshCampaignChronicle();
  push({ key: undone.kind === 'turn' ? 'msg.undoneTurn' : 'msg.undoneAction', fg: 'system' });
}

/**
 * `/retry`: ход заново. Если последний ход не удался (ошибка, обрыв), отправляется та же реплика. Иначе последний ход Мастера
 * откатывается и его реплика уходит снова: кубы те же (`undoLastAction` возвращает генератор), меняется текст Мастера.
 */
export async function retryTurn(): Promise<void> {
  if (busy.value) return void push({ key: 'msg.busy', fg: 'warning' });
  const current = session.peek();
  if (!current) return;
  if (notConfigured()) return; // откат до проверки настроек потерял бы ход, который нечем повторить
  const action = failedAction ?? lastRetryAction(current.commits);
  if (!action) return void push({ key: 'msg.nothingToRetry', fg: 'warning' });
  if (failedAction) failedAction = null;
  else if ((await undoSafely()) === undefined) return; // не удалось откатить: повторный ход поверх старого не запускаем
  refreshCampaignChronicle(); // убирает и откатанный ход, и строки неудавшегося
  await playTurn(action);
}

function turnFailure(e: unknown): string {
  if (e instanceof TurnError) return t('msg.turnFailed', { reason: e.message });
  return errorText(e);
}

/**
 * Ход в кампании: реплика игрока (или открытие игры) → оркестратор Мастера → коммит в журнал. Номер показанного варианта заменяется его текстом.
 * Пока Мастер отвечает, его текст стримится в ленту; после хода лента перестраивается по журналу (так же, как после перезагрузки).
 * Неудавшийся ход в журнал не попадает и его можно повторить.
 */
export async function playTurn(requested: PlayerAction): Promise<void> {
  const missing = llm.problems.value;
  if (missing.length > 0) {
    push({ key: 'msg.notConfigured', params: { problems: missing.map((p) => t(`problems.${p}` as Key)).join(', ') }, fg: 'warning' });
    return;
  }
  if (busy.value) {
    push({ key: 'msg.busy', fg: 'warning' });
    return;
  }
  const start = session.peek();
  if (!start) return;
  // Номер варианта («2») заменяется его текстом ещё до ленты и журнала: игрок и Мастер видят одну и ту же реплику, `/retry` повторяет её же.
  const action: PlayerAction = requested.kind === 'player' ? { kind: 'player', text: resolveChoice(requested.text, lastSuggestions(start.commits)) } : requested;
  scrollOffset.value = 0;
  thinkingTick.value = 0;
  if (action.kind === 'player') push({ text: `${t('input.prompt')} ${action.text}`, fg: 'player' }, { text: '', fg: 'dm' }, { pending: true, fg: 'dm' });
  else push({ pending: true, fg: 'dm' });
  const index = chronicle.value.length - 1;
  // Лента может смениться, пока идёт ход (игрок ушёл в другую кампанию): чужую ленту не трогаем.
  const owner = chronicleOwner;
  const replace = (body: string, fg: Token = 'dm') => {
    if (chronicleOwner !== owner) return;
    chronicle.value = chronicle.value.map((e, i) => (i === index ? { text: body, fg, ...(fg === 'dm' ? { md: true } : {}) } : e));
  };
  let streamed = '';
  const started = Date.now();
  const abortSignal = beginRequest();
  try {
    const report = await takeTurn(action, {
      ...dmConfig(abortSignal),
      onProgress: (p) => {
        if (p.type !== 'text') return;
        streamed += p.delta;
        const shown = cleanNarration(streamed).text; // мусор вроде «(end_turn)» не мелькает и во время стриминга
        if (shown) replace(shown);
      },
    });
    lastUsage.value = { inputTokens: report.usage.inputTokens, outputTokens: report.usage.outputTokens, ms: Date.now() - started };
    failedAction = null;
    const done = session.peek();
    if (done && chronicleOwner === owner) chronicle.value = campaignEntries(done);
  } catch (e) {
    failedAction = action;
    if (e instanceof LlmError && e.kind === 'aborted') replace(t('msg.aborted'), 'warning');
    else {
      lastError.value = e instanceof LlmError ? e.kind : 'other';
      replace(turnFailure(e), 'failure');
    }
  } finally {
    endRequest(abortSignal);
  }
}
