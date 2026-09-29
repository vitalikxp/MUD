// Провайдер-агностичный клиент: строит запрос по формату API, ходит напрямую или через relay,
// классифицирует ошибки и повторяет только то, что имеет смысл повторять (ADR-0002, 0015, 0018).
import { buildChatBody, CHAT_PATH, parseChatStream } from './chat';
import { buildResponsesBody, parseResponsesStream, RESPONSES_PATH } from './responses';
import { parseSse } from './sse';
import { LlmError, type ChatRequest, type FinishReason, type ProviderConfig, type StreamEvent, type ToolCall, type Usage } from './types';

export interface ClientOptions {
  fetch?: typeof fetch;
  /** Подмена ожидания между повторами (в тестах). */
  sleep?: (ms: number) => Promise<void>;
  retries?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function endpointUrl(cfg: ProviderConfig, path: string): string {
  const base = cfg.baseUrl.replace(/\/+$/, '');
  // Через relay путь фиксированный (/v1/…), а адрес провайдера уходит заголовком X-Upstream.
  return cfg.relayUrl ? `${cfg.relayUrl.replace(/\/+$/, '')}/v1${path}` : `${base}${path}`;
}

export function buildHeaders(cfg: ProviderConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    Authorization: `Bearer ${cfg.apiKey}`,
    ...(cfg.sessionId ? { 'x-opencode-session': cfg.sessionId } : {}),
    ...(cfg.relayUrl ? { 'X-Upstream': cfg.baseUrl.replace(/\/+$/, '') } : {}),
  };
}

export function classifyError(status: number, body: string): LlmError {
  const text = body.slice(0, 500);
  if (/MissingSessionID/i.test(text)) return new LlmError('session', 'Запросу нужен заголовок x-opencode-session', status);
  if (status === 401) return new LlmError('auth', 'Неверный ключ API', status);
  if (status === 403 && /region|country|not available|unavailable|opt.?in|consent/i.test(text))
    return new LlmError('region', 'Модель недоступна в вашем регионе или не включено согласие на тариф', status);
  if (status === 403) return new LlmError('auth', 'Доступ запрещён для этого ключа', status);
  if (status === 451) return new LlmError('region', 'Модель недоступна в вашем регионе', status);
  if (status === 429) return new LlmError('rate', 'Исчерпан лимит подписки или частоты запросов', status);
  if (status >= 500) return new LlmError('server', `Ошибка сервера провайдера (${status})`, status);
  return new LlmError('other', text || `Ошибка ${status}`, status);
}

export async function* streamChat(cfg: ProviderConfig, req: ChatRequest, opts: ClientOptions = {}): AsyncGenerator<StreamEvent> {
  if (cfg.format === 'messages') throw new LlmError('other', 'Формат Anthropic Messages будет добавлен в M1 (ADR-0015)');
  const doFetch = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const retries = opts.retries ?? 2;
  const [path, body] = cfg.format === 'responses' ? [RESPONSES_PATH, buildResponsesBody(req)] : [CHAT_PATH, buildChatBody(req)];

  let response: Response | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      response = await doFetch(endpointUrl(cfg, path), {
        method: 'POST',
        headers: buildHeaders(cfg),
        body: JSON.stringify(body),
        ...(req.signal ? { signal: req.signal } : {}),
      });
    } catch (e) {
      if (req.signal?.aborted) throw new LlmError('aborted', 'Запрос отменён');
      if (attempt < retries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new LlmError('network', `Нет связи с провайдером или relay: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (response.ok) break;
    const err = classifyError(response.status, await response.text().catch(() => ''));
    if (err.kind === 'server' && attempt < retries) {
      await sleep(500 * 2 ** attempt);
      continue;
    }
    throw err;
  }
  if (!response.body) throw new LlmError('network', 'Пустой ответ провайдера');

  try {
    const sse = parseSse(response.body);
    yield* cfg.format === 'responses' ? parseResponsesStream(sse) : parseChatStream(sse);
  } catch (e) {
    if (req.signal?.aborted) throw new LlmError('aborted', 'Запрос отменён');
    throw e instanceof LlmError ? e : new LlmError('network', `Поток оборвался: ${e instanceof Error ? e.message : String(e)}`);
  }
}

export interface Completion {
  text: string;
  toolCalls: ToolCall[];
  finish: FinishReason;
  usage: Usage;
}

/**
 * Полный ответ с колбэком на текстовые дельты. Если модель упёрлась в лимит выхода, не выдав ни текста, ни вызовов
 * (всё ушло на рассуждения), запрос повторяется один раз с удвоенным лимитом; иначе — ошибка `incomplete` (ADR-0018).
 */
export async function complete(
  cfg: ProviderConfig,
  req: ChatRequest,
  onText?: (delta: string) => void,
  opts: ClientOptions = {},
): Promise<Completion> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r: ChatRequest = attempt === 0 ? req : { ...req, maxOutputTokens: req.maxOutputTokens * 2 };
    let text = '';
    const toolCalls: ToolCall[] = [];
    let done: Extract<StreamEvent, { type: 'done' }> | undefined;
    for await (const ev of streamChat(cfg, r, opts)) {
      if (ev.type === 'text') {
        text += ev.delta;
        onText?.(ev.delta);
      } else if (ev.type === 'tool_call') toolCalls.push(ev.call);
      else if (ev.type === 'done') done = ev;
    }
    const finish = done?.finish ?? 'stop';
    const usage = done?.usage ?? { inputTokens: 0, outputTokens: 0, cachedTokens: 0, reasoningTokens: 0 };
    if (finish === 'length' && !text && toolCalls.length === 0) {
      if (attempt === 0) continue;
      throw new LlmError('incomplete', 'Модель исчерпала лимит токенов на рассуждения и не дала ответа');
    }
    return { text, toolCalls, finish, usage };
  }
  throw new LlmError('incomplete', 'Модель не дала ответа');
}
