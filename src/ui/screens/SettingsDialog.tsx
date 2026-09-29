import { signal } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import * as llm from '../../app/llm';
import { locale, t, type Key, type Locale } from '../../i18n';
import { checkProvider, type CheckStep } from '../../llm/check';
import { CUSTOM, OPENCODE_GO } from '../../llm/presets';
import type { ApiFormat } from '../../llm/types';
import { Dialog } from '../tui/Dialog';
import { ModelPickerDialog } from './ModelPickerDialog';
import { useFKeys, type FKey } from '../tui/FKeyBar';
import { Form, type Field } from '../tui/Form';
import { useScreen } from '../tui/Screen';
import { ScrollText, type ScrollApi } from '../tui/ScrollText';
import { wrapParagraphs } from '../tui/TextView';
import type { Paragraph } from '../tui/types';

type CheckState = { status: 'idle' } | { status: 'running' } | { status: 'done'; steps: CheckStep[] } | { status: 'blocked' };
const checkState = signal<CheckState>({ status: 'idle' });

async function runCheck(): Promise<void> {
  if (llm.problems.value.length > 0) {
    checkState.value = { status: 'blocked' };
    return;
  }
  checkState.value = { status: 'running' };
  const role = llm.dmRole.value;
  const target = { model: role.model, maxOutputTokens: role.maxOutputTokens, ...(role.effort ? { effort: role.effort } : {}) };
  checkState.value = { status: 'done', steps: await checkProvider(llm.providerConfig(), target) };
}

function stepLines(steps: readonly CheckStep[]): Paragraph[] {
  const out: Paragraph[] = [];
  for (const s of steps) {
    const extra = s.count !== undefined ? ` (${t('check.deltas', { count: s.count })})` : '';
    out.push({ text: `${s.ok ? '✓' : '×'} ${t(`check.${s.id}`)}: ${s.ok ? t('check.ok') : t('check.fail')}${extra}`, fg: s.ok ? 'success' : 'failure' });
    if (!s.ok) {
      const reason = s.id === 'tools' && !s.kind ? t('check.noTools') : s.kind === 'other' && s.message ? s.message : t(`errors.${s.kind ?? 'other'}`);
      out.push({ text: `→ ${reason}`, fg: 'warning' });
    }
  }
  out.push({ text: '' });
  out.push(steps.every((s) => s.ok) ? { text: t('check.done'), fg: 'success' } : { text: t('check.partial'), fg: 'warning' });
  return out;
}

/**
 * Настройки LLM во всплывающем окне (F4, `/settings`).
 * `gate` — первый запуск без настроек: окно единственное на экране, закрыть его нельзя, пока не выбрано «Начать игру».
 */
