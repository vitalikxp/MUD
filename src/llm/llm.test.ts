import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { parseChatStream, buildChatBody } from './chat';
import { buildHeaders, classifyError, complete, endpointUrl, streamChat } from './client';
import { formatFor, getProvider, OPENCODE_GO } from './presets';
import { modelTrainsOnData } from './models';
import { buildResponsesBody, parseResponsesStream } from './responses';
import { parseSse } from './sse';
import { LlmError, type ChatRequest, type ProviderConfig, type StreamEvent } from './types';

const fixture = (name: string): string => readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), 'utf8');
const streamOf = (text: string, chunk = 64): ReadableStream<Uint8Array> => {
  const bytes = new TextEncoder().encode(text);
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i >= bytes.length) return controller.close();
      controller.enqueue(bytes.slice(i, i + chunk));
      i += chunk;
    },
  });
};
async function collect(gen: AsyncIterable<StreamEvent>): Promise<StreamEvent[]> {
  const out: StreamEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}
const textOf = (events: StreamEvent[]): string => events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('');

describe('parseSse', () => {
  it('склеивает события из кусков произвольного размера, включая границы внутри UTF-8', async () => {
    const raw = 'event: a\ndata: {"x":"привет"}\n\n: keep-alive\ndata: [DONE]\n\n';
    for (const chunk of [1, 3, 7, 1000]) {
      const msgs: unknown[] = [];
      for await (const m of parseSse(streamOf(raw, chunk))) msgs.push(m);
      expect(msgs).toEqual([{ event: 'a', data: '{"x":"привет"}' }, { data: '[DONE]' }]);
    }
  });
  it('понимает \\r\\n и последнее событие без пустой строки', async () => {
    const msgs: unknown[] = [];
    for await (const m of parseSse(streamOf('data: 1\r\n\r\ndata: 2'))) msgs.push(m);
    expect(msgs).toEqual([{ data: '1' }, { data: '2' }]);
  });
});

describe('Chat Completions', () => {
  it('текстовый поток: дельты, рассуждения отдельно, usage, stop', async () => {
    const ev = await collect(parseChatStream(parseSse(streamOf(fixture('chat-text.sse'), 200))));
    expect(textOf(ev).length).toBeGreaterThan(5);
    expect(ev.some((e) => e.type === 'reasoning')).toBe(true);
    const done = ev.at(-1);
    expect(done).toMatchObject({ type: 'done', finish: 'stop' });
    expect(done?.type === 'done' && done.usage.outputTokens).toBeGreaterThan(0);
  });
  it('вызов инструмента собирается из кусков и выдаётся целиком', async () => {
    const ev = await collect(parseChatStream(parseSse(streamOf(fixture('chat-tool.sse'), 500))));
    const calls = ev.flatMap((e) => (e.type === 'tool_call' ? [e.call] : []));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ name: 'check' });
    expect(JSON.parse(calls[0]!.arguments)).toMatchObject({ actorId: expect.any(String), difficulty: expect.any(Number) });
    expect(ev.at(-1)).toMatchObject({ type: 'done', finish: 'tool_calls' });
  });
  it('тело запроса: инструменты, лимит, история с вызовами', () => {
    const body = buildChatBody({
      model: 'm',
      maxOutputTokens: 100,
      reasoningEffort: 'low',
      tools: [{ name: 'check', description: 'd', parameters: { type: 'object' } }],
      messages: [
        { role: 'system', content: 's' },
        { role: 'assistant', content: '', toolCalls: [{ id: 'c1', name: 'check', arguments: '{}' }] },
        { role: 'tool', toolCallId: 'c1', content: '{"total":17}' },
      ],
    });
    expect(body).toMatchObject({ stream: true, max_tokens: 100, reasoning_effort: 'low' });
    expect((body['messages'] as unknown[])[1]).toMatchObject({ content: null, tool_calls: [{ id: 'c1', function: { name: 'check' } }] });
    expect((body['messages'] as unknown[])[2]).toEqual({ role: 'tool', tool_call_id: 'c1', content: '{"total":17}' });
  });
});

