// Длина и стиль повествования Мастера: настройки игрока (окно LLM) превращаются в куски системного промпта.
// Изменил текст — поднимай `SYSTEM_PROMPT_VERSION` в system.ts и прогоняй `pnpm eval:dm` (`DM_LENGTH`, `DM_STYLE`).
import type { Lang } from '../../rules/api';

export const LENGTHS = ['short', 'normal', 'long'] as const;
export type NarrationLength = (typeof LENGTHS)[number];

export interface NarrationStyle {
  id: string;
  name: Record<Lang, string>;
  /** Что это за стиль, одной строкой для игрока (подсказка в окне настроек). */
  hint: Record<Lang, string>;
  /** Блок промпта; пустой — стиль по умолчанию, ничего не добавляется. */
  prompt: string;
}

export const STYLES: readonly NarrationStyle[] = [
  {
    id: 'classic',
    name: { ru: 'Классика', en: 'Classic' },
    hint: { ru: 'атмосферная проза', en: 'atmospheric prose' },
    prompt: '',
  },
  {
    id: 'plain',
    name: { ru: 'Простая речь', en: 'Plain speech' },
    hint: { ru: 'короткие фразы, обычные слова, без метафор', en: 'short sentences, everyday words, no metaphors' },
    prompt:
      'Plain speech. Short sentences, everyday words. No metaphors, similes, poetic epithets or archaisms. ' +
      'Say directly what happens and what the hero sees and hears; one concrete detail is enough. NPC speech is brief and natural.',
  },
  {
    id: 'children',
    name: { ru: 'Детская книга', en: "Children's book" },
    hint: { ru: 'добрый тон, простые образы, мягкие угрозы', en: 'kind tone, simple images, gentle dangers' },
    prompt:
      "Children's book. A warm, kind, friendly voice; simple words a child understands; short sentences; gentle, cheerful imagery. " +
      'Danger exists but is told softly: no gore, no cruelty, nobody is humiliated; tension comes from mystery and courage. ' +
      'Sometimes address the hero directly. The rules stay intact (checks, wounds and failure still happen); only the telling is gentle.',
  },
];

export const DEFAULT_STYLE = 'classic';
export const DEFAULT_LENGTH: NarrationLength = 'normal';

export interface NarrationSettings {
  style: string;
  length: NarrationLength;
}

export const DEFAULT_NARRATION: NarrationSettings = { style: DEFAULT_STYLE, length: DEFAULT_LENGTH };

export const getStyle = (id: string): NarrationStyle => STYLES.find((s) => s.id === id) ?? STYLES[0]!;

/** Правило длины хода (правило 6 системного промпта). */
export function lengthRule(length: NarrationLength): string {
  switch (length) {
    case 'short':
      return 'Be very brief: ONE short paragraph per turn, 2-4 short sentences, at most about 60 words. Never more than one paragraph. Show, do not tell. End on a situation that demands a decision.';
    case 'long':
      return 'Be vivid and detailed: 3-5 paragraphs per turn. Show, do not tell. End on a situation that demands a decision.';
    default:
      return 'Be brief: 1-3 short paragraphs per turn. Show, do not tell. End on a situation that demands a decision.';
  }
}

/** Длина вступительной сцены. */
export function openingLength(length: NarrationLength): string {
  return length === 'short' ? 'one short paragraph, 2-4 sentences' : length === 'long' ? '3-5 paragraphs' : '1-3 paragraphs';
}

/** Блок стиля после жёстких правил; пусто у стиля по умолчанию. Стиль касается только текста повествования. */
export function styleBlock(styleId: string): string {
  const { prompt } = getStyle(styleId);
  return prompt ? `\n\nNARRATION STYLE\n${prompt}\nThe style applies ONLY to the story text; it never changes tool calls, arguments or the rules above.` : '';
}
