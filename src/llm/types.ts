// Общий внутренний интерфейс LLM-клиента (ADR-0015). Оркестратор Мастера знает только эти типы.

export type ApiFormat = 'chat' | 'responses' | 'messages';
export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ToolDef {
  name: string;
  description: string;
  /** JSON Schema аргументов. */
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  /** Аргументы как пришли от модели (строка JSON) — валидирует вызывающий код. */
  arguments: string;
}

export type Message =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  | { role: 'tool'; toolCallId: string; content: string };

export interface ChatRequest {
  model: string;
  messages: Message[];
  tools?: ToolDef[];
  /** Для «думающих» моделей. Токены рассуждений входят в лимит выхода (ADR-0018). */
  reasoningEffort?: ReasoningEffort;
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  reasoningTokens: number;
}

export type FinishReason = 'stop' | 'tool_calls' | 'length' | 'error';

export type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'reasoning'; delta: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'done'; finish: FinishReason; usage: Usage };

export interface ProviderConfig {
  format: ApiFormat;
  /** Например https://opencode.ai/zen/go/v1 — без завершающего слэша. */
  baseUrl: string;
  apiKey: string;
  /** Адрес relay (Cloudflare Worker). Пусто — прямое подключение (нужен CORS у провайдера). */
  relayUrl?: string;
  /** Заголовок сессии OpenCode Go (ID кампании), ADR-0018. */
  sessionId?: string;
}

export type LlmErrorKind =
  | 'auth'        // 401/403: неверный ключ или нет доступа
  | 'region'      // модель недоступна в регионе / не включено согласие на тариф
  | 'session'     // 400 MissingSessionID
  | 'rate'        // 429: лимит подписки или частоты
  | 'server'      // 5xx
  | 'network'     // сеть, CORS, relay недоступен
  | 'incomplete'  // ответ оборван лимитом токенов (в том числе рассуждений)
  | 'aborted'     // отмена игроком
  | 'other';

export class LlmError extends Error {
  constructor(
    public readonly kind: LlmErrorKind,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'LlmError';
  }
}
