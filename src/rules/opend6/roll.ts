// Произвольный бросок без персонажа: классическая формула (`2d6+1`, случайные таблицы) или код кубов OpenD6 (`4D+1`, с Wild Die).
import { rollClassic } from '../../engine/classic';
import type { GameEvent, Json } from '../../engine/types';
import { fail, ok, type Outcome, type Result, type RollArgs, type RulesCtx } from '../api';
import { parseDieCode, rollPool } from './dice';
import { resolveOptions } from './options';

const CLASSIC = /^\s*\d+\s*d\s*\d+/i;

export function roll(ctx: RulesCtx, args: RollArgs): Result<Outcome> {
  const visibility = args.visibility ?? 'all';
  const expr = args.expr.trim();
  if (CLASSIC.test(expr)) {
    let r;
    try {
      r = rollClassic(ctx.rng, expr);
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e));
    }
    const event: GameEvent = { t: 'roll', roll: r, reason: args.reason, visibility };
    return ok({ events: [event], result: { expr: r.expr, dice: r.dice, modifier: r.modifier, total: r.total } });
  }
  let code;
  try {
    code = parseDieCode(expr);
  } catch {
    return fail(`Некорректная формула «${args.expr}»: нужен код кубов (4D+1) или классическая формула (2d6+1)`);
  }
  if (code.dice < 1) return fail('В формуле нет кубов');
  if (code.dice > 30) return fail('Слишком много кубов (не больше 30D)');
  const r = rollPool(ctx.rng, { code, wildOne: resolveOptions(ctx.options).wildOne });
  const result: Record<string, Json> = { expr: r.code, total: r.total, dice: r.dice, wildDie: r.wild, complication: r.complication, wildOne: r.wildOne };
  return ok({ events: [{ t: 'roll', roll: r, reason: args.reason, visibility }], result });
}
