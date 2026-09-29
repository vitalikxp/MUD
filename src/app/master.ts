// M0: простой чат с моделью, чтобы увидеть потоковый ответ в хронике. Настоящий оркестратор Мастера
// (инструменты, память, правила) появится в M1 — тогда этот модуль заменит src/dm/.
import { signal } from '@preact/signals';
import { locale } from '../i18n';
import { complete } from '../llm/client';
import { LlmError, type LlmErrorKind, type Message } from '../llm/types';
import * as llm from './llm';

export const busy = signal(false);
/** Итоги последнего запроса для строки состояния. */
export const lastError = signal<LlmErrorKind | null>(null);
export const lastUsage = signal<{ inputTokens: number; outputTokens: number; ms: number } | null>(null);
const history: Message[] = [];
let controller: AbortController | null = null;

const MAX_HISTORY = 20;

function systemPrompt(): string {
  const lang = locale.value === 'ru' ? 'Russian' : 'English';
  return (
    'You are the game master of a tabletop role-playing game (OpenD6 rules). This is a technical preview: there are no dice tools yet, ' +
    `so never invent dice results or numbers. Answer in ${lang}, in 1-3 short paragraphs, vividly, and end with a situation that demands a decision.`
  );
}

export function abort(): void {
  controller?.abort();
}

export interface AskHandlers {
  onText: (fullText: string) => void;
}

/** Отправляет реплику игрока модели и стримит ответ. Возвращает итоговый текст; ошибки — как LlmError. */
export async function ask(playerText: string, handlers: AskHandlers): Promise<string> {
  history.push({ role: 'user', content: playerText });
  controller = new AbortController();
  busy.value = true;
  lastError.value = null;
  const started = Date.now();
  const role = llm.dmRole.value;
  let text = '';
  try {
    const c = await complete(
      llm.providerConfig(),
      {
        model: llm.dmModel.value,
        maxOutputTokens: role.maxOutputTokens,
        ...(role.effort ? { reasoningEffort: role.effort } : {}),
        messages: [{ role: 'system', content: systemPrompt() }, ...history.slice(-MAX_HISTORY)],
        signal: controller.signal,
      },
      (delta) => {
        text += delta;
        handlers.onText(text);
      },
    );
    history.push({ role: 'assistant', content: c.text });
    lastUsage.value = { inputTokens: c.usage.inputTokens, outputTokens: c.usage.outputTokens, ms: Date.now() - started };
    return c.text;
  } catch (e) {
    // Неудавшуюся реплику убираем из истории, чтобы повтор не дублировал её.
    if (history.at(-1)?.role === 'user') history.pop();
    const err = e instanceof LlmError ? e : new LlmError('other', e instanceof Error ? e.message : String(e));
    lastError.value = err.kind === 'aborted' ? null : err.kind;
    throw err;
  } finally {
    busy.value = false;
    controller = null;
  }
}
