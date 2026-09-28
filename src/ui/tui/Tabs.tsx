import { cssVar } from '../../theme/palettes';
import { cellBox } from './Screen';

export interface Tab {
  id: string;
  label: string;
}

/** Нижние вкладки мобильной раскладки (вместо F-клавиш). Высота 2 строки — удобно для пальца. */
export function Tabs({ tabs, active, y, cols, onChange, extra }: {
  tabs: readonly Tab[];
  active: string;
  y: number;
  cols: number;
  onChange: (id: string) => void;
  extra?: { label: string; action: () => void; ariaLabel: string };
}) {
  const count = tabs.length + (extra ? 1 : 0);
  const slot = Math.max(3, Math.floor(cols / count));
  return (
    <div class="tui-tabs" style={cellBox(0, y, cols, 2)} role="tablist">
      {tabs.map((t, i) => {
        const isActive = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            class="tui-tab"
            style={{
              ...cellBox(i * slot, 0, slot, 2),
              color: cssVar(isActive ? 'selFg' : 'fg'),
              background: cssVar(isActive ? 'selBg' : 'bgAlt'),
            }}
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        );
      })}
      {extra ? (
        <button
          type="button"
          class="tui-tab"
          aria-label={extra.ariaLabel}
          style={{ ...cellBox(tabs.length * slot, 0, cols - tabs.length * slot, 2), color: cssVar('fg'), background: cssVar('bgAlt') }}
          onClick={extra.action}
        >
          {extra.label}
        </button>
      ) : null}
    </div>
  );
}
