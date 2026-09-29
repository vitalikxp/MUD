import { describe, expect, it } from 'vitest';
import { addCodes, formatDieCode, fromPips, judge, parseDieCode, rollPool, scaleCode, toPips } from './dice';
import { createRng } from '../../engine/rng';
import { scriptedRng } from '../../engine/testing';

describe('коды кубов', () => {
  it('разбор и запись: пипы, бонусы, штрафы, кириллическая «Д»', () => {
    expect(parseDieCode('4D+1')).toEqual({ dice: 4, pips: 1 });
    expect(parseDieCode('3д')).toEqual({ dice: 3, pips: 0 });
    expect(parseDieCode('+1D')).toEqual({ dice: 1, pips: 0 });
    expect(parseDieCode('+2')).toEqual({ dice: 0, pips: 2 });
    expect(parseDieCode('-1D')).toEqual({ dice: -1, pips: 0 });
    expect(parseDieCode('2D+3')).toEqual({ dice: 3, pips: 0 }); // 3 пипа = 1D
    expect(formatDieCode({ dice: 4, pips: 1 })).toBe('4D+1');
    expect(formatDieCode(parseDieCode('-1D'))).toBe('-1D');
    expect(() => parseDieCode('D6')).toThrow(SyntaxError);
    expect(() => parseDieCode('')).toThrow(SyntaxError);
  });

  it('знак пипов независим: «-1D+1» = −2 пипа, «-1D-1» = −4, «4D-1» = 3D+2; запись читается обратно', () => {
    expect(toPips(parseDieCode('-1D+1'))).toBe(-2);
    expect(toPips(parseDieCode('-1D-1'))).toBe(-4);
    expect(parseDieCode('4D-1')).toEqual({ dice: 3, pips: 2 });
    expect(parseDieCode('-2')).toEqual({ dice: -1, pips: 1 });
    for (const pips of [-14, -4, -3, -2, -1, 0, 1, 2, 3, 14]) {
      expect(toPips(parseDieCode(formatDieCode(fromPips(pips))))).toBe(pips);
    }
    expect(formatDieCode(fromPips(-4))).toBe('-1D-1');
    expect(formatDieCode(fromPips(-2))).toBe('-2');
    expect(() => parseDieCode('1D+')).toThrow(SyntaxError);
  });

  it('арифметика в пипах: 3 пипа = 1D, удвоение (Очко судьбы) 4D+2 → 8D+4 → 9D+1', () => {
    expect(toPips({ dice: 4, pips: 2 })).toBe(14);
    expect(fromPips(14)).toEqual({ dice: 4, pips: 2 });
    expect(addCodes(parseDieCode('2D+2'), parseDieCode('+2'))).toEqual({ dice: 3, pips: 1 });
    expect(formatDieCode(scaleCode(parseDieCode('4D+2'), 2))).toBe('9D+1'); // книга: 8D+4 = 9D+1
    expect(addCodes(parseDieCode('3D'), parseDieCode('-1D'))).toEqual({ dice: 2, pips: 0 });
  });
});

