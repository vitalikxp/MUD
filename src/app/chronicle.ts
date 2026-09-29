// Хроника (лента записей), её прокрутка и действия, которые пишут в неё: реплика игрока → Мастер, смена настроек.
import { signal } from '@preact/signals';
import { locale, t, type Key } from '../i18n';
import { LlmError } from '../llm/types';
import { getPalette, type Token } from '../theme/palettes';
import * as llm from './llm';
import { ask, busy } from './master';
import { paletteId } from './settings';

/** Запись хроники: ключ словаря (перерисуется при смене языка), готовый текст или заглушка «Мастер думает». */
export type Entry = { key: Key; params?: Record<string, string>; fg: Token } | { text: string; fg: Token } | { pending: true; fg: Token };

const INTRO: Entry[] = [
  { key: 'intro.p1', fg: 'dm' },
  { text: '', fg: 'dm' },
  { key: 'intro.p2', fg: 'dm' },
  { text: '', fg: 'dm' },
  { key: 'intro.roll', fg: 'success' },
  { text: '', fg: 'dm' },
  { key: 'intro.p3', fg: 'accent' },
];

export const chronicle = signal<Entry[]>(INTRO);
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
    chronicle.value = chronicle.value.map((e, i) => (i === index ? { text: body, fg } : e));
  };
  try {
    const answer = await ask(text, { onText: (full) => replace(full) });
    replace(answer);
  } catch (e) {
    if (e instanceof LlmError && e.kind === 'aborted') replace(t('msg.aborted'), 'warning');
    else replace(errorText(e), 'failure');
  }
}
