import { describe, expect, it } from 'vitest';
import { DEFAULT_PALETTE, HIGH_CONTRAST, PALETTES, TOKENS, contrast, getPalette, type Token } from './palettes';

// Токены, которыми рисуется текст (а не фон, рамки или туман).
const TEXT: Token[] = [
  'fg', 'fgDim', 'fgBright', 'title', 'accent', 'accent2', 'dm', 'player', 'ooc', 'system',
  'success', 'failure', 'crit', 'fumble', 'hp', 'hpLow', 'mana', 'danger', 'warning', 'info', 'magic',
  'mapFloor', 'mapWall', 'mapWater', 'mapSeen', 'mapToken', 'mapEnemy', 'mapAlly', 'cursor', 'frameActive',
];
const BACKGROUNDS: Token[] = ['bg', 'bgAlt', 'bgPanel'];

describe('палитры', () => {
  it('11 встроенных палитр, терминальная первая, id уникальны', () => {
    expect(PALETTES).toHaveLength(11);
    expect(PALETTES[0]!.id).toBe(DEFAULT_PALETTE);
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
  });

  it('у каждой палитры ровно все токены в формате #rrggbb и названия RU/EN', () => {
    for (const p of PALETTES) {
      expect(Object.keys(p.colors).toSorted()).toEqual([...TOKENS].toSorted());
      for (const t of TOKENS) expect(p.colors[t], `${p.id}.${t}`).toMatch(/^#[0-9a-f]{6}$/);
      expect(p.name.ru && p.name.en && p.when.ru && p.when.en).toBeTruthy();
    }
  });

  it('высокий контраст недоступен Мастеру, остальные доступны', () => {
    for (const p of PALETTES) expect(p.dmAllowed, p.id).toBe(p.id !== HIGH_CONTRAST);
  });

  describe.each(PALETTES.map((p) => [p.id, p] as const))('контраст: %s', (id, p) => {
    const hc = id === HIGH_CONTRAST;
    it(`fg ≥ ${hc ? 7 : 7}:1 и fgDim ≥ ${hc ? 7 : 4.5}:1 на всех фонах`, () => {
      for (const bg of BACKGROUNDS) {
        expect(contrast(p.colors.fg, p.colors[bg])).toBeGreaterThanOrEqual(7);
        expect(contrast(p.colors.fgDim, p.colors[bg])).toBeGreaterThanOrEqual(hc ? 7 : 4.5);
      }
    });
    it(`текстовые токены ≥ ${hc ? 7 : 4.5}:1, рамки ≥ ${hc ? 7 : 3}:1, выделение ≥ ${hc ? 7 : 4.5}:1`, () => {
      for (const bg of BACKGROUNDS) {
        for (const t of TEXT) expect(contrast(p.colors[t], p.colors[bg]), `${t} на ${bg}`).toBeGreaterThanOrEqual(hc ? 7 : 4.5);
        expect(contrast(p.colors.frame, p.colors[bg])).toBeGreaterThanOrEqual(hc ? 7 : 3);
      }
      expect(contrast(p.colors.selFg, p.colors.selBg)).toBeGreaterThanOrEqual(hc ? 7 : 4.5);
    });
  });

  it('неизвестный id даёт палитру по умолчанию', () => {
    expect(getPalette('nope').id).toBe(DEFAULT_PALETTE);
  });

  it('формула контраста WCAG', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});
