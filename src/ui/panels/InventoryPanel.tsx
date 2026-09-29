import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import { cellBox } from '../tui/Screen';
import { Panel } from '../tui/Panel';
import { InventoryList } from './InventoryList';

/**
 * Панель «Вещи» в правой колонке: деньги и предметы героя (● надето, ○ в сумке). F3 переводит на неё фокус, Enter открывает меню действий
 * (надеть, снять, использовать, выбросить), Esc возвращает фокус в строку ввода. Полный список — окно F3 на узком экране.
 */
export function InventoryPanel({ x, y, w, h, listRef, onOpen, onEscape }: {
  x: number; y: number; w: number; h: number;
  listRef: { current: HTMLDivElement | null };
  onOpen: (itemId: string) => void;
  onEscape: () => void;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Panel x={x} y={y} w={w} h={h} title={t('panels.inventory')} active={focused} id="panel-inventory">
      <div style={cellBox(0, 0, w - 2, h - 2)} onFocusIn={() => setFocused(true)} onFocusOut={() => setFocused(false)}>
        <InventoryList width={w - 2} height={h - 2} listRef={listRef} onOpen={onOpen} onEscape={onEscape} onEmpty={onEscape} />
      </div>
    </Panel>
  );
}
