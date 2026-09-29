// Модель данных движка (docs/06-data-model.md): события, состояние-проекция, коммиты. Без зависимостей от системы правил.
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type EntityId = string;

/** Подробности броска по схеме модуля правил (кубы, цепочки, итог): движок хранит их как есть. */
export type RollDetail = { [key: string]: Json };

export interface Item {
  id: string;
  /** Ссылка на запись контента модуля правил (например `weapon:short-sword`); у придуманных Мастером предметов её нет. */
  ref?: string;
  /** Название на языке повествования кампании — записывается при создании предмета. */
  name: string;
  qty: number;
  /** Свойства по схеме модуля правил (урон, доспех и т. п.). */
  data?: Record<string, Json>;
  /** Куда надет/взят (слот модуля правил) или `null`. */
  slot?: string | null;
}

export interface Entity {
  id: EntityId;
  kind: 'pc' | 'npc';
  name: string;
  /** uid владельца-игрока для `pc`. */
  ownerUid?: string;
  /** Данные по схеме модуля правил (для OpenD6 — характеристики, навыки, Очки тела, CP/FP). */
  data: Record<string, Json>;
  items: Item[];
  conditions: string[];
}

export interface Scene {
  name: string;
  description?: string;
}

export interface GameState {
  schema: 1;
  rules: { id: string; version: string; variant: string };
  entities: Record<EntityId, Entity>;
  scene: Scene | null;
  palette: string;
  flags: Record<string, Json>;
  /** Число закоммиченных ходов игроков/Мастера (для нумерации в интерфейсе). */
  turn: number;
}

/** Операции над `entity.data` по пути через точку: `body.points`, `skills.dodge`. */
export type PatchOp =
  | { op: 'set'; path: string; value: Json }
  | { op: 'inc'; path: string; by: number }
  | { op: 'push'; path: string; value: Json }
  | { op: 'remove'; path: string };

/** Запись броска в журнале. Кроме кубов хранит смысл броска, чтобы хронику можно было нарисовать без правил. */
export interface RollRecord {
  roll: RollDetail;
  reason: string;
  actorId?: EntityId;
  attribute?: string;
  skill?: string;
  difficulty?: number;
  success?: boolean;
  margin?: number;
  /** Кто видит бросок: все игроки или только Мастер (шифруется в облаке, ADR-0010). */
  visibility: 'all' | 'dm';
}

export type GameEvent =
  | { t: 'narration'; text: string; speaker?: 'dm' | EntityId }
  | { t: 'intent'; uid: string; charId: EntityId; text: string }
  | ({ t: 'roll' } & RollRecord)
  | { t: 'entity.created'; entity: Entity }
  | { t: 'entity.patched'; id: EntityId; ops: PatchOp[] }
  | { t: 'entity.removed'; id: EntityId }
  | { t: 'item.added'; entityId: EntityId; item: Item }
  | { t: 'item.removed'; entityId: EntityId; itemId: string; qty?: number }
  | { t: 'item.slot'; entityId: EntityId; itemId: string; slot: string | null }
  | { t: 'condition.set'; entityId: EntityId; condition: string; on: boolean }
  | { t: 'scene.set'; scene: Scene }
  | { t: 'palette.set'; paletteId: string; reason: string }
  | { t: 'flag.set'; key: string; value: Json }
  | { t: 'turn.ended'; suggestions: string[] }
  | { t: 'revert'; targetSeq: number };

export type CommitKind = 'turn' | 'ui_action' | 'maintenance' | 'revert' | 'system';

export interface Commit {
  /** Монотонный номер в кампании, начиная с 1. */
  seq: number;
  turnId: string;
  kind: CommitKind;
  /** Мс с эпохи, задаётся снаружи (движок часов не читает). */
  createdAt: number;
  /** Состояние RNG ПОСЛЕ коммита — из него продолжаются броски следующего хода. */
  rngState: string;
  promptVersion?: string;
  events: GameEvent[];
}
