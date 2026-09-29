// Кнопка «Проверить» (FR-LLM-4): связь, стриминг, вызов инструментов — с понятными причинами отказа.
import { complete, type ClientOptions } from './client';
import { LlmError, type LlmErrorKind, type ProviderConfig, type ReasoningEffort } from './types';

export type CheckStepId = 'connect' | 'stream' | 'tools';

export interface CheckStep {
  id: CheckStepId;
  ok: boolean;
  kind?: LlmErrorKind;
  /** Сообщение от провайдера для непонятных ошибок. */
  message?: string;
  /** Число дельт стрима и т. п. */
  count?: number;
}

export interface CheckTarget {
  model: string;
  effort?: ReasoningEffort;
  maxOutputTokens: number;
}

const PING_TOOL = {
  name: 'ping',
  description: 'Call this tool to confirm that tool calling works.',
  parameters: { type: 'object', properties: { word: { type: 'string', enum: ['pong'] } }, required: ['word'], additionalProperties: false },
};

function failure(id: CheckStepId, e: unknown): CheckStep {
  if (e instanceof LlmError) return { id, ok: false, kind: e.kind, ...(e.kind === 'other' ? { message: e.message } : {}) };
  return { id, ok: false, kind: 'other', message: e instanceof Error ? e.message : String(e) };
}

export async function checkProvider(cfg: ProviderConfig, target: CheckTarget, opts: ClientOptions = {}): Promise<CheckStep[]> {
  const base = { model: target.model, maxOutputTokens: target.maxOutputTokens, ...(target.effort ? { reasoningEffort: target.effort } : {}) };
  const steps: CheckStep[] = [];

  let deltas = 0;
  try {
    const c = await complete(cfg, { ...base, messages: [{ role: 'user', content: 'Ответь одним словом: готов.' }] }, () => { deltas++; }, opts);
    steps.push({ id: 'connect', ok: c.text.trim().length > 0 });
    steps.push({ id: 'stream', ok: deltas > 0, count: deltas });
  } catch (e) {
    // Без связи остальные шаги бессмысленны.
    return [failure('connect', e)];
  }

  try {
    const c = await complete(
      cfg,
      {
        ...base,
        tools: [PING_TOOL],
        messages: [
          { role: 'system', content: 'You must call the ping tool with word "pong". Do not answer in text.' },
          { role: 'user', content: 'ping' },
        ],
      },
      undefined,
      opts,
    );
    steps.push({ id: 'tools', ok: c.toolCalls.some((t) => t.name === 'ping') });
  } catch (e) {
    steps.push(failure('tools', e));
  }
  return steps;
}
