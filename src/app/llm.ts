// Настройки LLM игрока и сборка конфигурации клиента. Ключ хранится только в браузере (AGENTS.md §4.5).
import { computed, effect, signal } from '@preact/signals';
import { CUSTOM, formatFor, getProvider, OPENCODE_GO, type ModelPreset, type ProviderPreset } from '../llm/presets';
import type { ApiFormat, ProviderConfig } from '../llm/types';

const STORAGE_KEY = 'swrd.llm.v1';
const KEY_STORAGE = 'swrd.llm.key.v1';

export type RelayMode = 'default' | 'custom' | 'direct';

/** Адрес встроенного relay проекта: `VITE_RELAY_URL` (значение по умолчанию — в .env.default). Пусто — только свой URL или прямой режим. */
export const DEFAULT_RELAY_URL: string = import.meta.env.VITE_RELAY_URL ?? '';

interface Stored {
  provider?: string;
  preset?: ModelPreset['id'];
  relayMode?: RelayMode;
  relayUrl?: string;
  customBaseUrl?: string;
  customModel?: string;
  customFormat?: ApiFormat;
  remember?: boolean;
  /** Игрок подтвердил, что модель отдаёт тексты игры на обучение (FR-LLM-9). */
  trainsAck?: boolean;
}

function load(): Stored {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Stored;
  } catch {
    return {};
  }
}

function loadKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) ?? sessionStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

const s = load();
export const providerId = signal(getProvider(s.provider ?? OPENCODE_GO.id).id);
export const presetId = signal<ModelPreset['id']>(s.preset ?? 'economy');
export const relayMode = signal<RelayMode>(s.relayMode ?? 'default');
export const relayUrl = signal(s.relayUrl ?? '');
export const customBaseUrl = signal(s.customBaseUrl ?? '');
export const customModel = signal(s.customModel ?? '');
export const customFormat = signal<ApiFormat>(s.customFormat ?? 'chat');
export const remember = signal(s.remember ?? true);
export const trainsAck = signal(s.trainsAck ?? false);
export const apiKey = signal(loadKey());

export const provider = computed<ProviderPreset>(() => (providerId.value === CUSTOM.id ? CUSTOM : OPENCODE_GO));
export const preset = computed<ModelPreset | undefined>(() =>
  provider.value.presets.find((p) => p.id === presetId.value) ?? provider.value.presets[0],
);
export const trainsOnData = computed(() => preset.value?.trainsOnData ?? false);

export const baseUrl = computed(() => (provider.value.id === CUSTOM.id ? customBaseUrl.value : provider.value.baseUrl));
export const dmModel = computed(() => (provider.value.id === CUSTOM.id ? customModel.value : (preset.value?.dm.model ?? '')));

export const effectiveRelay = computed(() => {
  if (relayMode.value === 'direct') return '';
  return relayMode.value === 'custom' ? relayUrl.value.trim() : DEFAULT_RELAY_URL;
});

/** Что мешает начать игру: ключ, адрес, модель, relay, согласие. Пустой список — можно играть. */
export type Problem = 'key' | 'baseUrl' | 'model' | 'relay' | 'consent';
export const problems = computed<Problem[]>(() => {
  const out: Problem[] = [];
  if (!apiKey.value.trim()) out.push('key');
  if (!baseUrl.value.trim()) out.push('baseUrl');
  if (!dmModel.value.trim()) out.push('model');
  if (provider.value.needsRelay && relayMode.value !== 'direct' && !effectiveRelay.value) out.push('relay');
  if (trainsOnData.value && !trainsAck.value) out.push('consent');
  return out;
});

/**
 * Первый запуск без настроек: показываем только окно настроек LLM, пока игрок не выберет «Начать игру».
 * Вычисляется один раз при загрузке: если настройки уже есть, окно не навязывается.
 */
export const setupPending = signal(problems.value.length > 0);

export const sessionId = crypto.randomUUID();

export function providerConfig(): ProviderConfig {
  const relay = effectiveRelay.value;
  return {
    format: provider.value.id === CUSTOM.id ? customFormat.value : formatFor(provider.value, dmModel.value),
    baseUrl: baseUrl.value.replace(/\/+$/, ''),
    apiKey: apiKey.value.trim(),
    sessionId,
    ...(relay ? { relayUrl: relay } : {}),
  };
}

export function startLlmSettings(): void {
  effect(() => {
    const data: Stored = {
      provider: providerId.value, preset: presetId.value, relayMode: relayMode.value, relayUrl: relayUrl.value,
      customBaseUrl: customBaseUrl.value, customModel: customModel.value, customFormat: customFormat.value,
      remember: remember.value, trainsAck: trainsAck.value,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch { /* хранилище недоступно — настройки не сохранятся */ }
  });
  effect(() => {
    // Ключ: «запомнить» — localStorage, иначе только sessionStorage (до закрытия вкладки).
    try {
      localStorage.removeItem(KEY_STORAGE);
      sessionStorage.removeItem(KEY_STORAGE);
      if (apiKey.value) (remember.value ? localStorage : sessionStorage).setItem(KEY_STORAGE, apiKey.value);
    } catch { /* нет хранилища — ключ живёт до перезагрузки */ }
  });
}
