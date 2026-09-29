// Значения по умолчанию из `.env.default` (в git, только публичные VITE_*). Приоритет: окружение > .env.local > .env.default.

/** Разбор формата dotenv: `KEY=value`, `#` — комментарий, кавычки по краям снимаются. */
export function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

/** Ключи, которым нельзя быть в `.env.default`: всё, что не VITE_*, — скорее всего секрет. */
export function nonPublicKeys(defaults: Record<string, string>): string[] {
  return Object.keys(defaults).filter((k) => !k.startsWith('VITE_'));
}

/**
 * Возвращает значения по умолчанию, которых не хватает в `current` (окружение + .env.local, уже слитые Vite).
 * Пустое значение в `current` считается «не задано» — например, `VITE_RELAY_URL=""` из CI не затирает дефолт.
 */
export function missingDefaults(defaults: Record<string, string>, current: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (key.startsWith('VITE_') && value !== '' && !current[key]) out[key] = value;
  }
  return out;
}
