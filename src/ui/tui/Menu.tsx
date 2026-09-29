import { useEffect, useRef } from 'preact/hooks';
import { cssVar } from '../../theme/palettes';
import { Scrollbar } from './TextView';
import { fit } from './text';

export interface MenuItem {
  id: string;
  label: string;
  hint?: string;
}

/**
 * Вертикальное меню: ↑/↓/Home/End — выбор, Enter или клик — действие, колесо мыши сдвигает выбор.
 * Прокручивается под выделение; когда пунктов больше, чем строк, справа рисуется полоса прокрутки.
 */
export function Menu({ items, selected, width, height, label, onSelect, onChoose, menuRef }: {
  items: readonly MenuItem[];
  selected: number;
  width: number;
  height: number;
  label: string;
  onSelect: (index: number) => void;
  onChoose: (index: number) => void;
  menuRef?: { current: HTMLDivElement | null };
}) {
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = menuRef ?? ownRef;
  // Прокрутка без состояния: окно сдвигается так, чтобы выделенный пункт был виден.
  const first = Math.min(Math.max(0, selected - height + 1), Math.max(0, items.length - height));
  const visible = items.slice(first, first + height);
  const overflow = items.length > height;
  const textW = overflow ? width - 1 : width; // последний столбец — под полосу прокрутки

  useEffect(() => {
    ref.current?.setAttribute('aria-activedescendant', `menu-item-${items[selected]?.id ?? ''}`);
  }, [selected, items, ref]);

  const onKeyDown = (e: KeyboardEvent) => {
    const last = items.length - 1;
    const next =
      e.key === 'ArrowDown' ? Math.min(last, selected + 1)
      : e.key === 'ArrowUp' ? Math.max(0, selected - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? last
      : e.key === 'PageDown' ? Math.min(last, selected + height)
      : e.key === 'PageUp' ? Math.max(0, selected - height)
      : null;
    if (next !== null) {
      onSelect(next);
      e.preventDefault();
    } else if (e.key === 'Enter' || e.key === ' ') {
      onChoose(selected);
      e.preventDefault();
    }
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- колесо мыши двигает выбор, клавиатура — на этом же listbox
    <div ref={ref} class="tui-menu" role="listbox" aria-label={label} tabIndex={0} onKeyDown={onKeyDown} style={{ position: 'relative' }}
      onWheel={(e) => { if (overflow) { e.preventDefault(); onSelect(Math.min(items.length - 1, Math.max(0, selected + (e.deltaY < 0 ? -3 : 3)))); } }}>
      {visible.map((item, i) => {
        const index = first + i;
        const isSel = index === selected;
        const hint = item.hint ? ` ${item.hint}` : '';
        const text = fit(`${item.label}`, Math.max(0, textW - Array.from(hint).length)) + hint;
        return (
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- клавиатура обрабатывается на listbox (aria-activedescendant)
          <div
            key={item.id}
            id={`menu-item-${item.id}`}
            role="option"
            tabIndex={-1}
            aria-selected={isSel}
            class="tui-row"
            style={isSel ? { background: cssVar('selBg'), color: cssVar('selFg') } : undefined}
            onMouseDown={(e) => { e.preventDefault(); onSelect(index); ref.current?.focus(); }}
            onClick={() => onChoose(index)}
          >
            {fit(text, textW)}
          </div>
        );
      })}
      {overflow ? <Scrollbar total={items.length} height={height} offset={items.length - height - first} x={width - 1} /> : null}
    </div>
  );
}
