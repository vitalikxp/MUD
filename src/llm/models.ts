// Список моделей провайдера (`GET {base}/models`) и порядок в окне выбора: сначала проверенные нами, потом остальные.
import { buildHeaders, classifyError, endpointUrl, type ClientOptions } from './client';
import { formatFor, type ProviderPreset, type VerifiedLevel, type VerifiedModel } from './presets';
import { LlmError, type ApiFormat, type ProviderConfig } from './types';

/** Список id моделей провайдера. Ошибки классифицируются как у запросов к модели. */
export async function listModels(cfg: ProviderConfig, opts: Pick<ClientOptions, 'fetch'> & { signal?: AbortSignal } = {}): Promise<string[]> {
  const doFetch = opts.fetch ?? fetch;
  const { 'Content-Type': _ct, ...headers } = buildHeaders(cfg);
  let response: Response;
  try {
    response = await doFetch(endpointUrl(cfg, '/models'), { method: 'GET', headers: { ...headers, Accept: 'application/json' }, ...(opts.signal ? { signal: opts.signal } : {}) });
  } catch (e) {
    if (opts.signal?.aborted) throw new LlmError('aborted', 'Запрос отменён');
    throw new LlmError('network', `Нет связи с провайдером или relay: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!response.ok) throw classifyError(response.status, await response.text().catch(() => ''));
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new LlmError('other', 'Провайдер вернул список моделей не в JSON');
  }
  const rows = (body as { data?: unknown; models?: unknown } | null)?.data ?? (body as { models?: unknown } | null)?.models;
  if (!Array.isArray(rows)) throw new LlmError('other', 'В ответе провайдера нет списка моделей');
  const ids = rows.flatMap((r) => (typeof r === 'string' ? [r] : typeof (r as { id?: unknown } | null)?.id === 'string' ? [(r as { id: string }).id] : []));
  return [...new Set(ids)];
}

export type ModelLevel = VerifiedLevel | 'unchecked';

export interface ModelChoice {
  id: string;
  level: ModelLevel;
  note?: VerifiedModel['note'];
  format: ApiFormat;
  /** Формат, который клиент не поддерживает (Messages от Anthropic, ADR-0022): выбор возможен, но игра не запустится. */
  unsupported: boolean;
  /** Модели нет в списке провайдера (например, список не удалось получить). */
  offline: boolean;
}

const ORDER: Record<ModelLevel, number> = { good: 0, caveats: 1, unchecked: 2, bad: 3 };

/**
 * Порядок окна выбора: рекомендуемые → с оговорками → непроверенные (по алфавиту) → неработающие.
 * `available` — список от провайдера; `null` — получить не удалось, тогда показываем только проверенные.
 */
export function arrangeModels(provider: ProviderPreset, available: readonly string[] | null): ModelChoice[] {
  const verified = provider.verified ?? [];
  const known = new Map(verified.map((v) => [v.id, v]));
  const ids = new Set<string>(available ?? verified.map((v) => v.id));
  // Проверенная модель, которой нет в списке провайдера, всё равно показывается (список мог не вернуться целиком).
  for (const v of verified) ids.add(v.id);
  const choices = [...ids].map<ModelChoice>((id) => {
    const v = known.get(id);
    const format = formatFor(provider, id);
    return {
      id,
      level: v?.level ?? 'unchecked',
      ...(v ? { note: v.note } : {}),
      format,
      unsupported: format === 'messages',
      offline: available !== null && !available.includes(id),
    };
  });
  const rank = new Map(verified.map((v, i) => [v.id, i]));
  return choices.toSorted((a, b) => ORDER[a.level] - ORDER[b.level] || (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) || a.id.localeCompare(b.id));
}

/** Модели с обучением на данных игрока помечены в id (ADR-0017). */
export function modelTrainsOnData(model: string): boolean {
  return /contributor/i.test(model);
}
