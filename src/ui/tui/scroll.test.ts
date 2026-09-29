import { describe, expect, it } from 'vitest';
import { clampOffset, followOffset, maxOffset, scrollThumb, thinkingBar } from './scroll';

describe('прокрутка', () => {
  it('максимальный сдвиг и ограничение', () => {
    expect(maxOffset(100, 20)).toBe(80);
    expect(maxOffset(10, 20)).toBe(0);
    expect(clampOffset(-5, 100, 20)).toBe(0);
    expect(clampOffset(500, 100, 20)).toBe(80);
    expect(clampOffset(7, 100, 20)).toBe(7);
  });

  it('внизу лента следует за новым текстом, прокрученная вверх — стоит на месте', () => {
    expect(followOffset(0, 50, 53)).toBe(0);
    expect(followOffset(10, 50, 53)).toBe(13);
    expect(followOffset(10, 50, 50)).toBe(10);
    expect(followOffset(10, 50, 48)).toBe(10); // строки могли убавиться при переносе — не двигаем
  });

  it('ползунок: нет, если всё помещается; внизу — у нижнего края; вверху — у верхнего', () => {
    expect(scrollThumb(20, 20, 0)).toBeNull();
    expect(scrollThumb(10, 20, 0)).toBeNull();
    const bottom = scrollThumb(100, 20, 0)!;
    const top = scrollThumb(100, 20, 80)!;
    expect(bottom.size).toBe(4); // 20*20/100
    expect(bottom.start + bottom.size).toBe(20);
    expect(top.start).toBe(0);
    const mid = scrollThumb(100, 20, 40)!;
    expect(mid.start).toBeGreaterThan(0);
    expect(mid.start + mid.size).toBeLessThan(20);
  });

  it('ползунок не меньше одной ячейки на очень длинной ленте', () => {
    expect(scrollThumb(100000, 10, 0)!.size).toBe(1);
  });
});

describe('thinkingBar', () => {
  it('ровно width ячеек, один блок, бегает туда-обратно', () => {
    const frames = Array.from({ length: 18 }, (_, i) => thinkingBar(i));
    for (const f of frames) {
      expect(Array.from(f)).toHaveLength(10);
      expect(f.split('█')).toHaveLength(2);
    }
    expect(frames[0]!.indexOf('█')).toBe(0);
    expect(frames[9]!.indexOf('█')).toBe(9);
    expect(frames[10]!.indexOf('█')).toBe(8); // обратный ход
    expect(thinkingBar(18)).toBe(frames[0]); // период 18
  });
});
