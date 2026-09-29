// Персонаж OpenD6: схема данных в `entity.data`, проверки, производные величины (уровень ранения, Strength Damage).
// Источники: adventure p.10–12 (создание), p.15 (Очки тела, Strength Damage), fantasy p.65 (таблица уровней ран).
import { z } from 'zod';
import { addCodes, formatDieCode, fromPips, parseDieCode, toPips, type DieCode } from './dice';
import type { Entity, Json } from '../../engine/types';
import { fail, ok, type DerivedStats, type Lang, type Result } from '../api';
import { findAttribute, findSkill, getVariant, type VariantDef } from './data';

export const ZERO: DieCode = { dice: 0, pips: 0 };

const codeString = z.string().refine((v) => {
  try {
    parseDieCode(v);
    return true;
  } catch {
    return false;
  }
}, 'некорректный код кубов');

const localized = z.object({ ru: z.string(), en: z.string() });

/** Преимущество, недостаток или особая способность (OpenD6: adventure p.20–36): механику по описанию применяет Мастер. */
export const traitSchema = z.object({
  kind: z.enum(['advantage', 'disadvantage', 'ability']),
  name: localized,
  /** Ранг (R1, R2…). */
  rank: z.number().int().min(1).optional(),
  text: localized,
});

export type Trait = z.infer<typeof traitSchema>;

export const characterDataSchema = z.object({
  variant: z.enum(['fantasy', 'adventure']),
  /** Характеристики кодами: «3D+1». Экстранормальные, которых нет, считаются 0D. */
  attributes: z.record(z.string(), codeString),
  /** Навыки — надбавка над характеристикой («1D+1» = навык на 1D+1 выше характеристики). */
  skills: z.record(z.string(), codeString).default({}),
  body: z.object({ points: z.number().int().min(0), max: z.number().int().min(1) }),
  move: z.number().int().min(0).default(10),
  /** Очки персонажа и судьбы. */
  points: z.object({ cp: z.number().int().min(0), fp: z.number().int().min(0) }).default({ cp: 5, fp: 1 }),
  /** Кратко о персонаже: шаблон, профессия — для Мастера и листа. */
  concept: z.string().optional(),
  /** Средства (Funds, код кубов) — для покупок в современных сеттингах (OpenD6: adventure p.113). */
  funds: codeString.optional(),
  /** Серебро — деньги в фэнтези-сеттингах. */
  silver: z.number().int().min(0).optional(),
  traits: z.array(traitSchema).default([]),
});

export type CharacterData = z.infer<typeof characterDataSchema>;

