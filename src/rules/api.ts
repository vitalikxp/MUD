// Интерфейс модуля правил (docs/05-rules-engine.md). Ядро и Мастер обращаются к правилам только через него.
// Функции модуля чистые: случайность приходит в `ctx.rng`, состояние — в `ctx.state`, результат — события и краткий отчёт для LLM.
import type { Rng } from '../engine/rng';
import type { Entity, EntityId, GameEvent, GameState, Item, Json, RollRecord } from '../engine/types';

export type Lang = 'ru' | 'en';
export interface LocalizedText {
  ru: string;
  en: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(error: string): Result<T> => ({ ok: false, error });

/** Настройки кампании, влияющие на правила: набор ключей задаёт модуль (`Record`), ядро лишь хранит и передаёт их. */
export type RulesOptions = Readonly<Record<string, Json>>;

export interface RulesCtx {
  state: GameState;
  rng: Rng;
  options: RulesOptions;
}

export interface Outcome {
  events: GameEvent[];
  /** То, что возвращается Мастеру (LLM) как результат инструмента. */
  result: Record<string, Json>;
}

export interface Spend {
  /** Очки персонажа: каждое — дополнительный Wild Die. */
  cp?: number;
  /** Очко судьбы: удвоить кубы. */
  fp?: boolean;
}

export interface CheckArgs {
  actorId: EntityId;
  /** Навык; характеристика берётся из него. */
  skill?: string;
  /** Характеристика: без навыка — бросок характеристики, с навыком — альтернативная база. */
  attribute?: string;
  difficulty: number;
  /** Модификатор кода кубов: «+1D», «-2», «-1D+1». */
  modifiers?: string;
  /** Сколько действий заявлено в раунде (штраф −1D за каждое сверх первого). */
  actions?: number;
  spend?: Spend;
  reason: string;
  /** Как трактовать «критическую неудачу» кубов: осложнение или отмена наибольшего куба. Модуль вправе игнорировать. */
  wildOne?: 'complication' | 'cancel';
  visibility?: 'all' | 'dm';
}

export interface ContestSide {
  actorId: EntityId;
  skill?: string;
  attribute?: string;
  modifiers?: string;
  actions?: number;
  spend?: Spend;
}

export interface ContestArgs {
  /** Инициатор: при ничьей побеждает он. */
  a: ContestSide;
  b: ContestSide;
  reason: string;
  visibility?: 'all' | 'dm';
}

export interface DamageArgs {
  targetId: EntityId;
  /** Код урона («3D+1») или готовое число. */
  damage: string | number;
  reason: string;
  /** Не учитывать броню (падение, яд). */
  ignoreArmor?: boolean;
  /** Куда попало («legs», «head»): броня с указанной зоной защищает только её. */
  zone?: string;
  /** Персонаж прикрылся щитом от этой атаки: только тогда щит добавляет защиту. */
  shielded?: boolean;
  /** Кто наносит урон. Обязателен для оружия с «+» в коде (`+1D`): такой урон прибавляется к Силе удара атакующего. */
  attackerId?: EntityId;
}

export interface RollArgs {
  /** Классическая формула («2d6+1») или код кубов системы («4D+1»). */
  expr: string;
  reason: string;
  visibility?: 'all' | 'dm';
}

export type RestQuality = 'full' | 'light' | 'hard';

export type HealArgs =
  | { targetId: EntityId; method: 'fixed'; amount: number; reason: string }
  | { targetId: EntityId; method: 'rest'; rest: RestQuality; reason: string }
  | { targetId: EntityId; method: 'medicine'; healerId: EntityId; kitBonus?: string; reason: string };

export interface AwardArgs {
  targetIds: EntityId[];
  cp: number;
  fp?: number;
  reason: string;
}

export interface SheetRow {
  label: string;
  value: string;
  /** Подсказка (например, «навык +1D над характеристикой»). */
  hint?: string;
  /** Длинная запись в одну колонку: заголовок «название · значение», подсказка ниже абзацем (особенности, описания). */
  block?: boolean;
}

export interface SheetView {
  title: string;
  /** `brief` — раздел важен в тесной панели (здоровье, очки): он идёт первым, остальные ниже и прокручиваются. */
  sections: { heading: string; rows: SheetRow[]; brief?: boolean }[];
}

/** Кусок строки с кубами: обычный куб, Wild Die, дополнительный Wild Die (за Очко персонажа) или связки между ними. */
export interface DiceSpan {
  text: string;
  kind: 'die' | 'wild' | 'extra' | 'plain';
}

/** Бросок для хроники: что проверялось и с каким значением, баффы и дебаффы, выпавшие кубы, исход. Тексты — на языке интерфейса. */
export interface RollView {
  /** Причина броска словами Мастера. */
  head: string;
  /** Кто проверяет и что: «Ирма — навык «Взлом замков» (Координация), 4D+1». Нет у свободных бросков без персонажа. */
  value?: string;
  /** Баффы и дебаффы тегами в скобках с источником и итоговый код. Нет, если поправок не было. */
  mods?: string;
  /** Выпавшие кубы: `[4] + [4] + [6] + 1`; вид куба задаёт цвет. Пусто, если подробностей нет. */
  dice: DiceSpan[];
  /** Краткий исход: «4D+1 = 15 ≥ 12 · успех». Нет у бросков без сложности и без противника. */
  verdict?: { text: string; success: boolean };
}

export interface RollViewContext {
  lang: Lang;
  /** Вариант правил кампании: по нему берутся названия навыков и характеристик. */
  variant: string;
  /** Имя того, кто бросал (из состояния). */
  actorName?: string;
}

export interface InventoryRow {
  /** Идентификатор предмета в инвентаре героя (для действий). */
  id: string;
  name: string;
  qty: number;
  /** Надето или удерживается (в слоте), а не лежит в сумке. */
  worn: boolean;
  /** Название слота, если предмет надет: «доспех», «основная рука». */
  slotLabel?: string;
  /** Краткая сводка свойств предмета на языке интерфейса (урон, броня, описание). */
  detail?: string;
}

export interface InventoryView {
  title: string;
  /** Деньги и прочее, что показывается над списком: «Серебро 14». */
  summary: { label: string; value: string }[];
  rows: InventoryRow[];
}

/** Бытовые действия игрока с вещами (без Мастера): валидирует модуль, результат — события. Язык — язык записи-заметки (язык кампании). */
export interface EquipmentActions {
  /** Надеть или взять в руку. Без `slot` модуль выбирает подходящий сам; занятый слот освобождается (прежний предмет уходит в рюкзак). */
  equip(ctx: RulesCtx, args: { entityId: EntityId; itemId: string; slot?: string; lang: Lang }): Result<Outcome>;
  unequip(ctx: RulesCtx, args: { entityId: EntityId; itemId: string; lang: Lang }): Result<Outcome>;
  /** Выбросить всю стопку или `qty` штук. */
  drop(ctx: RulesCtx, args: { entityId: EntityId; itemId: string; qty?: number; lang: Lang }): Result<Outcome>;
}

export interface AttributeInfo {
  id: string;
  name: LocalizedText;
  extranormal: boolean;
  skills: { id: string; name: LocalizedText }[];
}

export interface VariantInfo {
  id: string;
  name: LocalizedText;
  attributes: AttributeInfo[];
  initiativeAttribute: string;
}

export interface DerivedStats {
  woundLevel: string;
  /** Штраф к броскам от ран, в кубах (положительное число). */
  woundPenaltyDice: number;
  /** Действовать нельзя (без сознания, мёртв). */
  incapacitated: boolean;
  dead: boolean;
  body: { points: number; max: number };
  move: number;
  strengthDamage: string;
}

/** Навык в форме создания персонажа: база (код характеристики) и название. */
export interface CreationSkill {
  id: string;
  name: LocalizedText;
  attribute: LocalizedText;
  /** База навыка как её показывает система (для OpenD6 — код характеристики, «3D+1»). */
  base: string;
}

/** Готовый шаблон персонажа для выбора при создании. */
export interface CreationTemplate {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  /** Характеристики шаблона в порядке листа. */
  attributes: { name: LocalizedText; code: string }[];
  /** Особенности (преимущества, недостатки, способности) с рангом. */
  traits: LocalizedText[];
  /** Навыки, между которыми игрок распределяет очки. */
  skills: CreationSkill[];
}

/** Как распределяются очки навыков: `total` очков всего, не больше `maxPerSkill` в один навык, шаг — одно очко. */
export interface CreationBudget {
  total: number;
  maxPerSkill: number;
  /** Самое длинное имя героя (в символах). */
  maxNameLength: number;
  /** Очки → запись в системе правил (OpenD6: 5 → «1D+2»). */
  format(points: number): string;
}

export interface CreationInput {
  variant: string;
  templateId: string;
  name: string;
  ownerUid?: string;
  lang: Lang;
  /** Очки навыков по id навыка; нули можно опускать. */
  skills: Record<string, number>;
}

/** Уровень простого NPC (M1, без бестиария). */
export type NpcTier = 'weak' | 'average' | 'strong' | 'elite';

export interface NpcInput {
  id: string;
  name: string;
  tier: NpcTier;
  /** Кто это (стражник, торговец) — коротко, для листа и промпта. */
  role?: string;
}

export interface CharacterCreation {
  templates(variant: string): CreationTemplate[];
  budget(variant: string): CreationBudget;
  /** Собирает персонажа из шаблона и проверяет по правилам; ошибки — понятным текстом на языке ввода. */
  build(input: CreationInput): Result<Entity>;
}

export interface RulesModule {
  id: string;
  version: string;
  name: LocalizedText;
  variants: VariantInfo[];

