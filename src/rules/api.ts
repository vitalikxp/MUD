// Интерфейс модуля правил (docs/05-rules-engine.md). Ядро и Мастер обращаются к правилам только через него.
// Функции модуля чистые: случайность приходит в `ctx.rng`, состояние — в `ctx.state`, результат — события и краткий отчёт для LLM.
import type { Rng } from '../engine/rng';
import type { Entity, EntityId, GameEvent, GameState, Json } from '../engine/types';

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
}

export interface SheetView {
  title: string;
  sections: { heading: string; rows: SheetRow[] }[];
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

export interface RulesModule {
  id: string;
  version: string;
  name: LocalizedText;
  variants: VariantInfo[];

  derive(entity: Entity): DerivedStats;
  sheet(entity: Entity, lang: Lang): SheetView;

  check(ctx: RulesCtx, args: CheckArgs): Result<Outcome>;
  contest(ctx: RulesCtx, args: ContestArgs): Result<Outcome>;
  applyDamage(ctx: RulesCtx, args: DamageArgs): Result<Outcome>;
  heal(ctx: RulesCtx, args: HealArgs): Result<Outcome>;
  awardPoints(ctx: RulesCtx, args: AwardArgs): Result<Outcome>;

  /** Короткое описание правил для системного промпта Мастера. */
  promptPrimer(variant: string, lang: Lang): string;
  /** Справка по теме (`rules_lookup`). */
  lookup(topic: string, lang: Lang): string | null;
}
