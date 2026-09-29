import { describe, expect, it } from 'vitest';
import { Draft } from '../../engine/commits';
import { scriptedRng } from '../../engine/testing';
import type { Entity, GameEvent } from '../../engine/types';
import { opend6 } from '.';
import { armorCode } from './damage';
import { toPips } from './dice';
import { ctxWith, irma } from './fixtures';

const sword = { id: 'sword', name: 'Меч', qty: 1, slot: null, data: { weapon: 'melee', damage: '+2D' } };
const dagger = { id: 'dagger', name: 'Кинжал', qty: 1, slot: null, data: { weapon: 'melee', damage: '+1D' } };
const axe = { id: 'axe', name: 'Топор', qty: 1, slot: null, data: { weapon: 'melee', damage: '+2D' } };
const mail = { id: 'mail', name: 'Кольчуга', qty: 1, slot: null, data: { armor: '+3' } };
const greaves = { id: 'greaves', name: 'Поножи', qty: 1, slot: null, data: { armor: '2', zone: 'legs' } };
const buckler = { id: 'buckler', name: 'Щит', qty: 1, slot: null, data: { armor: '+1', shield: true } };
const torch = { id: 'torch', name: 'Факел', qty: 3, slot: null };
const items: Entity['items'] = [sword, dagger, axe, mail, buckler, torch];

const ctx = (list: Entity['items'] = items) => ctxWith(scriptedRng([]), [irma({}, list)]);
/** Применяет события к состоянию контекста: следующий шаг видит результат прошлого. */
function apply(c: ReturnType<typeof ctx>, events: GameEvent[]): ReturnType<typeof ctx> {
  const d = new Draft(c.state, c.rng, 't');
  d.emit(...events);
  return { ...c, state: d.state };
}
const slotOf = (c: ReturnType<typeof ctx>, id: string) => c.state.entities['irma']!.items.find((i) => i.id === id)?.slot;
const equip = (c: ReturnType<typeof ctx>, itemId: string, slot?: string, lang: 'ru' | 'en' = 'ru') =>
  opend6.equipment.equip(c, { entityId: 'irma', itemId, ...(slot ? { slot } : {}), lang });

describe('equipment.equip: слоты экипировки', () => {
  it('доспех — в слот «body», щит — в «shield», оружие — в основную руку, потом во вторую', () => {
    let c = ctx();
    for (const [id, slot] of [['mail', 'body'], ['buckler', 'shield'], ['sword', 'main-hand'], ['dagger', 'off-hand']] as const) {
      const r = equip(c, id);
      expect(r.ok).toBe(true);
      c = apply(c, r.ok ? r.value.events : []);
      expect(slotOf(c, id)).toBe(slot);
    }
  });

  it('событие — смена слота плюс запись-заметка на языке кампании', () => {
    const r = equip(ctx(), 'mail');
    expect(r.ok && r.value.events).toEqual([{ t: 'item.slot', entityId: 'irma', itemId: 'mail', slot: 'body' }, { t: 'note', text: 'Ирма надевает «Кольчуга».' }]);
    const en = equip(ctx(), 'mail', undefined, 'en');
    expect(en.ok && en.value.events.at(-1)).toEqual({ t: 'note', text: 'Ирма equips “Кольчуга”.' });
  });

  it('свободного слота нет — предмет берёт первый подходящий, прежний уходит в рюкзак, в заметке это сказано', () => {
    let c = ctx();
    for (const id of ['sword', 'dagger']) {
      const r = equip(c, id);
      c = apply(c, r.ok ? r.value.events : []);
    }
    const r = equip(c, 'axe');
    expect(r.ok && r.value.events[0]).toEqual({ t: 'item.slot', entityId: 'irma', itemId: 'axe', slot: 'main-hand' });
    expect(r.ok && r.value.events.at(-1)).toMatchObject({ t: 'note', text: expect.stringContaining('«Меч» убран в рюкзак') });
    c = apply(c, r.ok ? r.value.events : []);
    expect(slotOf(c, 'axe')).toBe('main-hand');
    expect(slotOf(c, 'sword')).toBeNull();
  });

  it('явный слот: совместимый принимается, несовместимый — ошибка с причиной', () => {
    expect(equip(ctx(), 'dagger', 'off-hand').ok).toBe(true);
    const bad = equip(ctx(), 'mail', 'main-hand');
    expect(bad).toEqual({ ok: false, error: expect.stringContaining('«Кольчуга» нельзя надеть в слот') });
    expect(equip(ctx(), 'mail', 'nowhere').ok).toBe(false);
  });

  it('броня на часть тела идёт в слот своей зоны и не вытесняет доспех', () => {
    let c = ctx([...items, greaves]);
    for (const id of ['mail', 'greaves']) {
      const r = equip(c, id);
      c = apply(c, r.ok ? r.value.events : []);
    }
    expect(slotOf(c, 'mail')).toBe('body');
    expect(slotOf(c, 'greaves')).toBe('legs');
  });

  it('прочие предметы — на пояс (три слота быстрого доступа), неизвестный предмет и уже надетый — ошибка', () => {
    const r = equip(ctx(), 'torch');
    expect(r.ok && r.value.events[0]).toMatchObject({ slot: 'belt-1' });
    expect(equip(ctx(), 'ghost')).toEqual({ ok: false, error: expect.stringContaining('нет предмета «ghost»') });
    const c = apply(ctx(), r.ok ? r.value.events : []);
    expect(equip(c, 'torch')).toEqual({ ok: false, error: expect.stringContaining('уже надет') });
  });

  it('доспех считается только после надевания (armorCode смотрит на слот)', () => {
    const c = ctx();
    expect(toPips(armorCode(c.state.entities['irma']!))).toBe(0);
    const r = equip(c, 'mail');
    expect(toPips(armorCode(apply(c, r.ok ? r.value.events : []).state.entities['irma']!))).toBe(3);
  });
});

