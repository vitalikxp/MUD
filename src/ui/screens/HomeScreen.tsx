import { signal, useSignalEffect } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { parseCommand } from '../../app/commands';
import * as llm from '../../app/llm';
import { abort, ask, busy } from '../../app/master';
import { navigate } from '../../app/router';
import { fontId, paletteId } from '../../app/settings';
import { locale, t, tList, type Key } from '../../i18n';
import { LlmError } from '../../llm/types';
import type { FontId } from '../../theme/fonts';
import { getPalette, PALETTES, type Token } from '../../theme/palettes';
import { Dialog } from '../tui/Dialog';
import { FKeyBar, useFKeys, type FKey } from '../tui/FKeyBar';
import { Input } from '../tui/Input';
import { Menu } from '../tui/Menu';
import { Panel } from '../tui/Panel';
import { cellBox, type ScreenInfo } from '../tui/Screen';
import { Tabs } from '../tui/Tabs';
import { clampOffset, followOffset, thinkingBar } from '../tui/scroll';
import { Scrollbar, TextView, wrapParagraphs } from '../tui/TextView';
import type { Paragraph } from '../tui/types';

/** Запись хроники: либо ключ словаря (перерисуется при смене языка), либо готовый текст. */
type Entry = { key: Key; params?: Record<string, string>; fg: Token } | { text: string; fg: Token } | { pending: true; fg: Token };

function errorText(e: unknown): string {
  const kind = e instanceof LlmError ? e.kind : 'other';
  const detail = e instanceof LlmError && kind === 'other' ? `: ${e.message}` : '';
  return `${t(`errors.${kind}` as Key)}${detail}`;
}

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
/** На сколько строк хроника прокручена вверх от низа (0 — внизу, следим за новым текстом). */
const scrollOffset = signal(0);
/** Кадр анимации «Мастер думает»; тикает только пока Мастер отвечает. */
const thinkingTick = signal(0);
const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
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

