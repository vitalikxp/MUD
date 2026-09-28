// Шрифты и метрики ячейки (docs/07-ui-tui.md#шрифты).
import '@fontsource/jetbrains-mono/cyrillic-400.css';
import '@fontsource/jetbrains-mono/latin-400.css';

export type FontId = 'pxplus' | 'jetbrains';

export interface FontDef {
  id: FontId;
  family: string;
  /** Базовый кегль в CSS px при масштабе ×1. */
  size: number;
  /** Высота ячейки при масштабе ×1 (= line-height). */
  lineHeight: number;
  /** Пиксельный шрифт: только целочисленный масштаб, без сглаживания. */
  pixel: boolean;
}

export const FONTS: Record<FontId, FontDef> = {
  pxplus: { id: 'pxplus', family: '"SWRD PxPlus IBM VGA"', size: 16, lineHeight: 16, pixel: true },
  jetbrains: { id: 'jetbrains', family: '"JetBrains Mono"', size: 15, lineHeight: 19, pixel: false },
};

export const DEFAULT_FONT: FontId = 'pxplus';

/** Минимальная сетка десктоп-раскладки; уже — мобильная. */
export const MIN_COLS = 80;
export const MIN_ROWS = 25;
/** Масштаб больше ×1 берётся, только если с ним помещается вдвое больше минимума (крупные экраны, ТВ). */
export const COMFORT_COLS = MIN_COLS * 2;
export const COMFORT_ROWS = MIN_ROWS * 2;

export interface CellMetrics {
  cellW: number;
  cellH: number;
  fontSize: number;
  scale: number;
  cols: number;
  rows: number;
}

let canvas: HTMLCanvasElement | undefined;

/** Ширина одного символа в px при заданном кегле (по «█», у моноширинного шрифта все равны). */
export function measureCharWidth(font: FontDef, fontSize: number): number {
  canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return fontSize * 0.6;
  ctx.font = `${fontSize}px ${font.family}`;
  return ctx.measureText('█').width;
}

/**
 * Масштаб — наибольший целый, при котором помещается «комфортная» сетка 160×50.
 * 16 CSS px — обычный размер текста, поэтому на ноутбуках и мониторах это ×1, на 4K-ТВ ×2.
 * Меньше 80 колонок при ×1 — мобильная раскладка.
 */
export function computeMetrics(font: FontDef, viewportW: number, viewportH: number, charW1: number): CellMetrics {
  let scale = 1;
  for (let s = 4; s >= 1; s--) {
    if (Math.floor(viewportW / (charW1 * s)) >= COMFORT_COLS && Math.floor(viewportH / (font.lineHeight * s)) >= COMFORT_ROWS) {
      scale = s;
      break;
    }
  }
  const cellW = font.pixel ? Math.round(charW1 * scale) : charW1 * scale;
  const cellH = font.lineHeight * scale;
  return {
    cellW,
    cellH,
    fontSize: font.size * scale,
    scale,
    cols: Math.max(1, Math.floor(viewportW / cellW)),
    rows: Math.max(1, Math.floor(viewportH / cellH)),
  };
}

export async function loadFont(font: FontDef): Promise<void> {
  try {
    await document.fonts.load(`${font.size}px ${font.family}`, 'Aя█═');
  } catch {
    // Шрифт не загрузился — метрики посчитаются по запасному моноширинному.
  }
}
