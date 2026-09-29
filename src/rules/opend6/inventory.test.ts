import { describe, expect, it } from 'vitest';
import type { Entity } from '../../engine/types';
import { opend6 } from '.';
import { irma } from './fixtures';

const items: Entity['items'] = [
  { id: 'short-sword', name: 'Короткий меч', qty: 1, slot: 'hand', data: { weapon: 'melee', damage: '+1D' } },
  { id: 'crossbow', name: 'Арбалет', qty: 1, slot: null, data: { weapon: 'ranged', damage: '4D', ammo: 6, range: [10, 25, 40] } },
  { id: 'leather', name: 'Кожаный доспех', qty: 1, slot: 'body', data: { armor: '+2' } },
  { id: 'torch', name: 'Факел', qty: 3, slot: null },
  { id: 'shield', name: 'Щит', qty: 1, slot: 'hand', data: { armor: '2', shield: true } },
  { id: 'custom-map', name: 'Карта', qty: 1, slot: null, data: { note: 'Клетчатая, с чернильным пятном' } },
];

describe('inventory: вещи героя для панели', () => {
  it('предметы с количеством, «надето» по слоту и краткой сводкой свойств', () => {
    const view = opend6.inventory(irma({}, items), 'ru');
    expect(view.rows.map((r) => [r.name, r.qty, r.worn])).toEqual([
      ['Короткий меч', 1, true],
      ['Арбалет', 1, false],
      ['Кожаный доспех', 1, true],
      ['Факел', 3, false],
      ['Щит', 1, true],
      ['Карта', 1, false],
    ]);
    expect(view.rows[0]!.detail).toBe('урон +1D');
    expect(view.rows[1]!.detail).toBe('урон 4D · заряды 6 · дальность 10/25/40');
    expect(view.rows[2]!.detail).toBe('броня +2');
    expect(view.rows[3]!.detail).toBeUndefined();
    expect(view.rows[4]!.detail).toBe('броня +2'); // «2» без кубов — надбавка
    expect(view.rows[5]!.detail).toBe('Клетчатая, с чернильным пятном');
  });

  it('английские подписи', () => {
    const view = opend6.inventory(irma({}, items), 'en');
    expect(view.rows[1]!.detail).toBe('damage 4D · ammo 6 · range 10/25/40');
    expect(view.rows[2]!.detail).toBe('armor +2');
  });

  it('средства и серебро — в сводке; пустая сумка — пустой список', () => {
    const view = opend6.inventory(irma({ funds: '2D', silver: 14 }), 'ru');
    expect(view.summary).toEqual([{ label: 'Средства', value: '2D' }, { label: 'Серебро', value: '14' }]);
    expect(view.rows).toEqual([]);
    expect(opend6.inventory(irma(), 'ru').summary).toEqual([]);
  });

  it('заголовок — имя героя; повреждённые данные не роняют панель', () => {
    expect(opend6.inventory(irma({}, items), 'ru').title).toBe('Ирма');
    const broken = { ...irma(), data: { nonsense: true } } as Entity;
    expect(opend6.inventory(broken, 'ru').rows).toEqual([]);
  });
});
