// Пресеты провайдеров (ADR-0002, 0018, 0021). Имена моделей живут только здесь.
import type { ApiFormat, ReasoningEffort } from './types';

export interface RoleModel {
  model: string;
  effort?: ReasoningEffort;
  maxOutputTokens: number;
}

/**
 * Итог проверки модели в роли Мастера (`pnpm eval:dm`, docs/04-ai-dm.md#evals): `good` — оба прогона 8/8, `caveats` — 10–15 из 16, `bad` — меньше 10
 * или провайдер отвергает модель. Порядок реестра — порядок в окне выбора внутри уровня.
 */
export type VerifiedLevel = 'good' | 'caveats' | 'bad';

export interface VerifiedModel {
  id: string;
  level: VerifiedLevel;
  /** Что мы увидели: коротко, для окна выбора модели. */
  note: { ru: string; en: string };
  /** Дата проверки. */
  checked: string;
}

export interface ProviderPreset {
  id: string;
  name: string;
  baseUrl: string;
  /** Формат по умолчанию и исключения по моделям. */
  format: ApiFormat;
  formatByModel?: Record<string, ApiFormat>;
  /** Нужен ли relay (у провайдера нет CORS для браузера). */
  needsRelay: boolean;
  notice?: 'opencode-terms';
  /** Модель Мастера по умолчанию и её параметры; для прочих моделей усилие рассуждений не задаётся. */
  defaultModel: RoleModel;
  /** Модели, проверенные в игре: они идут в окне выбора первыми. */
  verified?: VerifiedModel[];
}

const GO_FORMATS: Record<string, ApiFormat> = {
  'muse-spark-1.3-contributor': 'responses',
  'muse-spark-1.2-contributor': 'responses',
  'gpt-6-luna': 'responses',
  'gpt-5.6-luna': 'responses',
  'grok-4.7': 'responses',
  'grok-4.6': 'responses',
  // qwen3.8-max, qwen3.8-flash и qwen3.7-plus провайдер числит за messages, но они играют через chat (evals 2026-09-30): формат по умолчанию.
  'minimax-m3': 'messages',
  'minimax-m2.7': 'messages',
};

