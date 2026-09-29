// Сидированный генератор случайных чисел (sfc32). Вся случайность движка идёт только отсюда:
// `Math.random` в engine/ и rules/ запрещён (AGENTS.md §4.2), а состояние генератора хранится в каждом коммите,
// поэтому журнал воспроизводим и откат хода даёт другие броски (RNG продолжает с последнего коммита).

export interface Rng {
  /** Число в [0, 1). */
  next(): number;
  /** Целое в [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Куб d6: 1..6. */
  d6(): number;
  /** Сериализованное состояние: `a.b.c.d` (hex). */
  state(): string;
  clone(): Rng;
}

const u32 = (n: number): number => n >>> 0;

/** Хэш строки в 32-битные числа (xmur3): из seed получаем четыре слова состояния. */
function seedWords(seed: string): [number, number, number, number] {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const next = (): number => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return u32((h ^= h >>> 16));
  };
  return [next(), next(), next(), next()];
}

class Sfc32 implements Rng {
  constructor(private a: number, private b: number, private c: number, private d: number) {}

  next(): number {
    const t = u32(u32(this.a + this.b) + this.d);
    this.d = u32(this.d + 1);
    this.a = this.b ^ (this.b >>> 9);
    this.b = u32(this.c + (this.c << 3));
    this.c = u32((this.c << 21) | (this.c >>> 11));
    this.c = u32(this.c + t);
    return t / 4294967296;
  }

  int(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive < 1) throw new RangeError(`rng.int: нужно целое ≥ 1, получено ${maxExclusive}`);
    return Math.floor(this.next() * maxExclusive);
  }

  d6(): number {
    return this.int(6) + 1;
  }

  state(): string {
    return [this.a, this.b, this.c, this.d].map((n) => u32(n).toString(16)).join('.');
  }

  clone(): Rng {
    return new Sfc32(this.a, this.b, this.c, this.d);
  }
}

export function createRng(seed: string): Rng {
  const [a, b, c, d] = seedWords(seed);
  const rng = new Sfc32(a, b, c, d);
  for (let i = 0; i < 15; i++) rng.next(); // прогрев
  return rng;
}

export function rngFromState(state: string): Rng {
  const parts = state.split('.').map((p) => parseInt(p, 16));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) throw new Error(`Некорректное состояние RNG: «${state}»`);
  return new Sfc32(parts[0]!, parts[1]!, parts[2]!, parts[3]!);
}