export function SettingsDialog({ gate, onClose, onStart }: { gate: boolean; onClose: () => void; onStart: () => void }) {
  const { cols, rows } = useScreen();
  const formRef = useRef<HTMLDivElement>(null);
  const notesRef = useRef<ScrollApi | null>(null);
  const [picking, setPicking] = useState(false);
  useEffect(() => { formRef.current?.focus(); }, []);
  useEffect(() => { checkState.value = { status: 'idle' }; }, []);

  const custom = llm.provider.value.id === CUSTOM.id;
  const start = () => {
    if (llm.problems.value.length > 0) checkState.value = { status: 'blocked' };
    else onStart();
  };
  const fields: Field[] = [
    { id: 'lang', label: t('settings.lang'), kind: 'choice', value: locale.value,
      options: [{ value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }],
      onChange: (v) => { locale.value = v as Locale; } },
    { id: 'provider', label: t('settings.provider'), kind: 'choice', value: llm.providerId.value,
      options: [OPENCODE_GO, CUSTOM].map((p) => ({ value: p.id, label: t(`providers.${p.id}` as Key) })),
      onChange: (v) => { llm.providerId.value = v; } },
    ...(custom
      ? ([
          { id: 'baseUrl', label: t('settings.baseUrl'), kind: 'text', value: llm.customBaseUrl.value, placeholder: 'https://…/v1', onChange: (v: string) => { llm.customBaseUrl.value = v; } },
          { id: 'model', label: t('settings.model'), kind: 'text', value: llm.customModel.value, onChange: (v: string) => { llm.customModel.value = v; } },
          { id: 'format', label: t('settings.format'), kind: 'choice', value: llm.customFormat.value,
            options: (['chat', 'responses', 'messages'] as const).map((f) => ({ value: f, label: t(`formats.${f}`) })),
            onChange: (v: string) => { llm.customFormat.value = v as ApiFormat; } },
        ] satisfies Field[])
      : ([
          { id: 'preset', label: t('settings.preset'), kind: 'choice', value: llm.presetId.value,
            options: OPENCODE_GO.presets.map((p) => ({ value: p.id, label: t(`presets.${p.id}`) })),
            onChange: (v: string) => { llm.presetId.value = v as typeof llm.presetId.value; llm.modelOverride.value = ''; } },
          { id: 'modelPick', label: t('settings.modelPick'), kind: 'pick', value: llm.dmModel.value, onPick: () => setPicking(true) },
        ] satisfies Field[])),
    ...(llm.trainsOnData.value
      ? ([{ id: 'ack', label: t('settings.ack'), kind: 'toggle', value: llm.trainsAck.value, yes: t('settings.ackYes'), no: t('settings.ackNo'), onChange: (v: boolean) => { llm.trainsAck.value = v; } }] satisfies Field[])
      : []),
    { id: 'key', label: t('settings.key'), kind: 'text', value: llm.apiKey.value, secret: true, placeholder: t('settings.keyEmpty'), onChange: (v) => { llm.apiKey.value = v; } },
    { id: 'remember', label: t('settings.remember'), kind: 'toggle', value: llm.remember.value, yes: t('settings.rememberYes'), no: t('settings.rememberNo'), onChange: (v) => { llm.remember.value = v; } },
    { id: 'relay', label: t('settings.relay'), kind: 'choice', value: llm.relayMode.value,
      options: (['default', 'custom', 'direct'] as const).map((m) => ({ value: m, label: t(`relayModes.${m}`) })),
      onChange: (v) => { llm.relayMode.value = v as llm.RelayMode; } },
    ...(llm.relayMode.value === 'custom'
      ? ([{ id: 'relayUrl', label: t('settings.relayUrl'), kind: 'text', value: llm.relayUrl.value, placeholder: t('settings.relayUrlEmpty'), onChange: (v: string) => { llm.relayUrl.value = v; } }] satisfies Field[])
      : []),
    { id: 'check', label: t('settings.check'), kind: 'action', onRun: () => { void runCheck(); } },
    ...(gate ? ([{ id: 'start', label: t('settings.start'), kind: 'action', onRun: start }] satisfies Field[]) : []),
  ];

  useFKeys([{ n: 6, label: t('fkeys.check'), action: () => { void runCheck(); } } satisfies FKey]);

  const w = Math.min(cols - 2, 84);
  const h = Math.min(rows - 2, 32);
  const bodyW = w - 2;
  const formH = fields.length;
  const notes: Paragraph[] = gate ? [{ text: t('settings.firstRun'), fg: 'accent' }, { text: '' }] : [];
  notes.push({ text: t(gate ? 'settings.hintFirst' : 'settings.hint'), fg: 'fgDim' });
  if (llm.trainsOnData.value) notes.push({ text: t('settings.noteTrains'), fg: 'warning' });
  if (llm.provider.value.notice === 'opencode-terms') notes.push({ text: t('settings.noteTerms'), fg: 'warning' });
  notes.push({ text: t('settings.noteKey'), fg: 'fgDim' });
  if (llm.provider.value.needsRelay) notes.push({ text: t('settings.noteRelay'), fg: 'fgDim' });
  notes.push({ text: '' });

  const cs = checkState.value;
  if (cs.status === 'running') notes.push({ text: t('check.running'), fg: 'info' });
  else if (cs.status === 'blocked') notes.push({ text: t('check.fixFirst', { problems: llm.problems.value.map((p) => t(`problems.${p}` as Key)).join(', ') }), fg: 'warning' });
  else if (cs.status === 'done') notes.push(...stepLines(cs.steps));

  return (
    <>
    <Dialog title={t('panels.settings')} w={w} h={h} onClose={onClose} separators={[formH + 1]}>
      {/* PgUp/PgDn листают заметки под формой (фокус остаётся на форме). */}
      {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- перехват PgUp/PgDn до формы */}
      <div onKeyDownCapture={(e) => {
        if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
        notesRef.current?.page(e.key === 'PageUp' ? -1 : 1);
        e.preventDefault();
        e.stopPropagation();
      }}>
        <Form fields={fields} width={bodyW} label={t('panels.settings')} formRef={formRef} />
        <ScrollText apiRef={notesRef} y={formH + 1} width={bodyW} height={Math.max(1, h - 2 - formH - 1)} live
          build={(width) => wrapParagraphs(notes, width)} />
      </div>
    </Dialog>
    {picking ? <ModelPickerDialog onClose={() => setPicking(false)} /> : null}
    </>
  );
}
