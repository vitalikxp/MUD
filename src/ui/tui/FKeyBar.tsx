import { useEffect, useRef } from 'preact/hooks';
import { cssVar } from '../../theme/palettes';
import { cellBox } from './Screen';
import { fit } from './text';

export interface FKey {
  /** Номер функциональной клавиши 1–10; Alt+цифра — альтернатива (F10 → Alt+0). */
  n: number;
  label: string;
  action: () => void;
}

/** Нижняя строка F-клавиш, как в Norton Commander. Клавиши кликабельны. */
export function FKeyBar({ keys, y, cols }: { keys: readonly FKey[]; y: number; cols: number }) {
  const slot = Math.max(3, Math.floor(cols / Math.max(1, keys.length)));
  // Как в NC: подписи одной ширины (по самой длинной), дальше — пустое место до следующей клавиши.
  const labelW = Math.max(1, Math.min(slot - 3, Math.max(...keys.map((k) => Array.from(k.label).length))));
  return (
    <nav class="tui-fkeys" style={cellBox(0, y, cols, 1)} aria-label="F1–F10">
      <div class="tui-row">
        {keys.map((k) => {
          const num = String(k.n);
          return (
            <button key={k.n} type="button" class="tui-fkey" onClick={k.action} aria-keyshortcuts={`F${k.n} Alt+${k.n % 10}`}>
              <span style={{ color: cssVar('fg') }}>{num}</span>
              <span style={{ color: cssVar('selFg'), background: cssVar('selBg') }}>{fit(k.label, labelW)}</span>
              <span>{' '.repeat(Math.max(0, slot - num.length - labelW))}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** Глобальные F1–F10 и Alt+1…Alt+0. Браузер не всегда отдаёт F5/F11/F12 — поэтому есть Alt-альтернативы. */
export function useFKeys(keys: readonly FKey[], enabled = true): void {
  const latest = useRef(keys);
  latest.current = keys;
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const f = /^F(\d{1,2})$/.exec(e.key);
      let n: number | null = f ? Number(f[1]) : null;
      if (n === null && e.altKey && !e.ctrlKey && !e.metaKey && /^Digit\d$/.test(e.code)) {
        const d = Number(e.code.slice(5));
        n = d === 0 ? 10 : d;
      }
      const key = n === null ? undefined : latest.current.find((k) => k.n === n);
      if (key) {
        e.preventDefault();
        key.action();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}
