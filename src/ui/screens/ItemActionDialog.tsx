import { useEffect, useRef, useState } from 'preact/hooks';
import { heroOf, session } from '../../app/campaigns';
import { inventoryAction, playUseItem } from '../../app/inventory';
import { rulesModule } from '../../app/rules';
import { locale, t, type Key } from '../../i18n';
import type { InventoryRow } from '../../rules/api';
import { Dialog } from '../tui/Dialog';
import { Menu, type MenuItem } from '../tui/Menu';
import { cellBox } from '../tui/Screen';

type Choice = 'equip' | 'unequip' | 'use' | 'drop' | 'dropOne' | 'dropAll' | 'cancel';

/** Действия над предметом: надеть или снять, использовать (заявка Мастеру), выбросить (для стопки — один или все). */
export function actionsFor(row: InventoryRow): Choice[] {
  return [row.worn ? 'unequip' : 'equip', 'use', ...(row.qty > 1 ? (['dropOne', 'dropAll'] as const) : (['drop'] as const)), 'cancel'];
}

/**
 * Меню действий над предметом героя. Рисуется на уровне экрана (родитель хранит выбранный предмет), закрывается Esc или «Отмена».
 * `onUse` — «Использовать» закрывает и остальные окна: ответ Мастера появляется в хронике.
 */
export function ItemActionDialog({ itemId, onClose, onUse }: { itemId: string; onClose: () => void; onUse: () => void }) {
  const hero = session.value ? heroOf(session.value.state) : undefined;
  const row = hero ? rulesModule.inventory(hero, locale.value).rows.find((r) => r.id === itemId) : undefined;
  const [sel, setSel] = useState(0);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { menuRef.current?.focus(); }, []);
  useEffect(() => { if (!row) onClose(); }, [row, onClose]);
  if (!row) return null;

  const choices = actionsFor(row);
  const items: MenuItem[] = choices.map((c) => ({ id: c, label: t(`inventory.actions.${c}` as Key, { qty: row.qty }) }));
  const choose = (i: number) => {
    const c = choices[i];
    if (!c || c === 'cancel') return onClose();
    if (c === 'use') { onUse(); void playUseItem(itemId); return; }
    onClose();
    void inventoryAction(
      c === 'equip' ? { kind: 'equip', itemId }
      : c === 'unequip' ? { kind: 'unequip', itemId }
      : { kind: 'drop', itemId, ...(c === 'dropOne' ? { qty: 1 } : {}) },
    );
  };
  const w = 34;
  const h = items.length + 2;
  return (
    <Dialog title={row.name} w={w} h={h} onClose={onClose}>
      <div style={cellBox(0, 0, w - 2, items.length)}>
        <Menu items={items} selected={sel} width={w - 2} height={items.length} label={row.name} menuRef={menuRef} onSelect={setSel} onChoose={choose} />
      </div>
    </Dialog>
  );
}