/** Разбор `entity.data` с проверкой по варианту. Ошибки — понятным текстом (их читает и игрок, и LLM). */
export function readCharacter(entity: Entity): Result<CharacterData> {
  const parsed = characterDataSchema.safeParse(entity.data);
  if (!parsed.success) return fail(`«${entity.name}»: неверные данные персонажа — ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  const data = parsed.data;
  const variant = getVariant(data.variant)!;
  for (const id of Object.keys(data.attributes)) if (!findAttribute(variant, id)) return fail(`«${entity.name}»: характеристики «${id}» нет в варианте ${variant.id}`);
  for (const id of Object.keys(data.skills)) if (!findSkill(variant, id)) return fail(`«${entity.name}»: навыка «${id}» нет в варианте ${variant.id}`);
  return ok(data);
}

export function attributeCode(data: CharacterData, attributeId: string): DieCode {
  const raw = data.attributes[attributeId];
  return raw === undefined ? ZERO : parseDieCode(raw);
}

/** Код навыка целиком: характеристика + надбавка навыка. */
export function skillCode(data: CharacterData, variant: VariantDef, skillId: string): DieCode | undefined {
  const ref = findSkill(variant, skillId);
  if (!ref) return undefined;
  const adds = data.skills[skillId];
  return addCodes(attributeCode(data, ref.attribute.id), adds === undefined ? ZERO : parseDieCode(adds));
}

export interface RollBase {
  code: DieCode;
  attribute: string;
  skill?: string;
  /** Навыка нет — бросается характеристика (Мастер может добавить +5 к сложности, adventure p.49). */
  untrained: boolean;
}

/**
 * Что бросать. Только навык — характеристика берётся из него; только характеристика — бросок характеристики;
 * оба — «альтернативная характеристика» (adventure p.49): надбавка навыка переносится на другую характеристику.
 */
export function rollBase(data: CharacterData, variant: VariantDef, args: { skill?: string | undefined; attribute?: string | undefined }): Result<RollBase> {
  if (args.skill) {
    const ref = findSkill(variant, args.skill);
    if (!ref) return fail(`Навыка «${args.skill}» нет в варианте ${variant.id}. Допустимые: ${variant.attributes.flatMap((x) => x.skills.map((y) => y.id)).join(', ')}`);
    const adds = data.skills[args.skill];
    const addsCode = adds === undefined ? ZERO : parseDieCode(adds);
    const attributeId = args.attribute ?? ref.attribute.id;
    if (!findAttribute(variant, attributeId)) return fail(`Характеристики «${attributeId}» нет в варианте ${variant.id}`);
    return ok({ code: addCodes(attributeCode(data, attributeId), addsCode), attribute: attributeId, skill: args.skill, untrained: adds === undefined });
  }
  if (!args.attribute) return fail('Нужно указать навык или характеристику');
  if (!findAttribute(variant, args.attribute)) return fail(`Характеристики «${args.attribute}» нет в варианте ${variant.id}`);
  return ok({ code: attributeCode(data, args.attribute), attribute: args.attribute, untrained: false });
}

// --- Уровни ранения (fantasy p.65; сверено по картинке страницы) ---------------------------------------------------

export type WoundLevel = 'healthy' | 'bruised' | 'stunned' | 'wounded' | 'severely-wounded' | 'incapacitated' | 'mortally-wounded' | 'dead';

export interface WoundInfo {
  id: WoundLevel;
  /** Штраф к броскам в кубах (положительное число). */
  penaltyDice: number;
  /** Не может действовать (без сознания или мёртв). */
  cannotAct: boolean;
}

const WOUND: Record<WoundLevel, WoundInfo> = {
  healthy: { id: 'healthy', penaltyDice: 0, cannotAct: false },
  bruised: { id: 'bruised', penaltyDice: 0, cannotAct: false },
  stunned: { id: 'stunned', penaltyDice: 1, cannotAct: false },
  wounded: { id: 'wounded', penaltyDice: 1, cannotAct: false },
  'severely-wounded': { id: 'severely-wounded', penaltyDice: 2, cannotAct: false },
  incapacitated: { id: 'incapacitated', penaltyDice: 3, cannotAct: false },
  'mortally-wounded': { id: 'mortally-wounded', penaltyDice: 0, cannotAct: true },
  dead: { id: 'dead', penaltyDice: 0, cannotAct: true },
};

/** Границы по доле оставшихся Очков тела: 81–99% ушиб, 60–80 оглушён, 40–59 ранен, 20–39 тяжело ранен, 10–19 недееспособен, 1–9 при смерти, 0 мёртв. */
export function woundLevel(points: number, max: number): WoundInfo {
  if (points <= 0) return WOUND.dead;
  if (points >= max) return WOUND.healthy;
  const percent = (points / max) * 100;
  if (percent >= 81) return WOUND.bruised;
  if (percent >= 60) return WOUND.stunned;
  if (percent >= 40) return WOUND.wounded;
  if (percent >= 20) return WOUND['severely-wounded'];
  if (percent >= 10) return WOUND.incapacitated;
  return WOUND['mortally-wounded'];
}

/** Strength Damage: кубы Телосложения без пипов, делённые на 2 с округлением вверх (adventure p.15, p.61). */
export function strengthDamage(physique: DieCode): DieCode {
  return { dice: Math.ceil(Math.max(0, physique.dice) / 2), pips: 0 };
}

export function deriveStats(entity: Entity): Result<DerivedStats> {
  const data = readCharacter(entity);
  if (!data.ok) return data;
  const w = woundLevel(data.value.body.points, data.value.body.max);
  return ok({
    woundLevel: w.id,
    woundPenaltyDice: w.penaltyDice,
    incapacitated: w.cannotAct,
    dead: w.id === 'dead',
    body: { ...data.value.body },
    move: data.value.move,
    strengthDamage: formatDieCode(strengthDamage(attributeCode(data.value, 'physique'))),
  });
}

// --- Проверка создания персонажа (adventure p.10, p.12) -------------------------------------------------------------

export interface CreationReport {
  errors: string[];
  /** Потрачено кубов на характеристики (в пипах) из 18D = 54. */
  attributePips: number;
  /** Потрачено на навыки (в пипах) из 7D = 21. */
  skillPips: number;
}

export const CREATION_ATTRIBUTE_PIPS = 18 * 3;
export const CREATION_SKILL_PIPS = 7 * 3;
/** Не больше +3D над характеристикой в один навык при создании. */
export const CREATION_SKILL_MAX_PIPS = 3 * 3;

/** Проверка характеристик: 18D всего, каждая обычная 1D…5D (экстранормальная без границ). Ошибки на языке `lang`. */
export function validateAttributes(data: CharacterData, lang: Lang = 'ru'): { errors: string[]; pips: number } {
  const variant = getVariant(data.variant)!;
  const errors: string[] = [];
  let pips = 0;
  for (const attr of variant.attributes) {
    const code = attributeCode(data, attr.id);
    const total = toPips(code);
    pips += total;
    if (attr.extranormal) continue;
    if (code.dice < 1) errors.push(lang === 'ru' ? `${attr.name.ru}: минимум 1D` : `${attr.name.en}: at least 1D`);
    if (total > 5 * 3) errors.push(lang === 'ru' ? `${attr.name.ru}: максимум 5D` : `${attr.name.en}: at most 5D`);
  }
  if (pips !== CREATION_ATTRIBUTE_PIPS) {
    const got = formatDieCode(fromPips(pips));
    errors.push(lang === 'ru' ? `На характеристики нужно ровно 18D, распределено ${got}` : `Attributes must total exactly 18D, got ${got}`);
  }
  return { errors, pips };
}

/** Проверка навыков: до 7D всего, не больше +3D в один, положительные надбавки, экстранормальным нужны кубы. */
export function validateSkills(data: CharacterData, lang: Lang = 'ru'): { errors: string[]; pips: number } {
  const variant = getVariant(data.variant)!;
  const errors: string[] = [];
  let pips = 0;
  for (const [id, adds] of Object.entries(data.skills)) {
    const ref = findSkill(variant, id)!;
    const name = ref.skill.name[lang];
    const total = toPips(parseDieCode(adds));
    pips += total;
    if (total < 1) errors.push(lang === 'ru' ? `${name}: надбавка должна быть положительной` : `${name}: the bonus must be positive`);
    if (total > CREATION_SKILL_MAX_PIPS) errors.push(lang === 'ru' ? `${name}: не больше +3D над характеристикой при создании` : `${name}: at most +3D over the attribute at creation`);
    if (ref.attribute.extranormal && toPips(attributeCode(data, ref.attribute.id)) < 3) {
      errors.push(lang === 'ru' ? `${name}: у характеристики «${ref.attribute.name.ru}» нет кубов` : `${name}: the attribute "${ref.attribute.name.en}" has no dice`);
    }
  }
  if (pips > CREATION_SKILL_PIPS) {
    const got = formatDieCode(fromPips(pips));
    errors.push(lang === 'ru' ? `На навыки не больше 7D, распределено ${got}` : `At most 7D for skills, got ${got}`);
  }
  return { errors, pips };
}

/**
 * Проверка «своего» персонажа по правилам «Defined Limits»: 18D на характеристики (1D…5D, экстранормальная без границ),
 * 7D на навыки (не больше +3D в навык). Шаблоны книги характеристики уже распределили (у Телохранителя 18D+1, см. templates.ts).
 */
export function validateCreation(data: CharacterData): CreationReport {
  const attributes = validateAttributes(data);
  const skills = validateSkills(data);
  return { errors: [...attributes.errors, ...skills.errors], attributePips: attributes.pips, skillPips: skills.pips };
}

/** Данные для `entity.created` из готового описания. */
export function characterEntity(input: { id: string; name: string; kind?: 'pc' | 'npc'; ownerUid?: string; data: CharacterData; items?: Entity['items'] }): Entity {
  return {
    id: input.id,
    kind: input.kind ?? 'pc',
    name: input.name,
    ...(input.ownerUid ? { ownerUid: input.ownerUid } : {}),
    data: input.data as unknown as Record<string, Json>,
    items: input.items ?? [],
    conditions: [],
  };
}
