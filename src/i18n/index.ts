import { signal } from '@preact/signals';
import { en } from './en';
import { ru } from './ru';
import type { Dict, Key, ListKey, Locale } from './types';

export type { Key, ListKey, Locale } from './types';

export const DICTS: Record<Locale, Dict> = { ru, en };
export const LOCALES: readonly Locale[] = ['ru', 'en'];

export const locale = signal<Locale>('ru');

function lookup(dict: Dict, path: string): unknown {
  return path.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict);
}

/** Строка интерфейса. Подстановки: t('msg.font', { name }) для «{name}». */
export function t(key: Key, params: Record<string, string | number> = {}, loc: Locale = locale.value): string {
  const value = lookup(DICTS[loc], key);
  if (typeof value !== 'string') return key;
  return value.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

export function tList(key: ListKey, loc: Locale = locale.value): readonly string[] {
  const value = lookup(DICTS[loc], key);
  return Array.isArray(value) ? (value as readonly string[]) : [];
}
