// Чистые функции символьной сетки TUI: ширина, перенос, рамки. Без DOM.

export type FrameStyle = 'single' | 'double';

interface BoxChars {
  h: string; v: string; tl: string; tr: string; bl: string; br: string;
  /** Разделитель внутри рамки: левый и правый стыки с одинарной линией. */
  sepL: string; sepR: string; sepH: string;
}

const BOX: Record<FrameStyle, BoxChars> = {
  single: { h: '─', v: '│', tl: '┌', tr: '┐', bl: '└', br: '┘', sepL: '├', sepR: '┤', sepH: '─' },
  double: { h: '═', v: '║', tl: '╔', tr: '╗', bl: '╚', br: '╝', sepL: '╟', sepR: '╢', sepH: '─' },
};

// Символы шире одной ячейки (эмодзи, CJK, fullwidth) ломают сетку — заменяем на «?».
// Не Extended_Pictographic: туда входят и однобайтные текстовые символы вроде ♦♥♣♠.
const WIDE = /[\p{Emoji_Presentation}\u{1F000}-\u{1FAFF}\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/u;
const COMBINING = /\p{M}/u;
// oxlint-disable-next-line no-control-regex -- намеренно вычищаем управляющие символы из текста модели
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/gu;

/** Приводит текст к виду «один кодпоинт = одна ячейка». */
export function sanitize(text: string): string {
  let out = '';
  for (const ch of text.normalize('NFC').replace(/\t/g, '  ').replace(CONTROL, '')) {
    if (COMBINING.test(ch)) continue;
    out += WIDE.test(ch) ? '?' : ch;
  }
  return out;
}

/** Длина строки в ячейках (строка уже прошла sanitize). */
export function cellLength(text: string): number {
  return Array.from(text).length;
}

/** Обрезает или дополняет пробелами до ровно `width` ячеек. */
export function fit(text: string, width: number, ellipsis = '…'): string {
  const chars = Array.from(text);
  if (chars.length > width) {
    return width <= 0 ? '' : chars.slice(0, width - ellipsis.length).join('') + ellipsis.slice(0, width);
  }
  return text + ' '.repeat(width - chars.length);
}

/**
 * Перенос по словам в пределах `width` ячеек. Абзацы разделяются `\n`,
 * пустые строки сохраняются, слово длиннее строки режется жёстко.
 */
export function wrapToWidth(text: string, width: number): string[] {
  if (width <= 0) return [];
  const lines: string[] = [];
  for (const paragraph of sanitize(text).split('\n')) {
    const words = paragraph.split(/ +/).filter((w) => w.length > 0);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let line = '';
    for (let word of words) {
      while (cellLength(word) > width) {
        if (line) {
          lines.push(line);
          line = '';
        }
        const chars = Array.from(word);
        lines.push(chars.slice(0, width).join(''));
        word = chars.slice(width).join('');
      }
      if (!word) continue;
      if (!line) line = word;
      else if (cellLength(line) + 1 + cellLength(word) <= width) line += ' ' + word;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

export interface FrameOptions {
  title?: string;
}

/**
 * Рамка `w × h` ячеек. Заголовок вписывается в верхнюю линию: `╔═[ Хроника ]═══╗`.
 * Возвращает `h` строк длиной ровно `w`; внутренность заполнена пробелами.
 */
export function frame(w: number, h: number, style: FrameStyle, opts: FrameOptions = {}): string[] {
  if (w < 2 || h < 2) throw new RangeError(`frame: минимум 2×2, получено ${w}×${h}`);
  const b = BOX[style];
  const inner = w - 2;
  let top = b.h.repeat(inner);
  if (opts.title && inner >= 5) {
    const label = `[ ${fit(sanitize(opts.title), Math.min(cellLength(sanitize(opts.title)), inner - 5))} ]`;
    top = b.h + label + b.h.repeat(Math.max(0, inner - 1 - cellLength(label)));
  }
  const rows = [b.tl + top + b.tr];
  for (let i = 0; i < h - 2; i++) rows.push(b.v + ' '.repeat(inner) + b.v);
  rows.push(b.bl + b.h.repeat(inner) + b.br);
  return rows;
}

/** Горизонтальный разделитель внутри рамки ширины `w`: `├────┤` или `╟────╢`. */
export function separator(w: number, style: FrameStyle): string {
  const b = BOX[style];
  return b.sepL + b.sepH.repeat(Math.max(0, w - 2)) + b.sepR;
}

/** Полоса ресурса: `█████░░░` шириной `width`. */
export function bar(value: number, max: number, width: number): string {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  const full = Math.round(ratio * width);
  return '█'.repeat(full) + '░'.repeat(width - full);
}
