// Чистая логика прокрутки ленты. `offset` — на сколько строк лента прокручена вверх от низа (0 = внизу, самое новое).

/** Максимальный сдвиг: всё содержимое, что не помещается в окно. */
export function maxOffset(total: number, height: number): number {
  return Math.max(0, total - height);
}

export function clampOffset(offset: number, total: number, height: number): number {
  return Math.min(Math.max(0, offset), maxOffset(total, height));
}

/**
 * Если игрок прокрутил вверх, а снизу добавились строки, сдвиг растёт на столько же — видимый кусок остаётся на месте.
 * Внизу (offset = 0) лента продолжает «липнуть» к новому тексту.
 */
export function followOffset(offset: number, prevTotal: number, total: number): number {
  return offset > 0 && total > prevTotal ? offset + (total - prevTotal) : offset;
}

/** Ползунок полосы прокрутки в ячейках: `start` — сверху, `size` — высота; `null`, если всё помещается. */
export function scrollThumb(total: number, height: number, offset: number): { start: number; size: number } | null {
  if (total <= height || height < 1) return null;
  const size = Math.max(1, Math.round((height * height) / total));
  const travel = height - size;
  const max = maxOffset(total, height);
  const fromTop = max - clampOffset(offset, total, height); // 0 = самый верх
  return { start: max === 0 ? 0 : Math.round((fromTop / max) * travel), size };
}

export interface ScrollLayout<L> {
  lines: L[];
  /** Ширина текста: на одну ячейку меньше, если справа нужна полоса прокрутки. */
  width: number;
  overflow: boolean;
}

/**
 * Раскладка прокручиваемого текста: сначала на всю ширину; если не помещается по высоте, переносим заново
 * на ширину без одного столбца — он уйдёт под полосу прокрутки.
 */
export function layoutScroll<L>(build: (width: number) => L[], width: number, height: number): ScrollLayout<L> {
  const full = build(width);
  if (full.length <= height || width < 2) return { lines: full, width, overflow: false };
  const narrow = build(width - 1);
  return { lines: narrow, width: width - 1, overflow: narrow.length > height };
}

/** Кадр анимации «Мастер думает»: полоса из `width` ячеек, по которой бегает блок с «шлейфом». */
export function thinkingBar(tick: number, width = 10): string {
  const period = Math.max(1, 2 * (width - 1));
  const p = tick % period;
  const head = p < width ? p : period - p;
  return Array.from({ length: width }, (_, i) => (i === head ? '█' : Math.abs(i - head) === 1 ? '▒' : '░')).join('');
}
