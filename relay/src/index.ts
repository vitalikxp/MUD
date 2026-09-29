// Stateless-relay для LLM-запросов из браузера (ADR-0002, docs/11-quality-ops.md#relay).
// Пересылает POST /v1/{chat/completions|responses|messages} к провайдеру из allowlist, ничего не хранит и не логирует.
// Cloudflare Worker (Free): ожидание сети не расходует лимит CPU, потоковые ответы разрешены.

export interface Env {
  /** Через запятую. Точное совпадение origin, например `https://swrd.ru,http://localhost:5173`. */
  ALLOWED_ORIGINS?: string;
  /** Через запятую: дополнительные хосты провайдеров сверх встроенных. */
  EXTRA_UPSTREAM_HOSTS?: string;
}

export const DEFAULT_ORIGINS = ['https://swrd.ru', 'https://www.swrd.ru'];
export const UPSTREAM_HOSTS = [
  'opencode.ai',
  'openrouter.ai',
  'generativelanguage.googleapis.com',
  'api.openai.com',
  'api.anthropic.com',
];
const ENDPOINTS = new Set(['chat/completions', 'responses', 'messages']);

/** Заголовки клиента, которые передаются провайдеру. Остальное (cookie, origin, cf-*) отбрасывается. */
const FORWARD_REQUEST_HEADERS = ['content-type', 'accept', 'authorization', 'x-api-key', 'anthropic-version', 'x-opencode-session'];
/** Заголовки ответа, которые возвращаются клиенту. */
const FORWARD_RESPONSE_HEADERS = ['content-type', 'cache-control', 'retry-after'];
const USER_AGENT = 'swrd-relay/0.1 (+https://swrd.ru)';

export function isLocalOrigin(origin: string): boolean {
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function allowedOrigin(origin: string | null, env: Env): string | null {
  if (!origin) return null;
  const list = env.ALLOWED_ORIGINS ? env.ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_ORIGINS;
  return list.includes(origin) || isLocalOrigin(origin) ? origin : null;
}

function cors(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': ['content-type', 'authorization', 'x-api-key', 'anthropic-version', 'x-opencode-session', 'x-upstream', 'accept'].join(', '),
    'Access-Control-Max-Age': '86400',
    'Access-Control-Expose-Headers': 'retry-after',
    Vary: 'Origin',
  };
}

function fail(status: number, code: string, message: string, origin?: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...(origin ? cors(origin) : {}) },
  });
}

export function upstreamAllowed(upstream: URL, env: Env): boolean {
  const extra = env.EXTRA_UPSTREAM_HOSTS ? env.EXTRA_UPSTREAM_HOSTS.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return upstream.protocol === 'https:' && !upstream.username && !upstream.password && [...UPSTREAM_HOSTS, ...extra].includes(upstream.hostname);
}

export default {
  async fetch(request: Request, env: Env = {}): Promise<Response> {
    const url = new URL(request.url);
    const origin = allowedOrigin(request.headers.get('Origin'), env);

    if (request.method === 'OPTIONS') {
      return origin ? new Response(null, { status: 204, headers: cors(origin) }) : fail(403, 'origin_not_allowed', 'Origin не разрешён');
    }
    if (url.pathname === '/health') return new Response('ok', { headers: { 'Content-Type': 'text/plain' } });
    if (!origin) return fail(403, 'origin_not_allowed', 'Origin не разрешён');
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Только POST', origin);

    const endpoint = url.pathname.replace(/^\/v1\//, '');
    if (!url.pathname.startsWith('/v1/') || !ENDPOINTS.has(endpoint)) return fail(404, 'unknown_endpoint', 'Неизвестный путь', origin);

    const rawUpstream = request.headers.get('X-Upstream');
    let upstream: URL;
    try {
      upstream = new URL(rawUpstream ?? '');
    } catch {
      return fail(400, 'bad_upstream', 'Нужен заголовок X-Upstream с адресом провайдера', origin);
    }
    if (!upstreamAllowed(upstream, env)) return fail(403, 'upstream_not_allowed', `Провайдер ${upstream.hostname} не в списке разрешённых`, origin);

    const target = `${upstream.origin}${upstream.pathname.replace(/\/+$/, '')}/${endpoint}`;
    const headers = new Headers({ 'User-Agent': USER_AGENT });
    for (const name of FORWARD_REQUEST_HEADERS) {
      const v = request.headers.get(name);
      if (v) headers.set(name, v);
    }

    let response: Response;
    try {
      response = await fetch(target, { method: 'POST', headers, body: request.body });
    } catch {
      return fail(502, 'upstream_unreachable', 'Провайдер недоступен', origin);
    }

    const out = new Headers(cors(origin));
    for (const name of FORWARD_RESPONSE_HEADERS) {
      const v = response.headers.get(name);
      if (v) out.set(name, v);
    }
    out.set('Cache-Control', 'no-store');
    out.set('X-Accel-Buffering', 'no');
    return new Response(response.body, { status: response.status, headers: out });
  },
};
