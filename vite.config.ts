import { existsSync, readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';
import preactPreset from '@preact/preset-vite';
import { missingDefaults, parseEnv } from './tools/env-default';

// Значения по умолчанию из .env.default (ниже по приоритету, чем окружение и .env.local).
function applyEnvDefaults(mode: string): void {
  if (!existsSync('.env.default')) return;
  const defaults = parseEnv(readFileSync('.env.default', 'utf8'));
  const current = loadEnv(mode, process.cwd(), 'VITE_');
  for (const [key, value] of Object.entries(missingDefaults(defaults, current))) process.env[key] = value;
}

// Сайт живёт в корне домена swrd.ru, поэтому base: '/'.
export default defineConfig(({ mode }) => {
  applyEnvDefaults(mode);
  return {
    base: '/',
    plugins: [preactPreset()],
    build: {
      target: 'es2022',
      sourcemap: true,
    },
    test: {
      include: ['src/**/*.test.{ts,tsx}', 'relay/**/*.test.ts', 'tools/**/*.test.ts'],
      environment: 'node',
    },
  };
});
