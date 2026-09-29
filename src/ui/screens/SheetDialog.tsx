import { heroOf, session } from '../../app/campaigns';
import { rulesModule } from '../../app/rules';
import { locale, t } from '../../i18n';
import { Dialog } from '../tui/Dialog';
import { cellBox, useScreen } from '../tui/Screen';
import { ScrollText } from '../tui/ScrollText';
import { fit } from '../tui/text';
import { TextView } from '../tui/TextView';
import { sheetLines } from './sheetLines';

/** Персонаж (F2). ↑/↓/PgUp/PgDn/колесо прокручивают, Esc закрывает. */
export function SheetDialog({ onClose }: { onClose: () => void }) {
  const { cols, rows } = useScreen();
  const hero = session.value ? heroOf(session.value.state) : undefined;
  const sheet = hero ? rulesModule.sheet(hero, locale.value) : null;
  const w = Math.min(cols - 2, 64);
  const h = Math.min(rows - 2, 30);
  const bodyW = w - 2;
  const textH = h - 4; // рамка (2) + разделитель и подсказка (2)

  return (
    <Dialog title={sheet?.title ?? t('sheet.title')} w={w} h={h} onClose={onClose} separators={[h - 3]}>
      <ScrollText focusable focusOnMount label={t('sheet.title')} width={bodyW} height={textH}
        build={(width) => (sheet ? sheetLines(sheet, width) : [[{ text: t('sheet.noHero'), fg: 'warning' }]])} />
      <div style={cellBox(0, h - 3, bodyW, 1)}>
        <TextView lines={[[{ text: fit(t('sheet.hint'), bodyW), fg: 'fgDim' }]]} width={bodyW} height={1} anchor="top" />
      </div>
    </Dialog>
  );
}
