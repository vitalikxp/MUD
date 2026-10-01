// Оркестратор хода Мастера (docs/04-ai-dm.md, «Конвейер хода»): контекст → LLM (стрим) → инструменты на черновике → … → end_turn.
// Всё, что происходит за ход, попадает в `Draft`; коммит (атомарный) делает вызывающий код, после того как `runTurn` вернулся без ошибки.
import type { ZodError } from 'zod';
import type { Draft } from '../engine/commits';
import type { Message, Usage } from '../llm/types';
import { LlmError } from '../llm/types';
import type { RulesModule } from '../rules/api';
import { buildMessages } from './context';
import { cleanNarration } from './narration';
import { REMIND_END_TURN, SYSTEM_PROMPT_VERSION } from './prompts/system';
import { buildTools, toolDefs, type ToolEnv } from './tools';
import { TurnError, type ToolTrace, type TurnDeps, type TurnInput, type TurnReport } from './types';

const MAX_RESULT_CHARS = 4000;
const EMPTY_USAGE: Usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, reasoningTokens: 0 };

const addUsage = (a: Usage, b: Usage): Usage => ({
  inputTokens: a.inputTokens + b.inputTokens,
  outputTokens: a.outputTokens + b.outputTokens,
  cachedTokens: a.cachedTokens + b.cachedTokens,
  reasoningTokens: a.reasoningTokens + b.reasoningTokens,
});

const clip = (text: string): string => (text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}…` : text);

function describeIssues(error: ZodError): string {
  return error.issues.map((i) => `${i.path.join('.') || 'arguments'}: ${i.message}`).join('; ');
}

/**
 * Один ход. Побочные эффекты — только события в `draft` (и его RNG). Бросает `TurnError` (лимиты, ошибки инструментов подряд)
 * или `LlmError` (сеть, ключ, отмена): в обоих случаях вызывающий код черновик отбрасывает, журнал остаётся прежним.
 */
export async function runTurn(draft: Draft, input: TurnInput, rules: RulesModule, deps: TurnDeps): Promise<TurnReport> {
  const started = Date.now();
  const maxIterations = deps.maxIterations ?? 12;
  const maxErrors = deps.maxConsecutiveErrors ?? 3;

  if (input.kind === 'player') draft.emit({ t: 'intent', uid: input.uid, charId: input.charId, text: input.text });

  const messages: Message[] = buildMessages({
    rules,
    variant: deps.variant,
    narrationLang: deps.narrationLang,
    ...(deps.narration ? { narration: deps.narration } : {}),
    campaignTitle: deps.campaignTitle,
    state: draft.state,
    commits: deps.commits,
    input,
  });

  const trace: ToolTrace[] = [];
  let usage = EMPTY_USAGE;
  let ended = false;
  let reminded = false;
  let autoClosed = false;
  let errorsInRow = 0;
  let iterations = 0;

  while (!ended) {
    if (deps.signal?.aborted) throw new LlmError('aborted', 'Запрос отменён');
    if (iterations >= maxIterations) throw new TurnError('limit', `Мастер не закончил ход за ${maxIterations} шагов`, trace);
    iterations++;

    const env = (): ToolEnv => ({
      state: draft.state,
      rng: draft.rng,
      rules,
      options: deps.options,
      lang: deps.narrationLang,
      variant: deps.variant,
      paletteIds: deps.paletteIds,
    });
    const tools = buildTools(env());
    const completion = await deps.llm(
      {
        model: deps.model,
        messages,
        tools: toolDefs(tools),
        maxOutputTokens: deps.maxOutputTokens,
        ...(deps.reasoningEffort ? { reasoningEffort: deps.reasoningEffort } : {}),
        ...(deps.signal ? { signal: deps.signal } : {}),
      },
      (delta) => deps.onProgress?.({ type: 'text', delta }),
    );
    usage = addUsage(usage, completion.usage);

    // Служебный мусор (псевдовызов end_turn, <think>) игроку не показывается и в историю модели не попадает.
    const { text, suggestions: leakedSuggestions } = cleanNarration(completion.text);
    if (text) draft.emit({ t: 'narration', text, speaker: 'dm' });
    messages.push({ role: 'assistant', content: text, ...(completion.toolCalls.length > 0 ? { toolCalls: completion.toolCalls } : {}) });

    if (completion.toolCalls.length === 0) {
      // Модель закончила текстом без end_turn: один раз напоминаем, потом закрываем ход сами (повествование уже записано).
      if (!reminded) {
        reminded = true;
        messages.push({ role: 'user', content: REMIND_END_TURN });
        continue;
      }
      draft.emit({ t: 'turn.ended', suggestions: leakedSuggestions }); // варианты, которые модель написала текстом вместо вызова
      autoClosed = true;
      break;
    }

    for (const call of completion.toolCalls) {
      if (ended) {
        // Всё, что после end_turn, игнорируем, но отвечаем на вызов — протокол требует ответ на каждый tool_call.
        messages.push({ role: 'tool', toolCallId: call.id, content: JSON.stringify({ error: 'the turn has already ended' }) });
        continue;
      }
      const tool = buildTools(env()).find((t) => t.name === call.name);
      const record: ToolTrace = { name: call.name, arguments: call.arguments, ok: false };
      trace.push(record);
      let reply: unknown;
      let args: unknown;

      if (!tool) {
        record.error = `unknown tool "${call.name}"`;
        reply = { error: record.error, tools: tools.map((t) => t.name) };
      } else {
        try {
          args = call.arguments.trim() ? JSON.parse(call.arguments) : {};
        } catch {
          record.error = 'arguments are not valid JSON';
          reply = { error: record.error };
        }
        if (!record.error) {
          const parsed = tool.schema.safeParse(args);
          if (!parsed.success) {
            record.error = describeIssues(parsed.error);
            reply = { error: record.error };
          } else {
            const out = tool.run(env(), parsed.data as never);
            if (!out.ok) {
              record.error = out.error;
              reply = { error: out.error };
            } else {
              draft.emit(...out.value.events);
              record.ok = true;
              record.result = out.value.result;
              reply = out.value.result;
              if (tool.name === 'end_turn') ended = true;
            }
          }
        }
      }

      errorsInRow = record.ok ? 0 : errorsInRow + 1;
      deps.onProgress?.({ type: 'tool', name: call.name, args, ...(record.ok ? { result: record.result } : { error: record.error ?? 'error' }) });
      messages.push({ role: 'tool', toolCallId: call.id, content: clip(JSON.stringify(reply)) });
      if (errorsInRow >= maxErrors) throw new TurnError('validation', `Мастер ${maxErrors} раза подряд вызвал инструменты с ошибками`, trace);
    }
  }

  return { promptVersion: SYSTEM_PROMPT_VERSION, iterations, tools: trace, usage, autoClosed, ms: Date.now() - started };
}
