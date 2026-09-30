import { defineConfig } from 'vitest/config';

// Evals не входят в `pnpm test`: они ходят к реальной модели (нужен ключ) и идут долго.
export default defineConfig({
  test: {
    include: ['evals/**/*.eval.ts'],
    environment: 'node',
    testTimeout: 600_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
