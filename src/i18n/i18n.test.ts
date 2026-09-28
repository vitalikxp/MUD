import { describe, expect, it } from 'vitest';
import { DICTS, t, tList } from './index';

type Node = { [k: string]: Node | string | readonly string[] };

function shape(node: Node | string | readonly string[], prefix = ''): string[] {
  if (typeof node === 'string') return [prefix];
  if (Array.isArray(node)) return [`${prefix}[${node.length}]`];
  return Object.entries(node as Node).flatMap(([k, v]) => shape(v, prefix ? `${prefix}.${k}` : k));
}

describe('i18n', () => {
  it('словари RU и EN совпадают по ключам и длинам списков', () => {
    expect(shape(DICTS.en as unknown as Node)).toEqual(shape(DICTS.ru as unknown as Node));
  });

  it('нет пустых строк, кроме разделителей в списках', () => {
    for (const [loc, dict] of Object.entries(DICTS)) {
      const walk = (n: unknown, path: string): void => {
        if (typeof n === 'string') expect(n.length, `${loc}:${path}`).toBeGreaterThan(0);
        else if (!Array.isArray(n)) for (const [k, v] of Object.entries(n as object)) walk(v, `${path}.${k}`);
      };
      walk(dict, loc);
    }
  });

  it('подстановки и выбор языка', () => {
    expect(t('msg.font', { name: 'X' }, 'ru')).toBe('Шрифт: X');
    expect(t('msg.font', { name: 'X' }, 'en')).toBe('Font: X');
    expect(t('msg.unknown', {}, 'ru')).toContain('{cmd}');
    expect(tList('help.lines', 'en').length).toBe(tList('help.lines', 'ru').length);
  });
});
