import { describe, expect, it } from 'vitest';
import { scriptedRng } from '../engine/testing';
import { opend6 } from '../rules/opend6';
import { DEFAULT_OPTIONS } from '../rules/opend6/options';
import { buildTools, toolDefs, type ToolEnv } from './tools';
import { heroDraft } from './testing';

/** Вызов инструмента как в оркестраторе: схема → run → события в черновик. */
function setup(rolls: number[] = []) {
  const { draft } = heroDraft(scriptedRng(rolls));
  const env = (): ToolEnv => ({ state: draft.state, rng: draft.rng, rules: opend6, options: { ...DEFAULT_OPTIONS }, lang: 'ru', variant: 'fantasy', paletteIds: ['terminal', 'amber'] });
  const call = (name: string, args: unknown) => {
    const tool = buildTools(env()).find((t) => t.name === name)!;
    const parsed = tool.schema.safeParse(args);
    if (!parsed.success) return { ok: false as const, error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
    const out = tool.run(env(), parsed.data as never);
    if (out.ok) draft.emit(...out.value.events);
    return out.ok ? { ok: true as const, result: out.value.result } : { ok: false as const, error: out.error };
  };
  return { draft, call, env };
}

describe('схемы инструментов', () => {
  it('JSON Schema без $schema; id сущностей, навыков и палитр — enum из текущего состояния', () => {
    const { env } = setup();
    const defs = toolDefs(buildTools(env()));
    const byName = Object.fromEntries(defs.map((d) => [d.name, d.parameters as { type: string; properties: Record<string, { enum?: string[] }>; $schema?: string }]));
    for (const d of defs) {
      expect(d.description.length).toBeGreaterThan(10);
      expect((d.parameters as { type: string }).type).toBe('object');
      expect(d.parameters).not.toHaveProperty('$schema');
    }
    expect(byName['check']!.properties['actorId']!.enum).toEqual(['hero']);
    expect(byName['check']!.properties['skill']!.enum).toContain('lockpicking');
    expect(byName['check']!.properties['attribute']!.enum).toContain('agility');
    expect(byName['set_palette']!.properties['paletteId']!.enum).toEqual(['terminal', 'amber']);
  });

  it('после create_npc его id появляется в enum следующих вызовов', () => {
    const { call, env } = setup();
    expect(call('create_npc', { name: 'Стражник', tier: 'average' })).toMatchObject({ ok: true, result: { id: 'npc-1' } });
    const defs = toolDefs(buildTools(env()));
    expect((defs.find((d) => d.name === 'apply_damage')!.parameters as { properties: { targetId: { enum: string[] } } }).properties.targetId.enum).toEqual(['hero', 'npc-1']);
  });
});

describe('механика', () => {
  it('roll: тайный бросок помечается dm; мусорная формула — отказ правил', () => {
    const { call, draft } = setup([3, 4]);
    expect(call('roll', { expr: '2d6', reason: 'слухи', hidden: true })).toMatchObject({ ok: true, result: { total: 7 } });
    expect(draft.events.at(-1)).toMatchObject({ t: 'roll', visibility: 'dm' });
    expect(call('roll', { expr: 'сто кубов', reason: 'r' })).toMatchObject({ ok: false });
  });

  it('check: нужен навык или характеристика; трата очков передаётся движку и списывается', () => {
    const { call, draft } = setup([1, 1, 1, 1, 1, 1, 5, 5]);
    expect(call('check', { actorId: 'hero', difficulty: 10, reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('skill or attribute') });
    expect(call('check', { actorId: 'hero', skill: 'stealth', difficulty: 60, reason: 'r', spend: { cp: 1 } })).toMatchObject({ ok: true, result: { spent: { characterPoints: 1 } } });
    expect((draft.state.entities['hero']!.data['points'] as { cp: number }).cp).toBe(4);
    expect(call('check', { actorId: 'hero', skill: 'stealth', difficulty: 61, reason: 'r' })).toMatchObject({ ok: false });
    expect(call('check', { actorId: 'nobody', skill: 'stealth', difficulty: 10, reason: 'r' })).toMatchObject({ ok: false });
  });

  it('contest и apply_damage против NPC; оружие «+1D» берёт Силу удара героя', () => {
    const { call, draft } = setup([2, 2, 2, 2, 5, 5, 5, 3, 3, 2]);
    call('create_npc', { name: 'Разбойник', tier: 'average', role: 'бандит' });
    expect(draft.state.entities['npc-1']).toMatchObject({ kind: 'npc', name: 'Разбойник' });
    expect(call('contest', { a: { actorId: 'hero', skill: 'stealth' }, b: { actorId: 'npc-1', attribute: 'acumen' }, reason: 'скрыться' })).toMatchObject({ ok: true, result: { winner: expect.stringMatching(/^[ab]$/) } });
    // Телосложение вора 3D → Сила удара 2D; «+1D» → 3D урона (два обычных куба и Wild Die)
    const hit = call('apply_damage', { targetId: 'npc-1', damage: '+1D', attackerId: 'hero', reason: 'кинжал' });
    expect(hit).toMatchObject({ ok: true, result: { damageRolled: '3D', target: 'npc-1' } });
    expect(call('apply_damage', { targetId: 'npc-1', damage: '+1D', reason: 'без атакующего' })).toMatchObject({ ok: false, error: expect.stringContaining('attackerId') });
  });

  it('heal: обязательные поля по способу', () => {
    const { call } = setup();
    expect(call('heal', { targetId: 'hero', method: 'fixed', reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('amount') });
    expect(call('heal', { targetId: 'hero', method: 'rest', reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('rest') });
    expect(call('heal', { targetId: 'hero', method: 'medicine', reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('healerId') });
    expect(call('heal', { targetId: 'hero', method: 'fixed', amount: 5, reason: 'зелье' })).toMatchObject({ ok: true });
  });

  it('set_condition: добавляет и снимает, формат имени проверяется', () => {
    const { call, draft } = setup();
    expect(call('set_condition', { targetId: 'hero', condition: 'poisoned', on: true })).toMatchObject({ ok: true, result: { conditions: ['poisoned'] } });
    expect(draft.state.entities['hero']!.conditions).toEqual(['poisoned']);
    expect(call('set_condition', { targetId: 'hero', condition: 'poisoned', on: false })).toMatchObject({ ok: true, result: { conditions: [] } });
    expect(call('set_condition', { targetId: 'hero', condition: 'Очень Плохо', on: true })).toMatchObject({ ok: false });
  });

  it('award_points: CP и FP героя растут', () => {
    const { call, draft } = setup();
    expect(call('award_points', { targetIds: ['hero'], cp: 2, fp: 1, reason: 'сцена' })).toMatchObject({ ok: true });
    expect(draft.state.entities['hero']!.data['points']).toEqual({ cp: 7, fp: 2 });
    expect(call('award_points', { targetIds: [], cp: 1, reason: 'r' })).toMatchObject({ ok: false });
  });
});

describe('предметы', () => {
  it('find_item → give_item по каталогу: предмет с ref и названием на языке повествования', () => {
    const { call, draft } = setup();
    const found = call('find_item', { query: 'длинный лук' });
    expect(found).toMatchObject({ ok: true, result: { matches: [expect.objectContaining({ id: 'long-bow' })] } });
    expect(call('find_item', { query: 'zzzz' })).toMatchObject({ ok: true, result: { matches: [] } });
    expect(call('give_item', { targetId: 'hero', catalogId: 'long-bow', qty: 1 })).toMatchObject({ ok: true, result: { item: 'long-bow', qty: 1 } });
    expect(draft.state.entities['hero']!.items.find((i) => i.id === 'long-bow')).toMatchObject({ ref: 'opend6:fantasy:long-bow', name: 'Длинный лук со стрелой' });
  });

  it('give_item: неизвестный id каталога, оба поля сразу и ни одного — отказ; custom без механики, повтор складывается', () => {
    const { call, draft } = setup();
    expect(call('give_item', { targetId: 'hero', catalogId: 'no-such-thing' })).toMatchObject({ ok: false, error: expect.stringContaining('find_item') });
    expect(call('give_item', { targetId: 'hero', catalogId: 'long-bow', name: 'Лук' })).toMatchObject({ ok: false });
    expect(call('give_item', { targetId: 'hero' })).toMatchObject({ ok: false });
    expect(call('give_item', { targetId: 'hero', name: 'Старый ключ', note: 'Медный, с зазубриной' })).toMatchObject({ ok: true });
    expect(call('give_item', { targetId: 'hero', name: 'Старый ключ', qty: 2 })).toMatchObject({ ok: true });
    const keys = draft.state.entities['hero']!.items.filter((i) => i.name === 'Старый ключ');
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatchObject({ qty: 3, data: { note: 'Медный, с зазубриной' } });
    expect(keys[0]!.data).not.toHaveProperty('armor');
  });

  it('take_item: частично, целиком, лишнее и чужое — отказ со списком предметов', () => {
    const { call, draft } = setup();
    call('give_item', { targetId: 'hero', name: 'Факел', qty: 3 });
    const id = draft.state.entities['hero']!.items.find((i) => i.name === 'Факел')!.id;
    expect(call('take_item', { targetId: 'hero', itemId: id, qty: 1 })).toMatchObject({ ok: true, result: { left: 2 } });
    expect(call('take_item', { targetId: 'hero', itemId: id, qty: 5 })).toMatchObject({ ok: false, error: expect.stringContaining('only 2') });
    expect(call('take_item', { targetId: 'hero', itemId: 'ghost' })).toMatchObject({ ok: false, error: expect.stringContaining('Items:') });
    expect(call('take_item', { targetId: 'hero', itemId: id })).toMatchObject({ ok: true, result: { left: 0 } });
    expect(draft.state.entities['hero']!.items.some((i) => i.id === id)).toBe(false);
  });
});

describe('мир и подача', () => {
  it('set_scene, set_flag, set_palette (только из списка), rules_lookup, end_turn', () => {
    const { call, draft } = setup();
    expect(call('set_scene', { name: 'Таверна', description: 'Дым и шум.' })).toMatchObject({ ok: true });
    expect(draft.state.scene).toEqual({ name: 'Таверна', description: 'Дым и шум.' });
    expect(call('set_flag', { key: 'met.innkeeper', value: true })).toMatchObject({ ok: true });
    expect(draft.state.flags['met.innkeeper']).toBe(true);
    expect(call('set_flag', { key: 'Bad Key', value: 1 })).toMatchObject({ ok: false });
    expect(call('set_flag', { key: 'world', value: 'x'.repeat(2001) })).toMatchObject({ ok: false });
    expect(call('set_palette', { paletteId: 'amber', reason: 'тёплый свет' })).toMatchObject({ ok: true });
    expect(draft.state.palette).toBe('amber');
    expect(call('set_palette', { paletteId: 'rainbow', reason: 'r' })).toMatchObject({ ok: false });
    expect(call('rules_lookup', { topic: 'wild die' })).toMatchObject({ ok: true, result: { text: expect.stringContaining('Wild Die') } });
    expect(call('rules_lookup', { topic: 'nonsense' })).toMatchObject({ ok: false, error: expect.stringContaining('Available: difficulty') });
    expect(call('end_turn', { suggestions: ['a', 'b', 'c', 'd', 'e'] })).toMatchObject({ ok: false });
    expect(call('end_turn', { suggestions: ['Осмотреться'] })).toMatchObject({ ok: true });
    expect(draft.events.at(-1)).toEqual({ t: 'turn.ended', suggestions: ['Осмотреться'] });
  });
});
