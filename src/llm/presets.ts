// Пресеты провайдеров и моделей (ADR-0002, 0016, 0017, 0018). Имена моделей живут только здесь.
import type { ApiFormat, ReasoningEffort } from './types';

export interface RoleModel {
  model: string;
  effort?: ReasoningEffort;
  maxOutputTokens: number;
}

export interface ModelPreset {
  id: 'economy' | 'private' | 'quality';
  /** Модель отдаёт тексты игры на обучение (нужно раскрытие и согласие, FR-LLM-9). */
  trainsOnData: boolean;
  dm: RoleModel;
  keeper: RoleModel;
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
  presets: ModelPreset[];
}

const GO_FORMATS: Record<string, ApiFormat> = {
  'muse-spark-1.3-contributor': 'responses',
  'muse-spark-1.2-contributor': 'responses',
  'gpt-6-luna': 'responses',
  'gpt-5.6-luna': 'responses',
  'grok-4.7': 'responses',
  'grok-4.6': 'responses',
  'qwen3.8-max': 'messages',
  'qwen3.8-flash': 'messages',
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
  presets: [
    {
      id: 'economy',
      trainsOnData: true,
      dm: { model: 'muse-spark-1.3-contributor', effort: 'medium', maxOutputTokens: 4000 },
      keeper: { model: 'muse-spark-1.3-contributor', effort: 'low', maxOutputTokens: 2000 },
    },
    {
      id: 'private',
      trainsOnData: false,
      dm: { model: 'gpt-5.6-luna', effort: 'medium', maxOutputTokens: 4000 },
      keeper: { model: 'deepseek-v4.1-flash', maxOutputTokens: 2000 },
    },
    {
      id: 'quality',
      trainsOnData: false,
      dm: { model: 'glm-5.3', maxOutputTokens: 4000 },
      keeper: { model: 'deepseek-v4.1-flash', maxOutputTokens: 2000 },
    },
  ],
};

export const CUSTOM: ProviderPreset = {
  id: 'custom',
  name: 'OpenAI-compatible',
  baseUrl: '',
  format: 'chat',
  needsRelay: false,
  presets: [],
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
