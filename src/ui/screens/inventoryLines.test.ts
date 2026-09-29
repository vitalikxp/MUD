import { describe, expect, it } from 'vitest';
import type { InventoryRow, InventoryView } from '../../rules/api';
import { detailLines, itemLabel, summaryLines } from './inventoryLines';

const text = (lines: ReturnType<typeof summaryLines>): string[] => lines.map((l) => l.map((s) => s.text).join(''));

const sword: InventoryRow = { id: 'sword', name: 'Короткий меч', qty: 1, worn: true, slotLabel: 'основная рука', detail: 'урон +1D' };
const torch: InventoryRow = { id: 'torch', name: 'Факел', qty: 3, worn: false };

describe('inventoryLines', () => {
  it('сводка: подпись и значение, подписи выровнены', () => {
    const view: InventoryView = { title: 'Ирма', summary: [{ label: 'Серебро', value: '14' }, { label: 'Средства', value: '2D' }], rows: [] };
    expect(text(summaryLines(view))).toEqual(['Серебро   14', 'Средства  2D']);
    expect(summaryLines({ title: 'Ирма', summary: [], rows: [] })).toEqual([]);
  });

  it('строка предмета: надето ●, в сумке ○, количество', () => {
    expect(itemLabel(sword)).toBe('● Короткий меч');
    expect(itemLabel(torch)).toBe('○ Факел ×3');
  });

  it('свойства выбранного предмета переносятся по ширине; без свойств — пусто', () => {
    expect(text(detailLines(sword, 30))).toEqual(['урон +1D']);
    expect(detailLines(torch, 30)).toEqual([]);
    expect(detailLines(undefined, 30)).toEqual([]);
    const long: InventoryRow = { id: 'map', name: 'Карта', qty: 1, worn: false, detail: 'Клетчатая, с чернильным пятном на углу' };
    for (const line of text(detailLines(long, 14))) expect(Array.from(line).length).toBeLessThanOrEqual(14);
  });
});
