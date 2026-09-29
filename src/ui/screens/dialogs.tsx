import { useEffect, useRef, useState } from 'preact/hooks';
import { paletteId } from '../../app/settings';
import * as llm from '../../app/llm';
import { locale, t, tList } from '../../i18n';
import { formatSeconds, formatTokens } from '../../app/statusLine';
import { lastUsage } from '../../app/master';
import { getPalette, PALETTES } from '../../theme/palettes';
import { Dialog } from '../tui/Dialog';
import { Menu } from '../tui/Menu';
import { useScreen } from '../tui/Screen';
import { ScrollText } from '../tui/ScrollText';
import { wrapParagraphs } from '../tui/TextView';
import type { Paragraph } from '../tui/types';
import { setPalette } from '../../app/chronicle';

/** Справка (F1). */
export function HelpDialog({ onClose }: { onClose: () => void }) {
  const { cols, rows } = useScreen();
  const lines = tList('help.lines');
  const w = Math.min(cols - 2, Math.max(...lines.map((l) => Array.from(l).length)) + 4);
  const textH = Math.max(1, Math.min(lines.length, rows - 4));
  return (
    <Dialog title={t('help.title')} w={w} h={textH + 2} onClose={onClose}>
      <ScrollText focusable focusOnMount label={t('help.title')} width={w - 2} height={textH}
        build={(width) => wrapParagraphs(lines.map((text) => ({ text })), width)} />
    </Dialog>
  );
}

/**
 * Палитры (F8). ↑/↓ сразу показывают палитру (предпросмотр), Enter или клик подтверждают,
 * Esc и клик мимо возвращают прежнюю.
 */
export function PaletteDialog({ onClose }: { onClose: () => void }) {
  const original = useRef(paletteId.value);
  const confirmed = useRef(false);
  const [sel, setSel] = useState(Math.max(0, PALETTES.findIndex((p) => p.id === paletteId.value)));
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    menuRef.current?.focus();
    // Любое закрытие, кроме подтверждения (Esc, клик мимо, та же F-клавиша, переход к другому окну), возвращает прежнюю палитру.
    const before = original.current;
    return () => { if (!confirmed.current) paletteId.value = before; };
  }, []);
  const w = 34;
  const h = PALETTES.length + 2;
  const items = PALETTES.map((p) => ({ id: p.id, label: p.name[locale.value], hint: p.id === paletteId.value ? '•' : ' ' }));
  return (
    <Dialog title={t('panels.palettes')} w={w} h={h} onClose={onClose}>
      <Menu items={items} selected={sel} width={w - 2} height={h - 2} label={t('panels.palettes')} menuRef={menuRef}
        onSelect={(i) => { setSel(i); paletteId.value = PALETTES[i]!.id; }}
        onChoose={(i) => {
          const id = PALETTES[i]!.id;
          confirmed.current = true;
          if (id !== original.current) setPalette(id); // применяет и пишет в хронику
          else paletteId.value = id;
          onClose();
        }} />
    </Dialog>
  );
}

/** Состояние (F7): сетка, раскладка, настройки, LLM. */
export function StatusDialog({ onClose }: { onClose: () => void }) {
  const { cols, rows, cellW, cellH, mobile } = useScreen();
  const palette = getPalette(paletteId.value);
  const usage = lastUsage.value;
  const lines: Paragraph[] = [
    { text: `${t('status.grid')}: ${cols}×${rows}` },
    { text: `${t('status.cell')}: ${cellW}×${cellH} px` },
    { text: `${t('status.layout')}: ${t(mobile ? 'status.mobile' : 'status.desktop')}` },
    { text: `${t('status.palette')}: ${palette.name[locale.value]}`, fg: 'accent' },
    { text: `${t('status.lang')}: ${locale.value.toUpperCase()}` },
    { text: '' },
    { text: `${t('status.llm')}: ${llm.dmModel.value || '—'} (${llm.providerConfig().format})` },
    { text: `${t('status.relay')}: ${llm.effectiveRelay.value || t('relayModes.direct')}` },
    { text: usage ? `${t('status.last')}: ↑${formatTokens(usage.inputTokens)} ↓${formatTokens(usage.outputTokens)} · ${formatSeconds(usage.ms)}` : `${t('status.last')}: —` },
  ];
  const w = Math.min(cols - 2, 56);
  const textH = Math.max(1, Math.min(wrapParagraphs(lines, w - 2).length, rows - 4));
  return (
    <Dialog title={t('panels.status')} w={w} h={textH + 2} onClose={onClose}>
      <ScrollText focusable focusOnMount label={t('panels.status')} width={w - 2} height={textH} build={(width) => wrapParagraphs(lines, width)} />
    </Dialog>
  );
}
