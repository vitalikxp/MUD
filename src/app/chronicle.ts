// Хроника (лента записей), её прокрутка и действия, которые пишут в неё: реплика игрока → Мастер, смена настроек.
import { signal } from '@preact/signals';
import { BRAND_NAME } from '../brand';
import { locale, t, type Key } from '../i18n';
import { TurnError } from '../dm/types';
import { LlmError } from '../llm/types';
import { getPalette, type Token } from '../theme/palettes';
import { session, type Session } from './campaigns';
import { entriesFromCommits } from './chronicleLog';
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
  const started = current.commits.some((c) => c.kind === 'turn');
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

function turnFailure(e: unknown): string {
  if (e instanceof TurnError) return t('msg.turnFailed', { reason: e.message });
  return errorText(e);
}

/**
 * Ход в кампании: реплика игрока (или открытие игры) → оркестратор Мастера → коммит в журнал.
 * Пока Мастер отвечает, его текст стримится в ленту; после хода лента перестраивается по журналу (так же, как после перезагрузки).
 * Неудавшийся ход в журнал не попадает и его можно повторить.
 */
export async function playTurn(action: PlayerAction): Promise<void> {
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
        replace(streamed);
      },
    });
    lastUsage.value = { inputTokens: report.usage.inputTokens, outputTokens: report.usage.outputTokens, ms: Date.now() - started };
    const done = session.peek();
    if (done && chronicleOwner === owner) chronicle.value = campaignEntries(done);
  } catch (e) {
    if (e instanceof LlmError && e.kind === 'aborted') replace(t('msg.aborted'), 'warning');
    else {
      lastError.value = e instanceof LlmError ? e.kind : 'other';
      replace(turnFailure(e), 'failure');
    }
  } finally {
    endRequest(abortSignal);
  }
}
