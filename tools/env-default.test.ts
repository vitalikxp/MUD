import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { missingDefaults, nonPublicKeys, parseEnv } from './env-default';

describe('env-default', () => {
  it('разбирает dotenv: комментарии, пустые значения, кавычки', () => {
    expect(parseEnv('# c\nA=1\n\nB="two words"\nC=\n  D = x  \nбез равно')).toEqual({ A: '1', B: 'two words', C: '', D: 'x' });
  });

  it('приоритет: то, что уже задано (окружение/.env.local), не перезаписывается; пустое — считается не заданным', () => {
    const defaults = { VITE_A: 'def', VITE_B: 'def', VITE_C: 'def', VITE_EMPTY: '' };
    expect(missingDefaults(defaults, { VITE_A: 'env', VITE_B: '', VITE_C: undefined })).toEqual({ VITE_B: 'def', VITE_C: 'def' });
  });

  it('в дефолты попадают только VITE_*', () => {
    expect(missingDefaults({ SECRET: 'x', VITE_OK: 'y' }, {})).toEqual({ VITE_OK: 'y' });
  });

  it('закоммиченный .env.default не содержит непубличных ключей (нет секретов)', () => {
    const defaults = parseEnv(readFileSync(new URL('../.env.default', import.meta.url), 'utf8'));
    expect(nonPublicKeys(defaults)).toEqual([]);
    expect(defaults['VITE_RELAY_URL']).toMatch(/^https:\/\//);
  });
});
