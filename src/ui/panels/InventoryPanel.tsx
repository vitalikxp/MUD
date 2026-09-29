import { heroOf, session } from '../../app/campaigns';
import { rulesModule } from '../../app/rules';
import { locale, t } from '../../i18n';
import { inventoryLines } from '../screens/inventoryLines';
import { Panel } from '../tui/Panel';
import { ScrollText } from '../tui/ScrollText';
import type { Line } from '../tui/types';

/** Панель «Вещи» в правой колонке: деньги и предметы героя (● надето, ○ в сумке). Полный список — окно F3. */
export function InventoryPanel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const hero = session.value ? heroOf(session.value.state) : undefined;
  const view = hero ? rulesModule.inventory(hero, locale.value) : null;
  const build = (width: number): Line[] => (view ? inventoryLines(view, width, t('inventory.empty')) : [[{ text: t('sheet.noHero'), fg: 'warning' }]]);
  return (
    <Panel x={x} y={y} w={w} h={h} title={t('panels.inventory')} id="panel-inventory">
      <ScrollText width={w - 2} height={h - 2} label={t('panels.inventory')} build={build} />
    </Panel>
  );
}
