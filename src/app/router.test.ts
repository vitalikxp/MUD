import { describe, expect, it, vi } from 'vitest';

// Роутер трогает location/history при импорте: даём минимальные заглушки.
vi.stubGlobal('location', { pathname: '/' });
vi.stubGlobal('history', { pushState: () => undefined });
vi.stubGlobal('window', { addEventListener: () => undefined });

const { parse, pathOf } = await import('./router');

describe('роутер', () => {
  it('разбирает пути', () => {
    expect(parse('/')).toEqual({ page: 'title' });
    expect(parse('')).toEqual({ page: 'title' });
    expect(parse('/game/abc-123')).toEqual({ page: 'game', id: 'abc-123' });
    expect(parse('/game/abc-123/')).toEqual({ page: 'game', id: 'abc-123' });
    expect(parse('/dev/chat')).toEqual({ page: 'chat' });
    expect(parse('/dev/glyphs')).toEqual({ page: 'glyphs' });
  });

  it('неизвестное, вложенное и битое ведёт на титульный экран', () => {
    expect(parse('/nope')).toEqual({ page: 'title' });
    expect(parse('/game')).toEqual({ page: 'title' });
    expect(parse('/game/a/b')).toEqual({ page: 'title' });
    expect(parse('/game/%E0%A4%A')).toEqual({ page: 'title' });
  });

  it('путь ↔ маршрут взаимно обратны, id кодируется', () => {
    for (const r of [{ page: 'title' }, { page: 'chat' }, { page: 'glyphs' }, { page: 'game', id: 'a b/ü' }] as const) {
      expect(parse(pathOf(r))).toEqual(r);
    }
  });
});
