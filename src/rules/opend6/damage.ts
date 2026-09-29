// Урон, сопротивление, лечение и награды. Система Очков тела (adventure p.62–66).
import { formatDieCode, parseDieCode, rollPool, toPips, fromPips, addCodes, type DieCode } from './dice';
import type { Entity, GameEvent, Item, Json } from '../../engine/types';
import { fail, ok, type AwardArgs, type DamageArgs, type HealArgs, type Outcome, type RestQuality, type Result, type RulesCtx } from '../api';
import { attributeCode, rollBase, woundLevel, ZERO } from './character';
import { loadActor } from './checks';
import { resolveOptions } from './options';

/**
 * Броня: сумма кодов `data.armor` у предметов, надетых в слот (не в рюкзаке). Код может быть без кубов: «2» = Armor Value +2 (OpenD6: adventure p.115).
 * Предмет с `data.zone` («legs», «head») защищает только эту часть тела и учитывается, когда `zone` совпадает с зоной попадания.
 * Щит (`data.shield`) защищает, только если он удерживался между атакующим и владельцем (`shielded`; OpenD6: fantasy p.116).
 */
export function armorCode(entity: Entity, zone?: string, shielded = false): DieCode {
  let total = ZERO;
  for (const item of entity.items as Item[]) {
    const armor = item.data?.['armor'];
    if (!item.slot || typeof armor !== 'string') continue;
    if (item.data?.['shield'] === true && !shielded) continue;
    const itemZone = item.data?.['zone'];
    if (typeof itemZone === 'string' && itemZone !== zone) continue;
    try {
      total = addCodes(total, parseDieCode(armor));
    } catch {
      // Неверный код брони у придуманного Мастером предмета не должен ронять ход: считаем предмет без защиты.
    }
  }
  return total;
}

export function applyDamage(ctx: RulesCtx, args: DamageArgs): Result<Outcome> {
  const target = loadActor(ctx, args.targetId);
  if (!target.ok) return target;
  const { entity, data } = target.value;
  if (woundLevel(data.body.points, data.body.max).id === 'dead') return fail(`«${entity.name}» уже мёртв`);

  const events: GameEvent[] = [];
  let damageTotal: number;
  let damageCode: string;
  if (typeof args.damage === 'number') {
    if (!Number.isInteger(args.damage) || args.damage < 0) return fail('Урон — целое число не меньше нуля');
    damageTotal = args.damage;
    damageCode = String(args.damage);
  } else {
    let code: DieCode;
    try {
      code = parseDieCode(args.damage);
    } catch {
      return fail(`Некорректный код урона «${args.damage}» (например 3D, 2D+1)`);
    }
    if (code.dice < 1) return fail('Урон должен содержать хотя бы 1D');
    const roll = rollPool(ctx.rng, { code, wildOne: resolveOptions(ctx.options).wildOne });
    damageTotal = roll.total;
    damageCode = roll.code;
    events.push({ t: 'roll', roll, reason: `${args.reason} — урон`, visibility: 'all' });
  }

  // Сопротивление: бросок кода брони (в системе Очков тела Телосложение в него не входит, adventure p.62–63).
  let resistance = 0;
  let armor = ZERO;
  if (!args.ignoreArmor) {
    armor = armorCode(entity, args.zone, args.shielded);
    if (armor.dice >= 1) {
      const roll = rollPool(ctx.rng, { code: armor, wildOne: resolveOptions(ctx.options).wildOne });
      resistance = roll.total;
      events.push({ t: 'roll', roll, reason: `Сопротивление урону: ${entity.name}`, actorId: entity.id, visibility: 'all' });
    } else if (toPips(armor) > 0) {
      resistance = toPips(armor); // только пипы («+2»): постоянная защита, бросать нечего
    }
  }

  const taken = Math.max(0, damageTotal - resistance);
  const before = data.body.points;
  const after = Math.max(0, before - taken);
  if (after !== before) events.push({ t: 'entity.patched', id: entity.id, ops: [{ op: 'set', path: 'body.points', value: after }] });
  const level = woundLevel(after, data.body.max);
  if (level.id === 'dead') events.push({ t: 'condition.set', entityId: entity.id, condition: 'dead', on: true });
  else if (level.cannotAct) events.push({ t: 'condition.set', entityId: entity.id, condition: 'unconscious', on: true });

  return ok({
    events,
    result: {
      target: entity.id,
      damageRolled: damageCode,
      damageTotal,
      armor: formatDieCode(armor),
      resistanceTotal: resistance,
      bodyPointsLost: before - after,
      bodyPoints: after,
      bodyPointsMax: data.body.max,
      woundLevel: level.id,
      dead: level.id === 'dead',
      unconscious: level.id === 'mortally-wounded',
      ...(taken === 0 ? { note: 'Броня поглотила весь урон: ни царапины (ушиб, ссадина).' } : {}),
    },
  });
}

/** Естественное лечение и лечение навыком: результат броска → восстановленные Очки тела (adventure p.65, таблица «Body Points Healing»). */
export function healingTable(total: number): DieCode | number {
  if (total <= 0) return 0;
  if (total <= 5) return 2;
  if (total <= 10) return { dice: 1, pips: 0 };
  if (total <= 15) return { dice: 2, pips: 0 };
  if (total <= 20) return { dice: 3, pips: 0 };
  if (total <= 25) return { dice: 4, pips: 0 };
  if (total <= 30) return { dice: 5, pips: 0 };
  return { dice: 6, pips: 0 }; // 31 и выше («30+»)
}

