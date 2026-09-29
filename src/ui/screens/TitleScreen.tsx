import { useEffect, useRef, useState } from 'preact/hooks';
import { campaigns, refreshCampaigns, storageError, variantName } from '../../app/campaigns';
import { setLang } from '../../app/chronicle';
import { navigate } from '../../app/router';
import { locale, t } from '../../i18n';
import type { CampaignMeta } from '../../net/storage';
import { FKeyBar, useFKeys, type FKey } from '../tui/FKeyBar';
import { Menu, type MenuItem } from '../tui/Menu';
import { Panel } from '../tui/Panel';
import { cellBox, type ScreenInfo } from '../tui/Screen';
import { Tabs } from '../tui/Tabs';
import { TextView, wrapParagraphs } from '../tui/TextView';
import type { Paragraph } from '../tui/types';
import { DeleteCampaignDialog, NewCampaignDialog } from './CampaignDialogs';
import { HelpDialog, PaletteDialog } from './dialogs';
import { SettingsDialog } from './SettingsDialog';

type Dialog = 'help' | 'palette' | 'settings' | 'new' | { deleting: CampaignMeta } | null;

const NEW_ID = '__new';

export function TitleScreen({ screen }: { screen: ScreenInfo }) {
  const { cols, rows, mobile } = screen;
  const [sel, setSel] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const list = campaigns.value;

  useEffect(() => { void refreshCampaigns(); }, []);
  const loaded = list !== null;
  const noDialog = dialog === null;
  useEffect(() => { if (noDialog) menuRef.current?.focus(); }, [loaded, noDialog]);

  const items: MenuItem[] = [
    ...(list ?? []).map((c) => ({
      id: c.id,
      label: c.title,
      hint: `${variantName(c.rules.variant, locale.value)} · ${c.phase === 'creation' ? t('title.noHero') : t('title.turns', { n: c.headSeq })}`,
    })),
    { id: NEW_ID, label: t('title.newItem') },
  ];
  const selected = Math.min(sel, items.length - 1);
  const current = list?.[selected];

  const toggle = (id: 'help' | 'palette' | 'settings' | 'new') => setDialog((d) => (d === id ? null : id));
  const open = (index: number) => {
    const c = list?.[index];
    if (c) navigate({ page: 'game', id: c.id });
    else setDialog('new');
  };
  const askDelete = () => { if (current) setDialog({ deleting: current }); };

  const fkeys: FKey[] = [
    { n: 1, label: t('fkeys.help'), action: () => toggle('help') },
    { n: 3, label: t('fkeys.new'), action: () => toggle('new') },
    { n: 4, label: t('fkeys.settings'), action: () => toggle('settings') },
    { n: 8, label: t('fkeys.palette'), action: () => toggle('palette') },
    { n: 9, label: t('fkeys.lang'), action: () => setLang(locale.value === 'ru' ? 'en' : 'ru') },
  ];
  useFKeys(fkeys);

  const panelH = mobile ? rows - 2 : rows - 1;
  const bodyW = cols - 2;
  const notes: Paragraph[] = [];
  if (storageError.value) notes.push({ text: t('title.storageError', { reason: storageError.value }), fg: 'failure' }, { text: '' });
  if (list !== null && list.length === 0) notes.push({ text: t('title.empty'), fg: 'warning' }, { text: '' });
  notes.push({ text: t('title.hint'), fg: 'fgDim' });
  const noteLines = wrapParagraphs(notes, bodyW);
  const headerH = 3; // слоган, пустая строка, «Кампании»
  const listH = Math.max(3, Math.min(items.length, panelH - 2 - headerH - noteLines.length - 1));

  return (
    <>
      <Panel x={0} y={0} w={cols} h={panelH} title={`${t('app.name')} · ${t('title.campaigns')}`} active id="panel-title">
        <div style={cellBox(0, 0, bodyW, 1)}>
          <TextView lines={[[{ text: t('app.tagline'), fg: 'accent' }]]} width={bodyW} height={1} anchor="top" />
        </div>
        <div style={cellBox(0, 2, bodyW, 1)}>
          <TextView lines={[[{ text: t('title.campaigns'), fg: 'fgDim' }]]} width={bodyW} height={1} anchor="top" />
        </div>
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- Del удаляет выбранную кампанию, событие всплывает от списка */}
        <div style={cellBox(0, headerH, bodyW, listH)} onKeyDown={(e) => {
          if (e.key === 'Delete') { e.preventDefault(); askDelete(); }
        }}>
          <Menu items={items} selected={selected} width={bodyW} height={listH} label={t('title.campaigns')} menuRef={menuRef} onSelect={setSel} onChoose={open} />
        </div>
        <div style={cellBox(0, headerH + listH + 1, bodyW, noteLines.length)}>
          <TextView lines={noteLines} width={bodyW} height={noteLines.length} anchor="top" live />
        </div>
      </Panel>

      {mobile ? (
        <Tabs y={rows - 2} cols={cols} active=""
          onChange={(id) => { if (id === 'new') toggle('new'); else if (id === 'delete') askDelete(); else if (id === 'palette') toggle('palette'); else toggle('settings'); }}
          tabs={[
            { id: 'new', label: t('tabs.new') },
            { id: 'delete', label: t('tabs.delete') },
            { id: 'palette', label: t('tabs.palettes') },
            { id: 'settings', label: t('tabs.settings') },
          ]}
          extra={{ label: '≡', ariaLabel: t('fkeys.help'), action: () => toggle('help') }} />
      ) : (
        <FKeyBar keys={fkeys} y={rows - 1} cols={cols} />
      )}

      {dialog === 'help' ? <HelpDialog onClose={() => setDialog(null)} /> : null}
      {dialog === 'palette' ? <PaletteDialog onClose={() => setDialog(null)} /> : null}
      {dialog === 'settings' ? <SettingsDialog gate={false} onClose={() => setDialog(null)} onStart={() => setDialog(null)} /> : null}
      {dialog === 'new' ? <NewCampaignDialog onClose={() => setDialog(null)} /> : null}
      {typeof dialog === 'object' && dialog !== null ? <DeleteCampaignDialog campaign={dialog.deleting} onClose={() => setDialog(null)} /> : null}
    </>
  );
}

