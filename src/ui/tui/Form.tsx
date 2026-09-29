import { useRef, useState } from 'preact/hooks';
import { cssVar } from '../../theme/palettes';
import { Input } from './Input';
import { fit } from './text';

export type Field =
  | { id: string; label: string; kind: 'choice'; value: string; options: readonly { value: string; label: string }[]; onChange: (v: string) => void }
  | { id: string; label: string; kind: 'text'; value: string; secret?: boolean; placeholder?: string; onChange: (v: string) => void }
  | { id: string; label: string; kind: 'toggle'; value: boolean; yes: string; no: string; onChange: (v: boolean) => void }
  | { id: string; label: string; kind: 'pick'; value: string; onPick: () => void }
  | { id: string; label: string; kind: 'action'; onRun: () => void };

function display(f: Field): string {
  switch (f.kind) {
    case 'choice': return f.options.find((o) => o.value === f.value)?.label ?? f.value;
    case 'text': {
      if (!f.value) return f.placeholder ?? '';
      const chars = Array.from(f.value);
      return f.secret ? '•'.repeat(Math.min(12, chars.length)) + chars.slice(-4).join('') : f.value;
    }
    case 'toggle': return f.value ? `[x] ${f.yes}` : `[ ] ${f.no}`;
    case 'pick': return `${f.value} …`;
    case 'action': return '';
  }
}

/**
 * Форма из строк «Название  значение». ↑/↓ — выбор поля, ←/→ или Enter — смена значения,
 * Enter на текстовом поле открывает редактирование прямо в строке, Esc отменяет.
 */
export function Form({ fields, width, label, formRef }: {
  fields: readonly Field[];
  width: number;
  label: string;
  formRef?: { current: HTMLDivElement | null };
}) {
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(false);
  const ownRef = useRef<HTMLDivElement>(null);
  const ref = formRef ?? ownRef;
  const current = fields[Math.min(sel, fields.length - 1)];
  const labelW = Math.min(Math.floor(width * 0.4), Math.max(...fields.map((f) => Array.from(f.label).length)) + 2);

  const step = (f: Field, dir: 1 | -1) => {
    if (f.kind === 'choice') {
      const i = f.options.findIndex((o) => o.value === f.value);
      f.onChange(f.options[(i + dir + f.options.length) % f.options.length]!.value);
    } else if (f.kind === 'toggle') f.onChange(!f.value);
  };
  const activate = (f: Field) => {
    if (f.kind === 'text') setEditing(true);
    else if (f.kind === 'action') f.onRun();
    else if (f.kind === 'pick') f.onPick();
    else step(f, 1);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    // События вложенного поля ввода не наши: к моменту всплытия форма уже могла перерисоваться с editing=false.
    if (editing || !current || (e.target as HTMLElement).classList.contains('tui-native-input')) return;
    const last = fields.length - 1;
    if (e.key === 'ArrowDown') setSel(Math.min(last, sel + 1));
    else if (e.key === 'ArrowUp') setSel(Math.max(0, sel - 1));
    else if (e.key === 'ArrowRight') step(current, 1);
    else if (e.key === 'ArrowLeft') step(current, -1);
    else if (e.key === 'Enter' || e.key === ' ') activate(current);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={ref} class="tui-form" role="menu" aria-label={label} tabIndex={0} onKeyDown={onKeyDown}>
      {fields.map((f, i) => {
        const isSel = i === sel;
        const isEditing = isSel && editing && f.kind === 'text';
        const valueW = width - labelW;
        return (
          // oxlint-disable-next-line jsx-a11y/click-events-have-key-events -- клавиатура обрабатывается на меню (↑↓ Enter)
          <div key={f.id} role="menuitem" tabIndex={-1} class="tui-row" style={{ position: 'relative', ...(isSel && !isEditing ? { background: cssVar('selBg'), color: cssVar('selFg') } : {}) }}
            onMouseDown={(e) => { e.preventDefault(); setSel(i); ref.current?.focus(); }}
            onClick={() => { setSel(i); activate(f); }}>
            <span style={isSel && !isEditing ? undefined : { color: cssVar('fgDim') }}>{fit(f.kind === 'action' ? '' : f.label, labelW)}</span>
            {isEditing && f.kind === 'text' ? (
              <Input x={labelW} y={0} w={valueW} prompt="" placeholder="" label={f.label} initial={f.value} allowEmpty mask={!!f.secret} focusOnMount
                onSubmit={(v) => { f.onChange(v.trim()); setEditing(false); queueMicrotask(() => ref.current?.focus()); }}
                onCancel={() => { setEditing(false); queueMicrotask(() => ref.current?.focus()); }} />
            ) : (
              <span style={isSel ? undefined : { color: cssVar(f.kind === 'action' ? 'accent' : 'fg') }}>
                {f.kind === 'action' ? fit(`[ ${f.label} ]`, valueW) : fit(display(f), valueW)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
