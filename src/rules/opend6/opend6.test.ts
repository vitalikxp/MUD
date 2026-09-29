import { describe, expect, it } from 'vitest';
import { Draft } from '../../engine/commits';
import { createRng } from '../../engine/rng';
import { scriptedRng } from '../../engine/testing';
import type { GameEvent } from '../../engine/types';
import { applyDamage, awardPoints, healingTable, heal } from './damage';
import { check, contest } from './checks';
import { characterDataSchema, deriveStats, readCharacter, strengthDamage, validateCreation, woundLevel } from './character';
import { ADVENTURE, FANTASY, findSkill } from './data';
import { ctxWith, irma, irmaData } from './fixtures';
import { opend6 } from '../opend6';
import { lookup, promptPrimer } from './primer';
import { buildSheet } from './sheet';

const run = (over: Parameters<typeof irma>[0], spend: { cp?: number; fp?: boolean }, options = {}) =>
  check(ctxWith(scriptedRng([]), [irma(over)], options), { actorId: 'irma', skill: 'stealth', difficulty: 10, spend, reason: 'r' });
const c = () => ctxWith(scriptedRng([]), [irma()]);
const two = () => [irma(), { ...irma(), id: 'guard', name: 'Стражник', kind: 'npc' as const }];

const rollEvents = (events: GameEvent[]) => events.filter((e) => e.t === 'roll');

describe('данные и схема', () => {
  it('у каждого навыка уникальный id внутри варианта и есть RU/EN названия', () => {
    for (const v of [FANTASY, ADVENTURE]) {
      const ids = v.attributes.flatMap((a) => a.skills.map((s) => s.id));
      expect(new Set(ids).size, v.id).toBe(ids.length);
      for (const a of v.attributes) {
        expect(a.name.ru && a.name.en).toBeTruthy();
        for (const s of a.skills) expect(s.name.ru && s.name.en, s.id).toBeTruthy();
      }
    }
  });

  it('списки соответствуют книгам: 6 обычных характеристик; в Adventure у Восприятия 10 навыков, у Присутствия 8; в Fantasy 9 навыков Интеллекта', () => {
    expect(FANTASY.attributes.filter((a) => !a.extranormal)).toHaveLength(6);
    expect(ADVENTURE.attributes.find((a) => a.id === 'perception')!.skills).toHaveLength(10);
    expect(ADVENTURE.attributes.find((a) => a.id === 'presence')!.skills).toHaveLength(8);
    expect(FANTASY.attributes.find((a) => a.id === 'intellect')!.skills).toHaveLength(9);
    expect(findSkill(FANTASY, 'dodge')!.attribute.id).toBe('agility');
    expect(findSkill(ADVENTURE, 'dodge')!.attribute.id).toBe('reflexes');
  });

  it('readCharacter отвергает неизвестные навыки, чужие характеристики и мусорные коды', () => {
    expect(readCharacter(irma()).ok).toBe(true);
    expect(readCharacter(irma({ skills: { foo: '1D' } }))).toMatchObject({ ok: false });
    expect(readCharacter(irma({ attributes: { ...irmaData.attributes, reflexes: '3D' } }))).toMatchObject({ ok: false });
    expect(characterDataSchema.safeParse({ ...irmaData, attributes: { agility: 'три кубика' } }).success).toBe(false);
    expect(readCharacter(irma({ body: { points: 5, max: 0 } }))).toMatchObject({ ok: false });
  });
});

describe('уровни ранения (fantasy p.65) и Strength Damage', () => {
  it.each([
    [30, 'healthy'], [29, 'bruised'], [25, 'bruised'], [24, 'stunned'], [18, 'stunned'], [17, 'wounded'], [12, 'wounded'],
    [11, 'severely-wounded'], [6, 'severely-wounded'], [5, 'incapacitated'], [3, 'incapacitated'], [2, 'mortally-wounded'], [1, 'mortally-wounded'], [0, 'dead'],
  ])('30 Очков тела: осталось %i → %s', (points, level) => {
    expect(woundLevel(points, 30).id).toBe(level);
  });

  it('штрафы: оглушён/ранен −1D, тяжело ранен −2D, недееспособен −3D, при смерти и мёртв не действуют', () => {
    expect([woundLevel(20, 30), woundLevel(15, 30), woundLevel(8, 30), woundLevel(4, 30)].map((w) => w.penaltyDice)).toEqual([1, 1, 2, 3]);
    expect(woundLevel(1, 30).cannotAct && woundLevel(0, 30).cannotAct).toBe(true);
  });

  it('Strength Damage: Телосложение 3D → 2D, 6D → 3D (пипы отбрасываются, деление на 2 вверх; adventure p.61)', () => {
    expect(strengthDamage({ dice: 3, pips: 1 })).toEqual({ dice: 2, pips: 0 });
    expect(strengthDamage({ dice: 6, pips: 2 })).toEqual({ dice: 3, pips: 0 });
    expect(strengthDamage({ dice: 2, pips: 0 })).toEqual({ dice: 1, pips: 0 });
    const d = deriveStats(irma());
    expect(d).toMatchObject({ ok: true, value: { strengthDamage: '2D', woundLevel: 'healthy', woundPenaltyDice: 0, move: 10, dead: false } });
  });
});