/** Героиня с мечом в основной руке. */
const worn = () => {
  const c = ctx();
  const r = equip(c, 'sword');
  return apply(c, r.ok ? r.value.events : []);
};

describe('equipment.unequip и drop', () => {
  it('снять: слот освобождается, заметка «убирает в рюкзак»; снять ненадетое — ошибка', () => {
    const r = opend6.equipment.unequip(worn(), { entityId: 'irma', itemId: 'sword', lang: 'ru' });
    expect(r.ok && r.value.events).toEqual([{ t: 'item.slot', entityId: 'irma', itemId: 'sword', slot: null }, { t: 'note', text: 'Ирма убирает «Меч» в рюкзак.' }]);
    expect(opend6.equipment.unequip(ctx(), { entityId: 'irma', itemId: 'sword', lang: 'ru' })).toEqual({ ok: false, error: expect.stringContaining('не надет') });
  });

  it('выбросить: всё или часть стопки; лишнее количество и чужой предмет — ошибка', () => {
    const all = opend6.equipment.drop(ctx(), { entityId: 'irma', itemId: 'torch', lang: 'ru' });
    expect(all.ok && all.value.events).toEqual([{ t: 'item.removed', entityId: 'irma', itemId: 'torch', qty: 3 }, { t: 'note', text: 'Ирма выбрасывает «Факел» ×3.' }]);
    const one = opend6.equipment.drop(ctx(), { entityId: 'irma', itemId: 'torch', qty: 1, lang: 'ru' });
    expect(one.ok && one.value.events[0]).toEqual({ t: 'item.removed', entityId: 'irma', itemId: 'torch', qty: 1 });
    expect(opend6.equipment.drop(ctx(), { entityId: 'irma', itemId: 'torch', qty: 9, lang: 'ru' }).ok).toBe(false);
    expect(opend6.equipment.drop(ctx(), { entityId: 'irma', itemId: 'ghost', lang: 'ru' }).ok).toBe(false);
  });

  it('выброшенный надетый предмет уходит вместе со слотом', () => {
    const c = worn();
    const r = opend6.equipment.drop(c, { entityId: 'irma', itemId: 'sword', lang: 'ru' });
    const next = apply(c, r.ok ? r.value.events : []);
    expect(next.state.entities['irma']!.items.some((i) => i.id === 'sword')).toBe(false);
  });
});

describe('inventory: строки для интерфейса', () => {
  it('id и название слота надетого предмета', () => {
    let c = ctx();
    const r = equip(c, 'buckler');
    c = apply(c, r.ok ? r.value.events : []);
    const view = opend6.inventory(c.state.entities['irma']!, 'ru');
    expect(view.rows.find((x) => x.id === 'buckler')).toMatchObject({ worn: true, slotLabel: 'щит' });
    expect(view.rows.find((x) => x.id === 'sword')).toMatchObject({ worn: false });
    expect(view.rows.find((x) => x.id === 'sword')!.slotLabel).toBeUndefined();
  });
});
