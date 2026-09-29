// Проверки навыков и характеристик, встречные проверки, траты Очков персонажа и судьбы.
// Источники: adventure p.47–48 (Wild Die, CP, FP), p.49–50 (действия, штраф за несколько действий), p.53–54 (сложности, встречные).
import { addCodes, formatDieCode, judge, parseDieCode, rollPool, type DieCode, type PoolRoll } from './dice';
import type { Entity, GameEvent, Json, PatchOp, RollRecord } from '../../engine/types';
import { fail, ok, type CheckArgs, type ContestArgs, type ContestSide, type Outcome, type Result, type RulesCtx, type Spend } from '../api';
import { getVariant, type VariantDef } from './data';
import { resolveOptions, type OpenD6Options } from './options';
import { readCharacter, rollBase, woundLevel, type CharacterData } from './character';

export const MAX_DIFFICULTY = 60;

interface Actor {
  entity: Entity;
  data: CharacterData;
  variant: VariantDef;
}

export function loadActor(ctx: RulesCtx, id: string): Result<Actor> {
  const entity = ctx.state.entities[id];
  if (!entity) return fail(`Нет персонажа «${id}». Известные: ${Object.keys(ctx.state.entities).join(', ') || 'никого'}`);
  const data = readCharacter(entity);
  if (!data.ok) return data;
  return ok({ entity, data: data.value, variant: getVariant(data.value.variant)! });
}

/** Проверяет траты и возвращает патч, уменьшающий CP/FP. */
export function planSpend(actor: Actor, spend: Spend | undefined, options: OpenD6Options): Result<{ cp: number; fp: boolean; ops: PatchOp[] }> {
  const cp = Math.floor(spend?.cp ?? 0);
  const fp = spend?.fp ?? false;
  if (cp < 0) return fail('Очков персонажа нельзя тратить меньше нуля');
  if (cp > 0 && fp && !options.cinematic) return fail('Очки персонажа и судьбы нельзя тратить на один бросок (adventure p.47)');
  if (cp > actor.data.points.cp) return fail(`У «${actor.entity.name}» только ${actor.data.points.cp} Очков персонажа`);
  if (cp > options.cpMaxPerRoll) return fail(`На один бросок не больше ${options.cpMaxPerRoll} Очков персонажа (лимит приключения)`);
  if (fp && actor.data.points.fp < 1) return fail(`У «${actor.entity.name}» нет Очков судьбы`);
  const ops: PatchOp[] = [];
  if (cp > 0) ops.push({ op: 'inc', path: 'points.cp', by: -cp });
  if (fp) ops.push({ op: 'inc', path: 'points.fp', by: -1 });
  return ok({ cp, fp, ops });
}

const MINUS_ONE_DIE: DieCode = { dice: -1, pips: 0 };

/** Штрафы броска: раны, лишние действия, модификатор от Мастера. */
function rollMods(actor: Actor, side: { modifiers?: string | undefined; actions?: number | undefined }): Result<{ mods: DieCode; notes: string[] }> {
  const notes: string[] = [];
  let mods: DieCode = { dice: 0, pips: 0 };
  const w = woundLevel(actor.data.body.points, actor.data.body.max);
  if (w.cannotAct) return fail(`«${actor.entity.name}» не может действовать (${w.id === 'dead' ? 'мёртв' : 'без сознания'})`);
  if (w.penaltyDice > 0) {
    mods = addCodes(mods, { dice: -w.penaltyDice, pips: 0 });
    notes.push(`раны: −${w.penaltyDice}D`);
  }
  const actions = Math.max(1, Math.floor(side.actions ?? 1));
  if (actions > 1) {
    for (let i = 1; i < actions; i++) mods = addCodes(mods, MINUS_ONE_DIE);
    notes.push(`действий за раунд ${actions}: −${actions - 1}D`);
  }
  if (side.modifiers) {
    try {
      const m = parseDieCode(side.modifiers);
      mods = addCodes(mods, m);
      notes.push(`модификатор ${side.modifiers}`);
    } catch {
      return fail(`Некорректный модификатор «${side.modifiers}» (нужен код вроде +1D, -2, -1D+1)`);
    }
  }
  return ok({ mods, notes });
}

interface Rolled {
  roll: PoolRoll;
  events: GameEvent[];
  base: { attribute: string; skill?: string; untrained: boolean };
  notes: string[];
  record: Omit<RollRecord, 'success' | 'margin' | 'difficulty' | 'reason' | 'visibility'>;
}

