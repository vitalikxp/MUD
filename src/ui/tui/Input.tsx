import { useRef, useState } from 'preact/hooks';
import { cssVar } from '../../theme/palettes';
import { cellBox } from './Screen';
import { sanitize } from './text';

/**
 * Строка ввода с курсором-блоком. Под видимой строкой лежит настоящий <input>
 * (прозрачный): он даёт IME, экранную клавиатуру на телефоне и доступность.
 * История — стрелки ↑/↓.
 */
export function Input({ x, y, w, prompt, placeholder, label, onSubmit, inputRef, initial = '', allowEmpty = false, mask = false, onCancel, focusOnMount = false }: {
  x: number; y: number; w: number;
  prompt: string;
  placeholder: string;
  label: string;
  onSubmit: (text: string) => void;
  inputRef?: { current: HTMLInputElement | null };
  initial?: string;
  /** Разрешить отправку пустой строки (очистка поля в форме). */
  allowEmpty?: boolean;
  /** Показывать вместо символов «•» (ключи). */
  mask?: boolean;
  onCancel?: () => void;
  focusOnMount?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [focused, setFocused] = useState(false);
  const history = useRef<string[]>([]);
  const cursor = useRef(-1);
  const ownRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? ownRef;

  const room = Math.max(1, w - Array.from(prompt).length - 2);
  const chars = Array.from(mask ? '•'.repeat(Array.from(value).length) : sanitize(value));
  const shown = chars.slice(Math.max(0, chars.length - room)).join('');

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const text = value.trim();
      if (text || allowEmpty) {
        onSubmit(text);
        history.current.push(text);
      }
      cursor.current = -1;
      setValue('');
      e.preventDefault();
      e.stopPropagation();
    } else if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'ArrowUp' && history.current.length) {
      cursor.current = cursor.current < 0 ? history.current.length - 1 : Math.max(0, cursor.current - 1);
      setValue(history.current[cursor.current] ?? '');
      e.preventDefault();
    } else if (e.key === 'ArrowDown' && cursor.current >= 0) {
      cursor.current += 1;
      setValue(cursor.current >= history.current.length ? '' : (history.current[cursor.current] ?? ''));
      if (cursor.current >= history.current.length) cursor.current = -1;
      e.preventDefault();
    }
  };

  return (
    <div class="tui-input" style={cellBox(x, y, w, 1)}>
      <div class="tui-row" aria-hidden="true">
        <span style={{ color: cssVar('player') }}>{prompt} </span>
        {value ? <span>{shown}</span> : !focused ? <span style={{ color: cssVar('fgDim') }}>{placeholder.slice(0, room)}</span> : null}
        <span class={focused ? 'tui-cursor' : undefined} style={{ color: cssVar('cursor') }}>{focused ? '█' : ''}</span>
      </div>
      <input
        class="tui-native-input"
        aria-label={label}
        autocomplete="off"
        spellcheck={false}
        value={value}
        onInput={(e) => setValue((e.target as HTMLInputElement).value)}
        onKeyDown={onKeyDown}
        ref={(el) => { ref.current = el; if (el && focusOnMount && document.activeElement !== el) el.focus(); }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}
