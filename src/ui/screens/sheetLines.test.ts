import { describe, expect, it } from 'vitest';
import type { SheetView } from '../../rules/api';
import { sheetLines } from './sheetLines';

const text = (lines: ReturnType<typeof sheetLines>): string[] => lines.map((l) => l.map((s) => s.text).join(''));

const sheet: SheetView = {
  title: 'Ирма',
  sections: [
    { heading: 'Навыки', rows: [{ label: 'лазание', value: '4D+1', hint: 'Ловкость +1D+2' }] },
    { heading: 'Пусто', rows: [] },
    {
      heading: 'Особенности',
      rows: [
        { label: 'Причуда R1', value: 'Недостаток', hint: 'Муза настигает вас и заставляет тут же сочинять песню или рассказ.', block: true },
        { label: 'Способность', value: 'Способность', block: true },
      ],
    },
  ],
};

describe('sheetLines', () => {
  it('обычные записи — в строку, пустые разделы пропускаются', () => {
    const out = text(sheetLines(sheet, 60));
    expect(out[0]).toBe('Навыки');
    expect(out[1]).toMatch(/^лазание\s+4D\+1\s+Ловкость \+1D\+2$/);
    expect(out).not.toContain('Пусто');
  });

  it('блочные записи — в одну колонку: заголовок и описание абзацем с отступом, ничего не обрезается', () => {
    const out = text(sheetLines(sheet, 30));
    const i = out.indexOf('Особенности');
    expect(out[i + 1]).toBe('Причуда R1 · Недостаток');
    const body = out.slice(i + 2, out.indexOf('Способность · Способность'));
    expect(body.length).toBeGreaterThan(1);
    for (const line of body) {
      expect(line.startsWith('  ')).toBe(true);
      expect(Array.from(line).length).toBeLessThanOrEqual(30);
    }
    expect(body.join(' ').replace(/\s+/g, ' ')).toContain('сочинять песню или рассказ.');
    expect(out.at(-1)).toBe('Способность · Способность'); // без описания — одна строка
  });

  it('длинный заголовок записи переносится, а не обрезается и не вылезает', () => {
    const long: SheetView = { title: 'x', sections: [{ heading: 'H', rows: [{ label: 'Бонус к навыку: эйдетическая память R1', value: 'Способность', block: true }] }] };
    const out = text(sheetLines(long, 20));
    for (const line of out) expect(Array.from(line).length).toBeLessThanOrEqual(20);
    expect(out.slice(1).join(' ')).toBe('Бонус к навыку: эйдетическая память R1 · Способность');
  });
});
