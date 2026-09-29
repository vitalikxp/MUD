import { useEffect, useRef, useState } from 'preact/hooks';
import { cellBox, useScreen } from './Screen';
import { clampOffset, layoutScroll } from './scroll';
import { Scrollbar, TextView } from './TextView';
import type { Line } from './types';

/** Управление прокруткой снаружи: родитель, у которого фокус на другом элементе, вызывает эти методы по клавишам. */
export interface ScrollApi {
  by(lines: number): void;
  /** Страница вверх (−1) или вниз (+1). */
  page(direction: 1 | -1): void;
}

/**
 * Текст, который может не поместиться по высоте: справа появляется полоса прокрутки, прокручивают колесо мыши, жест пальцем
 * и (если поле в фокусе) клавиши ↑/↓/PgUp/PgDn/Home/End. Иначе родитель ведёт прокрутку через `apiRef`.
 * `build(width)` переносит текст по ширине; при переполнении он вызывается ещё раз на ширину без столбца под полосу.
 */
export function ScrollText({ build, width, height, x = 0, y = 0, apiRef, focusable = false, focusOnMount = false, label, live = false }: {
  build: (width: number) => Line[];
  width: number;
  height: number;
  x?: number;
  y?: number;
  apiRef?: { current: ScrollApi | null };
  /** Поле получает фокус и листается клавишами. */
  focusable?: boolean;
  focusOnMount?: boolean;
  label?: string;
  live?: boolean;
}) {
  const { cellH } = useScreen();
  const [offset, setOffset] = useState(0);
  const touch = useRef<{ y: number; offset: number } | null>(null);
  const layout = layoutScroll(build, width, height);
  const total = layout.lines.length;
  const max = Math.max(0, total - height);
  const current = Math.min(offset, max);

  const by = (n: number) => setOffset(clampOffset(current + n, total, height));
  // Родитель получает актуальные методы после каждой отрисовки (замыкание видит свежий сдвиг).
  useEffect(() => {
    if (!apiRef) return;
    apiRef.current = { by, page: (d) => by(d * Math.max(1, height - 1)) };
    return () => { apiRef.current = null; };
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const page = Math.max(1, height - 1);
    if (e.key === 'ArrowDown') by(1);
    else if (e.key === 'ArrowUp') by(-1);
    else if (e.key === 'PageDown') by(page);
    else if (e.key === 'PageUp') by(-page);
    else if (e.key === 'Home') by(-total);
    else if (e.key === 'End') by(total);
    else return;
    e.preventDefault();
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex -- прокручиваемая область: колесо, жест и (в фокусе) клавиши
    <div
      class="tui-scroll-area"
      style={{ ...cellBox(x, y, width, height), ...(focusable ? { outline: 'none' } : {}) }}
      {...(focusable ? { tabIndex: 0, role: 'document', 'aria-label': label ?? '', onKeyDown } : {})}
      ref={(el) => { if (el && focusOnMount && document.activeElement !== el && !el.contains(document.activeElement)) el.focus(); }}
      onWheel={(e) => { if (max > 0) { e.preventDefault(); by(e.deltaY < 0 ? -3 : 3); } }}
      onTouchStart={(e) => { touch.current = { y: e.touches[0]!.clientY, offset: current }; }}
      onTouchMove={(e) => {
        if (!touch.current || max === 0) return;
        const dy = e.touches[0]!.clientY - touch.current.y;
        setOffset(clampOffset(touch.current.offset - Math.round(dy / cellH), total, height));
      }}
      onTouchEnd={() => { touch.current = null; }}
    >
      <TextView lines={layout.lines} width={layout.width} height={height} offset={current} anchor="top" live={live} />
      {layout.overflow ? <Scrollbar total={total} height={height} offset={max - current} x={width - 1} /> : null}
    </div>
  );
}
