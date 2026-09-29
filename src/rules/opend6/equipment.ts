// Бытовые действия игрока с вещами: надеть, снять, выбросить (FR-CHR-5, docs/05-rules-engine.md#инвентарь).
// Слоты экипировки: доспех (`body`, а броня на часть тела — `head`, `legs`), щит, основная и вторая рука, пояс (3 слота быстрого доступа).
// Ids `body`/`legs`/`shield` те же, что в шаблонах героев. Лимита рюкзака нет: в книге его нет.
import type { Entity, Item } from '../../engine/types';
import { fail, ok, type EquipmentActions, type Lang, type LocalizedText, type Result, type Outcome } from '../api';

interface SlotDef {
  id: string;
  name: LocalizedText;
}

const lt = (ru: string, en: string): LocalizedText => ({ ru, en });

export const SLOTS: readonly SlotDef[] = [
  { id: 'body', name: lt('доспех', 'armor') },
  { id: 'head', name: lt('голова', 'head') },
  { id: 'legs', name: lt('ноги', 'legs') },
  { id: 'shield', name: lt('щит', 'shield') },
  { id: 'main-hand', name: lt('основная рука', 'main hand') },
  { id: 'off-hand', name: lt('вторая рука', 'off hand') },
  { id: 'belt-1', name: lt('пояс', 'belt') },
  { id: 'belt-2', name: lt('пояс', 'belt') },
  { id: 'belt-3', name: lt('пояс', 'belt') },
];

const ARMOR_SLOTS = ['body', 'head', 'legs'];
const HANDS = ['main-hand', 'off-hand'];
const BELT = ['belt-1', 'belt-2', 'belt-3'];

/** В какие слоты подходит предмет: по его свойствам (щит, доспех, оружие); прочее — на пояс. */
export function slotsFor(item: Item): string[] {
  const data = item.data ?? {};
  if (data['shield'] === true) return ['shield'];
  if (typeof data['armor'] === 'string') {
    const zone = data['zone'];
    return typeof zone === 'string' && SLOTS.some((s) => s.id === zone) ? [zone] : ['body'];
  }
  if (typeof data['weapon'] === 'string') return HANDS;
  return BELT;
}

export const slotName = (slot: string, lang: Lang): string => SLOTS.find((s) => s.id === slot)?.name[lang] ?? slot;

const T = {
  noItem: { ru: (who: string, id: string) => `У ${who} нет предмета «${id}»`, en: (who: string, id: string) => `${who} has no item “${id}”` },
  alreadyWorn: { ru: (n: string) => `«${n}» уже надет`, en: (n: string) => `“${n}” is already equipped` },
  notWorn: { ru: (n: string) => `«${n}» не надет`, en: (n: string) => `“${n}” is not equipped` },
  noSlot: { ru: (s: string) => `Нет такого слота: ${s}`, en: (s: string) => `No such slot: ${s}` },
  wrongSlot: { ru: (n: string, s: string) => `«${n}» нельзя надеть в слот «${s}»`, en: (n: string, s: string) => `“${n}” cannot go into the ${s} slot` },
  tooMany: { ru: (q: number, have: number, n: string) => `Нельзя выбросить ${q} из ${have}: «${n}»`, en: (q: number, have: number, n: string) => `Cannot drop ${q} of ${have}: “${n}”` },
};

const quote = (name: string, lang: Lang): string => (lang === 'ru' ? `«${name}»` : `“${name}”`);

function equipVerb(slot: string, lang: Lang): string {
  if (ARMOR_SLOTS.includes(slot)) return lang === 'ru' ? 'надевает' : 'equips';
  if (HANDS.includes(slot) || slot === 'shield') return lang === 'ru' ? 'берёт' : 'wields';
  return lang === 'ru' ? 'вешает' : 'hangs';
}