  creation: CharacterCreation;

  derive(entity: Entity): DerivedStats;
  sheet(entity: Entity, lang: Lang): SheetView;
  /** Вещи героя для панели «Вещи»: список с количеством, слотом и сводкой свойств. */
  inventory(entity: Entity, lang: Lang): InventoryView;
  equipment: EquipmentActions;
  /** Расшифровка записи броска для хроники (запись в журнале хранит смысл броска, правила знают, как его читать). */
  describeRoll(roll: RollRecord, ctx: RollViewContext): RollView;

  roll(ctx: RulesCtx, args: RollArgs): Result<Outcome>;
  check(ctx: RulesCtx, args: CheckArgs): Result<Outcome>;
  contest(ctx: RulesCtx, args: ContestArgs): Result<Outcome>;
  applyDamage(ctx: RulesCtx, args: DamageArgs): Result<Outcome>;
  heal(ctx: RulesCtx, args: HealArgs): Result<Outcome>;
  awardPoints(ctx: RulesCtx, args: AwardArgs): Result<Outcome>;

  /** Простые NPC для проверок и урона (полноценный бестиарий — позже). */
  npc: {
    tiers: NpcTier[];
    create(variant: string, input: NpcInput): Result<Entity>;
  };
  /** Компактное описание персонажа для промпта Мастера (английский, с id навыков). */
  describe(entity: Entity): string;

  /** Каталог снаряжения: Мастер выдаёт предметы по id, а не выдумывает свойства. */
  items: {
    ids(variant: string): string[];
    /** Предмет для инвентаря из каталога; `undefined`, если такого id нет. */
    make(variant: string, id: string, lang: Lang, qty: number): Item | undefined;
    /** Поиск по id и названиям (RU и EN) — Мастер не помнит id каталога наизусть. */
    search(variant: string, query: string, lang: Lang, limit?: number): { id: string; name: string; price?: string; note?: string }[];
  };

  /** Короткое описание правил для системного промпта Мастера. */
  promptPrimer(variant: string, lang: Lang): string;
  /** Справка по теме (`rules_lookup`). */
  lookup(topic: string, lang: Lang): string | null;
  /** Темы справки. */
  lookupTopics: string[];
}
