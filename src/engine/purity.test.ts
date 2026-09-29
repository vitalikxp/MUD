import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// AGENTS.md §4.2: engine/ и rules/ чистые — без часов, случайности, сети, UI и облака.
const FORBIDDEN: [RegExp, string][] = [
  [/Math\.random/, 'Math.random (используйте Rng)'],
  [/Date\.now|new Date\b/, 'часы (время приходит параметром)'],
  [/\bfetch\s*\(/, 'fetch'],
  [/from ['"](preact|@preact|firebase|\.\.\/(ui|app|net|dm|llm))/, 'импорт из другого слоя'],
  [/\b(window|document|localStorage|indexedDB)\b/, 'браузерные глобальные'],
  [/crypto\.(randomUUID|getRandomValues)/, 'случайность из crypto'],
];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && name !== 'testing.ts' ? [p] : [];
  });
}

describe('чистота engine/ и rules/', () => {
  for (const dir of ['src/engine', 'src/rules']) {
    it(`${dir} не использует запрещённое`, () => {
      let files: string[] = [];
      try { files = sources(dir); } catch { return; } // rules/ появится позже
      const violations: string[] = [];
      for (const f of files) {
        const text = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        for (const [re, what] of FORBIDDEN) if (re.test(text)) violations.push(`${f}: ${what}`);
      }
      expect(violations).toEqual([]);
    });
  }
});
