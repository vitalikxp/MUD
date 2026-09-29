import { describe, expect, it } from 'vitest';
import type { InventoryView } from '../../rules/api';
import { inventoryLines } from './inventoryLines';

const text = (lines: ReturnType<typeof inventoryLines>): string[] => lines.map((l) => l.map((s) => s.text).join(''));

const view: InventoryView = {
  title: 'Ирма',
  summary: [{ label: 'Серебро', value: '14' }],
  rows: [
    { name: 'Короткий меч', qty: 1, worn: true, detail: 'урон +1D' },
    { name: 'Факел', qty: 3, worn: false },
    { name: 'Очень длинное название вещи из сумки странника', qty: 1, worn: false, detail: 'Клетчатая, с чернильным пятном на углу' },
  ],
};

describe('inventoryLines', () => {
  it('сводка, потом предметы: надето ●, в сумке ○, количество, свойства под названием', () => {
    const out = text(inventoryLines(view, 40, 'пусто'));
    expect(out.slice(0, 6)).toEqual(['Серебро  14', '', '● Короткий меч', '  урон +1D', '○ Факел ×3', '○ Очень длинное название вещи из сумки']);
  });

  it('ничего не выходит за ширину; продолжение названия и свойства с отступом', () => {
    const out = text(inventoryLines(view, 20, 'пусто'));
    for (const line of out) expect(Array.from(line).length).toBeLessThanOrEqual(20);
    expect(out.join('\n')).toContain('  чернильным');
  });

  it('пустая сумка — подсказка, без сводки — без пустой строки сверху', () => {
    expect(text(inventoryLines({ title: 'Ирма', summary: [], rows: [] }, 30, 'Сумка пуста'))).toEqual(['Сумка пуста']);
  });
});
