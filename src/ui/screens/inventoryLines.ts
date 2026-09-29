import type { InventoryRow, InventoryView } from '../../rules/api';
import { fit, wrapToWidth } from '../tui/text';
import type { Line } from '../tui/types';

/** Сводка над списком вещей: «Серебро 14» (подпись приглушённо, значение обычным). */
export function summaryLines(view: InventoryView): Line[] {
  const labelW = view.summary.length > 0 ? Math.max(...view.summary.map((s) => Array.from(s.label).length)) + 2 : 0;
  return view.summary.map((s) => [{ text: fit(s.label, labelW), fg: 'fgDim' as const }, { text: s.value }]);
}

/** Свойства выбранного предмета под списком (урон, броня, описание): приглушённо, с переносом по ширине. */
export function detailLines(row: InventoryRow | undefined, width: number): Line[] {
  if (!row?.detail) return [];
  return wrapToWidth(row.detail, Math.max(1, width)).map((text) => [{ text, fg: 'fgDim' as const }]);
}

/** Строка предмета в списке: «●» надето, «○» в сумке, количество «×N». */
export function itemLabel(row: InventoryRow): string {
  return `${row.worn ? '●' : '○'} ${row.name}${row.qty > 1 ? ` ×${row.qty}` : ''}`;
}
