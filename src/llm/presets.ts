// Пресеты провайдеров (ADR-0002, 0018, 0021). Имена моделей живут только здесь.
import type { ApiFormat, ReasoningEffort } from './types';

export interface RoleModel {
  model: string;
  effort?: ReasoningEffort;
  maxOutputTokens: number;
}

/** Итог нашей проверки модели в роли Мастера (`DM_LIVE=1 pnpm test src/dm/live`, docs/04-ai-dm.md). */
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
  'qwen3.8-max': 'messages',
  'qwen3.8-flash': 'chat', // по таблице провайдера messages, но в игре проверена через chat (2026-09-29)
  'qwen3.7-plus': 'messages',
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
  defaultModel: { model: 'gpt-5.6-luna', effort: 'medium', maxOutputTokens: 4000 },
  verified: [
    { id: 'gpt-5.6-luna', level: 'good', checked: '2026-09-29', note: { ru: 'Связная история, честно спрашивает про очки, аккуратные инструменты.', en: 'Coherent story, asks about points, clean tool calls.' } },
    { id: 'glm-5.3', level: 'good', checked: '2026-09-29', note: { ru: 'Богатый язык, следует правилам хода.', en: 'Rich prose, follows the turn rules.' } },
    { id: 'deepseek-v4-flash', level: 'good', checked: '2026-09-29', note: { ru: 'Сильный текст и точные инструменты, дёшево.', en: 'Strong prose and precise tools, cheap.' } },
    { id: 'mimo-v2.6-flash', level: 'good', checked: '2026-09-29', note: { ru: 'Аккуратно с инструментами, самая экономная по токенам.', en: 'Careful tool use, the lightest on tokens.' } },
    { id: 'deepseek-v4.1-flash', level: 'caveats', checked: '2026-09-29', note: { ru: 'Играет, но путает аргументы, роняет английскую реплику в текст, не всегда тратит очки по просьбе.', en: 'Playable, but botches arguments, leaks an English line, does not always spend points.' } },
    { id: 'qwen3.8-flash', level: 'caveats', checked: '2026-09-29', note: { ru: 'Работает через chat; в тексте попадаются чужие символы.', en: 'Works over chat; stray foreign characters in the text.' } },
    { id: 'gpt-6-luna', level: 'caveats', checked: '2026-09-29', note: { ru: 'Без усилия рассуждений играет; со средним даёт пустой текст. Иногда обрывок JSON в тексте.', en: 'Plays without reasoning effort; empty text at medium. Sometimes a JSON scrap in the text.' } },
    { id: 'glm-5.3-flash', level: 'caveats', checked: '2026-09-29', note: { ru: 'Медленная (до двух минут на ход), чужие слова в тексте, ход иногда закрывается без вопроса.', en: 'Slow (up to two minutes a turn), foreign words in the text.' } },
    { id: 'mimo-v2.5', level: 'caveats', checked: '2026-09-29', note: { ru: 'Проскакивают слова на других языках, игнорирует просьбу потратить очко.', en: 'Words in other languages slip in; ignores a request to spend a point.' } },
    { id: 'muse-spark-1.3-contributor', level: 'caveats', checked: '2026-09-29', note: { ru: 'Вместо истории пишет реплики о своих действиях и не бросает проверки. Отдаёт тексты на обучение.', en: 'Writes remarks about its own actions instead of a story and does not roll checks. Trains on your data.' } },
    { id: 'longcat-2.0', level: 'bad', checked: '2026-09-29', note: { ru: 'Провайдер отвечает 500 на её битые аргументы инструментов.', en: 'The provider returns 500 on its malformed tool arguments.' } },
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
