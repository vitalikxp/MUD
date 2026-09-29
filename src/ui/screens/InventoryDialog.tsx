import { heroOf, session } from '../../app/campaigns';
import { rulesModule } from '../../app/rules';
import { locale, t } from '../../i18n';
import { Dialog } from '../tui/Dialog';
import { cellBox, useScreen } from '../tui/Screen';
import { ScrollText } from '../tui/ScrollText';
import { fit } from '../tui/text';
import { TextView } from '../tui/TextView';
import { inventoryLines } from './inventoryLines';

/** Вещи (F3): полный список с прокруткой; на узких экранах и на телефоне панель «Вещи» заменяет это окно. Esc закрывает. */
export function InventoryDialog({ onClose }: { onClose: () => void }) {
  const { cols, rows } = useScreen();
  const hero = session.value ? heroOf(session.value.state) : undefined;
  const view = hero ? rulesModule.inventory(hero, locale.value) : null;
  const w = Math.min(cols - 2, 64);
  const h = Math.min(rows - 2, 30);
  const bodyW = w - 2;
  const textH = h - 4;

  return (
    <Dialog title={t('panels.inventory')} w={w} h={h} onClose={onClose} separators={[h - 3]}>
      <ScrollText focusable focusOnMount label={t('panels.inventory')} width={bodyW} height={textH}
        build={(width) => (view ? inventoryLines(view, width, t('inventory.empty')) : [[{ text: t('sheet.noHero'), fg: 'warning' }]])} />
      <div style={cellBox(0, h - 3, bodyW, 1)}>
        <TextView lines={[[{ text: fit(t('sheet.hint'), bodyW), fg: 'fgDim' }]]} width={bodyW} height={1} anchor="top" />
      </div>
    </Dialog>
  );
}
