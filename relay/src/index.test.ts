import { afterEach, describe, expect, it, vi } from 'vitest';
import relay, { allowedOrigin, upstreamAllowed } from './index';

const ORIGIN = 'https://swrd.ru';
const GO = 'https://opencode.ai/zen/go/v1';
afterEach(() => vi.unstubAllGlobals());

function post(path: string, init: { origin?: string | null; upstream?: string | null; headers?: Record<string, string> } = {}): Request {
  const headers = new Headers({ 'Content-Type': 'application/json', Authorization: 'Bearer SECRET', ...init.headers });
  if (init.origin !== null) headers.set('Origin', init.origin ?? ORIGIN);
  if (init.upstream !== null) headers.set('X-Upstream', init.upstream ?? GO);
  return new Request(`https://relay.test${path}`, { method: 'POST', headers, body: '{"model":"m"}' });
}

describe('relay', () => {
  it('OPTIONS: разрешённый origin получает CORS, чужой — 403', async () => {
    const ok = await relay.fetch(new Request('https://relay.test/v1/responses', { method: 'OPTIONS', headers: { Origin: ORIGIN } }));
    expect(ok.status).toBe(204);
    expect(ok.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(ok.headers.get('Access-Control-Allow-Headers')).toContain('x-opencode-session');
    const bad = await relay.fetch(new Request('https://relay.test/v1/responses', { method: 'OPTIONS', headers: { Origin: 'https://evil.example' } }));
    expect(bad.status).toBe(403);
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('localhost разрешён, ALLOWED_ORIGINS переопределяет список', () => {
    expect(allowedOrigin('http://localhost:5173', {})).toBe('http://localhost:5173');
    expect(allowedOrigin('https://swrd.ru', {})).toBe('https://swrd.ru');
    expect(allowedOrigin('https://fork.example', { ALLOWED_ORIGINS: 'https://fork.example' })).toBe('https://fork.example');
    expect(allowedOrigin('https://swrd.ru', { ALLOWED_ORIGINS: 'https://fork.example' })).toBeNull();
    expect(allowedOrigin(null, {})).toBeNull();
  });

  it('пересылает запрос провайдеру: адрес, нужные заголовки, тело; чужие заголовки отбрасывает', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response('data: hi\n\n', { status: 200, headers: { 'Content-Type': 'text/event-stream', 'Set-Cookie': 'a=b', 'X-Secret': '1' } }));
    vi.stubGlobal('fetch', upstream);
    const res = await relay.fetch(post('/v1/responses', { headers: { 'x-opencode-session': 'sess', Cookie: 'x=1', 'CF-Connecting-IP': '1.2.3.4' } }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('data: hi\n\n');
    const [target, init] = upstream.mock.calls[0]!;
    expect(target).toBe('https://opencode.ai/zen/go/v1/responses');
    const h = init.headers as Headers;
    expect(h.get('authorization')).toBe('Bearer SECRET');
    expect(h.get('x-opencode-session')).toBe('sess');
    expect(h.get('user-agent')).toMatch(/^swrd-relay\//);
    expect(h.get('cookie')).toBeNull();
    expect(h.get('origin')).toBeNull();
    expect(h.get('cf-connecting-ip')).toBeNull();
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    expect(res.headers.get('X-Secret')).toBeNull();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('статус ошибки провайдера возвращается как есть, с CORS (чтобы браузер видел причину)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{"type":"error"}', { status: 400 })));
    const res = await relay.fetch(post('/v1/chat/completions'));
    expect(res.status).toBe(400);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it.each([
    ['чужой origin', post('/v1/responses', { origin: 'https://evil.example' }), 403, 'origin_not_allowed'],
    ['нет origin', post('/v1/responses', { origin: null }), 403, 'origin_not_allowed'],
    ['нет X-Upstream', post('/v1/responses', { upstream: null }), 400, 'bad_upstream'],
    ['провайдер не в списке', post('/v1/responses', { upstream: 'https://evil.example/v1' }), 403, 'upstream_not_allowed'],
    ['http вместо https', post('/v1/responses', { upstream: 'http://opencode.ai/zen/go/v1' }), 403, 'upstream_not_allowed'],
    ['учётные данные в адресе', post('/v1/responses', { upstream: 'https://user:pw@opencode.ai/v1' }), 403, 'upstream_not_allowed'],
    ['внутренний адрес', post('/v1/responses', { upstream: 'https://127.0.0.1/v1' }), 403, 'upstream_not_allowed'],
    ['неизвестный путь', post('/v1/embeddings'), 404, 'unknown_endpoint'],
    ['путь мимо /v1', post('/responses'), 404, 'unknown_endpoint'],
  ])('отказ: %s', async (_name, req, status, code) => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const res = await relay.fetch(req);
    expect(res.status).toBe(status);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(code);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('GET → 405; /health открыт; недоступный провайдер → 502', async () => {
    const get = await relay.fetch(new Request('https://relay.test/v1/responses', { headers: { Origin: ORIGIN } }));
    expect(get.status).toBe(405);
    expect((await relay.fetch(new Request('https://relay.test/health'))).status).toBe(200);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    expect((await relay.fetch(post('/v1/responses'))).status).toBe(502);
  });

  it('EXTRA_UPSTREAM_HOSTS расширяет список провайдеров', () => {
    expect(upstreamAllowed(new URL('https://llm.local/v1'), {})).toBe(false);
    expect(upstreamAllowed(new URL('https://llm.local/v1'), { EXTRA_UPSTREAM_HOSTS: 'llm.local' })).toBe(true);
  });

  it('relay не пишет в консоль (ни тела, ни ключей)', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x')));
    await relay.fetch(post('/v1/responses'));
    await relay.fetch(post('/v1/responses', { upstream: 'https://evil.example' }));
    for (const s of spies) expect(s).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
