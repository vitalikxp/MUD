import type { Token } from '../../theme/palettes';

/** Отрезок строки одного цвета. Строка TUI — массив отрезков, а не span на ячейку (docs/07). */
export interface Segment {
  text: string;
  fg?: Token;
  bg?: Token;
  bold?: boolean;
}

export type Line = readonly Segment[];

/** Абзац с цветом, который TextView переносит по ширине панели. */
export interface Paragraph {
  text: string;
  fg?: Token;
}
