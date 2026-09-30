// Пересчёт проверок по сохранённым отчётам без обращения к моделям: `DM_RESCORE=evals/reports/run-2 pnpm eval:rescore`.
// Нужен, когда поправлена проверка (она ошибалась) или добавлена новая: результаты ходов (тексты, инструменты, события) уже в JSON.
// `DM_DROP=id,id` — выбросить сценарии, чей текст изменился (их старые результаты уже не отвечают сценарию).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { summarize, toMarkdown } from './report';
import type { ScenarioRun } from './runner';
import { SCENARIOS } from './scenarios';

const dir = process.env['DM_RESCORE'] ?? '';
const drop = (process.env['DM_DROP'] ?? '').split(',').map((s) => s.trim()).filter(Boolean);

describe.skipIf(!dir)('Пересчёт проверок по сохранённым отчётам', () => {
  it(`${dir}`, () => {
    expect(existsSync(dir)).toBe(true);
    const runs: ScenarioRun[] = [];
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const saved = JSON.parse(readFileSync(`${dir}/${file}`, 'utf8')) as { runs: ScenarioRun[] };
      for (const run of saved.runs) {
        const scenario = SCENARIOS.find((s) => s.id === run.scenario);
        if (!scenario || drop.includes(run.scenario)) continue;
        const turns = run.turns.map((t, i) => ({ ...t, checks: (scenario.turns[i]?.checks ?? []).map((c) => c(t.result)) }));
        const all = turns.flatMap((t) => t.checks);
        runs.push({ ...run, turns, failed: all.some((c) => !c.ok && !c.soft) || turns.some((t) => t.result.error !== undefined), warnings: all.filter((c) => !c.ok && c.soft).length });
      }
    }
    mkdirSync(`${dir}/rescored`, { recursive: true });
    writeFileSync(`${dir}/rescored/all.json`, JSON.stringify({ runs, summary: summarize(runs) }, null, 2));
    writeFileSync(`${dir}/rescored/all.md`, toMarkdown(runs, `пересчёт ${dir}`));
    process.stdout.write(`\nПересчитано ${runs.length} прогонов сценариев → ${dir}/rescored/all.md\n`);
    expect(runs.length).toBeGreaterThan(0);
  });
});
