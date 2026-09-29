// Список моделей провайдера для окна выбора: грузится сам, когда задан ключ (или сменились провайдер, relay), и общий для настроек и окна выбора.
import { signal } from '@preact/signals';
import { listModels } from '../llm/models';
import { CUSTOM } from '../llm/presets';
import { errorText } from './chronicle';
import * as llm from './llm';

export type ModelList =
  | { status: 'idle' } // у своего API список не запрашиваем: модель вводится текстом
  | { status: 'nokey' }
  | { status: 'loading' }
  | { status: 'ok'; ids: string[] }
  | { status: 'error'; reason: string };

export const modelList = signal<ModelList>({ status: 'nokey' });

const DEBOUNCE_MS = 400;
let timer: ReturnType<typeof setTimeout> | undefined;
let controller: AbortController | undefined;
/** Настройки, для которых список загружен или загружается прямо сейчас. */
let requested = '';

/** От чего зависит ответ провайдера; при том же значении повторно не запрашиваем. */
export function modelListKey(): string {
  return [llm.providerId.value, llm.baseUrl.value, llm.effectiveRelay.value, llm.apiKey.value.trim()].join('|');
}

/** Подгрузить список моделей. Для тех же настроек загрузка не повторяется, кроме неудачной. */
export function refreshModels(): void {
  const key = modelListKey();
  const status = modelList.value.status;
  if (key === requested && (status === 'ok' || status === 'loading')) return;
  clearTimeout(timer);
  controller?.abort();
  requested = '';
  if (llm.provider.value.id === CUSTOM.id) { modelList.value = { status: 'idle' }; return; }
  if (!llm.apiKey.value.trim()) { modelList.value = { status: 'nokey' }; return; }
  requested = key;
  modelList.value = { status: 'loading' };
  const own = new AbortController();
  controller = own;
  timer = setTimeout(() => {
    listModels(llm.providerConfig(), { signal: own.signal }).then(
      (ids) => { modelList.value = { status: 'ok', ids }; },
      (e: unknown) => { if (!own.signal.aborted) { modelList.value = { status: 'error', reason: errorText(e) }; } },
    );
  }, DEBOUNCE_MS);
}
