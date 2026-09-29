// Разбор строки ввода: `/команда аргументы` или обычная заявка. Чистая функция — эффекты применяет экран.
import type { Locale } from '../i18n';

export type Command =
  | { kind: 'say'; text: string }
  | { kind: 'help' }
  | { kind: 'palette'; id: string }
  | { kind: 'lang'; locale: Locale }
  | { kind: 'glyphs' }
  | { kind: 'settings' }
  | { kind: 'unknown'; raw: string };

export function parseCommand(input: string, knownPalettes: readonly string[]): Command {
  const text = input.trim();
  if (!text.startsWith('/')) return { kind: 'say', text };
  const [name = '', arg = ''] = text.slice(1).split(/\s+/, 2).map((s) => s.toLowerCase());
  switch (name) {
    case 'help':
    case '?':
      return { kind: 'help' };
    case 'palette':
      return knownPalettes.includes(arg) ? { kind: 'palette', id: arg } : { kind: 'unknown', raw: text };
    case 'lang':
      return arg === 'ru' || arg === 'en' ? { kind: 'lang', locale: arg } : { kind: 'unknown', raw: text };
    case 'glyphs':
      return { kind: 'glyphs' };
    case 'settings':
      return { kind: 'settings' };
    default:
      return { kind: 'unknown', raw: text };
  }
}
