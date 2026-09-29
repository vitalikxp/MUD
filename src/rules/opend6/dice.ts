// Коды кубов и броски OpenD6 (OpenD6: adventure p.47–48): `4D+1` = четыре d6 и +1; 3 пипа = 1D; один куб броска — Wild Die.
import type { Rng } from '../../engine/rng';

/** Код кубов. Всегда нормализован: пипов 0..2, а знак несёт `dice` (для штрафов `-1D` dice = -1). */
export interface DieCode {
  dice: number;
  pips: number;
}

export const toPips = (c: DieCode): number => c.dice * 3 + c.pips;

export function fromPips(total: number): DieCode {
  const dice = Math.floor(total / 3);
  return { dice, pips: total - dice * 3 };
}

export const addCodes = (a: DieCode, b: DieCode): DieCode => fromPips(toPips(a) + toPips(b));
export const scaleCode = (c: DieCode, k: number): DieCode => fromPips(toPips(c) * k);
export const normalizeCode = (c: DieCode): DieCode => fromPips(toPips(c));

const CODE_RE = /^([+-]?)(?:(\d+)D(?:([+-])(\d+))?|(\d+))$/i;

/**
 * «4D+1», «3D», «+1D», «-2», «+2» (голые пипы). Знак в начале относится к кубам, знак перед пипами — к пипам:
 * «-1D+1» = −1D и +1 пип (−2 пипа), «-1D-1» = −4 пипа, «4D-1» = 3D+2. Бросает SyntaxError на мусоре.
 */
export function parseDieCode(text: string): DieCode {
  const s = text.trim().replace(/д/gi, 'D').replace(/\s+/g, '');
  const m = CODE_RE.exec(s);
  if (!m) throw new SyntaxError(`Некорректный код кубов: «${text}»`);
  const sign = m[1] === '-' ? -1 : 1;
  if (m[5] !== undefined) return fromPips(sign * Number(m[5]));
  const pips = m[4] === undefined ? 0 : (m[3] === '-' ? -1 : 1) * Number(m[4]);
  return fromPips(sign * Number(m[2]) * 3 + pips);
}

/** «4D+1»; отрицательный код — «-1D», «-1D-1» (−4 пипа), «-2» (−2 пипа); читается обратно `parseDieCode`. */
export function formatDieCode(c: DieCode): string {
  const total = toPips(c);
  if (total >= 0) return `${c.dice}D${c.pips ? `+${c.pips}` : ''}`;
  const abs = fromPips(-total);
  if (abs.dice === 0) return `-${abs.pips}`;
  return `-${abs.dice}D${abs.pips ? `-${abs.pips}` : ''}`;
}

/** Как применять единицу на первом броске Wild Die (adventure p.47). */
export type WildOne = 'complication' | 'cancel';

export interface PoolRollInput {
  /** Код характеристики или навыка. */
  code: DieCode;
  /** Штрафы и бонусы, добавляются ПОСЛЕ удвоения Очком судьбы (OpenD6: adventure p.47). */
  mods?: DieCode;
  /** Очко судьбы: удваивает кубы и пипы кода (не бонусы снаряжения и не штрафы). */
  fate?: boolean;
  /** Число потраченных Очков персонажа: каждое добавляет ещё один Wild Die (единица на нём — просто 1). */
  extraWild?: number;
  wildOne?: WildOne;
}

export type PoolRoll = {
  /** Итоговый код, который бросали (после FP и модификаторов), например «8D+4». */
  code: string;
  /** Обычные кубы. */
  dice: number[];
  /** Основной Wild Die: первый бросок и его «взрывы» на шестёрках. */
  wild: number[];
  /** Дополнительные Wild Die за Очки персонажа (по цепочке на каждое). */
  cpWild: number[][];
  pips: number;
  total: number;
  /** На первом броске Wild Die выпала единица и выбрано осложнение. */
  complication: boolean;
  /** Значение наибольшего обычного куба, убранного единицей (если выбрано `cancel`). */
  cancelled: number | null;
  /** Единица на первом броске Wild Die (в любом режиме). */
  wildOne: boolean;
  spent: { cp: number; fp: boolean };
  /** Кубов меньше одного — бросать нельзя (навык, «сведённый в ноль», adventure p.50). */
  impossible: boolean;
};

const EXPLOSION_CAP = 40;

/** Цепочка Wild Die: 6 добавляется и бросается ещё раз. */
function wildChain(rng: Rng): number[] {
  const chain: number[] = [];
  for (let i = 0; i < EXPLOSION_CAP; i++) {
    const v = rng.d6();
    chain.push(v);
    if (v !== 6) break;
  }
  return chain;
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export function rollPool(rng: Rng, input: PoolRollInput): PoolRoll {
  const fate = input.fate ?? false;
  const extra = Math.max(0, Math.floor(input.extraWild ?? 0));
  const eff = fromPips(toPips(input.code) * (fate ? 2 : 1) + toPips(input.mods ?? { dice: 0, pips: 0 }));
  const base = { code: formatDieCode(eff), spent: { cp: extra, fp: fate } };

  if (eff.dice < 1) {
    return { ...base, dice: [], wild: [], cpWild: [], pips: eff.pips, total: 0, complication: false, cancelled: null, wildOne: false, impossible: true };
  }

  const dice = Array.from({ length: eff.dice - 1 }, () => rng.d6());
  const wild = wildChain(rng);
  const cpWild = Array.from({ length: extra }, () => wildChain(rng));
  const cpTotal = sum(cpWild.map(sum));
  const first = wild[0]!;

  if (first === 1) {
    if ((input.wildOne ?? 'complication') === 'cancel') {
      const highest = dice.length > 0 ? Math.max(...dice) : 0;
      const remaining = dice.length > 0 ? sum(dice) - highest : 0;
      return { ...base, dice, wild, cpWild, pips: eff.pips, total: remaining + cpTotal + eff.pips, complication: false, cancelled: dice.length > 0 ? highest : null, wildOne: true, impossible: false };
    }
    return { ...base, dice, wild, cpWild, pips: eff.pips, total: sum(dice) + 1 + cpTotal + eff.pips, complication: true, cancelled: null, wildOne: true, impossible: false };
  }

  return { ...base, dice, wild, cpWild, pips: eff.pips, total: sum(dice) + sum(wild) + cpTotal + eff.pips, complication: false, cancelled: null, wildOne: false, impossible: false };
}

export interface Judgement {
  success: boolean;
  /** Итог минус сложность (отрицательный — недобор). */
  margin: number;
}

/** Успех, если итог достиг сложности или превысил её (adventure p.53). */
export function judge(total: number, difficulty: number): Judgement {
  return { success: total >= difficulty, margin: total - difficulty };
}