describe('check', () => {
  // Ирма: скрытность = Ловкость 3D+1 + 1D = 4D+1. Кубы: три обычных (3, 5, 2) и Wild Die (4).
  it('навык = характеристика + надбавка; событие броска и отчёт для Мастера', () => {
    const ctx = ctxWith(scriptedRng([3, 5, 2, 4]), [irma()]);
    const r = check(ctx, { actorId: 'irma', skill: 'stealth', difficulty: 15, reason: 'прокрасться мимо стражи' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.result).toMatchObject({ rolled: '4D+1', total: 15, difficulty: 15, success: true, margin: 0, untrained: false, complication: false, skill: 'stealth', attribute: 'agility' });
    const [ev] = rollEvents(r.value.events);
    expect(ev).toMatchObject({ t: 'roll', actorId: 'irma', skill: 'stealth', difficulty: 15, success: true, reason: 'прокрасться мимо стражи', visibility: 'all' });
  });

  it('провал: недобор отрицательный; единица на Wild Die — осложнение', () => {
    const ctx = ctxWith(scriptedRng([2, 2, 2, 1]), [irma()]);
    const r = check(ctx, { actorId: 'irma', skill: 'stealth', difficulty: 15, reason: 'r' });
    expect(r.ok && r.value.result).toMatchObject({ total: 8, success: false, margin: -7, complication: true, wildOne: true });
  });

  it('без навыка бросается характеристика и помечается untrained (Мастер может поднять сложность на +5)', () => {
    const ctx = ctxWith(scriptedRng([3, 3, 4]), [irma()]);
    const r = check(ctx, { actorId: 'irma', skill: 'sleight-of-hand', difficulty: 10, reason: 'стянуть кошелёк' });
    expect(r.ok && r.value.result).toMatchObject({ rolled: '3D', untrained: true, total: 10 });
  });

  it('альтернативная характеристика (adventure p.49): надбавка навыка переносится на другую характеристику', () => {
    // взлом замков: надбавка +1D+1; Интеллект 2D+2 → 4D
    const ctx = ctxWith(scriptedRng([1, 1, 1, 1]), [irma()]);
    const r = check(ctx, { actorId: 'irma', skill: 'lockpicking', attribute: 'intellect', difficulty: 5, reason: 'r', wildOne: 'cancel' });
    expect(r.ok && r.value.result).toMatchObject({ rolled: '4D', attribute: 'intellect' });
  });

  it('только характеристика: бросок характеристики', () => {
    const ctx = ctxWith(scriptedRng([2, 3, 4]), [irma()]);
    const r = check(ctx, { actorId: 'irma', attribute: 'physique', difficulty: 10, reason: 'r' });
    expect(r.ok && r.value.result).toMatchObject({ rolled: '3D+1', total: 10, success: true, margin: 0 });
  });

  it('раны, несколько действий и модификатор складываются в штраф к кодам', () => {
    // 12/30 = ранен (−1D); 3 действия (−2D); модификатор +1D → 4D+1 −1D −2D +1D = 2D+1
    const ctx = ctxWith(scriptedRng([2, 3]), [irma({ body: { points: 12, max: 30 } })]);
    const r = check(ctx, { actorId: 'irma', skill: 'stealth', difficulty: 10, actions: 3, modifiers: '+1D', reason: 'r' });
    expect(r.ok && r.value.result).toMatchObject({ rolled: '2D+1', modifiersApplied: ['раны: −1D', 'действий за раунд 3: −2D', 'модификатор +1D'] });
  });

  it('модификатор «-1D+1» — это −2 пипа: 4D+1 → 3D+2', () => {
    const r = check(ctxWith(scriptedRng([1, 1, 1]), [irma()]), { actorId: 'irma', skill: 'stealth', difficulty: 5, modifiers: '-1D+1', reason: 'r' });
    expect(r.ok && r.value.result).toMatchObject({ rolled: '3D+2' });
  });

  it('траты: Очки персонажа — доп. Wild Die и вычет из CP; Очко судьбы удваивает код и вычитается из FP', () => {
    // CP ×2 на 4D+1: обычные 3,5,2 + Wild 4; CP-цепочки: [6,1] (=7) и [3]
    const cp = check(ctxWith(scriptedRng([3, 5, 2, 4, 6, 1, 3]), [irma()]), { actorId: 'irma', skill: 'stealth', difficulty: 20, spend: { cp: 2 }, reason: 'r' });
    expect(cp.ok).toBe(true);
    if (!cp.ok) return;
    expect(cp.value.result).toMatchObject({ total: 15 + 7 + 3, spent: { characterPoints: 2, fatePoint: false } });
    expect(cp.value.events[0]).toEqual({ t: 'entity.patched', id: 'irma', ops: [{ op: 'inc', path: 'points.cp', by: -2 }] });

    // FP: 4D+1 → 9D+1: восемь обычных и один Wild Die
    const fp = check(ctxWith(scriptedRng([1, 1, 1, 1, 1, 1, 1, 2]), [irma()]), { actorId: 'irma', skill: 'stealth', difficulty: 5, spend: { fp: true }, reason: 'r' });
    expect(fp.ok && fp.value.result).toMatchObject({ rolled: '8D+2', total: 7 + 2 + 2 });
    expect(fp.ok && fp.value.events[0]).toEqual({ t: 'entity.patched', id: 'irma', ops: [{ op: 'inc', path: 'points.fp', by: -1 }] });
  });

  it('траты: отказы — больше CP, чем есть; больше лимита; CP вместе с FP; нет FP', () => {
    expect(run({}, { cp: 6 })).toMatchObject({ ok: false });
    expect(run({ points: { cp: 9, fp: 1 } }, { cp: 6 })).toMatchObject({ ok: false, error: expect.stringContaining('не больше 5') });
    expect(run({}, { cp: 1, fp: true })).toMatchObject({ ok: false, error: expect.stringContaining('нельзя тратить на один бросок') });
    expect(run({ points: { cp: 5, fp: 0 } }, { fp: true })).toMatchObject({ ok: false, error: expect.stringContaining('нет Очков судьбы') });
    expect(run({}, { cp: -1 })).toMatchObject({ ok: false });
  });

  it('cinematic разрешает CP и FP вместе; cpMaxPerRoll повышает лимит', () => {
    // 9D+1: 8 обычных + Wild; плюс один CP: одна цепочка
    const r = check(ctxWith(scriptedRng([1, 1, 1, 1, 1, 1, 1, 1, 2, 3]), [irma()], { cinematic: true }), { actorId: 'irma', skill: 'stealth', difficulty: 5, spend: { cp: 1, fp: true }, reason: 'r' });
    expect(r.ok && r.value.result).toMatchObject({ spent: { characterPoints: 1, fatePoint: true } });
    const more = check(ctxWith(scriptedRng([2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1]), [irma({ points: { cp: 9, fp: 0 } })], { cpMaxPerRoll: 7 }), { actorId: 'irma', skill: 'stealth', difficulty: 5, spend: { cp: 7 }, reason: 'r' });
    expect(more.ok).toBe(true);
  });

  it('отказы по входным данным: сложность, актёр, навык, состояние, кубы', () => {
    expect(check(c(), { actorId: 'irma', skill: 'stealth', difficulty: 0, reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('автоуспех') });
    expect(check(c(), { actorId: 'irma', skill: 'stealth', difficulty: 12.5, reason: 'r' }).ok).toBe(false);
    expect(check(c(), { actorId: 'irma', skill: 'stealth', difficulty: 100, reason: 'r' }).ok).toBe(false);
    expect(check(c(), { actorId: 'нет', skill: 'stealth', difficulty: 10, reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('Известные: irma') });
    expect(check(c(), { actorId: 'irma', skill: 'levitation', difficulty: 10, reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('Допустимые') });
    expect(check(c(), { actorId: 'irma', difficulty: 10, reason: 'r' })).toMatchObject({ ok: false });
    expect(check(c(), { actorId: 'irma', skill: 'stealth', difficulty: 10, modifiers: 'много', reason: 'r' }).ok).toBe(false);
    expect(check(c(), { actorId: 'irma', attribute: 'magic', difficulty: 10, reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('нет кубов') });
    const dead = ctxWith(scriptedRng([]), [irma({ body: { points: 0, max: 30 } })]);
    expect(check(dead, { actorId: 'irma', skill: 'stealth', difficulty: 10, reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('не может действовать') });
    const weak = ctxWith(scriptedRng([]), [irma({ attributes: { ...irmaData.attributes, agility: '1D' }, skills: {}, body: { points: 8, max: 30 } })]);
    expect(check(weak, { actorId: 'irma', skill: 'stealth', difficulty: 10, reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('не осталось кубов') });
  });

  it('отказ не тратит кубы и очки (RNG не тронут)', () => {
    const rng = createRng('same');
    const before = rng.state();
    check(ctxWith(rng, [irma()]), { actorId: 'irma', skill: 'stealth', difficulty: 10, spend: { cp: 99 }, reason: 'r' });
    expect(rng.state()).toBe(before);
  });
});

describe('contest', () => {
  it('побеждает больший итог, при равенстве — инициатор', () => {
    // Ирма: скрытность 4D+1, стражник: поиск = Смекалка 3D → 2 обычных + Wild
    const win = contest(ctxWith(scriptedRng([5, 5, 5, 5, 1, 1, 1]), two()), { a: { actorId: 'irma', skill: 'stealth' }, b: { actorId: 'guard', skill: 'search' }, reason: 'прокрасться' });
    expect(win.ok && win.value.result).toMatchObject({ winner: 'a' });
    const tie = contest(ctxWith(scriptedRng([2, 2, 2, 3, 3, 3, 3]), two()), { a: { actorId: 'irma', attribute: 'physique' }, b: { actorId: 'guard', attribute: 'physique' }, reason: 'армрестлинг' });
    // 3D+1: 2+2+3+1 = 8 ; 3D+1: 3+3+3+1 = 10 — стражник выше; проверим равенство отдельным набором
    expect(tie.ok && tie.value.result).toMatchObject({ winner: 'b' });
    const equal = contest(ctxWith(scriptedRng([2, 3, 4, 3, 2, 4]), two()), { a: { actorId: 'irma', attribute: 'physique' }, b: { actorId: 'guard', attribute: 'physique' }, reason: 'r' });
    expect(equal.ok && equal.value.result).toMatchObject({ winner: 'a', margin: 0 }); // 2+3+4+1 = 10 против 3+2+4+1 = 10
    expect(equal.ok && rollEvents(equal.value.events)).toHaveLength(2);
  });

  it('ошибка одной из сторон отменяет всё', () => {
    const r = contest(ctxWith(scriptedRng([1, 1, 1]), two()), { a: { actorId: 'irma', attribute: 'physique' }, b: { actorId: 'призрак', attribute: 'physique' }, reason: 'r' });
    expect(r.ok).toBe(false);
  });
});

describe('урон, лечение, награды', () => {
  const armorItem = { id: 'jerkin', name: 'Кожаный жилет', qty: 1, slot: 'body', data: { armor: '1D' } };

  it('урон без брони: бросок урона, потеря Очков тела, событие; уровень ранения в отчёте', () => {
    // 3D: [2,4] + Wild 3 → 9
    const r = applyDamage(ctxWith(scriptedRng([2, 4, 3]), [irma()]), { targetId: 'irma', damage: '3D', reason: 'падение с лестницы' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.result).toMatchObject({ damageTotal: 9, resistanceTotal: 0, bodyPointsLost: 9, bodyPoints: 21, woundLevel: 'stunned' });
    expect(r.value.events.at(-1)).toEqual({ t: 'entity.patched', id: 'irma', ops: [{ op: 'set', path: 'body.points', value: 21 }] });
  });

  it('броня: бросок её кода вычитается из урона; полное поглощение — без потерь', () => {
    // урон 2D: [4] + Wild 2 = 6; броня 1D (Wild Die) = 5 → −1
    const r = applyDamage(ctxWith(scriptedRng([4, 2, 5]), [irma({}, [armorItem])]), { targetId: 'irma', damage: '2D', reason: 'удар' });
    expect(r.ok && r.value.result).toMatchObject({ damageTotal: 6, resistanceTotal: 5, bodyPointsLost: 1, bodyPoints: 29, armor: '1D' });
    const absorbed = applyDamage(ctxWith(scriptedRng([1, 1, 6, 2]), [irma({}, [armorItem])]), { targetId: 'irma', damage: '2D', reason: 'удар' });
    // урон 2D: 1 + Wild 1 (осложнение, сумма 2); броня 1D: Wild 6 + 2 = 8 → 0
    expect(absorbed.ok && absorbed.value.result).toMatchObject({ bodyPointsLost: 0, note: expect.stringContaining('Броня') });
    expect(absorbed.ok && absorbed.value.events.some((e) => e.t === 'entity.patched')).toBe(false);
  });

  it('броня в рюкзаке (без слота) не считается; ignoreArmor пропускает сопротивление', () => {
    const inPack = { ...armorItem, slot: null };
    const r = applyDamage(ctxWith(scriptedRng([4, 2]), [irma({}, [inPack])]), { targetId: 'irma', damage: '2D', reason: 'r' });
    expect(r.ok && r.value.result).toMatchObject({ resistanceTotal: 0, armor: '0D' });
    const r2 = applyDamage(ctxWith(scriptedRng([4, 2]), [irma({}, [armorItem])]), { targetId: 'irma', damage: '2D', reason: 'яд', ignoreArmor: true });
    expect(r2.ok && r2.value.result).toMatchObject({ resistanceTotal: 0, bodyPointsLost: 6 });
  });

  it('число вместо кода; смерть на нуле, состояния; уже мёртвого бить нельзя; мусорный код', () => {
    const r = applyDamage(ctxWith(scriptedRng([]), [irma({ body: { points: 5, max: 30 } })]), { targetId: 'irma', damage: 40, reason: 'обвал' });
    expect(r.ok && r.value.result).toMatchObject({ bodyPoints: 0, dead: true, woundLevel: 'dead' });
    expect(r.ok && r.value.events).toContainEqual({ t: 'condition.set', entityId: 'irma', condition: 'dead', on: true });
    const mortal = applyDamage(ctxWith(scriptedRng([]), [irma({ body: { points: 5, max: 30 } })]), { targetId: 'irma', damage: 4, reason: 'r' });
    expect(mortal.ok && mortal.value.result).toMatchObject({ bodyPoints: 1, unconscious: true });
    expect(mortal.ok && mortal.value.events).toContainEqual({ t: 'condition.set', entityId: 'irma', condition: 'unconscious', on: true });
    expect(applyDamage(ctxWith(scriptedRng([]), [irma({ body: { points: 0, max: 30 } })]), { targetId: 'irma', damage: 1, reason: 'r' })).toMatchObject({ ok: false });
    expect(applyDamage(ctxWith(scriptedRng([]), [irma()]), { targetId: 'irma', damage: 'много', reason: 'r' }).ok).toBe(false);
    expect(applyDamage(ctxWith(scriptedRng([]), [irma()]), { targetId: 'irma', damage: -3, reason: 'r' }).ok).toBe(false);
  });

  it('таблица лечения (adventure p.65): границы диапазонов', () => {
    expect(healingTable(0)).toBe(0);
    expect(healingTable(1)).toBe(2);
    expect(healingTable(5)).toBe(2);
    expect(healingTable(6)).toEqual({ dice: 1, pips: 0 });
    expect(healingTable(15)).toEqual({ dice: 2, pips: 0 });
    expect(healingTable(20)).toEqual({ dice: 3, pips: 0 });
    expect(healingTable(25)).toEqual({ dice: 4, pips: 0 });
    expect(healingTable(30)).toEqual({ dice: 5, pips: 0 });
    expect(healingTable(31)).toEqual({ dice: 6, pips: 0 });
  });

  it('отдых: бросок Телосложения с модификатором → восстановленные кубы; не выше максимума', () => {
    // Телосложение 3D+1 +1D (сутки покоя) = 4D+1: [2,3,2] + Wild 3 = 10+1 = 11 → 2D: [4] + Wild 3 = 7
    const hurt = irma({ body: { points: 10, max: 30 } });
    const r = heal(ctxWith(scriptedRng([2, 3, 2, 3, 4, 3]), [hurt]), { targetId: 'irma', method: 'rest', rest: 'full', reason: 'сутки в трактире' });
    expect(r.ok && r.value.result).toMatchObject({ healingRoll: 11, bodyPointsRestored: 7, bodyPoints: 17, method: 'rest' });
    const nearFull = heal(ctxWith(scriptedRng([2, 3, 2, 3, 4, 3]), [irma({ body: { points: 28, max: 30 } })]), { targetId: 'irma', method: 'rest', rest: 'full', reason: 'r' });
    expect(nearFull.ok && nearFull.value.result).toMatchObject({ bodyPointsRestored: 2, bodyPoints: 30 });
    expect(nearFull.ok && nearFull.value.events.at(-1)).toEqual({ t: 'entity.patched', id: 'irma', ops: [{ op: 'inc', path: 'body.points', by: 2 }] });
  });

  it('врачевание навыком: используется навык healing (fantasy) и бонус аптечки; лекарь не может быть без сознания', () => {
    const healer = { ...irma({ attributes: { ...irmaData.attributes, intellect: '3D' }, skills: { healing: '1D' } }), id: 'lek', name: 'Лекарь' };
    const patient = { ...irma({ body: { points: 10, max: 30 } }), id: 'pac', name: 'Пациент' };
    // здоровье: Интеллект 3D + 1D = 4D + аптечка +1D = 5D: [1,1,1,1]+Wild 2 = 6 → 1D (Wild Die) = 6? → используем 6 и затем 6/1
    const r = heal(ctxWith(scriptedRng([1, 1, 1, 1, 2, 5]), [healer, patient]), { targetId: 'pac', method: 'medicine', healerId: 'lek', kitBonus: '+1D', reason: 'перевязка' });
    expect(r.ok && r.value.result).toMatchObject({ method: 'medicine', healer: 'lek', healingRoll: 6, bodyPointsRestored: 5 });
    const knockedOut = { ...healer, data: { ...healer.data, body: { points: 1, max: 30 } } };
    expect(heal(ctxWith(scriptedRng([]), [knockedOut, patient]), { targetId: 'pac', method: 'medicine', healerId: 'lek', reason: 'r' })).toMatchObject({ ok: false });
  });

  it('фиксированное лечение, мёртвых не лечим, награды', () => {
    const r = heal(ctxWith(scriptedRng([]), [irma({ body: { points: 10, max: 30 } })]), { targetId: 'irma', method: 'fixed', amount: 6, reason: 'зелье' });
    expect(r.ok && r.value.result).toMatchObject({ bodyPointsRestored: 6, bodyPoints: 16 });
    expect(heal(ctxWith(scriptedRng([]), [irma({ body: { points: 0, max: 30 } })]), { targetId: 'irma', method: 'fixed', amount: 6, reason: 'r' }).ok).toBe(false);
    expect(heal(ctxWith(scriptedRng([]), [irma()]), { targetId: 'irma', method: 'fixed', amount: 0, reason: 'r' }).ok).toBe(false);
    // выход из «при смерти» снимает бессознательность
    const up = heal(ctxWith(scriptedRng([]), [{ ...irma({ body: { points: 2, max: 30 } }), conditions: ['unconscious'] }]), { targetId: 'irma', method: 'fixed', amount: 10, reason: 'r' });
    expect(up.ok && up.value.events).toContainEqual({ t: 'condition.set', entityId: 'irma', condition: 'unconscious', on: false });

    const aw = awardPoints(ctxWith(scriptedRng([]), [irma()]), { targetIds: ['irma'], cp: 3, fp: 1, reason: 'закрыли сцену' });
    expect(aw.ok && aw.value.events).toEqual([{ t: 'entity.patched', id: 'irma', ops: [{ op: 'inc', path: 'points.cp', by: 3 }, { op: 'inc', path: 'points.fp', by: 1 }] }]);
    expect(aw.ok && aw.value.result).toMatchObject({ nowHave: [{ id: 'irma', cp: 8, fp: 2 }] });
    expect(awardPoints(ctxWith(scriptedRng([]), [irma()]), { targetIds: ['irma'], cp: 0, reason: 'r' }).ok).toBe(false);
    expect(awardPoints(ctxWith(scriptedRng([]), [irma()]), { targetIds: [], cp: 1, reason: 'r' }).ok).toBe(false);
    expect(awardPoints(ctxWith(scriptedRng([]), [irma()]), { targetIds: ['ghost'], cp: 1, reason: 'r' }).ok).toBe(false);
  });
});

describe('создание, лист, промпт, интеграция с движком', () => {
  it('validateCreation: 18D на характеристики и 7D на навыки', () => {
    // Ирма: 3D+1 + 3D + 3D+1 + 2D+2 + 3D + 2D = 17D+... считаем в пипах
    const r = validateCreation(irmaData);
    expect(r.attributePips).toBe(52);
    expect(r.errors.some((e) => e.includes('18D'))).toBe(true);
    const ok = validateCreation({ ...irmaData, attributes: { ...irmaData.attributes, charisma: '2D+2' }, skills: { stealth: '1D', dodge: '1D' } });
    expect(ok.attributePips).toBe(54);
    expect(ok.errors).toEqual([]);
    expect(validateCreation({ ...irmaData, attributes: { ...irmaData.attributes, charisma: '2D+2' }, skills: { stealth: '4D' } }).errors.join()).toContain('+3D');
    expect(validateCreation({ ...irmaData, attributes: { ...irmaData.attributes, agility: '6D', charisma: '0D+2' }, skills: {} }).errors.join()).toMatch(/максимум 5D|минимум 1D/);
    expect(validateCreation({ ...irmaData, attributes: { ...irmaData.attributes, charisma: '2D+2' }, skills: { alteration: '1D' } }).errors.join()).toContain('нет кубов');
  });

  it('лист персонажа: разделы, коды, подсказки, RU и EN', () => {
    const ru = buildSheet(irma({ body: { points: 12, max: 30 } }), 'ru');
    expect(ru.title).toBe('Ирма — Плутовка');
    expect(ru.sections.map((s) => s.heading)).toEqual(['Характеристики', 'Навыки', 'Здоровье', 'Очки', 'Прочее']);
    expect(ru.sections[0]!.rows).toContainEqual({ label: 'Ловкость', value: '3D+1' });
    expect(ru.sections[0]!.rows.some((r) => r.label === 'Магия')).toBe(false); // 0D скрыт
    expect(ru.sections[1]!.rows).toContainEqual({ label: 'скрытность', value: '4D+1', hint: 'Ловкость +1D' });
    expect(ru.sections[2]!.rows).toEqual([{ label: 'Очки тела', value: '12/30' }, { label: 'Состояние', value: 'ранен (−1D)' }]);
    const en = buildSheet(irma(), 'en');
    expect(en.sections[2]!.rows[1]!.value).toBe('healthy');
    expect(buildSheet({ ...irma(), data: { broken: true } }, 'ru').sections[0]!.heading).toBe('Ошибка');
  });

  it('промпт-праймер содержит опорные числа; справка по темам двуязычная', () => {
    const p = promptPrimer('fantasy');
    for (const s of ['30 heroic', 'NEVER invent dice results', 'Wild Die', 'Body Points', '-3D', 'contest tool', 'award_points']) expect(p).toContain(s);
    expect(promptPrimer('adventure')).toContain('post-apocalypse');
    expect(lookup('Wild Die', 'ru')).toContain('Единица на первом');
    expect(lookup('healing', 'en')).toContain('31+→6D');
    expect(lookup('нет такой темы', 'en')).toBeNull();
  });

  it('модуль в сборе: описание вариантов и вызов через интерфейс', () => {
    expect(opend6.variants.map((v) => v.id)).toEqual(['fantasy', 'adventure']);
    expect(opend6.variants[0]!.attributes.find((a) => a.id === 'magic')!.extranormal).toBe(true);
    expect(opend6.derive(irma())).toMatchObject({ woundLevel: 'healthy', strengthDamage: '2D' });
    expect(() => opend6.derive({ ...irma(), data: {} })).toThrow();
  });

  it('интеграция с движком: проверка внутри Draft меняет состояние (CP списаны), бросок пишется в журнал, RNG двигается', () => {
    const base = ctxWith(createRng('int'), [irma()]);
    const d = new Draft(base.state, base.rng, 't1');
    const r = opend6.check({ state: d.state, rng: d.rng, options: base.options }, { actorId: 'irma', skill: 'stealth', difficulty: 15, spend: { cp: 2 }, reason: 'r' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    d.emit(...r.value.events);
    expect((d.state.entities['irma']!.data['points'] as { cp: number }).cp).toBe(3);
    expect(d.events.filter((e) => e.t === 'roll')).toHaveLength(1);
    expect(d.rng.state()).not.toBe(base.rng.state === undefined ? '' : createRng('int').state());
  });
});
