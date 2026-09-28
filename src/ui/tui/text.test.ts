import { describe, expect, it } from 'vitest';
import { bar, cellLength, fit, frame, sanitize, separator, wrapToWidth } from './text';

describe('sanitize', () => {
  it('заменяет широкие символы и убирает комбинируемые знаки', () => {
    expect(sanitize('меч 🗡 и 漢')).toBe('меч ? и ?');
    expect(sanitize('Йод')).toBe('Йод'); // NFC: Й остаётся одной ячейкой
    expect(sanitize('a\u0301b')).toBe('\u00e1b'); // NFC склеивает в «á» — одна ячейка
    expect(sanitize('q\u0301b')).toBe('qb'); // готового символа нет — знак убирается
    expect(sanitize('a\tb')).toBe('a  b');
    expect(sanitize('♦♥♣♠ ✓ → ≥')).toBe('♦♥♣♠ ✓ → ≥'); // текстовые символы шрифта остаются
    expect(sanitize('кубы 🎲')).toBe('кубы ?');
  });
});

describe('fit', () => {
  it('дополняет и обрезает до точной ширины', () => {
    expect(fit('кот', 5)).toBe('кот  ');
    expect(fit('длинное слово', 6)).toBe('длинн…');
    expect(cellLength(fit('длинное слово', 6))).toBe(6);
  });
});

describe('wrapToWidth', () => {
  it('переносит по словам и сохраняет пустые строки', () => {
    expect(wrapToWidth('Сырой воздух пахнет воском\n\nи гнилью', 12)).toEqual([
      'Сырой воздух', 'пахнет', 'воском', '', 'и гнилью',
    ]);
  });
  it('режет слово длиннее строки', () => {
    expect(wrapToWidth('абвгдежзик', 4)).toEqual(['абвг', 'дежз', 'ик']);
  });
  it('ни одна строка не длиннее ширины', () => {
    const text = 'Под лепестками блестит монета с чужим гербом, а за колонной что-то скребётся.';
    for (const w of [5, 10, 17, 40]) {
      for (const line of wrapToWidth(text, w)) expect(cellLength(line)).toBeLessThanOrEqual(w);
    }
  });
});

describe('frame', () => {
  it('одинарная рамка без заголовка', () => {
    expect(frame(5, 3, 'single')).toEqual(['┌───┐', '│   │', '└───┘']);
  });
  it('двойная рамка с заголовком, все строки одной ширины', () => {
    const rows = frame(20, 4, 'double', { title: 'Хроника' });
    expect(rows[0]).toBe('╔═[ Хроника ]══════╗');
    expect(new Set(rows.map(cellLength))).toEqual(new Set([20]));
  });
  it('длинный заголовок обрезается, ширина сохраняется', () => {
    const rows = frame(12, 3, 'single', { title: 'Очень длинный заголовок' });
    expect(cellLength(rows[0]!)).toBe(12);
    expect(rows[0]).toMatch(/^┌─\[ .+ \]─*┐$/);
  });
  it('отказывает для размеров меньше 2×2', () => {
    expect(() => frame(1, 3, 'single')).toThrow(RangeError);
  });
});

describe('separator и bar', () => {
  it('разделители', () => {
    expect(separator(6, 'single')).toBe('├────┤');
    expect(separator(6, 'double')).toBe('╟────╢');
  });
  it('полоса ресурса', () => {
    expect(bar(14, 16, 8)).toBe('███████░');
    expect(bar(0, 10, 4)).toBe('░░░░');
    expect(bar(5, 0, 3)).toBe('░░░');
  });
});
