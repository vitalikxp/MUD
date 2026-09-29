import { describe, expect, it, vi } from 'vitest';
import { checkProvider } from './check';
import type { ProviderConfig } from './types';

const cfg: ProviderConfig = { format: 'chat', baseUrl: 'https://x.test/v1', apiKey: 'K' };
const target = { model: 'm', maxOutputTokens: 1500 };
const sse = (chunks: object[]): Response =>
  new Response(chunks.map((c) => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n', { status: 200 });
const text = (t: string): Response => sse([{ choices: [{ delta: { content: t.slice(0, 2) } }] }, { choices: [{ delta: { content: t.slice(2) }, finish_reason: 'stop' }] }]);
const tool = (): Response =>
  sse([
    { choices: [{ delta: { tool_calls: [{ index: 0, id: 'c1', function: { name: 'ping', arguments: '{"word":' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"pong"}' } }] }, finish_reason: 'tool_calls' }] },
  ]);

describe('checkProvider', () => {
  it('всё работает: связь, стрим и инструменты', async () => {
    const f = vi.fn().mockImplementationOnce(async () => text('готов')).mockImplementationOnce(async () => tool());
    expect(await checkProvider(cfg, target, { fetch: f })).toEqual([
      { id: 'connect', ok: true },
      { id: 'stream', ok: true, count: 2 },
      { id: 'tools', ok: true },
    ]);
  });
  it('нет связи: один шаг с причиной, инструменты не проверяются', async () => {
    const f = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    expect(await checkProvider(cfg, target, { fetch: f })).toEqual([{ id: 'connect', ok: false, kind: 'auth' }]);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('модель не умеет вызывать инструменты — шаг tools не пройден, остальное пройдено', async () => {
    const f = vi.fn().mockImplementationOnce(async () => text('готов')).mockImplementationOnce(async () => text('pong'));
    const steps = await checkProvider(cfg, target, { fetch: f });
    expect(steps.map((s) => [s.id, s.ok])).toEqual([['connect', true], ['stream', true], ['tools', false]]);
  });
  it('region и session различаются', async () => {
    const region = vi.fn().mockResolvedValue(new Response('not available in your region', { status: 403 }));
    expect((await checkProvider(cfg, target, { fetch: region }))[0]).toMatchObject({ kind: 'region' });
    const session = vi.fn().mockResolvedValue(new Response('{"type":"MissingSessionID"}', { status: 400 }));
    expect((await checkProvider(cfg, target, { fetch: session }))[0]).toMatchObject({ kind: 'session' });
  });
});
