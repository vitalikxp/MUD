import { describe, expect, it } from 'vitest';
import { createRng, rngFromState } from './rng';

describe('rng', () => {
  it('один seed — одна последовательность, разные seed — разные', () => {
    const a = createRng('кампания-1');
    const b = createRng('кампания-1');
    const seqA = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(seqA);
    const c = createRng('кампания-2');
    expect(Array.from({ length: 20 }, () => c.next())).not.toEqual(seqA);
  });

  it('состояние сериализуется и продолжается ровно с того же места; clone независим', () => {
    const rng = createRng('s');
    for (let i = 0; i < 7; i++) rng.next();
    const saved = rng.state();
    const copy = rng.clone();
    const expected = Array.from({ length: 10 }, () => rng.d6());
    const restored = rngFromState(saved);
    expect(Array.from({ length: 10 }, () => restored.d6())).toEqual(expected);
    expect(Array.from({ length: 10 }, () => copy.d6())).toEqual(expected); // clone не двигал оригинал и наоборот
  });

  it('d6 даёт 1..6 и все грани, int уважает границы', () => {
    const rng = createRng('faces');
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      const v = rng.d6();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
    expect(() => rng.int(0)).toThrow(RangeError);
    for (let i = 0; i < 100; i++) expect(rng.int(1)).toBe(0);
  });

  it('распределение d6 близко к равномерному (30 000 бросков, допуск 5%)', () => {
    const rng = createRng('uniform');
    const count = [0, 0, 0, 0, 0, 0];
    for (let i = 0; i < 30000; i++) count[rng.d6() - 1]!++;
    for (const c of count) expect(Math.abs(c - 5000) / 5000).toBeLessThan(0.05);
  });

  it('испорченное состояние отвергается', () => {
    expect(() => rngFromState('nope')).toThrow();
    expect(() => rngFromState('1.2.3')).toThrow();
  });
});
