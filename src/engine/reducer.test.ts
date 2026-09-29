import { describe, expect, it } from 'vitest';
import { applyPatch, EngineError, initialState, reduce, reduceAll } from './reducer';
import type { Entity, GameEvent } from './types';

const rules = { id: 'opend6', version: '0.1.0', variant: 'fantasy' };
const hero = (over: Partial<Entity> = {}): Entity => ({ id: 'irma', kind: 'pc', name: 'Ирма', data: { body: { points: 30, max: 30 } }, items: [], conditions: [], ...over });
const created = (e: Entity = hero()): GameEvent => ({ t: 'entity.created', entity: e });

describe('applyPatch', () => {
  it('set, inc, push, remove по пути; исходные данные не меняются', () => {
    const data = { body: { points: 30 }, tags: ['a'] };
    const a = applyPatch(data, { op: 'inc', path: 'body.points', by: -7 });
    expect(a).toEqual({ body: { points: 23 }, tags: ['a'] });
    expect(data.body.points).toBe(30);
    expect(applyPatch(a, { op: 'set', path: 'points.cp', value: 5 })).toMatchObject({ points: { cp: 5 } });
    expect(applyPatch(a, { op: 'push', path: 'tags', value: 'b' }).tags).toEqual(['a', 'b']);
    expect(applyPatch(a, { op: 'remove', path: 'body.points' })).toEqual({ body: {}, tags: ['a'] });
  });

  it('inc на пустом пути стартует с нуля; ошибки типов и опасные пути', () => {
    expect(applyPatch({}, { op: 'inc', path: 'x.y', by: 2 })).toEqual({ x: { y: 2 } });
    expect(() => applyPatch({ x: 'text' }, { op: 'inc', path: 'x', by: 1 })).toThrow(EngineError);
    expect(() => applyPatch({ x: 1 }, { op: 'push', path: 'x', value: 1 })).toThrow(EngineError);
    expect(() => applyPatch({ x: 5 }, { op: 'set', path: 'x.y', value: 1 })).toThrow(EngineError);
    expect(() => applyPatch({}, { op: 'set', path: '__proto__.polluted', value: 1 })).toThrow(EngineError);
    expect(() => applyPatch({}, { op: 'set', path: '', value: 1 })).toThrow(EngineError);
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});

describe('reduce', () => {
  const s0 = initialState(rules);

  it('создание, изменение и удаление сущности; редьюсер не мутирует прежнее состояние', () => {
    const s1 = reduce(s0, created());
    expect(Object.keys(s0.entities)).toEqual([]);
    const s2 = reduce(s1, { t: 'entity.patched', id: 'irma', ops: [{ op: 'inc', path: 'body.points', by: -5 }] });
    expect(s1.entities['irma']!.data).toEqual({ body: { points: 30, max: 30 } });
    expect(s2.entities['irma']!.data).toEqual({ body: { points: 25, max: 30 } });
    expect(reduce(s2, { t: 'entity.removed', id: 'irma' }).entities).toEqual({});
    expect(() => reduce(s1, created())).toThrow(EngineError); // дубликат
    expect(() => reduce(s0, { t: 'entity.patched', id: 'нет', ops: [] })).toThrow(EngineError);
  });

  it('создаваемая сущность копируется: правки исходного объекта не проникают в состояние', () => {
    const e = hero();
    const s = reduce(s0, created(e));
    e.data['body'] = { points: 1, max: 1 };
    expect(s.entities['irma']!.data).toEqual({ body: { points: 30, max: 30 } });
  });

  it('предметы: складываются по id, убираются частями, слот занимает один предмет', () => {
    let s = reduceAll(s0, [created(), { t: 'item.added', entityId: 'irma', item: { id: 'torch', name: 'Факел', qty: 2 } }]);
    s = reduce(s, { t: 'item.added', entityId: 'irma', item: { id: 'torch', name: 'Факел', qty: 1 } });
    expect(s.entities['irma']!.items).toEqual([{ id: 'torch', name: 'Факел', qty: 3 }]);
    s = reduce(s, { t: 'item.removed', entityId: 'irma', itemId: 'torch', qty: 1 });
    expect(s.entities['irma']!.items[0]!.qty).toBe(2);
    s = reduce(s, { t: 'item.removed', entityId: 'irma', itemId: 'torch' });
    expect(s.entities['irma']!.items).toEqual([]);
    expect(() => reduce(s, { t: 'item.removed', entityId: 'irma', itemId: 'torch' })).toThrow(EngineError);

    s = reduceAll(s, [
      { t: 'item.added', entityId: 'irma', item: { id: 'sword', name: 'Меч', qty: 1 } },
      { t: 'item.added', entityId: 'irma', item: { id: 'axe', name: 'Топор', qty: 1 } },
      { t: 'item.slot', entityId: 'irma', itemId: 'sword', slot: 'main-hand' },
      { t: 'item.slot', entityId: 'irma', itemId: 'axe', slot: 'main-hand' },
    ]);
    const slots = Object.fromEntries(s.entities['irma']!.items.map((i) => [i.id, i.slot]));
    expect(slots).toEqual({ sword: null, axe: 'main-hand' });
    expect(() => reduce(s, { t: 'item.added', entityId: 'irma', item: { id: 'x', name: 'x', qty: 0 } })).toThrow(EngineError);
    expect(() => reduce(s, { t: 'item.removed', entityId: 'irma', itemId: 'axe', qty: 5 })).toThrow(EngineError);
  });

  it('состояния, сцена, палитра, флаги; turn.ended считает ходы', () => {
    let s = reduceAll(s0, [created(), { t: 'condition.set', entityId: 'irma', condition: 'stunned', on: true }, { t: 'condition.set', entityId: 'irma', condition: 'stunned', on: true }]);
    expect(s.entities['irma']!.conditions).toEqual(['stunned']);
    s = reduce(s, { t: 'condition.set', entityId: 'irma', condition: 'stunned', on: false });
    expect(s.entities['irma']!.conditions).toEqual([]);
    s = reduceAll(s, [
      { t: 'scene.set', scene: { name: 'Склеп' } },
      { t: 'palette.set', paletteId: 'torchlight', reason: 'подземелье' },
      { t: 'flag.set', key: 'altar.seen', value: true },
      { t: 'turn.ended', suggestions: [] },
    ]);
    expect(s).toMatchObject({ scene: { name: 'Склеп' }, palette: 'torchlight', flags: { 'altar.seen': true }, turn: 1 });
  });

  it('повествование, заявки, броски и откат состояние не меняют', () => {
    const s1 = reduce(s0, created());
    for (const e of [
      { t: 'narration', text: 'Тихо.' },
      { t: 'note', text: 'Ирма надевает куртку.' },
      { t: 'intent', uid: 'u1', charId: 'irma', text: 'иду' },
      { t: 'revert', targetSeq: 1 },
    ] as GameEvent[]) expect(reduce(s1, e)).toBe(s1);
  });
});
