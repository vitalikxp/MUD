// oxlint-disable-next-line no-unassigned-import -- подключает IndexedDB-эмуляцию глобально
import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import { describe, expect, it } from 'vitest';
import { Draft, nextSeq } from '../engine/commits';
import { initialState } from '../engine/reducer';
import { createRng } from '../engine/rng';
import type { Commit, Entity, GameState } from '../engine/types';
import { LocalAdapter } from './local';
import { StorageConflictError, type CampaignMeta } from './storage';

let counter = 0;
const fresh = (): LocalAdapter => new LocalAdapter(`test-${++counter}`);

const rules = { id: 'opend6', version: '0.1.0', variant: 'fantasy' };
const meta = (id: string, over: Partial<CampaignMeta> = {}): CampaignMeta => ({
  schemaVersion: 1, id, title: `Кампания ${id}`, rules, narrationLang: 'ru', seed: 'seed', phase: 'creation', headSeq: 0, createdAt: 1000, updatedAt: 1000, ...over,
});
const hero: Entity = { id: 'hero', kind: 'pc', name: 'Ирма', data: { body: { points: 30 } }, items: [], conditions: [] };

/** Следующий коммит журнала: события применяются к состоянию, RNG идёт от зерна. */
function makeCommit(prev: Commit[], state: GameState, build: (d: Draft) => void, at: number): { commit: Commit; state: GameState } {
  const d = new Draft(state, createRng('seed'), `t${nextSeq(prev)}`);
  build(d);
  return { commit: d.toCommit(nextSeq(prev), 'turn', at), state: d.state };
}

