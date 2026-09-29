// Единый источник имени и адреса проекта: brand.json (его же читают vite.config.ts и relay).
// Рабочее название временное. Чтобы переименовать проект, правят только brand.json (+ CNAME при смене домена).
import brand from '../brand.json';

/** Отображаемое имя: заголовки, тексты интерфейса, манифест. */
export const BRAND_NAME: string = brand.name;
/** Технический идентификатор: префикс ключей localStorage, имя IndexedDB, формат экспорта. Не показывается пользователю и не меняется при смене имени. */
export const BRAND_ID: string = brand.id;
export const BRAND_DOMAIN: string = brand.domain;
export const BRAND_ORIGIN = `https://${brand.domain}`;

/** Ключ хранилища браузера с префиксом проекта: `storageKey('llm.v1')` → `mud.llm.v1`. */
export function storageKey(name: string): string {
  return `${BRAND_ID}.${name}`;
}
