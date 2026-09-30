import { describe, expect, it } from 'vitest';
import type { Entity } from '../src/engine/types';
import { askedBeforeRolling, baselineChecks, calledBefore, calledTool, damageOnlyThroughEngine, doesNotSpeakForHero, endedByMaster, fewToolErrors, mentions, narrationLanguage, noMeta, noPointsSpent, notCalledTool, plainText, rolledDice, spentCharacterPoints } from './checks';
import type { TurnResult } from './types';

const hero = (cp: number, body = 24): Entity => ({ id: 'hero', kind: 'pc', name: 'Ирма', data: { points: { cp, fp: 1 }, body: { points: body, max: 24 } }, items: [], conditions: [] }) as unknown as Entity;
const roll = (spentCp = 0) => ({ t: 'roll' as const, roll: { total: 12, spent: { cp: spentCp, fp: false } }, reason: 'замок', visibility: 'all' as const });
const tool = (name: string, okay = true) => ({ name, arguments: '{}', ok: okay, ...(okay ? {} : { error: 'плохие аргументы' }) });

const turn = (over: Partial<TurnResult> = {}): TurnResult => ({
  input: 'вскрываю замок', tools: [], events: [], text: 'Замок щёлкает, крышка сундука приоткрывается, внутри тускло блестит серебро.', suggestions: ['Забрать серебро'],
  autoClosed: false, iterations: 2, ms: 1000, usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, reasoningTokens: 0 },
  heroBefore: hero(5), heroAfter: hero(5), lang: 'ru', ...over,
});

describe('общие проверки', () => {
  it('нормальный русский ход проходит все', () => {
    for (const check of baselineChecks) expect(check(turn()).ok, check(turn()).name).toBe(true);
  });

  it('упавший ход проваливает проверки с причиной', () => {
    expect(endedByMaster(turn({ error: 'таймаут' }))).toMatchObject({ ok: false, detail: expect.stringContaining('таймаут') });
  });

  it('автозакрытие хода движком — провал', () => {
    expect(endedByMaster(turn({ autoClosed: true })).ok).toBe(false);
  });

  it('язык: русский текст с латиницей и английский текст в русской кампании', () => {
    expect(narrationLanguage(turn({ text: 'The lock clicks open and the chest reveals a small pile of silver coins.' })).ok).toBe(false);
    expect(narrationLanguage(turn({ text: 'Замок открылся (click), внутри блестит серебро и лежит пергамент.' })).ok).toBe(true);
    expect(narrationLanguage(turn({ lang: 'en', text: 'The lock clicks open and the chest reveals a small pile of silver coins.' })).ok).toBe(true);
  });

  it('метакомментарии про инструменты и разметка', () => {
    expect(noMeta(turn({ text: 'Сейчас я вызову инструмент check и брошу кубы.' })).ok).toBe(false);
    expect(noMeta(turn({ text: 'Ирма достаёт набор инструментов для ловушек и склоняется над замком сундука.' })).ok).toBe(true);
    expect(plainText(turn({ text: '## Сцена\nЗамок.' })).ok).toBe(false);
    expect(plainText(turn({ text: 'Вы видите:\n- сундук\n- дверь' })).ok).toBe(false);
    expect(plainText(turn({ text: 'Она шепчет: *тихо*, **быстро**.' })).ok).toBe(true);
    expect(plainText(turn({ text: '## Сцена' })).soft).toBe(true);
  });

  it('ошибки инструментов: одна допустима, две — нет', () => {
    expect(fewToolErrors(turn({ tools: [tool('check', false), tool('check')] })).ok).toBe(true);
    expect(fewToolErrors(turn({ tools: [tool('check', false), tool('check', false)] })).ok).toBe(false);
  });
});

describe('проверки под сценарии', () => {
  it('вызван / не вызван / порядок', () => {
    expect(calledTool('check')(turn({ tools: [tool('check')] })).ok).toBe(true);
    expect(calledTool('check')(turn({ tools: [tool('check', false)] })).ok).toBe(false); // неуспешный вызов не считается
    expect(notCalledTool('apply_damage')(turn({ tools: [tool('check')] })).ok).toBe(true);
    expect(calledBefore('create_npc', 'apply_damage')(turn({ tools: [tool('create_npc'), tool('apply_damage')] })).ok).toBe(true);
    expect(calledBefore('create_npc', 'apply_damage')(turn({ tools: [tool('apply_damage')] })).ok).toBe(false);
    expect(calledBefore('create_npc', 'apply_damage')(turn({ tools: [] })).ok).toBe(true);
  });

  it('очки: не тратятся сами; трата по просьбе — броском и уменьшением запаса', () => {
    expect(noPointsSpent(turn({ events: [roll(1)], heroAfter: hero(4) })).ok).toBe(false);
    expect(noPointsSpent(turn({ events: [roll(0)] })).ok).toBe(true);
    const deduct = { t: 'entity.patched' as const, id: 'hero', ops: [{ op: 'inc' as const, path: 'points.cp', by: -1 }] };
    expect(spentCharacterPoints(1)(turn({ events: [deduct, roll(1)], heroAfter: hero(4) })).ok).toBe(true);
    expect(spentCharacterPoints(1)(turn({ events: [roll(0)] })).ok).toBe(false);
    expect(spentCharacterPoints(1)(turn({ events: [roll(1)] })).ok).toBe(false); // бросок с тратой есть, а списания нет
    // Мастер наградил очками после успеха: остаток прежний, но трата была и записана движком
    expect(spentCharacterPoints(1)(turn({ events: [deduct, roll(1), { t: 'entity.patched', id: 'hero', ops: [{ op: 'inc', path: 'points.cp', by: 1 }] }], heroAfter: hero(5) })).ok).toBe(true);
  });

  it('вопрос про очки без броска', () => {
    expect(askedBeforeRolling(turn({ text: 'Сейф тяжёлый, охрана рядом. Хочешь потратить Очко персонажа на попытку?' })).ok).toBe(true);
    expect(askedBeforeRolling(turn({ text: 'Сейф тяжёлый, охрана рядом. Хочешь потратить Очко персонажа на попытку?', events: [roll()] })).ok).toBe(false);
    expect(askedBeforeRolling(turn({ text: 'Сейф тяжёлый, охрана рядом.' })).ok).toBe(false);
    expect(askedBeforeRolling(turn({ text: 'Кошелёк можно снять, но риск велик. Можешь потратить Очко персонажа. Решай.' })).ok).toBe(true); // без знака вопроса
  });

  it('бросок, упоминание факта, урон и речь героя', () => {
    expect(rolledDice(turn({ events: [roll()] })).ok).toBe(true);
    expect(rolledDice(turn()).ok).toBe(false);
    expect(mentions('кинжал', /кинжал/i)(turn({ text: 'Ирма сжимает Кинжал.' })).ok).toBe(true);
    expect(damageOnlyThroughEngine(turn({ heroAfter: hero(5, 20) })).ok).toBe(false);
    expect(damageOnlyThroughEngine(turn({ heroAfter: hero(5, 20), tools: [tool('apply_damage')] })).ok).toBe(true);
    expect(doesNotSpeakForHero('Ирма')(turn({ text: 'Ирма шепчет — «Я уйду».' })).ok).toBe(false);
    expect(doesNotSpeakForHero('Ирма')(turn({ text: 'Ирма молчит, а стражник спрашивает: «Кто там?»' })).ok).toBe(true);
  });
});