export const OPENCODE_GO: ProviderPreset = {
  id: 'opencode-go',
  name: 'OpenCode Go',
  baseUrl: 'https://opencode.ai/zen/go/v1',
  format: 'chat',
  formatByModel: GO_FORMATS,
  needsRelay: true,
  notice: 'opencode-terms',
  defaultModel: { model: 'deepseek-v4-flash', maxOutputTokens: 4000 },
  verified: [
    { id: 'deepseek-v4-flash', level: 'good', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 8/8, 8,5 с на ход. Модель по умолчанию: самая быстрая из безупречных.', en: 'Evals 8/8 + 8/8, 8.5 s per turn. The default: the fastest of the flawless ones.' } },
    { id: 'deepseek-flash', level: 'good', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 8/8, 19 с на ход. Быстрая, без замечаний.', en: 'Evals 8/8 + 8/8, 19 s per turn. Fast, no findings.' } },
    { id: 'deepseek-v4-pro', level: 'good', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 8/8, 21 с на ход. Без замечаний.', en: 'Evals 8/8 + 8/8, 21 s per turn. No findings.' } },
    { id: 'mimo-v2.5-pro', level: 'good', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 8/8, 26 с на ход. Без замечаний.', en: 'Evals 8/8 + 8/8, 26 s per turn. No findings.' } },
    { id: 'mimo-v2.6-flash', level: 'good', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 8/8, 34 с на ход. Без замечаний, самая экономная по выходным токенам.', en: 'Evals 8/8 + 8/8, 34 s per turn. No findings; the lightest on output tokens.' } },
    { id: 'qwen3.8-max', level: 'good', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 8/8, 41 с на ход. Играет через Chat Completions.', en: 'Evals 8/8 + 8/8, 41 s per turn. Plays over Chat Completions.' } },
    { id: 'mimo-v2.5', level: 'good', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 8/8, 54 с на ход. Без замечаний, медленнее лидеров.', en: 'Evals 8/8 + 8/8, 54 s per turn. No findings, slower than the leaders.' } },
    { id: 'glm-5.3', level: 'good', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 8/8, 62 с на ход. Без замечаний, медленная, много выходных токенов.', en: 'Evals 8/8 + 8/8, 62 s per turn. No findings, slow, many output tokens.' } },
    { id: 'glm-5.2', level: 'good', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 8/8, 73 с на ход. Без замечаний, медленная.', en: 'Evals 8/8 + 8/8, 73 s per turn. No findings, slow.' } },
    { id: 'kimi-k3', level: 'good', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 8/8, 80 с на ход. Без замечаний, очень медленная.', en: 'Evals 8/8 + 8/8, 80 s per turn. No findings, very slow.' } },
    { id: 'deepseek-v4.1-flash', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 7/8, 18 с на ход. Один сбой: лишние варианты действий в end_turn.', en: 'Evals 8/8 + 7/8, 18 s per turn. One failure: too many suggestions in end_turn.' } },
    { id: 'qwen3.7-plus', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 8/8 + 7/8, 24 с на ход. Играет через Chat Completions; один ход не на русском.', en: 'Evals 8/8 + 7/8, 24 s per turn. Plays over Chat Completions; one turn not in the campaign language.' } },
    { id: 'deepseek-v4-flash-vision-exp', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 7/8 + 7/8, 11 с на ход. Два раза ни броска, ни вопроса про очки.', en: 'Evals 7/8 + 7/8, 11 s per turn. Twice neither a roll nor a question about points.' } },
    { id: 'hy3', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 6/8 + 8/8, 22 с на ход. До очистки текста end_turn просачивался в повествование; после — без замечаний.', en: 'Evals 6/8 + 8/8, 22 s per turn. Before narration cleaning end_turn leaked into the story; clean afterwards.' } },
    { id: 'space-bunny-free', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 7/8 + 7/8, 36 с на ход. Пустой текст в двух ходах.', en: 'Evals 7/8 + 7/8, 36 s per turn. Empty text in two turns.' } },
    { id: 'mimo-v2.6-pro', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 6/8 + 8/8, 37 с на ход. Пустой текст или не тот язык (по одному ходу).', en: 'Evals 6/8 + 8/8, 37 s per turn. Empty text or wrong language (one turn each).' } },
    { id: 'hy4-preview', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 7/8 + 7/8, 62 с на ход. Пустой текст в двух ходах.', en: 'Evals 7/8 + 7/8, 62 s per turn. Empty text in two turns.' } },
    { id: 'longcat-2.0', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 7/8 + 6/8, 27 с на ход. Провайдер иногда отвечает 500 на битые аргументы инструмента; ход без end_turn.', en: 'Evals 7/8 + 6/8, 27 s per turn. The provider sometimes answers 500 on malformed tool arguments; a turn without end_turn.' } },
    { id: 'longcat-2.5-preview-free', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 7/8 + 6/8, 52 с на ход. Обрыв потока, три подряд ошибки инструментов.', en: 'Evals 7/8 + 6/8, 52 s per turn. A dropped stream, three tool errors in a row.' } },
    { id: 'glm-5.3-flash', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 5/8 + 8/8, 110 с на ход. Очень медленная; до очистки ход бывал без end_turn.', en: 'Evals 5/8 + 8/8, 110 s per turn. Very slow; before cleaning a turn sometimes lacked end_turn.' } },
    { id: 'gpt-5.6-luna', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 5/8 + 7/8, 9,1 с на ход. До очистки end_turn(...) просачивался в текст; после — только сбой потока у провайдера.', en: 'Evals 5/8 + 7/8, 9.1 s per turn. Before cleaning end_turn(...) leaked into the story; afterwards only a provider stream error.' } },
    { id: 'muse-spark-1.2-contributor', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 6/8 + 6/8, 18 с на ход. Пустой текст и не тот язык (4 хода). Отдаёт тексты на обучение.', en: 'Evals 6/8 + 6/8, 18 s per turn. Empty text and wrong language (4 turns). Trains on your data.' } },
    { id: 'kimi-k2.7-code', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 7/8 + 5/8, 25 с на ход. Ход без end_turn, служебные слова в тексте.', en: 'Evals 7/8 + 5/8, 25 s per turn. Turns without end_turn, service words in the text.' } },
    { id: 'qwen3.8-flash', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 7/8 + 5/8, 26 с на ход. Пустой текст, ни броска, ни вопроса про очки.', en: 'Evals 7/8 + 5/8, 26 s per turn. Empty text, neither a roll nor a question about points.' } },
    { id: 'muse-spark-1.3-contributor', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 6/8 + 6/8, 57 с на ход. Не бросает и не спрашивает про очки, не знает про кинжал. Отдаёт тексты на обучение.', en: 'Evals 6/8 + 6/8, 57 s per turn. Neither rolls nor asks about points, misses the dagger. Trains on your data.' } },
    { id: 'grok-4.6', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 5/8 + 6/8, 47 с на ход. Пустой текст в пяти ходах.', en: 'Evals 5/8 + 6/8, 47 s per turn. Empty text in five turns.' } },
    { id: 'gpt-6-luna', level: 'caveats', checked: '2026-09-30', note: { ru: 'Evals 5/8 + 5/8, 8,0 с на ход. Пустой текст в шести ходах.', en: 'Evals 5/8 + 5/8, 8.0 s per turn. Empty text in six turns.' } },
    { id: 'minimax-m3', level: 'bad', checked: '2026-09-30', note: { ru: 'Evals 0/8 + 7/8, 38 с на ход. Формат Messages не поддерживается; через chat играет только после очистки <think>, с ошибками языка.', en: 'Evals 0/8 + 7/8, 38 s per turn. The Messages format is not supported; over chat it plays only after <think> cleaning, with language errors.' } },
    { id: 'grok-4.7', level: 'bad', checked: '2026-09-30', note: { ru: 'Evals 3/8 + 3/8, 30 с на ход. Ход без end_turn, пустой текст.', en: 'Evals 3/8 + 3/8, 30 s per turn. Turns without end_turn, empty text.' } },
    { id: 'minimax-m2.7', level: 'bad', checked: '2026-09-30', note: { ru: 'Evals 0/8 + 0/8. Провайдер отвечает ModelProtocolUnsupported (нужен Messages).', en: 'Evals 0/8 + 0/8. The provider answers ModelProtocolUnsupported (needs Messages).' } },
  ],
};

export const CUSTOM: ProviderPreset = {
  id: 'custom',
  name: 'OpenAI-compatible',
  baseUrl: '',
  format: 'chat',
  needsRelay: false,
  defaultModel: { model: '', maxOutputTokens: 4000 },
};

export const PROVIDERS: readonly ProviderPreset[] = [OPENCODE_GO, CUSTOM];

export function formatFor(provider: ProviderPreset, model: string): ApiFormat {
  return provider.formatByModel?.[model] ?? provider.format;
}

export function getProvider(id: string): ProviderPreset {
  return PROVIDERS.find((p) => p.id === id) ?? OPENCODE_GO;
}

/** Предупреждение о токенах: без лимита на рассуждения ответ может прийти пустым. */
export const MIN_DM_OUTPUT_TOKENS = 1500;
