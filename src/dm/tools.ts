// Реестр инструментов Мастера. Схема каждого инструмента строится из ТЕКУЩЕГО состояния: id сущностей, навыки, палитры — `enum`,
// свободная строка допустима только для причин и повествовательных полей (иначе модель выдумывает id, ADR-0018).
import { z } from 'zod';
import type { Rng } from '../engine/rng';
import type { GameEvent, GameState, Item, Json } from '../engine/types';
import type { LlmToolDef } from './types';
import { fail, ok, type CheckArgs, type ContestSide, type HealArgs, type Lang, type Outcome, type Result, type RulesModule, type RulesOptions } from '../rules/api';

export interface ToolEnv {
  /** Состояние черновика хода на момент вызова: события предыдущих инструментов уже применены. */
  state: GameState;
  rng: Rng;
  rules: RulesModule;
  options: RulesOptions;
  /** Язык повествования: на нём названия предметов. */
  lang: Lang;
  variant: string;
  paletteIds: readonly string[];
}

export interface DmTool {
  name: string;
  description: string;
  schema: z.ZodType;
  run(env: ToolEnv, args: never): Result<Outcome>;
}

const reason = z.string().min(1).max(200).describe('Short reason shown in the log.');
const hidden = z.boolean().optional().describe('true: secret roll only the GM sees.');
const oneOf = (values: readonly string[], describe: string): z.ZodType<string> =>
  (values.length > 0 ? z.enum(values as [string, ...string[]]) : z.string()).describe(describe);

const slug = (text: string): string => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 30) || 'item';

/** Убирает `undefined`, чтобы объект проходил `exactOptionalPropertyTypes`; тип результата берётся из контекста вызова. */
function defined<R>(o: Record<string, unknown>): R {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as R;
}

function outcome(events: GameEvent[], result: Record<string, Json>): Result<Outcome> {
  return ok({ events, result });
}

