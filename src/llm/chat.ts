// Адаптер OpenAI Chat Completions (`/chat/completions`): GLM, Kimi, DeepSeek, MiMo и др. на OpenCode Go.
import type { ChatRequest, FinishReason, Message, StreamEvent, ToolCall, Usage } from './types';
import { LlmError } from './types';
import type { SseMessage } from './sse';

export const CHAT_PATH = '/chat/completions';

function toWireMessage(m: Message): Record<string, unknown> {
  switch (m.role) {
    case 'tool':
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    case 'assistant':
      return {
        role: 'assistant',
        content: m.content || null,
        ...(m.toolCalls?.length
          ? { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.arguments } })) }
          : {}),
      };
    default:
      return { role: m.role, content: m.content };
  }
}

export function buildChatBody(req: ChatRequest): Record<string, unknown> {
  return {
    model: req.model,
    stream: true,
    stream_options: { include_usage: true },
    max_tokens: req.maxOutputTokens,
    messages: req.messages.map(toWireMessage),
    ...(req.tools?.length
      ? { tools: req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) }
      : {}),
    ...(req.reasoningEffort ? { reasoning_effort: req.reasoningEffort } : {}),
  };
}

interface WireChunk {
  choices?: {
    delta?: {
      content?: string | null;
      reasoning_content?: string | null;
      tool_calls?: { index: number; id?: string; function?: { name?: string; arguments?: string } }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    prompt_tokens_details?: { cached_tokens?: number };
    completion_tokens_details?: { reasoning_tokens?: number };
  } | null;
  error?: { message?: string };
}

const FINISH: Record<string, FinishReason> = { stop: 'stop', tool_calls: 'tool_calls', length: 'length' };

/** Превращает поток SSE в общие события. Вызовы инструментов собираются из кусков и выдаются целиком в конце. */
export async function* parseChatStream(messages: AsyncIterable<SseMessage>): AsyncGenerator<StreamEvent> {
  const calls = new Map<number, ToolCall>();
  let finish: FinishReason = 'stop';
  let usage: Usage = { inputTokens: 0, outputTokens: 0, cachedTokens: 0, reasoningTokens: 0 };

  for await (const msg of messages) {
    if (msg.data === '[DONE]') break;
    const chunk = JSON.parse(msg.data) as WireChunk;
    if (chunk.error) throw new LlmError('other', chunk.error.message ?? 'Ошибка потока');
    if (chunk.usage) {
      usage = {
        inputTokens: chunk.usage.prompt_tokens ?? 0,
        outputTokens: chunk.usage.completion_tokens ?? 0,
        cachedTokens: chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
        reasoningTokens: chunk.usage.completion_tokens_details?.reasoning_tokens ?? 0,
      };
    }
    const choice = chunk.choices?.[0];
    if (!choice) continue;
    const d = choice.delta;
    if (d?.reasoning_content) yield { type: 'reasoning', delta: d.reasoning_content };
    if (d?.content) yield { type: 'text', delta: d.content };
    for (const tc of d?.tool_calls ?? []) {
      const cur = calls.get(tc.index) ?? { id: '', name: '', arguments: '' };
      if (tc.id) cur.id = tc.id;
      if (tc.function?.name) cur.name += tc.function.name;
      if (tc.function?.arguments) cur.arguments += tc.function.arguments;
      calls.set(tc.index, cur);
    }
    if (choice.finish_reason) finish = FINISH[choice.finish_reason] ?? 'stop';
  }

  for (const [, call] of [...calls].toSorted((a, b) => a[0] - b[0])) yield { type: 'tool_call', call };
  yield { type: 'done', finish: calls.size > 0 && finish === 'stop' ? 'tool_calls' : finish, usage };
}
