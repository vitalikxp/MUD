// Настройки игрока: язык, палитра, шрифт. Хранятся локально (localStorage), в облако не уходят.
import { effect, signal } from '@preact/signals';
import { locale, LOCALES, type Locale } from '../i18n';
import { applyPalette, DEFAULT_PALETTE, getPalette } from '../theme/palettes';
import { DEFAULT_FONT, FONTS, type FontId } from '../theme/fonts';

const STORAGE_KEY = 'swrd.settings.v1';

interface Stored {
  locale?: Locale;
  palette?: string;
  font?: FontId;
}

function read(): Stored {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Stored;
  } catch {
    return {};
  }
}

const stored = read();

export const paletteId = signal<string>(getPalette(stored.palette ?? DEFAULT_PALETTE).id);
export const fontId = signal<FontId>(stored.font && stored.font in FONTS ? stored.font : DEFAULT_FONT);
if (stored.locale && LOCALES.includes(stored.locale)) locale.value = stored.locale;

/** Применяет настройки к документу и сохраняет их при каждом изменении. */
export function startSettings(): void {
  effect(() => applyPalette(getPalette(paletteId.value)));
  effect(() => {
    document.documentElement.lang = locale.value;
  });
  effect(() => {
    const data: Stored = { locale: locale.value, palette: paletteId.value, font: fontId.value };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Приватный режим или запрет хранилища — настройки просто не сохранятся.
    }
  });
}
