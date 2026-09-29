// Настройки игрока: язык и палитра. Хранятся локально (localStorage), в облако не уходят.
import { effect, signal } from '@preact/signals';
import { storageKey } from '../brand';
import { locale, LOCALES, type Locale } from '../i18n';
import { applyPalette, DEFAULT_PALETTE, getPalette } from '../theme/palettes';

const STORAGE_KEY = storageKey('settings.v1');

interface Stored {
  locale?: Locale;
  palette?: string;
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
if (stored.locale && LOCALES.includes(stored.locale)) locale.value = stored.locale;

/** Применяет настройки к документу и сохраняет их при каждом изменении. */
export function startSettings(): void {
  effect(() => applyPalette(getPalette(paletteId.value)));
  effect(() => {
    document.documentElement.lang = locale.value;
  });
  effect(() => {
    const data: Stored = { locale: locale.value, palette: paletteId.value };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Приватный режим или запрет хранилища — настройки просто не сохранятся.
    }
  });
}
