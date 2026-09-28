import type { ComponentChildren } from 'preact';
import { cssVar } from '../../theme/palettes';
import { cellBox } from './Screen';
import { frame, sanitize, separator } from './text';

/**
 * Панель в рамке. Неактивная — одинарная рамка, активная — двойная (как в Norton Commander).
 * Содержимое занимает внутреннюю область `(w-2) × (h-2)` ячеек.
 */
export function Panel({ x, y, w, h, title, active = false, onActivate, children, id, separators = [] }: {
  x: number; y: number; w: number; h: number;
  title?: string;
  /** Номера строк панели (1…h-2), где рамку пересекает горизонтальный разделитель. */
  separators?: readonly number[];
  active?: boolean;
  onActivate?: () => void;
  children?: ComponentChildren;
  id?: string;
}) {
  if (w < 2 || h < 2) return null;
  const style = active ? 'double' : 'single';
  const rows = frame(w, h, style, title ? { title } : {});
  for (const r of separators) if (r > 0 && r < h - 1) rows[r] = separator(w, style);
  const top = rows[0]!;
  const label = title ? sanitize(title) : '';
  const titleStart = top.indexOf('[ ');
  const titleEnd = titleStart >= 0 ? top.indexOf(' ]', titleStart) : -1;

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- клик мышью активирует панель; с клавиатуры это делает Tab
    <section
      id={id}
      class={`tui-panel${active ? ' is-active' : ''}`}
      style={{ ...cellBox(x, y, w, h), background: cssVar('bgPanel') }}
      aria-label={label || undefined}
      onMouseDown={onActivate}
    >
      <div class="tui-frame" aria-hidden="true" style={{ color: cssVar(active ? 'frameActive' : 'frame') }}>
        <div class="tui-row">
          {titleStart >= 0 && titleEnd > titleStart ? (
            <>
              {top.slice(0, titleStart + 2)}
              <span style={{ color: cssVar(active ? 'selFg' : 'title'), background: active ? cssVar('selBg') : undefined }}>
                {top.slice(titleStart + 2, titleEnd)}
              </span>
              {top.slice(titleEnd)}
            </>
          ) : (
            top
          )}
        </div>
        {rows.slice(1).map((r, i) => (
          <div class="tui-row" key={i}>{r}</div>
        ))}
      </div>
      <div class="tui-panel-body" style={cellBox(1, 1, w - 2, h - 2)}>
        {children}
      </div>
    </section>
  );
}