/** Один бросок актёра: считает код, применяет штрафы и траты, бросает. События трат возвращаются вместе с записью броска отдельно (её достраивает вызывающий). */
function rollFor(ctx: RulesCtx, side: ContestSide, wildOne: CheckArgs['wildOne']): Result<Rolled> {
  const options = resolveOptions(ctx.options);
  const actor = loadActor(ctx, side.actorId);
  if (!actor.ok) return actor;
  const base = rollBase(actor.value.data, actor.value.variant, { skill: side.skill, attribute: side.attribute });
  if (!base.ok) return base;
  if (base.value.code.dice < 1) return fail(`У «${actor.value.entity.name}» нет кубов в «${base.value.skill ?? base.value.attribute}» — бросать нельзя`);
  const mods = rollMods(actor.value, side);
  if (!mods.ok) return mods;
  const spend = planSpend(actor.value, side.spend, options);
  if (!spend.ok) return spend;

  const roll = rollPool(ctx.rng, {
    code: base.value.code,
    mods: mods.value.mods,
    fate: spend.value.fp,
    extraWild: spend.value.cp,
    wildOne: wildOne ?? options.wildOne,
  });
  if (roll.impossible) return fail(`После штрафов у «${actor.value.entity.name}» не осталось кубов на этот бросок`);

  const events: GameEvent[] = [];
  if (spend.value.ops.length > 0) events.push({ t: 'entity.patched', id: side.actorId, ops: spend.value.ops });
  return ok({
    roll,
    events,
    base: { attribute: base.value.attribute, ...(base.value.skill ? { skill: base.value.skill } : {}), untrained: base.value.untrained },
    notes: mods.value.notes,
    record: { roll, actorId: side.actorId, attribute: base.value.attribute, ...(base.value.skill ? { skill: base.value.skill } : {}) },
  });
}

function rollSummary(r: Rolled): Record<string, Json> {
  return {
    rolled: r.roll.code,
    total: r.roll.total,
    dice: r.roll.dice,
    wildDie: r.roll.wild,
    ...(r.roll.cpWild.length > 0 ? { characterPointDice: r.roll.cpWild } : {}),
    complication: r.roll.complication,
    wildOne: r.roll.wildOne,
    ...(r.roll.cancelled !== null ? { cancelledHighestDie: r.roll.cancelled } : {}),
    spent: { characterPoints: r.roll.spent.cp, fatePoint: r.roll.spent.fp },
    attribute: r.base.attribute,
    ...(r.base.skill ? { skill: r.base.skill } : {}),
    untrained: r.base.untrained,
    ...(r.notes.length > 0 ? { modifiersApplied: r.notes } : {}),
  };
}

export function check(ctx: RulesCtx, args: CheckArgs): Result<Outcome> {
  if (!Number.isInteger(args.difficulty) || args.difficulty < 1 || args.difficulty > MAX_DIFFICULTY) {
    return fail(`Сложность — целое от 1 до ${MAX_DIFFICULTY} (5 очень легко, 10 легко, 15 средне, 20 трудно, 25 очень трудно, 30 героически). Сложность 0 — автоуспех, бросок не нужен`);
  }
  const rolled = rollFor(ctx, args, args.wildOne);
  if (!rolled.ok) return rolled;
  const r = rolled.value;
  const verdict = judge(r.roll.total, args.difficulty);
  const events: GameEvent[] = [
    ...r.events,
    { t: 'roll', ...r.record, reason: args.reason, difficulty: args.difficulty, success: verdict.success, margin: verdict.margin, visibility: args.visibility ?? 'all' },
  ];
  return ok({
    events,
    result: { ...rollSummary(r), difficulty: args.difficulty, success: verdict.success, margin: verdict.margin },
  });
}

export function contest(ctx: RulesCtx, args: ContestArgs): Result<Outcome> {
  const a = rollFor(ctx, args.a, undefined);
  if (!a.ok) return a;
  const b = rollFor(ctx, args.b, undefined);
  if (!b.ok) return b;
  // При ничьей побеждает инициатор (adventure p.53).
  const aWins = a.value.roll.total >= b.value.roll.total;
  const visibility = args.visibility ?? 'all';
  const events: GameEvent[] = [
    ...a.value.events,
    ...b.value.events,
    { t: 'roll', ...a.value.record, reason: `${args.reason} (инициатор)`, success: aWins, margin: a.value.roll.total - b.value.roll.total, visibility },
    { t: 'roll', ...b.value.record, reason: `${args.reason} (противник)`, success: !aWins, margin: b.value.roll.total - a.value.roll.total, visibility },
  ];
  return ok({
    events,
    result: {
      winner: aWins ? 'a' : 'b',
      margin: Math.abs(a.value.roll.total - b.value.roll.total),
      a: { actorId: args.a.actorId, ...rollSummary(a.value) },
      b: { actorId: args.b.actorId, ...rollSummary(b.value) },
    },
  });
}

export { formatDieCode };
