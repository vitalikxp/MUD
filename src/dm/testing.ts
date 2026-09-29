// Помощники тестов Мастера. В продакшен-код не импортируются.
import { Draft } from '../engine/commits';
import { initialState } from '../engine/reducer';
import type { Rng } from '../engine/rng';
import type { Commit } from '../engine/types';
import type { ToolCall, Usage } from '../llm/types';
import type { Completion } from '../llm/client';
import { opend6 } from '../rules/opend6';
import { DEFAULT_OPTIONS } from '../rules/opend6/options';
import type { ChatRequest } from '../llm/types';
import type { LlmCall, TurnDeps } from './types';

const USAGE: Usage = { inputTokens: 10, outputTokens: 5, cachedTokens: 0, reasoningTokens: 0 };

export interface Step {
  text?: string;
  calls?: { name: string; args: unknown }[];
  /** Сырые аргументы (для битого JSON). */
  raw?: string;
  error?: Error;
}

/** LLM-заглушка: отдаёт заранее заданные ответы по порядку и запоминает запросы. */
export function scriptedLlm(steps: readonly Step[]): { llm: LlmCall; requests: ChatRequest[] } {
  const queue = [...steps];
  const requests: ChatRequest[] = [];
  let n = 0;
  const llm: LlmCall = async (req, onText) => {
    requests.push({ ...req, messages: [...req.messages] });
    const step = queue.shift();
    if (!step) throw new Error('scriptedLlm: ответы кончились');
    if (step.error) throw step.error;
    if (step.text) onText?.(step.text);
    const toolCalls: ToolCall[] = (step.calls ?? []).map((c) => ({ id: `call-${++n}`, name: c.name, arguments: step.raw ?? JSON.stringify(c.args) }));
    const completion: Completion = { text: step.text ?? '', toolCalls, finish: toolCalls.length > 0 ? 'tool_calls' : 'stop', usage: USAGE };
    return completion;
  };
  return { llm, requests };
}

/** Кампания с героем-вором: черновик хода, готовый к `runTurn`. */
export function heroDraft(rng: Rng, opts: { variant?: string; template?: string } = {}): { draft: Draft; state: Draft['state'] } {
  const variant = opts.variant ?? 'fantasy';
  const built = opend6.creation.build({ variant, templateId: opts.template ?? 'thief', name: 'Ирма', lang: 'ru', skills: { lockpicking: 6, stealth: 3 } });
  if (!built.ok) throw new Error(built.error);
  const base = new Draft(initialState({ id: 'opend6', version: '0.1.0', variant }), rng, 'setup');
  base.emit({ t: 'entity.created', entity: built.value });
  const draft = new Draft(base.state, rng, 'turn-1');
  return { draft, state: base.state };
}

export function deps(llm: LlmCall, over: Partial<TurnDeps> = {}): TurnDeps {
  return {
    llm,
    model: 'test-model',
    maxOutputTokens: 1000,
    narrationLang: 'ru',
    campaignTitle: 'Тест',
    variant: 'fantasy',
    options: { ...DEFAULT_OPTIONS },
    paletteIds: ['terminal', 'amber'],
    commits: [] as Commit[],
    ...over,
  };
}
