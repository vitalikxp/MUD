// Адаптер OpenAI Responses (`/responses`): Muse Spark, GPT, Grok на OpenCode Go.
import type { ChatRequest, StreamEvent, ToolCall, Usage } from './types';
import { LlmError } from './types';
import type { SseMessage } from './sse';

export const RESPONSES_PATH = '/responses';

export function buildResponsesBody(req: ChatRequest): Record<string, unknown> {
  const instructions = req.messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const input: Record<string, unknown>[] = [];
  for (const m of req.messages) {
    if (m.role === 'system') continue;
    if (m.role === 'user') input.push({ role: 'user', content: m.content });
    else if (m.role === 'assistant') {
      if (m.content) input.push({ role: 'assistant', content: m.content });
      for (const c of m.toolCalls ?? []) input.push({ type: 'function_call', call_id: c.id, name: c.name, arguments: c.arguments });
    } else if (m.role === 'tool') input.push({ type: 'function_call_output', call_id: m.toolCallId, output: m.content });
  }
  return {
    model: req.model,
    stream: true,
    max_output_tokens: req.maxOutputTokens,
    ...(instructions ? { instructions } : {}),
    input,
    ...(req.tools?.length
      ? { tools: req.tools.map((t) => ({ type: 'function', name: t.name, description: t.description, parameters: t.parameters })) }
      : {}),
    ...(req.reasoningEffort ? { reasoning: { effort: req.reasoningEffort } } : {}),
  };
}

interface WireResponse {
  status?: string;
  incomplete_details?: { reason?: string } | null;
  error?: { message?: string } | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens_details?: { reasoning_tokens?: number };
  };
}

interface WireEvent {
  type: string;
  delta?: string;
  item?: { type?: string; call_id?: string; name?: string; arguments?: string };
  response?: WireResponse;
  message?: string;
}

function usageOf(r: WireResponse | undefined): Usage {
  return {
    inputTokens: r?.usage?.input_tokens ?? 0,
    outputTokens: r?.usage?.output_tokens ?? 0,
    cachedTokens: r?.usage?.input_tokens_details?.cached_tokens ?? 0,
    reasoningTokens: r?.usage?.output_tokens_details?.reasoning_tokens ?? 0,
  };
}

export async function* parseResponsesStream(messages: AsyncIterable<SseMessage>): AsyncGenerator<StreamEvent> {
  let sawToolCall = false;
  for await (const msg of messages) {
    if (msg.data === '[DONE]') break;
    const ev = JSON.parse(msg.data) as WireEvent;
    switch (ev.type) {
      case 'response.output_text.delta':
        if (ev.delta) yield { type: 'text', delta: ev.delta };
        break;
      case 'response.reasoning_summary_text.delta':
      case 'response.reasoning_text.delta':
        if (ev.delta) yield { type: 'reasoning', delta: ev.delta };
        break;
      case 'response.output_item.done':
        if (ev.item?.type === 'function_call') {
          sawToolCall = true;
          const call: ToolCall = { id: ev.item.call_id ?? '', name: ev.item.name ?? '', arguments: ev.item.arguments ?? '' };
          yield { type: 'tool_call', call };
        }
        break;
      case 'response.completed':
        yield { type: 'done', finish: sawToolCall ? 'tool_calls' : 'stop', usage: usageOf(ev.response) };
        return;
      case 'response.incomplete': {
        const reason = ev.response?.incomplete_details?.reason;
        yield { type: 'done', finish: reason === 'max_output_tokens' ? 'length' : 'error', usage: usageOf(ev.response) };
        return;
      }
      case 'response.failed':
        throw new LlmError('other', ev.response?.error?.message ?? 'Запрос не выполнен');
      case 'error':
        throw new LlmError('other', ev.message ?? 'Ошибка потока');
      default:
        break;
    }
  }
  yield { type: 'done', finish: sawToolCall ? 'tool_calls' : 'stop', usage: usageOf(undefined) };
}
