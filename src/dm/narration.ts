// Повествование модели: вырезает то, что не должно попасть игроку. Модели иногда пишут псевдовызов инструмента (`(end_turn)`,
// `end_turn(["…"])`) или блок рассуждений (`<think>…</think>`) прямо в текст. Найдено evals ([docs/04-ai-dm.md#evals]).

const MAX_SUGGESTIONS = 4;
const STRING_ARRAY = /\[\s*"(?:[^"\\]|\\.)*"(?:\s*,\s*"(?:[^"\\]|\\.)*")*\s*\]/;

export interface CleanNarration {
  /** Текст для игрока без служебного мусора. */
  text: string;
  /** Варианты действий из псевдовызова `end_turn` (модель их написала, но не вызвала инструмент). */
  suggestions: string[];
}

function suggestionsFrom(junk: string): string[] {
  const match = STRING_ARRAY.exec(junk);
  if (!match) return [];
  try {
    const parsed: unknown = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string' && s.trim() !== '').slice(0, MAX_SUGGESTIONS) : [];
  } catch {
    return [];
  }
}

export function cleanNarration(raw: string): CleanNarration {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/<think>[\s\S]*$/i, '').replace(/<\/think>/gi, '');
  let suggestions: string[] = [];
  // Всё от строки, где впервые встретился идентификатор end_turn, до конца: обычное повествование его не содержит.
  const at = text.search(/\bend_turn\b/);
  if (at >= 0) {
    const lineStart = text.lastIndexOf('\n', at) + 1;
    // «(end_turn …)» и «(end_turn suggestions: …)»: скобка перед идентификатором принадлежит мусору, а слова до неё в той же строке — тексту.
    const cut = text.slice(lineStart, at).replace(/\(\s*$/, '');
    suggestions = suggestionsFrom(text.slice(at));
    text = text.slice(0, lineStart) + cut;
  }
  return { text: text.trim(), suggestions };
}
