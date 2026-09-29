// Markdown в строках TUI: модели иногда отвечают с разметкой, и звёздочки не должны попадать на экран.
// Шрифт один и пиксельный, поэтому жирный и курсив передаются цветом токенов палитры, а не синтезированным начертанием.
// Поддержано: заголовки, **жирный**, *курсив* / _курсив_, ***оба***, ~~зачёркнутый~~, `код`, блоки кода, списки, цитаты, ссылки, ---, экранирование `\*`.
// Всё остальное (таблицы, HTML, картинки) показывается как есть. Незакрытая разметка (текст ещё стримится) остаётся буквальной.
import type { Token } from '../../theme/palettes';
import { cellLength, sanitize } from './text';
import type { Line, Segment } from './types';

interface Style {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: boolean;
  fg?: Token;
}

/** Символ с его стилем: перенос по словам работает по таким ячейкам. */
interface Cell {
  ch: string;
  style: Style;
}

const PUNCT = /[\\`*_{}[\]()#+\-.!~>|]/;
const ALNUM = /[\p{L}\p{N}]/u;

/** Индекс закрывающего `delim`, начиная с `from`; `-1`, если пары нет. Одиночный `*` не путается с `**`, содержимое кода пропускается. */
function findClose(text: string, delim: string, from: number): number {
  for (let j = from; j < text.length; j++) {
    const c = text[j]!;
    if (c === '\\') { j++; continue; }
    if (c === '`') {
      const end = text.indexOf('`', j + 1);
      if (end > 0) j = end;
      continue;
    }
    if (delim.length === 1 && text.startsWith(delim + delim, j)) { j++; continue; }
    if (text.startsWith(delim, j)) return j;
  }
  return -1;
}

const DELIMS: readonly { d: string; style: Style }[] = [
  { d: '***', style: { bold: true, italic: true } },
  { d: '___', style: { bold: true, italic: true } },
  { d: '**', style: { bold: true } },
  { d: '__', style: { bold: true } },
  { d: '~~', style: { strike: true } },
  { d: '*', style: { italic: true } },
  { d: '_', style: { italic: true } },
];

/** Инлайн-разметка в ячейки со стилями. */
function inline(text: string, base: Style = {}): Cell[] {
  const out: Cell[] = [];
  const push = (s: string, style: Style) => { for (const ch of Array.from(s)) out.push({ ch, style }); };
  let buf = '';
  const flush = () => { push(buf, base); buf = ''; };
  let i = 0;
  scan: while (i < text.length) {
    const c = text[i]!;
    if (c === '\\' && i + 1 < text.length && PUNCT.test(text[i + 1]!)) { buf += text[i + 1]!; i += 2; continue; }
    if (c === '`') {
      const end = text.indexOf('`', i + 1);
      if (end > i + 1) { flush(); push(text.slice(i + 1, end), { ...base, code: true }); i = end + 1; continue; }
    }
    for (const { d, style } of DELIMS) {
      if (!text.startsWith(d, i)) continue;
      if (d[0] === '_' && i > 0 && ALNUM.test(text[i - 1]!)) continue; // snake_case и слова с подчёркиванием внутри
      const start = i + d.length;
      const end = findClose(text, d, start);
      if (end <= start || /\s/.test(text[start]!) || /\s/.test(text[end - 1]!)) continue;
      if (d[0] === '_' && end + d.length < text.length && ALNUM.test(text[end + d.length]!)) continue;
      flush();
      out.push(...inline(text.slice(start, end), { ...base, ...style }));
      i = end + d.length;
      continue scan;
    }
    if (c === '[') {
      const m = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(text.slice(i));
      if (m) {
        flush();
        out.push(...inline(m[1]!, { ...base, link: true }));
        if (m[2] !== m[1]) push(` (${m[2]})`, { ...base, fg: 'fgDim' });
        i += m[0].length;
        continue;
      }
    }
    buf += c;
    i++;
  }
  flush();
  return out;
}

/** Цвет по стилю: код и ссылка свои, жирный — `fgBright`, курсив — `accent2`, вместе — `accent`; без разметки — цвет абзаца. */
function colorOf(style: Style, base: Token | undefined): Token | undefined {
  if (style.fg) return style.fg;
  if (style.code) return 'accent';
  if (style.link) return 'info';
  if (style.bold && style.italic) return 'accent';
  if (style.italic) return 'accent2';
  if (style.bold) return 'fgBright';
  return style.strike ? 'fgDim' : base;
}

const toSegment = (ch: string, style: Style, base: Token | undefined): Segment => {
  const fg = colorOf(style, base);
  return {
    text: ch,
    ...(fg ? { fg } : {}),
    ...(style.code ? { bg: 'bgAlt' as const } : {}),
    ...(style.strike ? { strike: true } : {}),
    ...(style.link ? { underline: true } : {}),
  };
};

const sameStyle = (a: Segment, b: Segment): boolean =>
  a.fg === b.fg && a.bg === b.bg && a.strike === b.strike && a.underline === b.underline;

