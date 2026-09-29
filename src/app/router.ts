// Минимальный роутер по pathname. На GitHub Pages глубокие ссылки работают через 404.html = index.html.
import { signal } from '@preact/signals';

export type Route = 'home' | 'glyphs' | 'settings';

const PATHS: Record<Route, string> = { home: '/', glyphs: '/dev/glyphs', settings: '/settings' };

function parse(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || '/';
  return (Object.entries(PATHS).find(([, p]) => p === clean)?.[0] as Route | undefined) ?? 'home';
}

export const route = signal<Route>(parse(location.pathname));

export function navigate(to: Route): void {
  if (route.value === to) return;
  history.pushState(null, '', PATHS[to]);
  route.value = to;
}

window.addEventListener('popstate', () => {
  route.value = parse(location.pathname);
});