export function buildTools(env: ToolEnv): DmTool[] {
  const { rules, variant } = env;
  const info = rules.variants.find((v) => v.id === variant);
  const entityIds = Object.keys(env.state.entities);
  const actor = oneOf(entityIds, 'Entity id.');
  const skills = oneOf(info?.attributes.flatMap((a) => a.skills.map((s) => s.id)) ?? [], 'Skill id.');
  const attributes = oneOf(info?.attributes.map((a) => a.id) ?? [], 'Attribute id.');
  const ctx = { state: env.state, rng: env.rng, options: env.options };

  const side = z.object({
    actorId: actor,
    skill: skills.optional(),
    attribute: attributes.optional(),
    modifiers: z.string().max(12).optional().describe('Die-code modifier such as "+1D", "-2", "-1D+1".'),
    actions: z.number().int().min(1).max(5).optional(),
    spend: z.object({ cp: z.number().int().min(0).max(10).optional(), fp: z.boolean().optional() }).optional(),
  });
  const sideOf = (s: z.infer<typeof side>): ContestSide => defined({ actorId: s.actorId, skill: s.skill, attribute: s.attribute, modifiers: s.modifiers, actions: s.actions, spend: s.spend && defined(s.spend) });

  const checkSchema = z.object({
    actorId: actor,
    skill: skills.optional().describe('Skill to roll. The attribute comes from the skill.'),
    attribute: attributes.optional().describe('Bare attribute roll, or an alternative attribute for the skill.'),
    difficulty: z.number().int().min(1).max(60).describe('5 very easy, 10 easy, 15 moderate, 20 difficult, 25 very difficult, 30 heroic.'),
    modifiers: z.string().max(12).optional().describe('Die-code modifier such as "+1D", "-2", "-1D+1" for gear or circumstances.'),
    actions: z.number().int().min(1).max(5).optional().describe('Actions declared this round (each beyond the first costs -1D).'),
    spend: z.object({ cp: z.number().int().min(0).max(10).optional(), fp: z.boolean().optional() }).optional().describe('ONLY what the player asked to spend in their latest message.'),
    wildOne: z.enum(['complication', 'cancel']).optional().describe('How to treat a 1 on the first Wild Die throw.'),
    reason,
    hidden,
  }).refine((a) => a.skill !== undefined || a.attribute !== undefined, { message: 'give skill or attribute' });

  const healSchema = z.object({
    targetId: actor,
    method: z.enum(['fixed', 'rest', 'medicine']),
    amount: z.number().int().min(1).max(200).optional().describe('method "fixed": Body Points restored (potions, magic).'),
    rest: z.enum(['full', 'light', 'hard']).optional().describe('method "rest": a full day of rest, light activity, or fighting/running.'),
    healerId: actor.optional().describe('method "medicine": who treats the patient.'),
    kitBonus: z.string().max(12).optional().describe('Bonus of the medical kit, e.g. "+1D".'),
    reason,
  }).superRefine((a, c) => {
    if (a.method === 'fixed' && a.amount === undefined) c.addIssue({ code: 'custom', message: 'method "fixed" needs amount' });
    if (a.method === 'rest' && a.rest === undefined) c.addIssue({ code: 'custom', message: 'method "rest" needs rest' });
    if (a.method === 'medicine' && a.healerId === undefined) c.addIssue({ code: 'custom', message: 'method "medicine" needs healerId' });
  });

  const tools: DmTool[] = [];
  const add = <S extends z.ZodType>(name: string, description: string, schema: S, run: (args: z.infer<S>) => Result<Outcome>): void => {
    tools.push({ name, description, schema, run: (_env: ToolEnv, args: never) => run(args as z.infer<S>) });
  };

  add('roll', 'Free roll not tied to a character: a classic formula ("2d6+1") or a die code with a Wild Die ("4D+1"). Use for random tables and hazards.',
    z.object({ expr: z.string().min(2).max(20), reason, hidden }),
    (a) => rules.roll(ctx, defined({ expr: a.expr, reason: a.reason, visibility: a.hidden ? ('dm' as const) : undefined })));

  add('check', 'Skill or attribute check for a character against a difficulty you choose BEFORE the roll. Returns total, success, margin and whether the Wild Die complicated it.', checkSchema, (a) =>
    rules.check(ctx, defined({ actorId: a.actorId, skill: a.skill, attribute: a.attribute, difficulty: a.difficulty, modifiers: a.modifiers, actions: a.actions, spend: a.spend && defined(a.spend), wildOne: a.wildOne, reason: a.reason, visibility: a.hidden ? ('dm' as const) : undefined }) as CheckArgs));

  add('contest', 'Opposed check between two characters. A tie goes to side "a" (the initiator).',
    z.object({ a: side.describe('Initiator.'), b: side.describe('Opponent.'), reason, hidden }),
    (x) => rules.contest(ctx, defined({ a: sideOf(x.a), b: sideOf(x.b), reason: x.reason, visibility: x.hidden ? ('dm' as const) : undefined })));

  add('apply_damage', 'Wound a character. "damage" is a die code ("3D+1"), a weapon code with "+" ("+1D", needs attackerId: added to the attacker\'s Strength Damage) or a fixed number. Armor is applied by the engine.',
    z.object({
      targetId: actor,
      damage: z.union([z.string().min(1).max(12), z.number().int().min(0).max(200)]),
      attackerId: actor.optional(),
      zone: z.string().max(20).optional().describe('Hit location such as "legs" or "head" for zoned armor.'),
      shielded: z.boolean().optional().describe('true if the target blocked with a shield.'),
      ignoreArmor: z.boolean().optional().describe('Falls, poison, fire.'),
      reason,
    }),
    (a) => rules.applyDamage(ctx, defined({ targetId: a.targetId, damage: a.damage, attackerId: a.attackerId, zone: a.zone, shielded: a.shielded, ignoreArmor: a.ignoreArmor, reason: a.reason })));

  add('heal', 'Restore Body Points: fixed amount, natural rest, or treatment by a healer.', healSchema, (a) => {
    const base = { targetId: a.targetId, reason: a.reason };
    const args: HealArgs =
      a.method === 'fixed' ? { ...base, method: 'fixed', amount: a.amount! }
      : a.method === 'rest' ? { ...base, method: 'rest', rest: a.rest! }
      : defined({ ...base, method: 'medicine' as const, healerId: a.healerId!, kitBonus: a.kitBonus });
    return rules.heal(ctx, args);
  });

  add('set_condition', 'Set or clear a status condition on a character (poisoned, prone, blinded, burning, ...).',
    z.object({ targetId: actor, condition: z.string().min(2).max(30).regex(/^[a-z][a-z0-9-]*$/), on: z.boolean() }),
    (a) => {
      const entity = env.state.entities[a.targetId];
      if (!entity) return fail(`Unknown entity ${a.targetId}`);
      const events: GameEvent[] = [{ t: 'condition.set', entityId: a.targetId, condition: a.condition, on: a.on }];
      const conditions = a.on ? [...new Set([...entity.conditions, a.condition])] : entity.conditions.filter((c) => c !== a.condition);
      return outcome(events, { target: a.targetId, conditions });
    });

  add('find_item', 'Search the equipment catalog by name (Russian or English) to get catalog ids for give_item.',
    z.object({ query: z.string().min(2).max(40) }),
    (a) => {
      const found = rules.items.search(variant, a.query, env.lang);
      return outcome([], { matches: found.map((f) => defined({ id: f.id, name: f.name, price: f.price, note: f.note })) as Json, hint: found.length === 0 ? 'no matches: try another word or give a custom item' : 'use catalogId with give_item' });
    });

  add('give_item', 'Give a character an item: a catalog item (catalogId from find_item) or a custom item (name only, no mechanical properties).',
    z.object({
      targetId: actor,
      catalogId: z.string().min(1).max(60).optional(),
      name: z.string().min(1).max(60).optional().describe('Custom item name in the narration language.'),
      note: z.string().max(200).optional().describe('Custom item description.'),
      qty: z.number().int().min(1).max(99).optional(),
    }).refine((a) => (a.catalogId === undefined) !== (a.name === undefined), { message: 'give exactly one of catalogId or name' }),
    (a) => {
      const entity = env.state.entities[a.targetId];
      if (!entity) return fail(`Unknown entity ${a.targetId}`);
      const qty = a.qty ?? 1;
      let item: Item | undefined;
      if (a.catalogId !== undefined) {
        item = rules.items.make(variant, a.catalogId, env.lang, qty);
        if (!item) return fail(`Unknown catalogId "${a.catalogId}". Use find_item to search, or give a custom item with "name".`);
      } else {
        const base = `custom-${slug(a.name!)}`;
        let id = base;
        for (let n = 2; entity.items.some((i) => i.id === id && i.name !== a.name); n++) id = `${base}-${n}`;
        item = { id, name: a.name!, qty, slot: null, ...(a.note ? { data: { note: a.note } } : {}) };
      }
      return outcome([{ t: 'item.added', entityId: a.targetId, item }], { target: a.targetId, item: item.id, name: item.name, qty });
    });

  add('take_item', 'Remove an item (or some of a stack) from a character: used up, lost, stolen, sold.',
    z.object({ targetId: actor, itemId: z.string().min(1).max(60), qty: z.number().int().min(1).max(99).optional() }),
    (a) => {
      const entity = env.state.entities[a.targetId];
      const held = entity?.items.find((i) => i.id === a.itemId);
      if (!entity) return fail(`Unknown entity ${a.targetId}`);
      if (!held) return fail(`${entity.name} has no item "${a.itemId}". Items: ${entity.items.map((i) => i.id).join(', ') || 'none'}`);
      const qty = a.qty ?? held.qty;
      if (qty > held.qty) return fail(`${entity.name} has only ${held.qty} of "${held.name}"`);
      return outcome([{ t: 'item.removed', entityId: a.targetId, itemId: a.itemId, qty }], { target: a.targetId, item: a.itemId, removed: qty, left: held.qty - qty });
    });

  add('award_points', 'Reward characters with Character Points (experience) and Fate Points.',
    z.object({ targetIds: z.array(actor).min(1).max(8), cp: z.number().int().min(0).max(10), fp: z.number().int().min(0).max(3).optional(), reason }),
    (a) => rules.awardPoints(ctx, defined({ targetIds: a.targetIds, cp: a.cp, fp: a.fp, reason: a.reason })));

  add('create_npc', 'Create a simple NPC (all attributes at one level) so you can roll for it or hurt it. Returns its id.',
    z.object({ name: z.string().min(1).max(40), tier: z.enum(rules.npc.tiers as [string, ...string[]]).describe('weak 2D, average 3D, strong 4D, elite 5D in every attribute.'), role: z.string().max(40).optional() }),
    (a) => {
      let n = 1;
      while (env.state.entities[`npc-${n}`]) n++;
      const created = rules.npc.create(variant, defined({ id: `npc-${n}`, name: a.name, tier: a.tier as 'weak', role: a.role }));
      if (!created.ok) return created;
      return outcome([{ t: 'entity.created', entity: created.value }], { id: created.value.id, name: created.value.name, tier: a.tier });
    });

  add('set_scene', 'Change the current scene: the location the hero is in now.',
    z.object({ name: z.string().min(1).max(80), description: z.string().max(400).optional() }),
    (a) => outcome([{ t: 'scene.set', scene: defined({ name: a.name, description: a.description }) }], { scene: a.name }));

  add('set_flag', 'Store a story fact. Key "world" holds the world sketch written in the opening turn (canon).',
    z.object({ key: z.string().regex(/^[a-z][a-z0-9_.-]{0,39}$/), value: z.union([z.string().max(2000), z.number(), z.boolean()]) }),
    (a) => outcome([{ t: 'flag.set', key: a.key, value: a.value }], { key: a.key }));

  add('set_palette', 'Change the interface color palette to fit the mood of a scene (rarely).',
    z.object({ paletteId: oneOf(env.paletteIds, 'Palette id.'), reason }),
    (a) => outcome([{ t: 'palette.set', paletteId: a.paletteId, reason: a.reason }], { palette: a.paletteId }));

  add('rules_lookup', 'Short reference on a rules topic.',
    z.object({ topic: z.string().min(2).max(40) }),
    (a) => {
      const text = rules.lookup(a.topic, 'en');
      return text ? outcome([], { topic: a.topic, text }) : fail(`Unknown topic. Available: ${rules.lookupTopics.join(', ')}`);
    });

  add('end_turn', 'ALWAYS the last call of a turn, after the narration. Offers the player up to 4 short suggested actions.',
    z.object({ suggestions: z.array(z.string().min(1).max(80)).max(4).optional() }),
    (a) => outcome([{ t: 'turn.ended', suggestions: a.suggestions ?? [] }], { ended: true }));

  return tools;
}

/** Описания инструментов для провайдера: JSON Schema из zod. */
export function toolDefs(tools: readonly DmTool[]): LlmToolDef[] {
  return tools.map((t) => {
    const { $schema: _ignored, ...parameters } = z.toJSONSchema(t.schema) as Record<string, unknown>;
    return { name: t.name, description: t.description, parameters };
  });
}