function equipTail(slot: string, lang: Lang): string {
  if (ARMOR_SLOTS.includes(slot)) return '';
  if (slot === 'shield') return lang === 'ru' ? ' на руку' : ' on the arm';
  if (HANDS.includes(slot)) return lang === 'ru' ? ' в руку' : ' in hand';
  return lang === 'ru' ? ' на пояс' : ' on the belt';
}

function find(entity: Entity, itemId: string, lang: Lang): Result<Item> {
  const item = entity.items.find((i) => i.id === itemId);
  return item ? ok(item) : fail(T.noItem[lang](entity.name, itemId));
}

const actor = (state: { entities: Record<string, Entity> }, id: string, lang: Lang): Result<Entity> => {
  const e = state.entities[id];
  return e ? ok(e) : fail(lang === 'ru' ? `Нет персонажа ${id}` : `Unknown entity ${id}`);
};

export const equipment: EquipmentActions = {
  equip(ctx, { entityId, itemId, slot, lang }): Result<Outcome> {
    const who = actor(ctx.state, entityId, lang);
    if (!who.ok) return who;
    const found = find(who.value, itemId, lang);
    if (!found.ok) return found;
    const item = found.value;
    const allowed = slotsFor(item);
    let target: string;
    if (slot !== undefined) {
      if (!SLOTS.some((s) => s.id === slot)) return fail(T.noSlot[lang](slot));
      if (!allowed.includes(slot)) return fail(T.wrongSlot[lang](item.name, slotName(slot, lang)));
      target = slot;
    } else {
      if (item.slot) return fail(T.alreadyWorn[lang](item.name));
      const occupied = new Set(who.value.items.flatMap((i) => (i.slot ? [i.slot] : [])));
      target = allowed.find((s) => !occupied.has(s)) ?? allowed[0]!;
    }
    if (item.slot === target) return fail(T.alreadyWorn[lang](item.name));
    const displaced = who.value.items.find((i) => i.slot === target && i.id !== item.id);
    const base = `${who.value.name} ${equipVerb(target, lang)} ${quote(item.name, lang)}${equipTail(target, lang)}`;
    const text = displaced
      ? lang === 'ru' ? `${base}; ${quote(displaced.name, lang)} убран в рюкзак.` : `${base}; ${quote(displaced.name, lang)} goes back to the pack.`
      : `${base}.`;
    return ok({
      events: [{ t: 'item.slot', entityId, itemId, slot: target }, { t: 'note', text }],
      result: { equipped: itemId, slot: target, ...(displaced ? { displaced: displaced.id } : {}) },
    });
  },

  unequip(ctx, { entityId, itemId, lang }): Result<Outcome> {
    const who = actor(ctx.state, entityId, lang);
    if (!who.ok) return who;
    const found = find(who.value, itemId, lang);
    if (!found.ok) return found;
    if (!found.value.slot) return fail(T.notWorn[lang](found.value.name));
    const text = lang === 'ru' ? `${who.value.name} убирает ${quote(found.value.name, lang)} в рюкзак.` : `${who.value.name} puts ${quote(found.value.name, lang)} away in the pack.`;
    return ok({ events: [{ t: 'item.slot', entityId, itemId, slot: null }, { t: 'note', text }], result: { unequipped: itemId } });
  },

  drop(ctx, { entityId, itemId, qty, lang }): Result<Outcome> {
    const who = actor(ctx.state, entityId, lang);
    if (!who.ok) return who;
    const found = find(who.value, itemId, lang);
    if (!found.ok) return found;
    const count = qty ?? found.value.qty;
    if (!Number.isInteger(count) || count < 1 || count > found.value.qty) return fail(T.tooMany[lang](count, found.value.qty, found.value.name));
    const amount = count > 1 ? ` ×${count}` : '';
    const text = lang === 'ru' ? `${who.value.name} выбрасывает ${quote(found.value.name, lang)}${amount}.` : `${who.value.name} drops ${quote(found.value.name, lang)}${amount}.`;
    return ok({ events: [{ t: 'item.removed', entityId, itemId, qty: count }, { t: 'note', text }], result: { dropped: itemId, qty: count } });
  },
};
