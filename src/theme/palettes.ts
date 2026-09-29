// Палитры: семантические токены цвета (docs/07-ui-tui.md#палитры). Данные — content/palettes/*.json.

export const TOKENS = [
  'bg', 'bgAlt', 'bgPanel',
  'fg', 'fgDim', 'fgBright',
  'frame', 'frameActive', 'title',
  'accent', 'accent2',
  'dm', 'player', 'ooc', 'system',
  'success', 'failure', 'crit', 'fumble',
  'hp', 'hpLow', 'mana',
  'danger', 'warning', 'info', 'magic',
  'selBg', 'selFg', 'cursor',
  'mapFloor', 'mapWall', 'mapWater', 'mapFog', 'mapSeen', 'mapToken', 'mapEnemy', 'mapAlly',
] as const;

export type Token = (typeof TOKENS)[number];

export interface Palette {
  id: string;
  name: { ru: string; en: string };
  /** Когда палитра уместна — это описание уходит в контекст Мастера. */
  when: { ru: string; en: string };
  /** Может ли Мастер включать палитру (`high-contrast` — нет). */
  dmAllowed: boolean;
  colors: Record<Token, string>;
}

export const DEFAULT_PALETTE = 'terminal';
export const HIGH_CONTRAST = 'high-contrast';

const modules = import.meta.glob<Palette>('../../content/palettes/*.json', { eager: true, import: 'default' });

export const PALETTES: readonly Palette[] = Object.values(modules).toSorted((a, b) =>
  a.id === DEFAULT_PALETTE ? -1 : b.id === DEFAULT_PALETTE ? 1 : a.id === HIGH_CONTRAST ? 1 : b.id === HIGH_CONTRAST ? -1 : a.id.localeCompare(b.id),
);

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES.find((p) => p.id === DEFAULT_PALETTE)!;
}

/** CSS-переменная токена: `--c-fgDim`. Компоненты используют только их. */
export const cssVar = (t: Token): string => `var(--c-${t})`;

/** Записывает цвета палитры в CSS-переменные корня. */
export function applyPalette(palette: Palette, root: HTMLElement = document.documentElement): void {
  for (const t of TOKENS) root.style.setProperty(`--c-${t}`, palette.colors[t]);
  root.dataset['palette'] = palette.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', palette.colors.bg); // цвет панели браузера следует за палитрой
  root.style.colorScheme = relativeLuminance(palette.colors.bg) < 0.2 ? 'dark' : 'light';
}

/** Относительная яркость по WCAG 2.x. */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].toSorted((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
