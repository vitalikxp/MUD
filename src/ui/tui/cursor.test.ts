import { describe, expect, it } from 'vitest';
import { snapToCell } from './cursor';

const rect = { left: 10, top: 20 };

describe('snapToCell', () => {
  it('привязывает точку к клетке', () => {
    expect(snapToCell(10, 20, rect, 9, 16, 80, 25)).toEqual({ col: 0, row: 0 });
    expect(snapToCell(18.9, 35.9, rect, 9, 16, 80, 25)).toEqual({ col: 0, row: 0 });
    expect(snapToCell(19, 36, rect, 9, 16, 80, 25)).toEqual({ col: 1, row: 1 });
    expect(snapToCell(300, 200, rect, 9, 16, 142, 50)).toEqual({ col: 32, row: 11 });
  });
  it('вне сетки — null', () => {
    expect(snapToCell(9, 30, rect, 9, 16, 80, 25)).toBeNull();
    expect(snapToCell(50, 19, rect, 9, 16, 80, 25)).toBeNull();
    expect(snapToCell(10 + 9 * 80, 30, rect, 9, 16, 80, 25)).toBeNull();
    expect(snapToCell(50, 20 + 16 * 25, rect, 9, 16, 80, 25)).toBeNull();
  });
  it('работает с дробной клеткой', () => {
    expect(snapToCell(10 + 13.5 * 3 + 0.1, 20, rect, 13.5, 24, 94, 33)).toEqual({ col: 3, row: 0 });
  });
});
