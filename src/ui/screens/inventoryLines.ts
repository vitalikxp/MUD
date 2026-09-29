import type { InventoryView } from '../../rules/api';
import { fit, wrapToWidth } from '../tui/text';
import type { Line } from '../tui/types';

/**
 * Вещи героя в строках: сводка (деньги), потом предметы. Надетое помечено «●», лежащее в сумке — «○»;
 * количество «×N»; под названием — свойства предмета, приглушённым цветом с отступом.
 */
export function inventoryLines(view: InventoryView, width: number, emptyText: string): Line[] {
  const lines: Line[] = [];
  const labelW = view.summary.length > 0 ? Math.max(...view.summary.map((s) => Array.from(s.label).length)) + 2 : 0;
  for (const s of view.summary) lines.push([{ text: fit(s.label, labelW), fg: 'fgDim' }, { text: s.value }]);
  if (view.summary.length > 0 && view.rows.length > 0) lines.push([{ text: '' }]);
  if (view.rows.length === 0) lines.push([{ text: emptyText, fg: 'fgDim' }]);
  for (const row of view.rows) {
    const qty = row.qty > 1 ? ` ×${row.qty}` : '';
    const wrapped = wrapToWidth(`${row.name}${qty}`, Math.max(1, width - 2));
    wrapped.forEach((text, i) => lines.push([{ text: i === 0 ? (row.worn ? '● ' : '○ ') : '  ', fg: row.worn ? 'success' : 'fgDim' }, { text }]));
    if (row.detail) for (const text of wrapToWidth(row.detail, Math.max(1, width - 2))) lines.push([{ text: `  ${text}`, fg: 'fgDim' }]);
  }
  return lines;
}
