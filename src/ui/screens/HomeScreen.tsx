import { signal, useSignalEffect } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { parseCommand } from '../../app/commands';
import { navigate } from '../../app/router';
import { fontId, paletteId } from '../../app/settings';
import { locale, t, tList, type Key } from '../../i18n';
import type { FontId } from '../../theme/fonts';
import { getPalette, PALETTES, type Token } from '../../theme/palettes';
import { Dialog } from '../tui/Dialog';
import { FKeyBar, useFKeys, type FKey } from '../tui/FKeyBar';
import { Input } from '../tui/Input';
import { Menu } from '../tui/Menu';
import { Panel } from '../tui/Panel';
import type { ScreenInfo } from '../tui/Screen';
import { Tabs } from '../tui/Tabs';
import { TextView, wrapParagraphs } from '../tui/TextView';
import type { Paragraph } from '../tui/types';

/** Запись хроники: либо ключ словаря (перерисуется при смене языка), либо готовый текст. */
type Entry = { key: Key; params?: Record<string, string>; fg: Token } | { text: string; fg: Token };

const INTRO: Entry[] = [
  { key: 'intro.p1', fg: 'dm' },
  { text: '', fg: 'dm' },
  { key: 'intro.p2', fg: 'dm' },
  { text: '', fg: 'dm' },
  { key: 'intro.roll', fg: 'success' },
  { text: '', fg: 'dm' },
  { key: 'intro.p3', fg: 'accent' },
];

const chronicle = signal<Entry[]>(INTRO);
type PanelId = 'chronicle' | 'palettes' | 'status';
const ORDER: PanelId[] = ['chronicle', 'palettes', 'status'];

function push(...entries: Entry[]): void {
  chronicle.value = [...chronicle.value, { text: '', fg: 'dm' }, ...entries];
}

function setPalette(id: string): void {
  paletteId.value = id;
  push({ key: 'msg.palette', params: { name: getPalette(id).name[locale.value] }, fg: 'system' });
}

function setFont(id: FontId): void {
  fontId.value = id;
  push({ key: 'msg.font', params: { name: t(`fonts.${id}`) }, fg: 'system' });
}

function setLang(next: 'ru' | 'en'): void {
  locale.value = next;
  push({ key: 'msg.lang', fg: 'system' });
}

