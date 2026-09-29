import { describe, expect, it } from 'vitest';
import { Draft, effectiveCommits, foldCommits, nextSeq, revertCommit, revertedSeqs, rngAfter } from './commits';
import { rollClassic } from './classic';
import { initialState, EngineError } from './reducer';
import { createRng } from './rng';
import type { Commit, Entity } from './types';

const rules = { id: 'opend6', version: '0.1.0', variant: 'fantasy' };
const s0 = initialState(rules);
const hero: Entity = { id: 'irma', kind: 'pc', name: 'Ирма', data: { body: { points: 30 } }, items: [], conditions: [] };

/** Ход: Draft → события → коммит. */
function turn(prev: Commit[], build: (d: Draft) => void, kind: Commit['kind'] = 'turn'): Commit[] {
  const d = new Draft(foldCommits(s0, prev), rngAfter('seed', prev), `t${nextSeq(prev)}`);
  build(d);
  return [...prev, d.toCommit(nextSeq(prev), kind, 1000 + prev.length)];
}

/** Что выпало бы на следующем ходе из данного журнала. */
function rollNext(log: Commit[]): number[] {
  const d = new Draft(foldCommits(s0, log), rngAfter('seed', log), 'x');
  return rollClassic(d.rng, '6d6').dice;
}

function play(): Commit[] {
  return turn(
    turn([], (d) => d.emit({ t: 'entity.created', entity: hero })),
    (d) => {
      const roll = rollClassic(d.rng, '5d6+1');
      d.emit({ t: 'roll', roll, reason: 'взлом', visibility: 'all' });
    },
  );
}

describe('Draft', () => {
  it('накапливает события и состояние, а RNG двигает у себя — исходный не трогает', () => {
    const rng = createRng('d');
    const before = rng.state();
    const d = new Draft(s0, rng, 't1');
    d.emit({ t: 'entity.created', entity: hero });
    const roll = rollClassic(d.rng, '3d6');
    d.emit({ t: 'roll', roll, reason: 'тест', visibility: 'all' });
    expect(Object.keys(d.state.entities)).toEqual(['irma']);
    expect(d.events).toHaveLength(2);
    expect(rng.state()).toBe(before);
    expect(d.toCommit(1, 'turn', 5).rngState).toBe(d.rng.state());
  });

  it('падение редьюсера посреди emit() оставляет черновик прежним (атомарность пачки)', () => {
    const d = new Draft(s0, createRng('d'), 't1');
    d.emit({ t: 'entity.created', entity: hero });
    expect(() =>
      d.emit({ t: 'entity.patched', id: 'irma', ops: [{ op: 'inc', path: 'body.points', by: -1 }] }, { t: 'entity.patched', id: 'нет', ops: [] }),
    ).toThrow(EngineError);
    expect(d.state.entities['irma']!.data).toEqual({ body: { points: 30 } });
    expect(d.events).toHaveLength(1);
  });
});

describe('журнал коммитов', () => {
  const base = turn([], (d) => d.emit({ t: 'entity.created', entity: hero }, { t: 'turn.ended', suggestions: [] }));

  it('свёртка воспроизводит состояние, нумерация растёт', () => {
    const log = turn(base, (d) => d.emit({ t: 'entity.patched', id: 'irma', ops: [{ op: 'inc', path: 'body.points', by: -8 }] }, { t: 'turn.ended', suggestions: ['бежать'] }));
    expect(log.map((c) => c.seq)).toEqual([1, 2]);
    expect(foldCommits(s0, log).entities['irma']!.data).toEqual({ body: { points: 22 } });
    expect(foldCommits(s0, log).turn).toBe(2);
    expect(nextSeq(log)).toBe(3);
    expect(nextSeq([])).toBe(1);
  });

  it('откат хода отменяет его события; сам коммит-откат в свёртку не идёт', () => {
    let log = turn(base, (d) => d.emit({ t: 'entity.patched', id: 'irma', ops: [{ op: 'inc', path: 'body.points', by: -8 }] }));
    log = [...log, revertCommit(3, 2, 'r', 2000, log.at(-1)!.rngState)];
    expect(revertedSeqs(log)).toEqual(new Set([2]));
    expect(effectiveCommits(log).map((c) => c.seq)).toEqual([1]);
    expect(foldCommits(s0, log).entities['irma']!.data).toEqual({ body: { points: 30 } });
  });

  it('откат отката: отменённый откат не действует, и ход возвращается', () => {
    let log = turn(base, (d) => d.emit({ t: 'entity.patched', id: 'irma', ops: [{ op: 'inc', path: 'body.points', by: -8 }] }));
    log = [...log, revertCommit(3, 2, 'r1', 2000, 'x.0.0.0'), revertCommit(4, 3, 'r2', 2001, 'x.0.0.0')];
    expect(effectiveCommits(log).map((c) => c.seq)).toEqual([1, 2]);
    expect(foldCommits(s0, log).entities['irma']!.data).toEqual({ body: { points: 22 } });
  });

  it('после отката броски НОВЫЕ: RNG продолжает с последнего коммита, а не возвращается назад', () => {
    let log = turn(base, (d) => { rollClassic(d.rng, '6d6'); });
    const firstAttempt = rollNext(base); // что выпало бы на ходе 2 из состояния до него
    log = [...log, revertCommit(3, 2, 'r', 2000, log.at(-1)!.rngState)];
    expect(rollNext(log)).not.toEqual(firstAttempt);
  });

  it('вся история воспроизводима: тот же seed и те же действия → те же броски и тот же журнал', () => {
    expect(play()).toEqual(play());
  });
});
