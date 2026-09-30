// Отчёт evals: markdown для чтения и JSON для сравнения запусков. Каталог evals/reports/ в git не хранится.
import type { ScenarioRun } from './runner';

export interface ModelSummary {
  model: string;
  scenarios: number;
  passed: number;
  warnings: number;
  turns: number;
  inputTokens: number;
  outputTokens: number;
  avgTurnMs: number;
  toolErrors: number;
}

export function summarize(runs: readonly ScenarioRun[]): ModelSummary[] {
  const models = [...new Set(runs.map((r) => r.model))];
  return models.map((model) => {
    const mine = runs.filter((r) => r.model === model);
    const turns = mine.flatMap((r) => r.turns);
    const ms = turns.reduce((n, t) => n + t.result.ms, 0);
    return {
      model,
      scenarios: mine.length,
      passed: mine.filter((r) => !r.failed).length,
      warnings: mine.reduce((n, r) => n + r.warnings, 0),
      turns: turns.length,
      inputTokens: turns.reduce((n, t) => n + t.result.usage.inputTokens, 0),
      outputTokens: turns.reduce((n, t) => n + t.result.usage.outputTokens, 0),
      avgTurnMs: turns.length > 0 ? Math.round(ms / turns.length) : 0,
      toolErrors: turns.reduce((n, t) => n + t.result.tools.filter((x) => !x.ok).length, 0),
    };
  });
}

const sec = (ms: number) => `${(ms / 1000).toFixed(1)} с`;

export function toMarkdown(runs: readonly ScenarioRun[], date: string): string {
  const out: string[] = [`# Evals Мастера · ${date}`, '', '## Сводка по моделям', '', '| Модель | Сценарии | Предупреждения | Ошибки инструментов | Ходов | Ток. вход/выход | Средний ход |', '|---|---|---|---|---|---|---|'];
  for (const s of summarize(runs)) out.push(`| ${s.model} | ${s.passed}/${s.scenarios} | ${s.warnings} | ${s.toolErrors} | ${s.turns} | ${s.inputTokens}/${s.outputTokens} | ${sec(s.avgTurnMs)} |`);
  for (const model of new Set(runs.map((r) => r.model))) {
    out.push('', `## ${model}`);
    for (const run of runs.filter((r) => r.model === model)) {
      out.push('', `### ${run.failed ? '✗' : '✓'} ${run.scenario} (${sec(run.ms)})`);
      for (const t of run.turns) {
        out.push('', `> ${t.input}`, '');
        if (t.result.error) out.push(`**Ход не удался:** ${t.result.error}`);
        else out.push(`Инструменты: ${t.result.tools.map((x) => (x.ok ? x.name : `${x.name}!`)).join(', ') || '—'} · шагов ${t.result.iterations} · ${sec(t.result.ms)} · ток. ${t.result.usage.inputTokens}/${t.result.usage.outputTokens}`);
        for (const c of t.checks.filter((x) => !x.ok)) out.push(`- ${c.soft ? '⚠ предупреждение' : '✗ провал'}: ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
        if (t.result.text) out.push('', ...t.result.text.split('\n').map((l) => `  ${l}`));
      }
    }
  }
  return `${out.join('\n')}\n`;
}
