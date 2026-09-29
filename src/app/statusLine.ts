// Строка состояния: что показывать про LLM и как уложить это в ширину сетки. Чистые функции.
import type { LlmErrorKind } from '../llm/types';
import type { Segment } from '../ui/tui/types';

export type LlmState = 'unconfigured' | 'busy' | 'error' | 'ready';

/** Приоритет: не настроен → отвечает → ошибка последнего запроса → готов. */
export function llmState(s: { problems: readonly string[]; busy: boolean; lastError: LlmErrorKind | null }): LlmState {
  if (s.problems.length > 0) return 'unconfigured';
  if (s.busy) return 'busy';
  if (s.lastError) return 'error';
  return 'ready';
}

/** «7,9 с» / «0,4 с» — секунды с одним знаком, запятая как разделитель. */
export function formatSeconds(ms: number): string {
  return `${(Math.max(0, ms) / 1000).toFixed(1).replace('.', ',')} с`;
}

/** Компактное число токенов: 474, 1,2k. */
export function formatTokens(n: number): string {
  return n < 1000 ? String(n) : `${(n / 1000).toFixed(1).replace('.', ',')}k`;
}

const len = (s: string): number => Array.from(s).length;

/**
 * Собирает строку ровно в `cols` ячеек: слева отрезки статуса, справа выровненный по краю текст.
 * Если места мало, сначала обрезается левая часть (с «…»), а правая отбрасывается, когда занимает больше трети ширины.
 */
export function layoutStatus(left: readonly Segment[], right: string, cols: number): Segment[] {
  const showRight = right !== '' && len(right) <= Math.floor(cols / 3);
  const leftMax = showRight ? cols - len(right) - 1 : cols;
  const out: Segment[] = [];
  let used = 0;
  for (const seg of left) {
    const room = leftMax - used;
    if (room <= 0) break;
    const chars = Array.from(seg.text);
    const text = chars.length > room ? chars.slice(0, Math.max(0, room - 1)).join('') + '…' : seg.text;
    out.push({ ...seg, text });
    used += len(text);
  }
  const gap = cols - used - (showRight ? len(right) : 0);
  out.push({ text: ' '.repeat(Math.max(0, gap)) });
  if (showRight) out.push({ text: right, fg: 'fgDim' });
  return out;
}
