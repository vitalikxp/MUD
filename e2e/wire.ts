// Ответы фальшивого Мастера в формате запроса: модель по умолчанию идёт через Chat Completions, прочие — через Responses.
// Путь запроса (`/v1/chat/completions` или `/v1/responses`) говорит, каким потоком отвечать.

export const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };

export interface Reply {
  /** Куски текста (дельты потока). */
  deltas?: string[];
  /** Вызовы инструментов; `arguments` — строка JSON. */
  calls?: { name: string; arguments: string }[];
}

const ev = (event: string, data: object): string => `event: ${event}\ndata: ${JSON.stringify({ type: event, ...data })}\n\n`;
const chunk = (o: object): string => `data: ${JSON.stringify(o)}\n\n`;

const responsesSse = (r: Reply): string => {
  return [
    ...(r.deltas ?? []).map((delta) => ev('response.output_text.delta', { delta })),
    ...(r.calls ?? []).map((c, i) => ev('response.output_item.done', { item: { type: 'function_call', call_id: `c${i}`, name: c.name, arguments: c.arguments } })),
    ev('response.completed', { response: { usage: { input_tokens: 5, output_tokens: 5 } } }),
  ].join('');
};

const chatSse = (r: Reply): string => {
  return [
    ...(r.deltas ?? []).map((content) => chunk({ choices: [{ delta: { content } }] })),
    ...(r.calls ?? []).map((c, index) => chunk({ choices: [{ delta: { tool_calls: [{ index, id: `c${index}`, type: 'function', function: { name: c.name, arguments: c.arguments } }] } }] })),
    chunk({ choices: [{ delta: {}, finish_reason: r.calls?.length ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 5, completion_tokens: 5 } }),
    'data: [DONE]\n\n',
  ].join('');
};

/** Тело потока SSE для запроса по этому пути. */
export const replyFor = (pathname: string, reply: Reply): string => (pathname.endsWith('/chat/completions') ? chatSse(reply) : responsesSse(reply));
