// Бытовые действия игрока с вещами (FR-CHR-5): без Мастера, мгновенно. Валидирует модуль правил, результат — коммит `ui_action` с записью-заметкой.
// «Использовать» — не действие движка: это заявка Мастеру («Использую …»), он сам решает эффект инструментами.
import { t, type Key } from '../i18n';
import { commitTurn, heroOf, session } from './campaigns';
import { playTurn, push, refreshCampaignChronicle } from './chronicle';
import { busy } from './master';
import { rulesModule } from './rules';

export type InventoryAction =
  | { kind: 'equip'; itemId: string }
  | { kind: 'unequip'; itemId: string }
  | { kind: 'drop'; itemId: string; qty?: number };

/** Правило отклонило действие: сообщение из модуля правил показывается игроку как есть. */
class ActionRejected extends Error {}

export async function inventoryAction(action: InventoryAction): Promise<void> {
  if (busy.value) {
    push({ key: 'msg.busy', fg: 'warning' });
    return;
  }
  const start = session.peek();
  const hero = start ? heroOf(start.state) : undefined;
  if (!start || !hero || start.meta.phase !== 'play') return;
  const lang = start.meta.narrationLang;
  try {
    await commitTurn('ui_action', (draft) => {
      const ctx = { state: draft.state, rng: draft.rng, options: {} };
      const args = { entityId: hero.id, itemId: action.itemId, lang };
      const result =
        action.kind === 'equip' ? rulesModule.equipment.equip(ctx, args)
        : action.kind === 'unequip' ? rulesModule.equipment.unequip(ctx, args)
        : rulesModule.equipment.drop(ctx, { ...args, ...(action.qty !== undefined ? { qty: action.qty } : {}) });
      if (!result.ok) throw new ActionRejected(result.error);
      draft.emit(...result.value.events);
    });
    refreshCampaignChronicle();
  } catch (e) {
    push({ text: e instanceof Error ? e.message : String(e), fg: 'warning' });
  }
}

/** «Использовать»: реплика игрока Мастеру на языке кампании. */
export async function playUseItem(itemId: string): Promise<void> {
  const current = session.peek();
  const hero = current ? heroOf(current.state) : undefined;
  const item = hero?.items.find((i) => i.id === itemId);
  if (!current || !item) return;
  await playTurn({ kind: 'player', text: t('inventory.useText' as Key, { name: item.name }, current.meta.narrationLang) });
}
