import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { Panel } from './Panel';
import { cellBox, useScreen } from './Screen';

/** Модальное окно по центру сетки: двойная рамка и тень на 1 ячейку вправо-вниз. Esc закрывает. */
export function Dialog({ title, w, h, onClose, children }: {
  title: string;
  w: number;
  h: number;
  onClose: () => void;
  children?: ComponentChildren;
}) {
  const { cols, rows } = useScreen();
  const width = Math.min(w, cols - 2);
  const height = Math.min(h, rows - 2);
  const x = Math.max(0, Math.floor((cols - width) / 2));
  const y = Math.max(0, Math.floor((rows - height) / 2));
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<Element | null>(null);

  useEffect(() => {
    previous.current = document.activeElement;
    ref.current?.focus();
    return () => (previous.current as HTMLElement | null)?.focus?.();
  }, []);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc закрывает модальное окно (паттерн WAI-ARIA dialog)
    <div
      ref={ref}
      class="tui-dialog"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- клик вне окна закрывает его; с клавиатуры — Esc */}
      <div class="tui-dialog-backdrop" onMouseDown={onClose} />
      <div class="tui-shadow" style={cellBox(x + 1, y + 1, width, height)} />
      <Panel x={x} y={y} w={width} h={height} title={title} active>
        {children}
      </Panel>
    </div>
  );
}
