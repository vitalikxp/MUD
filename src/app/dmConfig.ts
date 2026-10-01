// Настройки хода Мастера из настроек LLM игрока (ключ, модель, relay).
import { PALETTES } from '../theme/palettes';
import { complete } from '../llm/client';
import * as llm from './llm';
import type { TurnConfig } from './turn';

export function dmConfig(signal?: AbortSignal): TurnConfig {
  const provider = llm.providerConfig();
  const role = llm.dmRole.value;
  return {
    llm: (req, onText) => complete(provider, req, onText),
    model: llm.dmModel.value,
    maxOutputTokens: role.maxOutputTokens,
    ...(role.effort ? { reasoningEffort: role.effort } : {}),
    ...(signal ? { signal } : {}),
    paletteIds: PALETTES.map((p) => p.id),
    narration: { style: llm.narrationStyle.value, length: llm.narrationLength.value },
  };
}
