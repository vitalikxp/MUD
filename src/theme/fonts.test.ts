import { describe, expect, it } from 'vitest';
import { computeMetrics, FONT, MIN_COLS, MIN_ROWS } from './fonts';

const px = FONT;

describe('computeMetrics', () => {
  it('ноутбук 1280×800: масштаб ×1, сетка 142×50', () => {
    const m = computeMetrics(px, 1280, 800, 9);
    expect(m).toMatchObject({ scale: 1, cellW: 9, cellH: 16, cols: 142, rows: 50 });
  });
  it('монитор 2560×1440: ×1 (16 px — обычный размер текста)', () => {
    expect(computeMetrics(px, 2560, 1440, 9).scale).toBe(1);
  });
  it('4K-ТВ 3840×2160: целый масштаб ×2, минимум 80×25 помещается с запасом', () => {
    const m = computeMetrics(px, 3840, 2160, 9);
    expect(m.scale).toBe(2);
    expect(m.cols).toBeGreaterThanOrEqual(MIN_COLS);
    expect(m.rows).toBeGreaterThanOrEqual(MIN_ROWS);
  });
  it('телефон 390×844: ×1 и меньше 80 колонок (мобильная раскладка)', () => {
    const m = computeMetrics(px, 390, 844, 9);
    expect(m.scale).toBe(1);
    expect(m.cols).toBeLessThan(MIN_COLS);
  });
  it('пиксельный шрифт: ширина ячейки целая', () => {
    expect(Number.isInteger(computeMetrics(px, 1920, 1080, 9.02).cellW)).toBe(true);
  });
});
