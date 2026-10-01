// Прогон сценария на реальной модели: подготовка (детерминированная), ход(ы) на модели, проверки. Без Vitest: чистая оркестрация приложения.
// oxlint-disable-next-line no-unassigned-import -- подключает IndexedDB-эмуляцию глобально
import 'fake-indexeddb/auto';
import { closeSession, createCampaign, createHero, heroOf, openSession, session, useStorage } from '../src/app/campaigns';
import { inventoryAction } from '../src/app/inventory';
import { takeTurn, type PlayerAction, type TurnConfig } from '../src/app/turn';
import { DEFAULT_NARRATION, getStyle, LENGTHS, type NarrationLength, type NarrationSettings } from '../src/dm/prompts/style';
import { scriptedLlm } from '../src/dm/testing';
import { complete } from '../src/llm/client';
import { OPENCODE_GO } from '../src/llm/presets';
import type { ApiFormat, ReasoningEffort } from '../src/llm/types';
import { LocalAdapter } from '../src/net/local';
import type { CheckResult, Scenario, TurnResult } from './types';

export interface ModelSetup {
  model: string;
  format: ApiFormat;
  effort?: ReasoningEffort;
  maxOutputTokens: number;
}

/** Параметры модели как в игре: формат по таблице провайдера, усилие рассуждений — только у модели по умолчанию (иначе `DM_EFFORT`). */
export function resolveModel(model: string, env: Record<string, string | undefined> = process.env): ModelSetup {
  const def = OPENCODE_GO.defaultModel;
  const effort = model === def.model ? def.effort : (env['DM_EFFORT'] as ReasoningEffort | undefined);
  return {
    model,
    format: (env['DM_FORMAT'] as ApiFormat | undefined) ?? OPENCODE_GO.formatByModel?.[model] ?? OPENCODE_GO.format,
    ...(effort ? { effort } : {}),
    maxOutputTokens: def.maxOutputTokens,
  };
}

/** Длина и стиль повествования для прогона: `DM_LENGTH` (short|normal|long) и `DM_STYLE` (id стиля). */
export function narrationFromEnv(env: Record<string, string | undefined> = process.env): NarrationSettings {
  const length = LENGTHS.find((l) => l === env['DM_LENGTH']) ?? DEFAULT_NARRATION.length;
  return { style: getStyle(env['DM_STYLE'] ?? DEFAULT_NARRATION.style).id, length: length satisfies NarrationLength };
}

export interface TurnRun {
  input: string;
  result: TurnResult;
  checks: CheckResult[];
}

export interface ScenarioRun {
  scenario: string;
  model: string;
  turns: TurnRun[];
  /** Провалена хотя бы одна обязательная проверка. */
  failed: boolean;
  warnings: number;
  ms: number;
}

const withUa: typeof fetch = (input, init) => fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), 'User-Agent': 'mud-eval' } });

const label = (a: PlayerAction): string => (a.kind === 'opening' ? '/start' : a.text);

const text = (events: readonly { t: string }[]): string =>
  (events as { t: string; text?: string; speaker?: string }[]).filter((e) => e.t === 'narration' && (e.speaker === undefined || e.speaker === 'dm')).map((e) => e.text ?? '').join('\n\n');

async function realTurn(action: PlayerAction, config: TurnConfig, lang: 'ru' | 'en'): Promise<TurnResult> {
  const heroBefore = heroOf(session.peek()!.state)!;
  const started = Date.now();
  try {
    const report = await takeTurn(action, config);
    const commit = session.peek()!.commits.at(-1)!;
    return {
      input: label(action), tools: report.tools, events: commit.events, text: text(commit.events),
      suggestions: commit.events.flatMap((e) => (e.t === 'turn.ended' ? e.suggestions : [])),
      autoClosed: report.autoClosed, iterations: report.iterations, ms: Date.now() - started, usage: report.usage,
      heroBefore, heroAfter: heroOf(session.peek()!.state)!, lang, ...(config.narration ? { narration: config.narration } : {}),
    };
  } catch (e) {
    return {
      input: label(action), tools: [], events: [], text: '', suggestions: [], autoClosed: false, iterations: 0, ms: Date.now() - started,
      usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0, reasoningTokens: 0 }, heroBefore, heroAfter: heroBefore, lang,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

let counter = 0;

export async function runScenario(scenario: Scenario, setup: ModelSetup, apiKey: string): Promise<ScenarioRun> {
  const started = Date.now();
  const lang = scenario.lang ?? 'ru';
  useStorage(new LocalAdapter(`eval-${scenario.id}-${++counter}-${started}`));
  closeSession();
  const id = await createCampaign({ title: lang === 'ru' ? 'Пограничье' : 'The Borderlands', variant: 'fantasy', lang });
  await openSession(id);
  await createHero(scenario.hero ?? { templateId: 'thief', name: 'Ирма', skills: { lockpicking: 6, stealth: 3 } });

  const base = { maxOutputTokens: 1000, paletteIds: ['terminal', 'amber'] };
  for (const step of scenario.prelude ?? []) {
    if (step.kind === 'equip') await inventoryAction({ kind: 'equip', itemId: step.itemId });
    else await takeTurn(step.action, { ...base, llm: scriptedLlm(step.steps).llm, model: 'scripted' });
  }

  const provider = { format: setup.format, baseUrl: OPENCODE_GO.baseUrl, apiKey, sessionId: crypto.randomUUID() };
  const config: TurnConfig = {
    llm: (req, onText) => complete(provider, req, onText, { fetch: withUa }),
    model: setup.model,
    maxOutputTokens: setup.maxOutputTokens,
    ...(setup.effort ? { reasoningEffort: setup.effort } : {}),
    paletteIds: base.paletteIds,
    narration: narrationFromEnv(),
  };

  const turns: TurnRun[] = [];
  for (const turn of scenario.turns) {
    const result = await realTurn(turn.action, config, lang);
    turns.push({ input: result.input, result, checks: turn.checks.map((c) => c(result)) });
    if (result.error) break; // следующие ходы опираются на этот
  }
  const all = turns.flatMap((t) => t.checks);
  return { scenario: scenario.id, model: setup.model, turns, failed: all.some((c) => !c.ok && !c.soft) || turns.some((t) => t.result.error !== undefined), warnings: all.filter((c) => !c.ok && c.soft).length, ms: Date.now() - started };
}
