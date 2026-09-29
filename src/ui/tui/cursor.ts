// Курсор мыши в стиле текстового режима DOS: блок размером в клетку, привязанный к сетке. Чистая математика.

export interface Snap {
  col: number;
  row: number;
}

/** Клетка сетки под точкой (clientX, clientY); `null`, если точка вне сетки. `rect` — рамка `.tui-screen`. */
export function snapToCell(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  cellW: number,
  cellH: number,
  cols: number,
  rows: number,
): Snap | null {
  const col = Math.floor((clientX - rect.left) / cellW);
  const row = Math.floor((clientY - rect.top) / cellH);
  return col < 0 || row < 0 || col >= cols || row >= rows ? null : { col, row };
}
