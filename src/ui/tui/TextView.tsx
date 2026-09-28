import { cssVar } from '../../theme/palettes';
import { fit, wrapToWidth } from './text';
import type { Line, Paragraph, Segment } from './types';

/** Переносит абзацы по ширине; каждый абзац — свой цвет. */
export function wrapParagraphs(paragraphs: readonly Paragraph[], width: number): Line[] {
  const out: Line[] = [];
  for (const p of paragraphs) {
    for (const text of wrapToWidth(p.text, width)) out.push([p.fg ? { text, fg: p.fg } : { text }]);
  }
  return out;
}

export function Row({ line, width }: { line: Line; width?: number }) {
  let used = 0;
  const segs: Segment[] = [];
  for (const s of line) {
    const room = width === undefined ? Infinity : width - used;
    if (room <= 0) break;
    const text = Array.from(s.text).length > room ? fit(s.text, room) : s.text;
    used += Array.from(text).length;
    segs.push({ ...s, text });
  }
  return (
    <div class="tui-row">
      {segs.map((s, i) => (
        <span
          key={i}
          style={{
            ...(s.fg ? { color: cssVar(s.fg) } : {}),
            ...(s.bg ? { background: cssVar(s.bg) } : {}),
            ...(s.bold ? { fontWeight: 'bold' } : {}),
          }}
        >
          {s.text}
        </span>
      ))}
    </div>
  );
}

/**
 * Окно на список строк высотой `height`. По умолчанию прижато к низу (как лента хроники),
 * `offset` — сколько строк прокручено вверх от низа.
 */
export function TextView({ lines, width, height, offset = 0, anchor = 'bottom', live = false }: {
  lines: readonly Line[];
  width: number;
  height: number;
  offset?: number;
  anchor?: 'top' | 'bottom';
  live?: boolean;
}) {
  const end = anchor === 'bottom' ? Math.max(0, lines.length - offset) : Math.min(lines.length, offset + height);
  const start = Math.max(0, end - height);
  const visible = lines.slice(start, end);
  return (
    <div class="tui-text" aria-live={live ? 'polite' : undefined} role={live ? 'log' : undefined}>
      {visible.map((line, i) => (
        <Row key={start + i} line={line} width={width} />
      ))}
    </div>
  );
}