export function HomeScreen({ screen }: { screen: ScreenInfo }) {
  const { cols, rows, mobile } = screen;
  const [active, setActive] = useState<PanelId>('chronicle');
  const [helpOpen, setHelpOpen] = useState(false);
  const palIndex = PALETTES.findIndex((p) => p.id === paletteId.value);
  const [menuSel, setMenuSel] = useState(Math.max(0, palIndex));
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const loc = locale.value;

  const focusPanel = (id: PanelId) => {
    setActive(id);
    queueMicrotask(() => (id === 'chronicle' ? inputRef.current : id === 'palettes' ? menuRef.current : null)?.focus());
  };


  const onSubmit = (text: string) => {
    const cmd = parseCommand(text, PALETTES.map((p) => p.id));
    switch (cmd.kind) {
      case 'say': push({ text: `${t('input.prompt')} ${cmd.text}`, fg: 'player' }); break;
      case 'help': setHelpOpen(true); break;
      case 'palette': setPalette(cmd.id); break;
      case 'lang': setLang(cmd.locale); break;
      case 'font': setFont(cmd.font); break;
      case 'glyphs': navigate('glyphs'); break;
      case 'unknown': push({ key: 'msg.unknown', params: { cmd: cmd.raw }, fg: 'warning' }); break;
    }
  };

  const fkeys: FKey[] = [
    { n: 1, label: t('fkeys.help'), action: () => setHelpOpen(true) },
    { n: 2, label: t('fkeys.lang'), action: () => setLang(locale.value === 'ru' ? 'en' : 'ru') },
    { n: 3, label: t('fkeys.font'), action: () => setFont(fontId.value === 'pxplus' ? 'jetbrains' : 'pxplus') },
    { n: 8, label: t('fkeys.palette'), action: () => focusPanel('palettes') },
    { n: 9, label: t('fkeys.glyphs'), action: () => navigate('glyphs') },
  ];
  useFKeys(fkeys, !helpOpen);

  // Tab / Shift+Tab — смена активной панели, как в Norton Commander.
  useEffect(() => {
    if (helpOpen || mobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const i = ORDER.indexOf(active);
      focusPanel(ORDER[(i + (e.shiftKey ? ORDER.length - 1 : 1)) % ORDER.length]!);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, helpOpen, mobile]);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useSignalEffect(() => { setMenuSel(Math.max(0, PALETTES.findIndex((p) => p.id === paletteId.value))); });

  const paragraphs: Paragraph[] = chronicle.value.map((e) => ({
    text: 'key' in e ? t(e.key, e.params ?? {}) : e.text,
    fg: e.fg,
  }));

  const palette = getPalette(paletteId.value);
  const statusLines: Paragraph[] = [
    { text: `${t('status.grid')}: ${cols}×${rows}` },
    { text: `${t('status.cell')}: ${screen.cellW}×${screen.cellH} px` },
    { text: `${t('status.scale')}: ×${screen.scale}` },
    { text: `${t('status.layout')}: ${t(mobile ? 'status.mobile' : 'status.desktop')}` },
    { text: `${t('status.palette')}: ${palette.name[loc]}`, fg: 'accent' },
    { text: `${t('status.font')}: ${t(`fonts.${fontId.value}`)}` },
    { text: `${t('status.lang')}: ${loc.toUpperCase()}` },
  ];
  const menuItems = PALETTES.map((p) => ({ id: p.id, label: p.name[loc], hint: p.id === paletteId.value ? '•' : ' ' }));

  const chroniclePanel = (x: number, y: number, w: number, h: number) => {
    const bodyW = w - 2;
    const textH = Math.max(1, h - 4);
    return (
      <Panel x={x} y={y} w={w} h={h} title={t('panels.chronicle')} active={active === 'chronicle'} separators={[h - 3]}
        onActivate={() => focusPanel('chronicle')} id="panel-chronicle">
        <TextView lines={wrapParagraphs(paragraphs, bodyW)} width={bodyW} height={textH} live />
        <Input x={0} y={h - 3} w={bodyW} prompt={t('input.prompt')} placeholder={t('input.placeholder')}
          label={t('input.placeholder')} onSubmit={onSubmit} inputRef={inputRef} />
      </Panel>
    );
  };
  const palettesPanel = (x: number, y: number, w: number, h: number) => (
    <Panel x={x} y={y} w={w} h={h} title={t('panels.palettes')} active={active === 'palettes'}
      onActivate={() => focusPanel('palettes')} id="panel-palettes">
      <Menu items={menuItems} selected={menuSel} width={w - 2} height={h - 2} label={t('panels.palettes')}
        onSelect={setMenuSel} onChoose={(i) => setPalette(PALETTES[i]!.id)} menuRef={menuRef} />
    </Panel>
  );
  const statusPanel = (x: number, y: number, w: number, h: number) => (
    <Panel x={x} y={y} w={w} h={h} title={t('panels.status')} active={active === 'status'}
      onActivate={() => setActive('status')} id="panel-status">
      <TextView lines={wrapParagraphs(statusLines, w - 2)} width={w - 2} height={h - 2} anchor="top" />
    </Panel>
  );

  let body;
  if (mobile) {
    const h = rows - 2;
    body = (
      <>
        {active === 'chronicle' && chroniclePanel(0, 0, cols, h)}
        {active === 'palettes' && palettesPanel(0, 0, cols, h)}
        {active === 'status' && statusPanel(0, 0, cols, h)}
        <Tabs y={rows - 2} cols={cols} active={active} onChange={(id) => focusPanel(id as PanelId)}
          tabs={ORDER.map((id) => ({ id, label: t(`tabs.${id}`) }))}
          extra={{ label: '≡', ariaLabel: t('fkeys.help'), action: () => setHelpOpen(true) }} />
      </>
    );
  } else {
    const h = rows - 1;
    const leftW = Math.max(40, Math.floor(cols * 0.62));
    const rightW = cols - leftW;
    const palH = Math.min(PALETTES.length + 2, Math.floor(h * 0.6));
    body = (
      <>
        {chroniclePanel(0, 0, leftW, h)}
        {palettesPanel(leftW, 0, rightW, palH)}
        {statusPanel(leftW, palH, rightW, h - palH)}
        <FKeyBar keys={fkeys} y={rows - 1} cols={cols} />
      </>
    );
  }

  const help = tList('help.lines');
  return (
    <>
      {body}
      {helpOpen ? (
        <Dialog title={t('help.title')} w={Math.max(...help.map((l) => l.length)) + 4} h={help.length + 2}
          onClose={() => setHelpOpen(false)}>
          <TextView lines={help.map((text) => [{ text }])} width={cols} height={help.length} anchor="top" />
        </Dialog>
      ) : null}
    </>
  );
}
