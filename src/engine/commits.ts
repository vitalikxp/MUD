// Журнал коммитов: свёртка в состояние с учётом откатов, черновик хода, продолжение RNG.
import { createRng, rngFromState, type Rng } from './rng';
import { reduce, reduceAll } from './reducer';
import type { Commit, CommitKind, GameEvent, GameState } from './types';

/** Номера коммитов, отменённых откатами. Откат отката не «воскрешает» — просто отменяет и его. */
export function revertedSeqs(commits: readonly Commit[]): Set<number> {
  const reverted = new Set<number>();
  // Идём с конца: откат, сам отменённый более поздним откатом, действия не имеет.
  for (const c of commits.toReversed()) {
    if (reverted.has(c.seq)) continue;
    for (const e of c.events) if (e.t === 'revert') reverted.add(e.targetSeq);
  }
  return reverted;
}

/** Действующие коммиты: без отменённых и без самих коммитов-откатов. */
export function effectiveCommits(commits: readonly Commit[]): Commit[] {
  const reverted = revertedSeqs(commits);
  return commits.filter((c) => !reverted.has(c.seq) && !c.events.some((e) => e.t === 'revert'));
}

/** Состояние = свёртка действующих коммитов. */
export function foldCommits(initial: GameState, commits: readonly Commit[]): GameState {
  return effectiveCommits(commits).reduce((s, c) => reduceAll(s, c.events), initial);
}

/** RNG продолжается с последнего коммита (в том числе отменённого): после отката броски новые, а не те же самые. */
export function rngAfter(seed: string, commits: readonly Commit[]): Rng {
  const last = commits.at(-1);
  return last ? rngFromState(last.rngState) : createRng(seed);
}

export function nextSeq(commits: readonly Commit[]): number {
  return (commits.at(-1)?.seq ?? 0) + 1;
}

/**
 * Черновик хода: копия состояния и RNG, к которой применяются события; в журнал ничего не пишется, пока не вызван `toCommit`.
 * Брошенный черновик просто забывается — ход атомарен (NFR-REL-1).
 */
export class Draft {
  private current: GameState;
  private readonly rngCopy: Rng;
  private readonly emitted: GameEvent[] = [];

  constructor(state: GameState, rng: Rng, readonly turnId: string) {
    this.current = state;
    this.rngCopy = rng.clone();
  }

  get state(): GameState {
    return this.current;
  }

  get rng(): Rng {
    return this.rngCopy;
  }

  get events(): readonly GameEvent[] {
    return this.emitted;
  }

  /** Применяет событие к черновику. Если редьюсер бросил исключение, черновик остаётся прежним. */
  emit(...events: GameEvent[]): void {
    let next = this.current;
    for (const e of events) next = reduce(next, e);
    this.current = next;
    this.emitted.push(...events);
  }

  toCommit(seq: number, kind: CommitKind, createdAt: number, promptVersion?: string): Commit {
    return {
      seq,
      turnId: this.turnId,
      kind,
      createdAt,
      rngState: this.rngCopy.state(),
      ...(promptVersion ? { promptVersion } : {}),
      events: [...this.emitted],
    };
  }
}

/** Коммит-откат: отменяет `targetSeq`. */
export function revertCommit(seq: number, targetSeq: number, turnId: string, createdAt: number, rngState: string): Commit {
  return { seq, turnId, kind: 'revert', createdAt, rngState, events: [{ t: 'revert', targetSeq }] };
}
