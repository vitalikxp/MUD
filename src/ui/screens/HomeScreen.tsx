import { useSignalEffect } from '@preact/signals';
import { useEffect, useRef, useState } from 'preact/hooks';
import { session } from '../../app/campaigns';
import { askMaster, campaignEntries, chronicle, enterChronicle, INTRO, playTurn, push, reducedMotion, scrollOffset, setLang, setPalette, thinkingTick } from '../../app/chronicle';
import { parseCommand } from '../../app/commands';
import * as llm from '../../app/llm';
import { abort, busy, lastError, lastUsage } from '../../app/master';
import { navigate } from '../../app/router';
import { paletteId } from '../../app/settings';
import { formatSeconds, formatTokens, layoutStatus, llmState } from '../../app/statusLine';
import { locale, t, type Key } from '../../i18n';
import { getPalette, PALETTES, type Token } from '../../theme/palettes';
import { FKeyBar, useFKeys, type FKey } from '../tui/FKeyBar';
import { Input } from '../tui/Input';
import { Panel } from '../tui/Panel';
import { cellBox, type ScreenInfo } from '../tui/Screen';
import { StatusBar } from '../tui/StatusBar';
import { Tabs } from '../tui/Tabs';
import { InventoryPanel } from '../panels/InventoryPanel';
import { SheetPanel } from '../panels/SheetPanel';
import { clampOffset, followOffset, thinkingBar } from '../tui/scroll';
import { Scrollbar, TextView, wrapParagraphs } from '../tui/TextView';
import type { Paragraph, Segment } from '../tui/types';
import { HelpDialog, PaletteDialog, StatusDialog } from './dialogs';
import { SettingsDialog } from './SettingsDialog';
import { InventoryDialog } from './InventoryDialog';
import { SheetDialog } from './SheetDialog';

type DialogId = 'help' | 'palette' | 'status' | 'settings' | 'sheet' | 'inventory';

/** Правая колонка с панелями «Персонаж» и «Вещи» (в кампании): ширина и порог по ширине экрана; уже — только окна F2/F3 и вкладки. */
const SIDE_W = 40;
const SIDE_MIN_COLS = 110;

const dot = (fg: Token): Segment => ({ text: '● ', fg });

/** Левая часть строки состояния: индикатор и краткий статус LLM. */
function llmSegments(): Segment[] {
  const problems = llm.problems.value;
  const state = llmState({ problems, busy: busy.value, lastError: lastError.value });
  const usage = lastUsage.value;
  const model = llm.dmModel.value;
  switch (state) {
    case 'unconfigured':
      return [{ text: '○ ', fg: 'warning' }, { text: `${t('statusbar.unconfigured')}: ${problems.map((p) => t(`problems.${p}` as Key)).join(', ')}`, fg: 'warning' }];
    case 'busy':
      return [dot('info'), { text: `${t('statusbar.busy')} `, fg: 'info' }, { text: model, fg: 'fgDim' }];
    case 'error':
      return [{ text: '× ', fg: 'failure' }, { text: `${t('statusbar.error')}: ${t(`errors.${lastError.value ?? 'other'}` as Key)}`, fg: 'failure' }];
    case 'ready':
      return [
        dot('success'),
        { text: `${t('statusbar.ready')} · ${model}` },
        ...(usage ? [{ text: ` · ↑${formatTokens(usage.inputTokens)} ↓${formatTokens(usage.outputTokens)} ${t('statusbar.tokens')} · ${formatSeconds(usage.ms)}`, fg: 'fgDim' as Token }] : []),
      ];
  }
}

/**
 * Игровой экран. С `game` показывает кампанию из `session` (лист героя, возврат к списку кампаний), без него — черновой чат с моделью.
 * В кампании реплики идут в оркестратор Мастера (`playTurn`), лента строится по журналу; черновой чат ничего не сохраняет.
 */