const REST_MOD: Record<RestQuality, DieCode> = { full: { dice: 1, pips: 0 }, light: { dice: 0, pips: 0 }, hard: { dice: -1, pips: 0 } };

export function heal(ctx: RulesCtx, args: HealArgs): Result<Outcome> {
  const target = loadActor(ctx, args.targetId);
  if (!target.ok) return target;
  const { entity, data } = target.value;
  if (woundLevel(data.body.points, data.body.max).id === 'dead') return fail(`«${entity.name}» мёртв: обычным лечением не вернуть`);
  const missing = data.body.max - data.body.points;
  const events: GameEvent[] = [];
  const info: Record<string, Json> = {};
  let amount: number;

  if (args.method === 'fixed') {
    if (!Number.isInteger(args.amount) || args.amount < 1) return fail('Лечение — целое число больше нуля');
    amount = args.amount;
  } else {
    let total: number;
    if (args.method === 'rest') {
      // Телосложение + модификатор отдыха (+1D сутки покоя, 0 лёгкая активность, −1D бой и бег); раны здесь не штрафуют.
      const roll = rollPool(ctx.rng, { code: attributeCode(data, 'physique'), mods: REST_MOD[args.rest], wildOne: resolveOptions(ctx.options).wildOne });
      if (roll.impossible) return fail('Нет кубов для лечения');
      total = roll.total;
      events.push({ t: 'roll', roll, reason: `${args.reason}: естественное лечение`, actorId: entity.id, attribute: 'physique', visibility: 'all' });
      info['method'] = 'rest';
    } else {
      const healer = loadActor(ctx, args.healerId);
      if (!healer.ok) return healer;
      const skillId = healer.value.variant.id === 'fantasy' ? 'healing' : 'medicine';
      const base = rollBase(healer.value.data, healer.value.variant, { skill: skillId });
      if (!base.ok) return base;
      if (woundLevel(healer.value.data.body.points, healer.value.data.body.max).cannotAct) return fail(`«${healer.value.entity.name}» не может действовать`);
      let mods: DieCode = ZERO;
      if (args.kitBonus) {
        try {
          mods = parseDieCode(args.kitBonus);
        } catch {
          return fail(`Некорректный бонус аптечки «${args.kitBonus}»`);
        }
      }
      const roll = rollPool(ctx.rng, { code: base.value.code, mods, wildOne: resolveOptions(ctx.options).wildOne });
      if (roll.impossible) return fail('Нет кубов для лечения');
      total = roll.total;
      events.push({ t: 'roll', roll, reason: `${args.reason}: лечение навыком`, actorId: healer.value.entity.id, attribute: base.value.attribute, skill: skillId, visibility: 'all' });
      info['method'] = 'medicine';
      info['healer'] = healer.value.entity.id;
      info['note'] = 'Лечить одного пациента можно раз в сутки; помощники добавляют свой навык к первому лекарю.';
    }
    info['healingRoll'] = total;
    const row = healingTable(total);
    if (typeof row === 'number') {
      amount = row;
    } else {
      const roll = rollPool(ctx.rng, { code: row, wildOne: resolveOptions(ctx.options).wildOne });
      events.push({ t: 'roll', roll, reason: 'Восстановлено Очков тела', actorId: entity.id, visibility: 'all' });
      amount = roll.total;
    }
  }

  const restored = Math.min(missing, amount);
  const after = data.body.points + restored;
  if (restored > 0) events.push({ t: 'entity.patched', id: entity.id, ops: [{ op: 'inc', path: 'body.points', by: restored }] });
  const before = woundLevel(data.body.points, data.body.max);
  const level = woundLevel(after, data.body.max);
  if (before.cannotAct && !level.cannotAct) events.push({ t: 'condition.set', entityId: entity.id, condition: 'unconscious', on: false });
  return ok({
    events,
    result: { target: entity.id, ...info, bodyPointsRestored: restored, bodyPoints: after, bodyPointsMax: data.body.max, woundLevel: level.id },
  });
}

export function awardPoints(ctx: RulesCtx, args: AwardArgs): Result<Outcome> {
  const fp = args.fp ?? 0;
  if (!Number.isInteger(args.cp) || !Number.isInteger(fp) || args.cp < 0 || fp < 0 || args.cp + fp < 1) return fail('Награда — целые неотрицательные Очки персонажа/судьбы, хотя бы одно очко');
  if (args.targetIds.length === 0) return fail('Не указано, кого награждать');
  const events: GameEvent[] = [];
  const awarded: Json[] = [];
  for (const id of args.targetIds) {
    const t = loadActor(ctx, id);
    if (!t.ok) return t;
    const ops = [
      ...(args.cp > 0 ? [{ op: 'inc' as const, path: 'points.cp', by: args.cp }] : []),
      ...(fp > 0 ? [{ op: 'inc' as const, path: 'points.fp', by: fp }] : []),
    ];
    events.push({ t: 'entity.patched', id, ops });
    awarded.push({ id, cp: t.value.data.points.cp + args.cp, fp: t.value.data.points.fp + fp });
  }
  return ok({ events, result: { awardedEach: { characterPoints: args.cp, fatePoints: fp }, nowHave: awarded, reason: args.reason } });
}

export { toPips, fromPips };
