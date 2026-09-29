// Чистый редьюсер: `reduce(state, event) → state`. Состояние никогда не мутируется, ошибки — исключения.
import type { Entity, EntityId, GameEvent, GameState, Item, Json, PatchOp } from './types';

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EngineError';
  }
}

export function initialState(rules: GameState['rules'], palette = 'terminal'): GameState {
  return { schema: 1, rules, entities: {}, scene: null, palette, flags: {}, turn: 0 };
}

const clone = <T extends Json>(v: T): T => structuredClone(v);

function getEntity(state: GameState, id: EntityId): Entity {
  const e = state.entities[id];
  if (!e) throw new EngineError(`Нет сущности «${id}»`);
  return e;
}

function withEntity(state: GameState, entity: Entity): GameState {
  return { ...state, entities: { ...state.entities, [entity.id]: entity } };
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function splitPath(path: string): string[] {
  const parts = path.split('.').filter((p) => p !== '');
  if (parts.length === 0) throw new EngineError('Пустой путь патча');
  if (parts.some((p) => FORBIDDEN_KEYS.has(p))) throw new EngineError(`Недопустимый путь: «${path}»`);
  return parts;
}

/** Применяет операцию к копии `data`; промежуточные объекты создаются по мере надобности. */
export function applyPatch(data: Record<string, Json>, op: PatchOp): Record<string, Json> {
  const root = clone(data);
  const parts = splitPath(op.path);
  const last = parts.pop()!;
  let node: Record<string, Json> = root;
  for (const key of parts) {
    const next = node[key];
    if (next === undefined || next === null) node[key] = {};
    else if (typeof next !== 'object' || Array.isArray(next)) throw new EngineError(`Путь «${op.path}»: «${key}» не объект`);
    node = node[key] as Record<string, Json>;
  }
  switch (op.op) {
    case 'set':
      node[last] = clone(op.value);
      break;
    case 'inc': {
      const cur = node[last] ?? 0;
      if (typeof cur !== 'number') throw new EngineError(`Путь «${op.path}»: не число`);
      node[last] = cur + op.by;
      break;
    }
    case 'push': {
      const cur = node[last] ?? [];
      if (!Array.isArray(cur)) throw new EngineError(`Путь «${op.path}»: не список`);
      node[last] = [...cur, clone(op.value)];
      break;
    }
    case 'remove':
      delete node[last];
      break;
  }
  return root;
}

function addItem(items: readonly Item[], item: Item): Item[] {
  // Одинаковые предметы (тот же id) складываются по количеству.
  const i = items.findIndex((x) => x.id === item.id);
  if (i === -1) return [...items, { ...item }];
  const merged = { ...items[i]!, qty: items[i]!.qty + item.qty };
  return items.map((x, k) => (k === i ? merged : x));
}

export function reduce(state: GameState, event: GameEvent): GameState {
  switch (event.t) {
    case 'entity.created': {
      if (state.entities[event.entity.id]) throw new EngineError(`Сущность «${event.entity.id}» уже есть`);
      return withEntity(state, clone(event.entity as unknown as Json) as unknown as Entity);
    }
    case 'entity.removed': {
      getEntity(state, event.id);
      const { [event.id]: _removed, ...rest } = state.entities;
      return { ...state, entities: rest };
    }
    case 'entity.patched': {
      const e = getEntity(state, event.id);
      let data = e.data;
      for (const op of event.ops) data = applyPatch(data, op);
      return withEntity(state, { ...e, data });
    }
    case 'item.added': {
      const e = getEntity(state, event.entityId);
      if (event.item.qty < 1 || !Number.isInteger(event.item.qty)) throw new EngineError('Количество предмета — целое ≥ 1');
      return withEntity(state, { ...e, items: addItem(e.items, event.item) });
    }
    case 'item.removed': {
      const e = getEntity(state, event.entityId);
      const item = e.items.find((x) => x.id === event.itemId);
      if (!item) throw new EngineError(`У «${e.name}» нет предмета «${event.itemId}»`);
      const qty = event.qty ?? item.qty;
      if (qty < 1 || qty > item.qty) throw new EngineError(`Нельзя убрать ${qty} из ${item.qty}: «${item.name}»`);
      const items = qty === item.qty ? e.items.filter((x) => x.id !== event.itemId) : e.items.map((x) => (x.id === event.itemId ? { ...x, qty: x.qty - qty } : x));
      return withEntity(state, { ...e, items });
    }
    case 'item.slot': {
      const e = getEntity(state, event.entityId);
      if (!e.items.some((x) => x.id === event.itemId)) throw new EngineError(`У «${e.name}» нет предмета «${event.itemId}»`);
      const items = e.items.map((x) => {
        if (x.id === event.itemId) return { ...x, slot: event.slot };
        // Слот занимает один предмет: прежний уходит в рюкзак.
        return event.slot !== null && x.slot === event.slot ? { ...x, slot: null } : x;
      });
      return withEntity(state, { ...e, items });
    }
    case 'condition.set': {
      const e = getEntity(state, event.entityId);
      const has = e.conditions.includes(event.condition);
      if (event.on === has) return state;
      const conditions = event.on ? [...e.conditions, event.condition] : e.conditions.filter((c) => c !== event.condition);
      return withEntity(state, { ...e, conditions });
    }
    case 'scene.set':
      return { ...state, scene: { ...event.scene } };
    case 'palette.set':
      return { ...state, palette: event.paletteId };
    case 'flag.set':
      return { ...state, flags: { ...state.flags, [event.key]: clone(event.value) } };
    case 'turn.ended':
      return { ...state, turn: state.turn + 1 };
    // Повествование, заявки, броски и откат состояние не меняют: они живут в журнале (хроника — вид на него).
    case 'narration':
    case 'note':
    case 'intent':
    case 'roll':
    case 'revert':
      return state;
  }
}

export function reduceAll(state: GameState, events: readonly GameEvent[]): GameState {
  return events.reduce(reduce, state);
}
