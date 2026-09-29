import { heroOf, session } from '../../app/campaigns';
import { rulesModule } from '../../app/rules';
import { locale, t } from '../../i18n';
import { Panel } from '../tui/Panel';
import { ScrollText } from '../tui/ScrollText';
import type { Line } from '../tui/types';
import { sheetLines } from '../screens/sheetLines';

/**
 * Панель «Персонаж» в правой колонке: здоровье и очки сверху, ниже характеристики и навыки (колесо или жест листают).
 * Данные живые: после каждого хода панель показывает новое состояние героя. Полный лист — окно F2.
 */
export function SheetPanel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const hero = session.value ? heroOf(session.value.state) : undefined;
  const sheet = hero ? rulesModule.sheet(hero, locale.value) : null;
  const build = (width: number): Line[] =>
    sheet ? [[{ text: sheet.title, fg: 'accent', bold: true }], [{ text: '' }], ...sheetLines(sheet, width, { briefFirst: true })] : [[{ text: t('sheet.noHero'), fg: 'warning' }]];
  return (
    <Panel x={x} y={y} w={w} h={h} title={t('panels.sheet')} id="panel-sheet">
      <ScrollText width={w - 2} height={h - 2} label={t('panels.sheet')} build={build} />
    </Panel>
  );
}
