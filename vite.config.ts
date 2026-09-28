import { defineConfig } from 'vitest/config';
import preactPreset from '@preact/preset-vite';

// Сайт живёт в корне домена swrd.ru, поэтому base: '/'.
export default defineConfig({
  base: '/',
  plugins: [preactPreset()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
