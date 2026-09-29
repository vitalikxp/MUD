import { useEffect, useRef } from 'preact/hooks';
import { snapToCell } from './cursor';
import { useScreen } from './Screen';

/**
 * Курсор мыши-блок, как в DOS: клетка сетки с инверсией цветов под ней (mix-blend-mode: difference),
 * поэтому подходит любой палитре. Обычный курсор скрывается только после первого движения мыши — без JS и на
 * сенсорных экранах остаётся системный. Позиция пишется прямо в DOM, без перерисовки Preact.
 */
export function MouseCursor({ screenRef }: { screenRef: { current: HTMLElement | null } }) {
  const info = useScreen();
  const el = useRef<HTMLDivElement>(null);
  const size = useRef(info);
  size.current = info;

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    const screen = screenRef.current;
    const cursor = el.current;
    if (!screen || !cursor) return;

    const hide = () => {
      cursor.style.display = 'none';
      screen.classList.remove('has-mouse-cursor');
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return hide();
      const { cellW, cellH, cols, rows } = size.current;
      const cell = snapToCell(e.clientX, e.clientY, screen.getBoundingClientRect(), cellW, cellH, cols, rows);
      if (!cell) return hide();
      cursor.style.display = 'block';
      cursor.style.transform = `translate(${cell.col * cellW}px, ${cell.row * cellH}px)`;
      screen.classList.add('has-mouse-cursor');
    };
    const onDown = () => cursor.classList.add('is-pressed');
    const onUp = () => cursor.classList.remove('is-pressed');

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    document.documentElement.addEventListener('pointerleave', hide);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.removeEventListener('pointerleave', hide);
      hide();
    };
  }, [screenRef]);

  return <div ref={el} class="tui-mouse-cursor" aria-hidden="true" style={{ width: `${info.cellW}px`, height: `${info.cellH}px`, display: 'none' }} />;
}