export function HomeScreen({ screen, game = false }: { screen: ScreenInfo; game?: boolean }) {
  const { cols, rows, mobile } = screen;
  const current = game ? session.value : null;
  const campaignId = current?.meta.id;
  const [dialog, setDialog] = useState<DialogId | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = () => setDialog(null);
  // Та же клавиша закрывает своё окно, другая — переключает на своё. Без этого клавиша уходит браузеру (F1 — справка браузера).
  const toggle = (id: DialogId) => setDialog((cur) => (cur === id ? null : id));

  const onSubmit = (text: string) => {
    const cmd = parseCommand(text, PALETTES.map((p) => p.id));
    switch (cmd.kind) {
      case 'say': if (game) void playTurn({ kind: 'player', text: cmd.text }); else void askMaster(cmd.text); break;
      case 'start': if (game) void playTurn({ kind: 'opening' }); else push({ key: 'msg.noCampaign', fg: 'warning' }); break;
      case 'settings': setDialog('settings'); break;
      case 'help': setDialog('help'); break;
      case 'palette': setPalette(cmd.id); break;
      case 'lang': setLang(cmd.locale); break;
      case 'glyphs': navigate({ page: 'glyphs' }); break;
      case 'unknown': push({ key: 'msg.unknown', params: { cmd: cmd.raw }, fg: 'warning' }); break;
    }
  };

  const fkeys: FKey[] = [
    { n: 1, label: t('fkeys.help'), action: () => toggle('help') },
    ...(game ? [{ n: 2, label: t('fkeys.sheet'), action: () => toggle('sheet') } satisfies FKey, { n: 3, label: t('fkeys.inventory'), action: () => toggle('inventory') } satisfies FKey] : []),
    { n: 4, label: t('fkeys.settings'), action: () => toggle('settings') },
    { n: 7, label: t('fkeys.status'), action: () => toggle('status') },
    { n: 8, label: t('fkeys.palette'), action: () => toggle('palette') },
    { n: 9, label: t('fkeys.lang'), action: () => setLang(locale.value === 'ru' ? 'en' : 'ru') },
    ...(game ? [{ n: 10, label: t('fkeys.campaigns'), action: () => navigate({ page: 'title' }) } satisfies FKey] : []),
  ];
  useFKeys(fkeys);

  // Лента зависит от режима: в кампании — её вступление, в черновом чате — приветствие M0.
  const campaignTitle = current?.meta.title;
  const heroName = current ? Object.values(current.state.entities).find((e) => e.kind === 'pc')?.name : undefined;
  useEffect(() => {
    const now = session.peek();
    if (!game || !now) {
      enterChronicle('chat', INTRO);
      return;
    }
    enterChronicle(`campaign:${campaignId}`, campaignEntries(now));
  }, [game, campaignId, campaignTitle, heroName]);

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

  useEffect(() => { inputRef.current?.focus(); }, []);

  const paragraphs: Paragraph[] = chronicle.value.map((e) =>
    'pending' in e
      ? { text: `${t('msg.thinking')} [${thinkingBar(thinkingTick.value)}]`, fg: 'info', decorative: true }
      : { text: 'key' in e ? t(e.key, e.params ?? {}) : e.text, fg: e.fg },
  );

  // Хроника занимает всё, кроме строки состояния и F-клавиш (десктоп) или вкладок (телефон).
  const chronH = mobile ? rows - 3 : rows - 2;
  const side = game && !mobile && cols >= SIDE_MIN_COLS;
  const chronW = side ? cols - SIDE_W : cols;
  const sheetH = Math.max(6, Math.min(chronH - 8, Math.round(chronH * 0.6)));
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
    if (dialog !== null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
      e.preventDefault();
      const page = Math.max(1, scrollState.current.textH - 1);
      scrollBy(e.key === 'PageUp' ? page : -page);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);
  const touch = useRef<{ y: number; offset: number } | null>(null);

  const rightStatus = mobile ? '' : `${getPalette(paletteId.value).name[locale.value]} · ${locale.value.toUpperCase()}`;
  const statusLine = layoutStatus(llmSegments(), rightStatus, cols);
  const statusY = mobile ? rows - 3 : rows - 2;

  return (
    <>
      <Panel x={0} y={0} w={chronW} h={chronH} title={current ? `${t('panels.chronicle')} · ${current.meta.title}` : t('panels.chronicle')} active separators={[chronH - 3]}
        onActivate={() => inputRef.current?.focus()} id="panel-chronicle">
        {/* Колесо мыши и жест пальцем прокручивают хронику; с клавиатуры — PgUp/PgDn. */}
        <div class="tui-scroll-area" style={cellBox(0, 0, chronBodyW, chronTextH)}
          onWheel={(e) => { e.preventDefault(); scrollBy(e.deltaY < 0 ? 3 : -3); }}
          onTouchStart={(e) => { touch.current = { y: e.touches[0]!.clientY, offset: scrollOffset.peek() }; }}
          onTouchMove={(e) => {
            if (!touch.current) return;
            const dy = e.touches[0]!.clientY - touch.current.y;
            const { total: tot, textH: th } = scrollState.current;
            scrollOffset.value = clampOffset(touch.current.offset + Math.round(dy / screen.cellH), tot, th);
          }}
          onTouchEnd={() => { touch.current = null; }}>
          <TextView lines={chronLines} width={chronBodyW - 1} height={chronTextH} offset={offset} live />
        </div>
        <Scrollbar total={total} height={chronTextH} offset={offset} x={chronBodyW - 1} />
        <Input x={0} y={chronH - 3} w={chronBodyW} prompt={t('input.prompt')} placeholder={t('input.placeholder')}
          label={t('input.placeholder')} onSubmit={onSubmit} inputRef={inputRef} />
      </Panel>

      {side ? (
        <>
          <SheetPanel x={chronW} y={0} w={SIDE_W} h={sheetH} />
          <InventoryPanel x={chronW} y={sheetH} w={SIDE_W} h={chronH - sheetH} />
        </>
      ) : null}

      <StatusBar line={statusLine} y={statusY} cols={cols} label={t('panels.status')} />

      {mobile ? (
        <Tabs y={rows - 2} cols={cols} active=""
          onChange={(id) => { if (id === 'menu') navigate({ page: 'title' }); else toggle(id as DialogId); }}
          tabs={game
            ? [
                { id: 'sheet', label: t('tabs.sheet') },
                { id: 'inventory', label: t('tabs.inventory') },
                { id: 'palette', label: t('tabs.palettes') },
                { id: 'settings', label: t('tabs.settings') },
                { id: 'menu', label: t('tabs.menu') },
              ]
            : [
                { id: 'palette', label: t('tabs.palettes') },
                { id: 'status', label: t('tabs.status') },
                { id: 'settings', label: t('tabs.settings') },
              ]}
          extra={{ label: '≡', ariaLabel: t('fkeys.help'), action: () => toggle('help') }} />
      ) : (
        <FKeyBar keys={fkeys} y={rows - 1} cols={cols} />
      )}

      {/* Для скринридеров: анимация в ленте скрыта, вместо неё — одно сообщение о статусе. */}
      <div class="tui-sr-only" role="status">{busy.value ? `${t('msg.thinking')}…` : ''}</div>

      {dialog === 'help' ? <HelpDialog onClose={close} /> : null}
      {dialog === 'palette' ? <PaletteDialog onClose={close} /> : null}
      {dialog === 'status' ? <StatusDialog onClose={close} /> : null}
      {dialog === 'settings' ? <SettingsDialog gate={false} onClose={close} onStart={close} /> : null}
      {dialog === 'sheet' ? <SheetDialog onClose={close} /> : null}
      {dialog === 'inventory' ? <InventoryDialog onClose={close} /> : null}
    </>
  );
}