describe('LocalAdapter', () => {
  it('создаёт и перечисляет кампании: недавно игранные первыми, повтор id запрещён', async () => {
    const s = fresh();
    await s.createCampaign(meta('a', { updatedAt: 10 }));
    await s.createCampaign(meta('b', { updatedAt: 30 }));
    await s.createCampaign(meta('c', { updatedAt: 20 }));
    expect((await s.listCampaigns()).map((m) => m.id)).toEqual(['b', 'c', 'a']);
    await expect(s.createCampaign(meta('a'))).rejects.toThrow('уже есть');
    expect((await s.listCampaigns()).find((m) => m.id === 'a')!.updatedAt).toBe(10); // прежняя запись цела
    await s.close();
  });

  it('отвергает неверные метаданные и не показывает испорченные записи', async () => {
    const s = fresh();
    await expect(s.createCampaign(meta('x', { title: '' }))).rejects.toThrow();
    await expect(s.createCampaign({ ...meta('y'), narrationLang: 'de' as 'ru' })).rejects.toThrow();
    await s.createCampaign(meta('ok'));
    await s.close();
    // порча записи «снаружи»
    const raw = await openDB(`test-${counter}`);
    await raw.put('campaigns', { id: 'broken', title: 42 });
    raw.close();
    expect((await s.listCampaigns()).map((m) => m.id)).toEqual(['ok']);
    await s.close();
  });

  it('коммит атомарно двигает журнал, проекцию, фазу и время; загрузка возвращает то же состояние', async () => {
    const s = fresh();
    await s.createCampaign(meta('a'));
    const state0 = initialState(rules);
    const first = makeCommit([], state0, (d) => d.emit({ t: 'entity.created', entity: hero }), 2000);
    const updated = await s.commit('a', first.commit, { state: first.state, phase: 'play' });
    expect(updated).toMatchObject({ headSeq: 1, phase: 'play', updatedAt: 2000 });

    const loaded = await s.loadCampaign('a');
    expect(loaded!.meta).toEqual(updated);
    expect(loaded!.state.entities['hero']!.name).toBe('Ирма');
    expect(loaded!.commits).toEqual([first.commit]);

    const second = makeCommit([first.commit], first.state, (d) => d.emit({ t: 'entity.patched', id: 'hero', ops: [{ op: 'inc', path: 'body.points', by: -4 }] }), 3000);
    await s.commit('a', second.commit, { state: second.state });
    const again = await s.loadCampaign('a');
    expect(again!.meta).toMatchObject({ headSeq: 2, phase: 'play' }); // фаза без патча не меняется
    expect(again!.state.entities['hero']!.data).toEqual({ body: { points: 26 } });
    expect((await s.allCommits('a')).map((c) => c.seq)).toEqual([1, 2]);
    await s.close();
  });

  it('конфликт: неверный номер коммита отвергается, ничего не записывается', async () => {
    const s = fresh();
    await s.createCampaign(meta('a'));
    const state0 = initialState(rules);
    const first = makeCommit([], state0, (d) => d.emit({ t: 'entity.created', entity: hero }), 2000);
    await s.commit('a', first.commit, { state: first.state });
    // вторая вкладка пытается записать тот же seq 1
    const dup = makeCommit([], state0, (d) => d.emit({ t: 'flag.set', key: 'x', value: 1 }), 2500);
    await expect(s.commit('a', dup.commit, { state: dup.state })).rejects.toMatchObject({ name: 'StorageConflictError', campaignId: 'a', expectedHead: 0, actualHead: 1 });
    // и «дырку» тоже нельзя
    const gap = { ...dup.commit, seq: 5 };
    const hole = await s.commit('a', gap, { state: dup.state }).catch((e: unknown) => e);
    expect(hole).toBeInstanceOf(StorageConflictError);
    expect(hole).toMatchObject({ expectedHead: 4, actualHead: 1 });
    expect((hole as Error).message).toContain('коммит 5 не встаёт в журнал, он уже на 1');
    const loaded = await s.loadCampaign('a');
    expect(loaded!.meta.headSeq).toBe(1);
    expect(loaded!.commits).toHaveLength(1);
    expect(loaded!.state.flags).toEqual({});
    await s.close();
  });

  it('коммит в несуществующую кампанию — ошибка', async () => {
    const s = fresh();
    const c = makeCommit([], initialState(rules), (d) => d.emit({ t: 'flag.set', key: 'k', value: true }), 1);
    await expect(s.commit('nope', c.commit, { state: c.state })).rejects.toThrow('Нет кампании');
    expect(await s.loadCampaign('nope')).toBeNull();
    await s.close();
  });

  it('устаревшая или потерянная проекция пересчитывается из журнала', async () => {
    const s = fresh();
    await s.createCampaign(meta('a'));
    let state = initialState(rules);
    let log: Commit[] = [];
    for (const [i, event] of ([{ t: 'entity.created', entity: hero }, { t: 'flag.set', key: 'k', value: 7 }] as const).entries()) {
      const next = makeCommit(log, state, (d) => d.emit(event), 2000 + i);
      await s.commit('a', next.commit, { state: next.state });
      log = [...log, next.commit];
      state = next.state;
    }
    await s.close();

    const raw = await openDB(`test-${counter}`);
    await raw.put('projections', { cid: 'a', name: 'state', atSeq: 1, data: initialState(rules) }); // отстаёт от головы
    raw.close();
    const healed = await s.loadCampaign('a');
    expect(healed!.state.flags).toEqual({ k: 7 });
    expect(healed!.state.entities['hero']).toBeDefined();
    await s.close();

    const raw2 = await openDB(`test-${counter}`);
    await raw2.delete('projections', ['a', 'state']);
    raw2.close();
    expect((await s.loadCampaign('a'))!.state.flags).toEqual({ k: 7 });
    await s.close();
  });

  it('recent ограничивает число коммитов, оставляя последние', async () => {
    const s = fresh();
    await s.createCampaign(meta('a'));
    let state = initialState(rules);
    let log: Commit[] = [];
    for (let i = 0; i < 5; i++) {
      const next = makeCommit(log, state, (d) => d.emit({ t: 'flag.set', key: 'n', value: i }), 2000 + i);
      await s.commit('a', next.commit, { state: next.state });
      log = [...log, next.commit];
      state = next.state;
    }
    expect((await s.loadCampaign('a', { recent: 2 }))!.commits.map((c) => c.seq)).toEqual([4, 5]);
    expect((await s.loadCampaign('a'))!.commits).toHaveLength(5);
    await s.close();
  });

  it('удаление стирает кампанию целиком и не задевает соседние', async () => {
    const s = fresh();
    await s.createCampaign(meta('a'));
    await s.createCampaign(meta('b'));
    for (const id of ['a', 'b']) {
      const c = makeCommit([], initialState(rules), (d) => d.emit({ t: 'flag.set', key: id, value: true }), 2000);
      await s.commit(id, c.commit, { state: c.state });
    }
    await s.deleteCampaign('a');
    expect(await s.loadCampaign('a')).toBeNull();
    expect(await s.allCommits('a')).toEqual([]);
    expect((await s.listCampaigns()).map((m) => m.id)).toEqual(['b']);
    expect((await s.loadCampaign('b'))!.state.flags).toEqual({ b: true });
    await s.deleteCampaign('a'); // повтор безвреден
    await s.close();
  });

  it('данные переживают переоткрытие базы (перезагрузку страницы)', async () => {
    const name = `persist-${++counter}`;
    const first = new LocalAdapter(name);
    await first.createCampaign(meta('a'));
    const c = makeCommit([], initialState(rules), (d) => d.emit({ t: 'entity.created', entity: hero }), 2000);
    await first.commit('a', c.commit, { state: c.state, phase: 'play' });
    await first.close();
    const second = new LocalAdapter(name);
    const loaded = await second.loadCampaign('a');
    expect(loaded!.meta).toMatchObject({ phase: 'play', headSeq: 1 });
    expect(loaded!.state.entities['hero']!.name).toBe('Ирма');
    await second.close();
  });
});
