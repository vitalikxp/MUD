// oxlint-disable-next-line no-unassigned-import -- подключает IndexedDB-эмуляцию глобально
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { scriptedLlm } from '../dm/testing';
import { LlmError } from '../llm/types';
import { parseDieCode, rollPool } from '../rules/opend6/dice';
import { LocalAdapter } from '../net/local';
import { closeSession, createCampaign, createHero, openSession, session, useStorage } from './campaigns';
import { takeTurn, type TurnConfig } from './turn';

let n = 0;
beforeEach(() => {
  useStorage(new LocalAdapter(`turn-${++n}`));
  closeSession();
});

async function startCampaign(): Promise<string> {
  const id = await createCampaign({ title: 'Пограничье', variant: 'fantasy', lang: 'ru' });
  await openSession(id);
  await createHero({ templateId: 'thief', name: 'Ирма', skills: { lockpicking: 6 } });
  return id;
}

const config = (llm: TurnConfig['llm']): TurnConfig => ({ llm, model: 'test', maxOutputTokens: 1000, paletteIds: ['terminal'] });
const endTurn = { name: 'end_turn', args: { suggestions: ['Осмотреться'] } };

describe('takeTurn: ход Мастера с коммитом в журнал', () => {
  it('открытие игры: мир, сцена и повествование записаны одним коммитом и переживают перезагрузку', async () => {
    const id = await startCampaign();
    const { llm } = scriptedLlm([
      { calls: [{ name: 'set_flag', args: { key: 'world', value: 'Мёртвый лес.' } }, { name: 'set_scene', args: { name: 'Застава' } }] },
      { text: 'Дождь над заставой.', calls: [endTurn] },
    ]);
    const report = await takeTurn({ kind: 'opening' }, config(llm));
    expect(report).toMatchObject({ iterations: 2, autoClosed: false });

    const s = session.value!;
    expect(s.meta.headSeq).toBe(2); // 1 — герой, 2 — ход
    const commit = s.commits.at(-1)!;
    expect(commit).toMatchObject({ kind: 'turn', promptVersion: 'dm-system@4' });
    expect(commit.events.map((e) => e.t)).toEqual(['flag.set', 'scene.set', 'narration', 'turn.ended']);

    closeSession();
    await openSession(id);
    expect(session.value!.state.flags['world']).toBe('Мёртвый лес.');
    expect(session.value!.state.scene?.name).toBe('Застава');
  });

  it('ход игрока: заявка и броски записаны, история прошлого хода попадает в следующий запрос', async () => {
    await startCampaign();
    await takeTurn({ kind: 'opening' }, config(scriptedLlm([{ text: 'Дождь над заставой.', calls: [endTurn] }]).llm));
    const second = scriptedLlm([
      { text: 'Вы приседаете у замка.', calls: [{ name: 'check', args: { actorId: 'hero', skill: 'lockpicking', difficulty: 10, reason: 'замок' } }] },
      { text: 'Щёлк.', calls: [endTurn] },
    ]);
    await takeTurn({ kind: 'player', text: 'Вскрываю замок' }, config(second.llm));
    const events = session.value!.commits.at(-1)!.events;
    expect(events.map((e) => e.t)).toEqual(['intent', 'narration', 'roll', 'narration', 'turn.ended']);
    expect(events[0]).toMatchObject({ text: 'Вскрываю замок', charId: 'hero', uid: 'local' });
    const messages = second.requests[0]!.messages.map((m) => m.role === 'system' ? 'system' : (m as { content: string }).content.slice(0, 40));
    expect(messages[1]).toBe('(the campaign begins)');
    expect(messages[2]).toBe('Дождь над заставой.');
    // кубы движка: бросок записан с итогом, а не со словами модели
    expect(events[2]).toMatchObject({ t: 'roll', skill: 'lockpicking' });
  });

  it('сбой посреди хода: журнал, состояние и генератор кубов не тронуты; повтор бросает те же кубы', async () => {
    await startCampaign();
    const before = session.value!;
    const roll = { name: 'check', args: { actorId: 'hero', skill: 'lockpicking', difficulty: 10, reason: 'замок' } };
    const failing = scriptedLlm([{ text: 'Вы приседаете.', calls: [roll] }, { error: new LlmError('network', 'обрыв') }]);
    await expect(takeTurn({ kind: 'player', text: 'Вскрываю' }, config(failing.llm))).rejects.toMatchObject({ kind: 'network' });
    const after = session.value!;
    expect(after.meta.headSeq).toBe(before.meta.headSeq);
    expect(after.commits).toEqual(before.commits);
    expect(after.state).toBe(before.state);
    expect(after.rng.state()).toBe(before.rng.state());

    // координация вора 4D + 2D навыка = 6D: те же кубы, что выпали бы при первой попытке
    const expected = rollPool(before.rng.clone(), { code: parseDieCode('6D') }).total;
    const retry = scriptedLlm([{ calls: [roll] }, { calls: [endTurn] }]);
    await takeTurn({ kind: 'player', text: 'Вскрываю' }, config(retry.llm));
    const rolled = session.value!.commits.at(-1)!.events.find((e) => e.t === 'roll');
    expect(rolled).toMatchObject({ t: 'roll', roll: { total: expected } });
  });

  it('ошибки использования: нет кампании, нет героя', async () => {
    const { llm } = scriptedLlm([]);
    await expect(takeTurn({ kind: 'opening' }, config(llm))).rejects.toThrow('Нет открытой кампании');
    const id = await createCampaign({ title: 'Пусто', variant: 'fantasy', lang: 'ru' });
    await openSession(id);
    await expect(takeTurn({ kind: 'opening' }, config(llm))).rejects.toThrow('Сначала создайте героя');
  });

  it('ходы идут по очереди и получают последовательные номера коммитов', async () => {
    await startCampaign();
    const a = scriptedLlm([{ text: 'Первый.', calls: [endTurn] }]);
    const b = scriptedLlm([{ text: 'Второй.', calls: [endTurn] }]);
    await Promise.all([takeTurn({ kind: 'player', text: 'а' }, config(a.llm)), takeTurn({ kind: 'player', text: 'б' }, config(b.llm))]);
    expect(session.value!.commits.map((c) => c.seq)).toEqual([1, 2, 3]);
    // второй ход видит историю первого
    expect(b.requests[0]!.messages.some((m) => (m as { content: string }).content === 'Первый.')).toBe(true);
  });
});
