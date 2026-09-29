// Каталог снаряжения OpenD6: общие типы и построители записей.
import type { Item, Json } from '../../../engine/types';
import type { Lang, LocalizedText } from '../../api';

export type CatalogKind = 'gear' | 'clothing' | 'food' | 'armor' | 'shield' | 'weapon' | 'explosive' | 'vehicle';

export interface Price {
  /** Сложность цены как в книге: VE, E, M, D, VD, H, L (бывает диапазон «VE–E»). */
  level: string;
  /** Цена в монетах, если книга даёт её (фэнтези): «16 S». C — медь, S — серебро, G — золото (8 C = 1 S, 8 S = 1 G). */
  coins?: string;
}

export interface CatalogEntry {
  id: string;
  kind: CatalogKind;
  name: LocalizedText;
  price?: Price;
  /** Доступность (adventure: A/C/U, N — недоступно до 1990-х). */
  availability?: string;
  /** Краткое описание эффекта, если у предмета есть игровое действие. */
  note?: LocalizedText;
  /** Свойства предмета: становятся `Item.data` (armor, weapon, damage, range, bonus и т. д.). */
  data: Record<string, Json>;
}

export const lt = (ru: string, en: string): LocalizedText => ({ ru, en });

const price = (level: string, coins?: string): Price => ({ level, ...(coins ? { coins: coins.replace('SP', 'S') } : {}) });

/** Предмет снаряжения без игровых свойств. */
export const gear = (id: string, ru: string, en: string, level: string, coins?: string, opts: { avail?: string; note?: [string, string]; data?: Record<string, Json>; kind?: CatalogKind } = {}): CatalogEntry => ({
  id,
  kind: opts.kind ?? 'gear',
  name: lt(ru, en),
  price: price(level, coins),
  ...(opts.avail ? { availability: opts.avail } : {}),
  ...(opts.note ? { note: lt(opts.note[0], opts.note[1]) } : {}),
  data: opts.data ?? {},
});

/** Броня и щиты. `value` — Armor Value кодом кубов: «2» = +2, «1D+1». */
export const armor = (id: string, ru: string, en: string, value: string, level: string, coins?: string, opts: { avail?: string; shield?: boolean } = {}): CatalogEntry => ({
  id,
  kind: opts.shield ? 'shield' : 'armor',
  name: lt(ru, en),
  price: price(level, coins),
  ...(opts.avail ? { availability: opts.avail } : {}),
  data: { armor: value, ...(opts.shield ? { shield: true } : {}) },
});

export type WeaponClass = 'melee' | 'missile' | 'thrown' | 'firearm' | 'energy' | 'explosive';

export interface WeaponOpts {
  /** Дальность в метрах (короткая, средняя, дальняя); строка вида «PHYS-3» — от Телосложения или поднятия тяжестей. */
  range?: [number | string, number | string, number | string];
  ammo?: number | string;
  /** Оружие длиннее 60 см: штраф за громоздкость (в книге помечено «*»). */
  unwieldy?: boolean;
  /** Цена патронов (уровень). */
  ammoPrice?: string;
  note?: [string, string];
  extra?: Record<string, Json>;
}

export const weapon = (id: string, ru: string, en: string, cls: WeaponClass, damage: string | null, level: string, coins?: string, o: WeaponOpts = {}): CatalogEntry => ({
  id,
  kind: cls === 'explosive' ? 'explosive' : 'weapon',
  name: lt(ru, en),
  price: price(level, coins),
  ...(o.note ? { note: lt(o.note[0], o.note[1]) } : {}),
  data: {
    weapon: cls,
    ...(damage ? { damage } : {}),
    ...(o.range ? { range: [...o.range] } : {}),
    ...(o.ammo !== undefined ? { ammo: o.ammo } : {}),
    ...(o.unwieldy ? { unwieldy: true } : {}),
    ...(o.ammoPrice ? { ammoPrice: o.ammoPrice } : {}),
    ...o.extra,
  },
});

export interface VehicleStats {
  move: string;
  passengers: string;
  toughness: string;
  maneuverability: string;
  scale?: number;
}

export const vehicle = (id: string, ru: string, en: string, v: VehicleStats, level: string, coins?: string, note?: [string, string]): CatalogEntry => ({
  id,
  kind: 'vehicle',
  name: lt(ru, en),
  price: price(level, coins),
  ...(note ? { note: lt(note[0], note[1]) } : {}),
  data: { vehicle: true, move: v.move, passengers: v.passengers, toughness: v.toughness, maneuverability: v.maneuverability, ...(v.scale === undefined ? {} : { scale: v.scale }) },
});

/** Предмет для инвентаря из записи каталога. `ref` связывает его с записью. */
export function catalogItem(entry: CatalogEntry, variant: string, lang: Lang, qty = 1): Item {
  return {
    id: entry.id,
    ref: `opend6:${variant}:${entry.id}`,
    name: entry.name[lang],
    qty,
    data: { ...entry.data, ...(entry.price ? { price: entry.price.level } : {}) },
    slot: null,
  };
}