/** Ячейки → строка из отрезков (соседние символы одного стиля склеиваются). */
function toLine(cells: readonly Cell[], base: Token | undefined, prefix: Segment[] = []): Line {
  const segs: Segment[] = [...prefix];
  for (const cell of cells) {
    const seg = toSegment(cell.ch, cell.style, base);
    const last = segs.at(-1);
    if (last && sameStyle(last, seg) && !prefix.includes(last)) segs[segs.length - 1] = { ...last, text: last.text + seg.text };
    else segs.push(seg);
  }
  return segs;
}

/** Перенос ячеек по словам. `firstWidth` и `restWidth` — доступная ширина первой и следующих строк (отступы уже вычтены). Пробел между словами сохраняет свой стиль (подчёркивание не рвётся). */
function wrapCells(cells: readonly Cell[], firstWidth: number, restWidth: number): Cell[][] {
  const words: { cells: Cell[]; sep: Style }[] = [];
  let word: Cell[] = [];
  let sep: Style = {};
  let gap: Style | null = null;
  for (const cell of cells) {
    if (cell.ch === ' ') {
      if (word.length > 0) { words.push({ cells: word, sep }); word = []; gap = null; }
      gap ??= cell.style;
    } else {
      if (word.length === 0) sep = gap ?? {};
      word.push(cell);
    }
  }
  if (word.length > 0) words.push({ cells: word, sep });
  if (words.length === 0) return [[]];

  const lines: Cell[][] = [];
  let line: Cell[] = [];
  const limit = () => Math.max(1, lines.length === 0 ? firstWidth : restWidth);
  for (const { cells: whole, sep: space } of words) {
    let w = whole;
    while (w.length > limit()) {
      if (line.length > 0) { lines.push(line); line = []; }
      const room = limit();
      lines.push(w.slice(0, room));
      w = w.slice(room);
    }
    if (w.length === 0) continue;
    if (line.length === 0) line = [...w];
    else if (line.length + 1 + w.length <= limit()) line = [...line, { ch: ' ', style: space }, ...w];
    else { lines.push(line); line = [...w]; }
  }
  if (line.length > 0) lines.push(line);
  return lines;
}

const pad = (n: number): Segment[] => (n > 0 ? [{ text: ' '.repeat(n) }] : []);

/** Абзац с инлайн-разметкой, отступом первой строки (`marker`) и висячим отступом следующих. */
function block(text: string, width: number, base: Token | undefined, opts: { indent?: number; marker?: Segment; hang?: number; style?: Style } = {}): Line[] {
  const indent = opts.indent ?? 0;
  const markerW = opts.marker ? cellLength(opts.marker.text) : 0;
  const hang = opts.hang ?? markerW;
  const first = Math.max(1, width - indent - markerW);
  const rest = Math.max(1, width - indent - hang);
  const rows = wrapCells(inline(sanitize(text), opts.style ?? {}), first, rest);
  return rows.map((cells, i) => toLine(cells, base, [...pad(indent), ...(i === 0 && opts.marker ? [opts.marker] : pad(hang))]));
}

/** Markdown → строки TUI шириной не больше `width`. `fg` — цвет обычного текста. */
export function markdownLines(text: string, width: number, fg?: Token): Line[] {
  if (width <= 0) return [];
  const out: Line[] = [];
  let fence = false;
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (/^\s*```/.test(raw)) { fence = !fence; continue; }
    if (fence) {
      const chars = Array.from(sanitize(raw));
      const chunks = chars.length === 0 ? [[]] : Array.from({ length: Math.ceil(chars.length / width) }, (_, k) => chars.slice(k * width, (k + 1) * width));
      for (const chunk of chunks) out.push([{ text: chunk.join('') || ' ', fg: 'accent', bg: 'bgAlt' }]);
      continue;
    }
    if (raw.trim() === '') { out.push([{ text: '' }]); continue; }
    const heading = /^\s{0,3}#{1,6}\s+(.*?)\s*#*\s*$/.exec(raw);
    if (heading) { out.push(...block(heading[1]!, width, 'accent', { style: { fg: 'accent' } })); continue; }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(raw)) { out.push([{ text: '─'.repeat(width), fg: 'fgDim' }]); continue; }
    const quote = /^\s{0,3}>\s?(.*)$/.exec(raw);
    if (quote) { out.push(...block(quote[1]!, width, 'fgDim', { marker: { text: '│ ', fg: 'frame' } })); continue; }
    const item = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/.exec(raw);
    if (item) {
      const level = Math.min(3, Math.floor(item[1]!.replace(/\t/g, '  ').length / 2));
      const marker = /\d/.test(item[2]!) ? `${item[2]} ` : '• ';
      out.push(...block(item[3]!, width, fg, { indent: level * 2, marker: { text: marker, fg: 'accent' } }));
      continue;
    }
    out.push(...block(raw.trim(), width, fg));
  }
  return out;
}
