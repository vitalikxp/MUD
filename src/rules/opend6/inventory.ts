// Вещи героя для интерфейса (InventoryView): название, количество, надето ли, краткая сводка свойств предмета.
import type { Entity, Item } from '../../engine/types';
import type { InventoryRow, InventoryView, Lang } from '../api';
import { readCharacter } from './character';
import { slotName } from './equipment';

const L = {
  funds: { ru: 'Средства', en: 'Funds' },
  silver: { ru: 'Серебро', en: 'Silver' },
  damage: { ru: 'урон', en: 'damage' },
  armor: { ru: 'броня', en: 'armor' },
  ammo: { ru: 'заряды', en: 'ammo' },
  range: { ru: 'дальность', en: 'range' },
};

/** Свойства предмета одной строкой: «урон 4D · заряды 6 · дальность 10/25/40». Без игровых свойств — заметка (у придуманных Мастером предметов). */
function detailOf(item: Item, lang: Lang): string | undefined {
  const data = item.data;
  if (!data) return undefined;
  const parts: string[] = [];
  if (typeof data['damage'] === 'string') parts.push(`${L.damage[lang]} ${data['damage']}`);
  // Код брони без кубов — надбавка к Armor Value: «2» читается как «+2» (OpenD6: adventure p.115).
  if (typeof data['armor'] === 'string') parts.push(`${L.armor[lang]} ${/^\d+$/.test(data['armor']) ? '+' : ''}${data['armor']}`);
  if (typeof data['ammo'] === 'number') parts.push(`${L.ammo[lang]} ${data['ammo']}`);
  const range = data['range'];
  if (Array.isArray(range) && range.length > 0 && range.every((n) => typeof n === 'number')) parts.push(`${L.range[lang]} ${range.join('/')}`);
  if (parts.length === 0 && typeof data['note'] === 'string') return data['note'];
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function buildInventory(entity: Entity, lang: Lang): InventoryView {
  const parsed = readCharacter(entity);
  const summary: InventoryView['summary'] = [];
  if (parsed.ok) {
    if (parsed.value.funds) summary.push({ label: L.funds[lang], value: parsed.value.funds });
    if (parsed.value.silver !== undefined) summary.push({ label: L.silver[lang], value: String(parsed.value.silver) });
  }
  const rows = entity.items.map<InventoryRow>((item) => {
    const detail = detailOf(item, lang);
    return { id: item.id, name: item.name, qty: item.qty, worn: Boolean(item.slot), ...(item.slot ? { slotLabel: slotName(item.slot, lang) } : {}), ...(detail ? { detail } : {}) };
  });
  return { title: entity.name, summary, rows };
}
