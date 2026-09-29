// Помощники для тестов движка и правил. В продакшен-код не импортируются.
import type { Rng } from './rng';

/** Генератор, который отдаёт заранее заданные значения d6 по порядку; на исчерпании — ошибка (тест неполный). */
export function scriptedRng(values: readonly number[]): Rng {
  const queue = [...values];
  const take = (): number => {
    const v = queue.shift();
    if (v === undefined) throw new Error('scriptedRng: значения кончились');
    return v;
  };
  const rng: Rng = {
    next: () => (take() - 1) / 6,
    int: (n) => {
      const v = take();
      if (v < 1 || v > n) throw new Error(`scriptedRng: ${v} вне 1..${n}`);
      return v - 1;
    },
    d6: take,
    state: () => `scripted.${queue.length}`,
    clone: () => scriptedRng(queue),
  };
  return rng;
}