/** Реплика игрока → модель; ответ стримится в последнюю запись хроники. */
async function askMaster(text: string): Promise<void> {
  const missing = llm.problems.value;
  if (missing.length > 0) {
    push({ key: 'msg.notConfigured', params: { problems: missing.map((p) => t(`problems.${p}` as Key)).join(', ') }, fg: 'warning' });
    return;
  }
  if (busy.value) {
    push({ key: 'msg.busy', fg: 'warning' });
    return;
  }
  scrollOffset.value = 0; // своя реплика — к концу ленты
  thinkingTick.value = 0;
  // Пустая строка между репликой игрока и ответом Мастера.
  push({ text: `${t('input.prompt')} ${text}`, fg: 'player' }, { text: '', fg: 'dm' }, { pending: true, fg: 'dm' });
  const index = chronicle.value.length - 1;
  const replace = (body: string, fg: Token = 'dm') => {
    chronicle.value = chronicle.value.map((e, i) => (i === index ? { text: body, fg } : e));
  };
  try {
    const answer = await ask(text, { onText: (full) => replace(full) });
    replace(answer);
  } catch (e) {
    if (e instanceof LlmError && e.kind === 'aborted') replace(t('msg.aborted'), 'warning');
    else replace(errorText(e), 'failure');
  }
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
      case 'say': void askMaster(cmd.text); break;
      case 'settings': navigate('settings'); break;
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
    { n: 4, label: t('fkeys.settings'), action: () => navigate('settings') },
    { n: 8, label: t('fkeys.palette'), action: () => focusPanel('palettes') },
    { n: 9, label: t('fkeys.glyphs'), action: () => navigate('glyphs') },
  ];
  useFKeys(fkeys, !helpOpen);

  // Анимация «думает»: тикаем, пока идёт запрос; при prefers-reduced-motion кадр не меняется.
  useSignalEffect(() => {
    if (!busy.value || reducedMotion()) return;
    const id = setInterval(() => { thinkingTick.value += 1; }, 120);
    return () => clearInterval(id);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && busy.value) abort(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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

  const paragraphs: Paragraph[] = chronicle.value.map((e) =>
    'pending' in e
      ? { text: `${t('msg.thinking')} [${thinkingBar(thinkingTick.value)}]`, fg: 'info', decorative: true }
      : { text: 'key' in e ? t(e.key, e.params ?? {}) : e.text, fg: e.fg },
  );

  // Размеры хроники нужны заранее: по ним считаются строки, прокрутка и её обработчики.
  const chronW = mobile ? cols : Math.max(40, Math.floor(cols * 0.62));
  const chronH = mobile ? rows - 2 : rows - 1;
  const chronBodyW = chronW - 2;
  const chronTextH = Math.max(1, chronH - 4);
  const chronLines = wrapParagraphs(paragraphs, chronBodyW - 1); // 1 столбец справа — под полосу прокрутки
  const total = chronLines.length;
  const offset = clampOffset(scrollOffset.value, total, chronTextH);
  const scrollState = useRef({ total, textH: chronTextH });
  scrollState.current = { total, textH: chronTextH };
  const prevTotal = useRef(total);
  useEffect(() => {
    // Прокрутили вверх, а текст растёт снизу — держим видимый кусок на месте.
    scrollOffset.value = followOffset(scrollOffset.peek(), prevTotal.current, total);
    prevTotal.current = total;
  }, [total]);

  const scrollBy = (lines: number) => {
    const { total: tot, textH } = scrollState.current;
    scrollOffset.value = clampOffset(scrollOffset.peek() + lines, tot, textH);
  };
  useEffect(() => {
    if (helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
      e.preventDefault();
      const page = Math.max(1, scrollState.current.textH - 1);
      scrollBy(e.key === 'PageUp' ? page : -page);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen]);
  const touch = useRef<{ y: number; offset: number } | null>(null);

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
        {/* Колесо мыши и жест пальцем прокручивают хронику; с клавиатуры — PgUp/PgDn. */}
        <div class="tui-scroll-area" style={cellBox(0, 0, bodyW, textH)}
          onWheel={(e) => { e.preventDefault(); scrollBy(e.deltaY < 0 ? 3 : -3); }}
          onTouchStart={(e) => { touch.current = { y: e.touches[0]!.clientY, offset: scrollOffset.peek() }; }}
          onTouchMove={(e) => {
            if (!touch.current) return;
            const dy = e.touches[0]!.clientY - touch.current.y;
            const { total: tot, textH: th } = scrollState.current;
            scrollOffset.value = clampOffset(touch.current.offset + Math.round(dy / screen.cellH), tot, th);
          }}
          onTouchEnd={() => { touch.current = null; }}>
          <TextView lines={chronLines} width={bodyW - 1} height={textH} offset={offset} live />
        </div>
        <Scrollbar total={total} height={textH} offset={offset} x={bodyW - 1} />
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
        <Tabs y={rows - 2} cols={cols} active={active} onChange={(id) => (id === 'settings' ? navigate('settings') : focusPanel(id as PanelId))}
          tabs={[...ORDER.map((id) => ({ id, label: t(`tabs.${id}`) })), { id: 'settings', label: t('tabs.settings') }]}
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
      {/* Для скринридеров: анимация в ленте скрыта, вместо неё — одно сообщение о статусе. */}
      <div class="tui-sr-only" role="status">{busy.value ? `${t('msg.thinking')}…` : ''}</div>
      {helpOpen ? (
        <Dialog title={t('help.title')} w={Math.max(...help.map((l) => l.length)) + 4} h={help.length + 2}
          onClose={() => setHelpOpen(false)}>
          <TextView lines={help.map((text) => [{ text }])} width={cols} height={help.length} anchor="top" />
        </Dialog>
      ) : null}
    </>
  );
}
