// Классические кубы `NdX±M` на сидированном RNG: случайные таблицы, d6/d66. Система-независимо.
import type { Rng } from './rng';

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

export type ClassicRoll = {
  expr: string;
  dice: number[];
  modifier: number;
  total: number;
};

const CLASSIC_RE = /^(\d+)d(\d+)(?:([+-])(\d+))?$/i;

/** Обычные кубы «2d6+1». */
export function rollClassic(rng: Rng, expr: string): ClassicRoll {
  const m = CLASSIC_RE.exec(expr.trim().replace(/\s+/g, ''));
  if (!m) throw new SyntaxError(`Некорректная формула кубов: «${expr}»`);
  const count = Number(m[1]);
  const sides = Number(m[2]);
  if (count < 1 || count > 100 || sides < 2 || sides > 1000) throw new RangeError(`Формула вне допустимых границ: «${expr}»`);
  const modifier = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
  const dice = Array.from({ length: count }, () => rng.int(sides) + 1);
  return { expr: `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? String(modifier) : ''}`, dice, modifier, total: sum(dice) + modifier };
}