describe('Responses', () => {
  it('текстовый поток', async () => {
    const ev = await collect(parseResponsesStream(parseSse(streamOf(fixture('responses-text.sse'), 300))));
    expect(textOf(ev).length).toBeGreaterThan(5);
    expect(ev.at(-1)).toMatchObject({ type: 'done', finish: 'stop' });
  });
  it('вызов инструмента с call_id и текст до него', async () => {
    const ev = await collect(parseResponsesStream(parseSse(streamOf(fixture('responses-tool.sse'), 500))));
    const call = ev.find((e) => e.type === 'tool_call');
    expect(call).toMatchObject({ call: { name: 'check', id: expect.stringMatching(/^call_/) } });
    expect(textOf(ev)).toContain('Ирма');
    expect(ev.at(-1)).toMatchObject({ type: 'done', finish: 'tool_calls' });
    const done = ev.at(-1);
    expect(done?.type === 'done' && done.usage.reasoningTokens).toBeGreaterThanOrEqual(0);
  });
  it('response.incomplete по лимиту токенов → finish=length', async () => {
    const raw = 'event: response.incomplete\ndata: {"type":"response.incomplete","response":{"incomplete_details":{"reason":"max_output_tokens"},"usage":{"output_tokens":300,"output_tokens_details":{"reasoning_tokens":297}}}}\n\n';
    const ev = await collect(parseResponsesStream(parseSse(streamOf(raw))));
    expect(ev).toEqual([{ type: 'done', finish: 'length', usage: { inputTokens: 0, outputTokens: 300, cachedTokens: 0, reasoningTokens: 297 } }]);
  });
  it('тело запроса: system → instructions, результат инструмента → function_call_output', () => {
    const body = buildResponsesBody({
      model: 'm',
      maxOutputTokens: 50,
      messages: [
        { role: 'system', content: 'GM' },
        { role: 'user', content: 'привет' },
        { role: 'assistant', content: 'ок', toolCalls: [{ id: 'c1', name: 'check', arguments: '{}' }] },
        { role: 'tool', toolCallId: 'c1', content: '17' },
      ],
    });
    expect(body).toMatchObject({ instructions: 'GM', max_output_tokens: 50 });
    expect(body['input']).toEqual([
      { role: 'user', content: 'привет' },
      { role: 'assistant', content: 'ок' },
      { type: 'function_call', call_id: 'c1', name: 'check', arguments: '{}' },
      { type: 'function_call_output', call_id: 'c1', output: '17' },
    ]);
  });
});

const cfg: ProviderConfig = { format: 'chat', baseUrl: 'https://opencode.ai/zen/go/v1/', apiKey: 'K', sessionId: 'sess-1' };
const req: ChatRequest = { model: 'm', maxOutputTokens: 100, messages: [{ role: 'user', content: 'hi' }] };
const sseResponse = (text: string, status = 200): Response => new Response(streamOf(text), { status });

