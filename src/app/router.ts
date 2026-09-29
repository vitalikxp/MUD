// Минимальный роутер по pathname. На GitHub Pages глубокие ссылки работают через 404.html = index.html.
import { signal } from '@preact/signals';

export type Route =
  | { page: 'title' }
  | { page: 'game'; id: string }
  /** Черновой чат с моделью без кампании (наследие M0), пока Мастера нет. */
  | { page: 'chat' }
  | { page: 'glyphs' };

export function pathOf(route: Route): string {
  switch (route.page) {
    case 'title': return '/';
    case 'game': return `/game/${encodeURIComponent(route.id)}`;
    case 'chat': return '/dev/chat';
    case 'glyphs': return '/dev/glyphs';
  }
}

export function parse(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/dev/chat') return { page: 'chat' };
  if (clean === '/dev/glyphs') return { page: 'glyphs' };
  const game = /^\/game\/([^/]+)$/.exec(clean);
  if (game) {
    try {
      return { page: 'game', id: decodeURIComponent(game[1]!) };
    } catch {
      return { page: 'title' };
    }
  }
  return { page: 'title' };
}

export const route = signal<Route>(parse(location.pathname));

export function navigate(to: Route): void {
  const path = pathOf(to);
  if (location.pathname === path) return;
  history.pushState(null, '', path);
  route.value = to;
}

window.addEventListener('popstate', () => {
  route.value = parse(location.pathname);
});
