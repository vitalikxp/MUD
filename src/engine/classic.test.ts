import { describe, expect, it } from 'vitest';
import { rollClassic } from './classic';
import { createRng } from './rng';
import { scriptedRng } from './testing';

describe('классические кубы', () => {
  it('2d6+1: формула, границы, отказ на мусоре', () => {
    const r = rollClassic(scriptedRng([3, 4]), '2d6+1');
    expect(r).toMatchObject({ expr: '2d6+1', dice: [3, 4], modifier: 1, total: 8 });
    expect(rollClassic(scriptedRng([2]), 'd6'.replace('d6', '1d6-1')).total).toBe(1);
    expect(() => rollClassic(createRng('x'), 'сто кубов')).toThrow(SyntaxError);
    expect(() => rollClassic(createRng('x'), '0d6')).toThrow(RangeError);
    expect(() => rollClassic(createRng('x'), '101d6')).toThrow(RangeError);
  });
});