describe('client', () => {
  it('прямой режим: адрес и заголовки, включая x-opencode-session', () => {
    expect(endpointUrl(cfg, '/responses')).toBe('https://opencode.ai/zen/go/v1/responses');
    expect(buildHeaders(cfg)).toMatchObject({ Authorization: 'Bearer K', 'x-opencode-session': 'sess-1' });
    expect(buildHeaders(cfg)).not.toHaveProperty('X-Upstream');
  });
  it('через relay: путь /v1/…, провайдер в X-Upstream', () => {
    const viaRelay = { ...cfg, relayUrl: 'https://relay.example.workers.dev/' };
    expect(endpointUrl(viaRelay, '/chat/completions')).toBe('https://relay.example.workers.dev/v1/chat/completions');
    expect(buildHeaders(viaRelay)['X-Upstream']).toBe('https://opencode.ai/zen/go/v1');
  });

  it.each([
    [401, '', 'auth'],
    [403, 'Not available in your region', 'region'],
    [403, 'forbidden', 'auth'],
    [400, '{"error":{"type":"MissingSessionID"}}', 'session'],
    [429, 'limit', 'rate'],
    [503, '', 'server'],
    [404, 'nope', 'other'],
  ])('классификация ошибки %i «%s» → %s', (status, body, kind) => {
    expect(classifyError(status, body).kind).toBe(kind);
  });

  it('повторяет 5xx и сетевые сбои, но не 401', async () => {
    const ok = 'data: {"choices":[{"delta":{"content":"да"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
    const f = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(sseResponse(ok));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const c = await complete(cfg, req, undefined, { fetch: f, sleep });
    expect(c.text).toBe('да');
    expect(f).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);

    const f401 = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    await expect(complete(cfg, req, undefined, { fetch: f401, sleep })).rejects.toMatchObject({ kind: 'auth' });
    expect(f401).toHaveBeenCalledTimes(1);
  });

  it('сеть недоступна после повторов → network', async () => {
    const f = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(complete(cfg, req, undefined, { fetch: f, sleep: async () => {}, retries: 1 })).rejects.toMatchObject({ kind: 'network' });
  });

  it('отмена → aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    const f = vi.fn().mockRejectedValue(new DOMException('x', 'AbortError'));
    await expect(collect(streamChat(cfg, { ...req, signal: ac.signal }, { fetch: f }))).rejects.toMatchObject({ kind: 'aborted' });
  });

  it('пустой ответ из-за лимита рассуждений: один повтор с удвоенным лимитом, затем incomplete', async () => {
    const empty = 'event: response.incomplete\ndata: {"type":"response.incomplete","response":{"incomplete_details":{"reason":"max_output_tokens"}}}\n\n';
    const good = 'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Склеп."}\n\nevent: response.completed\ndata: {"type":"response.completed","response":{}}\n\n';
    const responsesCfg: ProviderConfig = { ...cfg, format: 'responses' };
    const f = vi.fn().mockImplementationOnce(async () => sseResponse(empty)).mockImplementationOnce(async () => sseResponse(good));
    const c = await complete(responsesCfg, req, undefined, { fetch: f });
    expect(c.text).toBe('Склеп.');
    expect(JSON.parse(f.mock.calls[1]![1].body as string).max_output_tokens).toBe(200);

    const f2 = vi.fn().mockImplementation(async () => sseResponse(empty));
    await expect(complete(responsesCfg, req, undefined, { fetch: f2 })).rejects.toBeInstanceOf(LlmError);
    await expect(complete(responsesCfg, req, undefined, { fetch: f2 })).rejects.toMatchObject({ kind: 'incomplete' });
  });

  it('формат Messages (Anthropic) не поддерживается — понятная ошибка', async () => {
    await expect(collect(streamChat({ ...cfg, format: 'messages' }, req))).rejects.toMatchObject({ kind: 'other' });
  });
});

describe('пресеты', () => {
  it('Muse Spark и Luna идут через responses, DeepSeek и GLM — через chat', () => {
    expect(formatFor(OPENCODE_GO, 'muse-spark-1.3-contributor')).toBe('responses');
    expect(formatFor(OPENCODE_GO, 'gpt-5.6-luna')).toBe('responses');
    expect(formatFor(OPENCODE_GO, 'deepseek-v4.1-flash')).toBe('chat');
    expect(formatFor(OPENCODE_GO, 'glm-5.3')).toBe('chat');
  });
  it('у Мастера запас токенов на рассуждения; модель по умолчанию не отдаёт данные на обучение', () => {
    expect(OPENCODE_GO.defaultModel.maxOutputTokens).toBeGreaterThanOrEqual(1500);
    expect(modelTrainsOnData(OPENCODE_GO.defaultModel.model)).toBe(false);
  });
  it('неизвестный провайдер → OpenCode Go', () => {
    expect(getProvider('nope').id).toBe('opencode-go');
  });
});
