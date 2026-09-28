import type { ru } from './ru';

/** Та же структура, что у ru, но со строками вместо литералов. */
type Widen<T> = T extends string
  ? string
  : T extends readonly string[]
    ? readonly string[]
    : { readonly [K in keyof T]: Widen<T[K]> };

export type Dict = Widen<typeof ru>;

type Join<K extends string, P extends string> = `${K}.${P}`;

/** Пути к строковым значениям: 'panels.chronicle', 'msg.palette' … */
export type Key<T = Dict> = {
  [K in keyof T & string]: T[K] extends string ? K : T[K] extends readonly string[] ? never : Join<K, Key<T[K]>>;
}[keyof T & string];

/** Пути к спискам строк: 'help.lines'. */
export type ListKey<T = Dict> = {
  [K in keyof T & string]: T[K] extends readonly string[] ? K : T[K] extends string ? never : Join<K, ListKey<T[K]>>;
}[keyof T & string];

export type Locale = 'ru' | 'en';
