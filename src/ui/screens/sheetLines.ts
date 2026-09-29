import type { SheetView } from '../../rules/api';
import { fit, wrapToWidth } from '../tui/text';
import type { Line, Segment } from '../tui/types';

/**
 * Лист персонажа в строках. Обычная запись — «название  значение  подсказка» в одну строку.
 * Запись с `block` (особенности) — в одну колонку: строка «название · значение», под ней описание абзацем с отступом.
 */
export function sheetLines(sheet: SheetView, width: number): Line[] {
  const lines: Line[] = [];
  for (const section of sheet.sections) {
    if (section.rows.length === 0) continue;
    if (lines.length > 0) lines.push([{ text: '' }]);
    lines.push([{ text: section.heading, fg: 'accent', bold: true }]);
    const plain = section.rows.filter((r) => !r.block);
    const labelW = plain.length > 0 ? Math.min(Math.floor(width * 0.5), Math.max(...plain.map((r) => Array.from(r.label).length)) + 2) : 0;
    const valueW = plain.length > 0 ? Math.max(...plain.map((r) => Array.from(r.value).length)) : 0;
    for (const row of section.rows) {
      if (row.block) {
        for (const text of wrapToWidth(`${row.label} · ${row.value}`, width)) lines.push([{ text }]);
        if (row.hint) for (const text of wrapToWidth(row.hint, Math.max(1, width - 2))) lines.push([{ text: `  ${text}`, fg: 'fgDim' }]);
        continue;
      }
      const segs: Segment[] = [{ text: fit(row.label, labelW), fg: 'fgDim' }, { text: row.value }];
      if (row.hint) segs.push({ text: `${' '.repeat(Math.max(1, valueW - Array.from(row.value).length + 1))}${row.hint}`, fg: 'fgDim' });
      lines.push(segs);
    }
  }
  return lines;
}