describe('бросок пула с Wild Die', () => {
  it('обычный бросок: сумма обычных кубов, Wild Die и пипов', () => {
    // 4D+1: три обычных (3,5,2) и Wild Die (4)
    const r = rollPool(scriptedRng([3, 5, 2, 4]), { code: parseDieCode('4D+1') });
    expect(r).toMatchObject({ code: '4D+1', dice: [3, 5, 2], wild: [4], pips: 1, total: 15, complication: false, wildOne: false, impossible: false });
  });

  it('шестёрка на Wild Die взрывается: 6 добавляется и Wild Die бросается снова, пока выпадают шестёрки', () => {
    const r = rollPool(scriptedRng([2, 6, 6, 3]), { code: parseDieCode('2D') });
    expect(r.wild).toEqual([6, 6, 3]);
    expect(r.total).toBe(2 + 6 + 6 + 3);
  });

  it('единица на первом Wild Die: осложнение (сумма считается как обычно) или отмена наибольшего куба', () => {
    const comp = rollPool(scriptedRng([3, 5, 2, 1]), { code: parseDieCode('4D'), wildOne: 'complication' });
    expect(comp).toMatchObject({ complication: true, cancelled: null, wildOne: true, total: 3 + 5 + 2 + 1 });
    const cancel = rollPool(scriptedRng([3, 5, 2, 1]), { code: parseDieCode('4D'), wildOne: 'cancel' });
    expect(cancel).toMatchObject({ complication: false, cancelled: 5, wildOne: true, total: 3 + 2 });
    // по умолчанию — осложнение
    expect(rollPool(scriptedRng([3, 1]), { code: parseDieCode('2D') }).complication).toBe(true);
  });

  it('единица на ПОВТОРНОМ броске Wild Die (после шестёрки) осложнений не даёт', () => {
    const r = rollPool(scriptedRng([4, 6, 1]), { code: parseDieCode('2D') });
    expect(r).toMatchObject({ wild: [6, 1], complication: false, wildOne: false, total: 4 + 6 + 1 });
  });

  it('1D — это один Wild Die; с единицей и отменой остаётся только пипы', () => {
    expect(rollPool(scriptedRng([5]), { code: parseDieCode('1D+2') }).total).toBe(7);
    const r = rollPool(scriptedRng([1]), { code: parseDieCode('1D+2'), wildOne: 'cancel' });
    expect(r).toMatchObject({ cancelled: null, total: 2 });
  });

  it('Очко судьбы удваивает код ДО модификаторов: 4D+2 → 9D+1, штраф −1D после удвоения, один Wild Die', () => {
    // 9D+1 −1D = 8D+1: семь обычных и один Wild Die
    const r = rollPool(scriptedRng([1, 1, 1, 1, 1, 1, 1, 3]), { code: parseDieCode('4D+2'), fate: true, mods: parseDieCode('-1D') });
    expect(r.code).toBe('8D+1');
    expect(r.dice).toHaveLength(7);
    expect(r.wild).toEqual([3]);
    expect(r.total).toBe(7 + 3 + 1);
    expect(r.spent).toEqual({ cp: 0, fp: true });
  });

  it('Очки персонажа: каждое добавляет ещё один Wild Die со своей цепочкой; единица на нём — просто 1', () => {
    // 2D: обычный 3, Wild 4; два CP: первый 6→6→2 (=14), второй 1 (=1, без осложнения)
    const r = rollPool(scriptedRng([3, 4, 6, 6, 2, 1]), { code: parseDieCode('2D'), extraWild: 2 });
    expect(r.cpWild).toEqual([[6, 6, 2], [1]]);
    expect(r.total).toBe(3 + 4 + 14 + 1);
    expect(r.complication).toBe(false);
    expect(r.spent.cp).toBe(2);
  });

  it('штраф сводит кубы к нулю — бросать нельзя, кости не тратятся', () => {
    const rng = scriptedRng([]);
    const r = rollPool(rng, { code: parseDieCode('2D'), mods: parseDieCode('-2D') });
    expect(r).toMatchObject({ impossible: true, total: 0, dice: [], wild: [] });
  });

  it('пул детерминирован при одном seed и состоянии', () => {
    const a = rollPool(createRng('x'), { code: parseDieCode('6D+2'), extraWild: 1 });
    const b = rollPool(createRng('x'), { code: parseDieCode('6D+2'), extraWild: 1 });
    expect(a).toEqual(b);
  });

  it('среднее 3D близко к 10.5 + вклад взрывов (10 000 бросков)', () => {
    const rng = createRng('avg');
    let total = 0;
    for (let i = 0; i < 10000; i++) total += rollPool(rng, { code: parseDieCode('3D'), wildOne: 'complication' }).total;
    const mean = total / 10000;
    // два обычных (7) + Wild Die с взрывом (E = 3.5 + 6*E/6 → 4.2) = 11.2
    expect(mean).toBeGreaterThan(10.8);
    expect(mean).toBeLessThan(11.6);
  });
});

describe('judge', () => {
  it('успех при итоге ≥ сложности; margin со знаком', () => {
    expect(judge(15, 15)).toEqual({ success: true, margin: 0 });
    expect(judge(14, 15)).toEqual({ success: false, margin: -1 });
    expect(judge(21, 15)).toEqual({ success: true, margin: 6 });
  });
});
