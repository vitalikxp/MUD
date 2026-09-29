// Разбор Server-Sent Events из ReadableStream. Формат: строки `event:` / `data:`, событие заканчивается пустой строкой.

export interface SseMessage {
  event?: string;
  data: string;
}

export async function* parseSse(body: ReadableStream<Uint8Array>): AsyncGenerator<SseMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event: string | undefined;
  let data: string[] = [];

  const flush = (): SseMessage | null => {
    if (data.length === 0) {
      event = undefined;
      return null;
    }
    const msg: SseMessage = event === undefined ? { data: data.join('\n') } : { event, data: data.join('\n') };
    event = undefined;
    data = [];
    return msg;
  };

  const handleLine = (line: string): SseMessage | null => {
    if (line === '') return flush();
    if (line.startsWith(':')) return null; // комментарий/keep-alive
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
    return null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.search(/\r\n|\n|\r/)) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + (buffer.startsWith('\r\n', nl) ? 2 : 1));
        const msg = handleLine(line);
        if (msg) yield msg;
      }
    }
    buffer += decoder.decode();
    if (buffer) handleLine(buffer);
    const last = flush();
    if (last) yield last;
  } finally {
    reader.releaseLock();
  }
}
