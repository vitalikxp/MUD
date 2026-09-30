// Evals Мастера на реальной модели. Запуск: `pnpm eval:dm` (ключ — OPENCODE_GO_API_KEY в .env.local).
//   DM_MODELS=gpt-5.6-luna,glm-5.3   несколько моделей подряд (или DM_MODEL=<id>); по умолчанию — модель по умолчанию провайдера
//   DM_SCENARIOS=opening,combat-guard  только эти сценарии
//   DM_EFFORT / DM_FORMAT              усилие рассуждений и формат API для модели не по умолчанию
// Отчёты — evals/reports/<время>.md и .json (в git не хранятся). Обязательная проверка не прошла → тест красный.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { OPENCODE_GO } from '../src/llm/presets';
import { summarize, toMarkdown } from './report';
import { resolveModel, runScenario, type ScenarioRun } from './runner';
import { SCENARIOS } from './scenarios';

const key = ((): string => {
  if (!existsSync('.env.local')) return '';
  return /^OPENCODE_GO_API_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1]?.trim() ?? '';
})();

const list = (value: string | undefined): string[] => (value ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const models = list(process.env['DM_MODELS'] ?? process.env['DM_MODEL']);
if (models.length === 0) models.push(OPENCODE_GO.defaultModel.model);
const wanted = list(process.env['DM_SCENARIOS']);
const scenarios = SCENARIOS.filter((s) => wanted.length === 0 || wanted.includes(s.id));

const runs: ScenarioRun[] = [];
const pad = (v: string | number, n: number) => String(v).padEnd(n);

afterAll(() => {
  if (runs.length === 0) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const name = `${stamp}-${models.join('+').replace(/[^\w.+-]/g, '_').slice(0, 60)}`;
  mkdirSync('evals/reports', { recursive: true });
  writeFileSync(`evals/reports/${name}.md`, toMarkdown(runs, stamp));
  writeFileSync(`evals/reports/${name}.json`, JSON.stringify({ runs, summary: summarize(runs) }, null, 2));
  const lines = summarize(runs).map((s) => `${pad(s.model, 32)} сценарии ${s.passed}/${s.scenarios}  предупр. ${s.warnings}  ошибки инстр. ${s.toolErrors}  ток. ${s.inputTokens}/${s.outputTokens}  ход ${(s.avgTurnMs / 1000).toFixed(1)} с`);
  process.stdout.write(`\nОтчёт: evals/reports/${name}.md\n${lines.join('\n')}\n`);
});

describe.skipIf(!key || Boolean(process.env['DM_RESCORE']))('Evals Мастера (нужен OPENCODE_GO_API_KEY в .env.local)', () => {
  for (const model of models) {
    describe(model, () => {
      const setup = resolveModel(model);
      for (const scenario of scenarios) {
        it.skipIf(setup.format === 'messages')(`${scenario.id}: ${scenario.title}`, async () => {
          const run = await runScenario(scenario, setup, key);
          runs.push(run);
          const hard = run.turns.flatMap((t) => (t.result.error ? [`ход не удался: ${t.result.error}`] : t.checks.filter((c) => !c.ok && !c.soft).map((c) => `${c.name}${c.detail ? ` — ${c.detail}` : ''}`)));
          expect(hard).toEqual([]);
        });
      }
    });
  }
});
