import { describe, expect, it, vi } from 'vitest';
import { arrangeModels, listModels, modelTrainsOnData } from './models';
import { CUSTOM, formatFor, OPENCODE_GO } from './presets';
import type { ProviderConfig } from './types';

const cfg: ProviderConfig = { format: 'chat', baseUrl: 'https://opencode.ai/zen/go/v1', apiKey: 'SECRET', sessionId: 's1' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe('listModels', () => {
  it('GET /models напрямую: ключ и сессия в заголовках, без Content-Type, id уникальны', async () => {
    const f = vi.fn().mockResolvedValue(json({ object: 'list', data: [{ id: 'b' }, { id: 'a' }, { id: 'b' }, { name: 'без id' }] }));
    expect(await listModels(cfg, { fetch: f })).toEqual(['b', 'a']);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://opencode.ai/zen/go/v1/models');
    expect(init.method).toBe('GET');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer SECRET', 'x-opencode-session': 's1', Accept: 'application/json' });
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('через relay: путь /v1/models и X-Upstream', async () => {
    const f = vi.fn().mockResolvedValue(json({ data: [{ id: 'x' }] }));
    await listModels({ ...cfg, relayUrl: 'https://relay.example/' }, { fetch: f });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://relay.example/v1/models');
    expect((init.headers as Record<string, string>)['X-Upstream']).toBe('https://opencode.ai/zen/go/v1');
  });

  it('другие формы ответа: models[], массив строк', async () => {
    expect(await listModels(cfg, { fetch: async () => json({ models: [{ id: 'm1' }, 'm2'] }) })).toEqual(['m1', 'm2']);
  });

  it('ошибки: ключ, лимит, сеть, не JSON, нет списка, отмена', async () => {
    await expect(listModels(cfg, { fetch: async () => json({}, 401) })).rejects.toMatchObject({ kind: 'auth' });
    await expect(listModels(cfg, { fetch: async () => json({}, 429) })).rejects.toMatchObject({ kind: 'rate' });
    await expect(listModels(cfg, { fetch: async () => { throw new Error('offline'); } })).rejects.toMatchObject({ kind: 'network' });
    await expect(listModels(cfg, { fetch: async () => new Response('<html>', { status: 200 }) })).rejects.toMatchObject({ kind: 'other' });
    await expect(listModels(cfg, { fetch: async () => json({ status: 'ok' }) })).rejects.toMatchObject({ kind: 'other', message: expect.stringContaining('нет списка') });
    const controller = new AbortController();
    controller.abort();
    await expect(listModels(cfg, { signal: controller.signal, fetch: async () => { throw new Error('aborted'); } })).rejects.toMatchObject({ kind: 'aborted' });
  });
});

describe('arrangeModels: порядок окна выбора', () => {
  const available = ['zeta-model', 'longcat-2.0', 'alpha-model', 'mimo-v2.5', 'glm-5.3', 'gpt-5.6-luna', 'qwen3.8-max', 'deepseek-v4-flash', 'mimo-v2.6-flash', 'minimax-m2.7'];

  it('рекомендуемые (в порядке реестра) → с оговорками → непроверенные по алфавиту → неработающие', () => {
    const order = arrangeModels(OPENCODE_GO, available).map((m) => `${m.level}:${m.id}`);
    // проверенные, которых нет в списке провайдера, тоже показываются (после проверенных из списка нет смысла скрывать их)
    expect(order.slice(0, 4)).toEqual(['good:deepseek-v4-flash', 'good:deepseek-flash', 'good:deepseek-v4-pro', 'good:mimo-v2.5-pro']);
    const caveats = order.filter((x) => x.startsWith('caveats:'));
    expect(caveats[0]).toBe('caveats:deepseek-v4.1-flash');
    expect(order.filter((x) => x.startsWith('unchecked:'))).toEqual(['unchecked:alpha-model', 'unchecked:zeta-model']); // остальные модели из списка проверены
    expect(order.at(-1)).toBe('bad:minimax-m2.7');
  });

  it('у проверенных есть заметка, у остальных нет; формат и «не поддержан» по таблице провайдера', () => {
    const list = arrangeModels(OPENCODE_GO, available);
    expect(list.find((m) => m.id === 'gpt-5.6-luna')).toMatchObject({ format: 'responses', unsupported: false, offline: false, note: { ru: expect.any(String), en: expect.any(String) } });
    expect(list.find((m) => m.id === 'alpha-model')).toMatchObject({ level: 'unchecked', format: 'chat' });
    expect(list.find((m) => m.id === 'alpha-model')).not.toHaveProperty('note');
    expect(list.find((m) => m.id === 'minimax-m2.7')).toMatchObject({ format: 'messages', unsupported: true });
    expect(list.find((m) => m.id === 'qwen3.8-max')).toMatchObject({ format: 'chat', unsupported: false }); // играет через chat (evals)
  });

  it('список провайдера не получен (null) — только проверенные; модель вне списка помечена offline', () => {
    const offline = arrangeModels(OPENCODE_GO, null);
    expect(offline).toHaveLength(OPENCODE_GO.verified!.length);
    expect(offline.slice(0, 4).map((m) => m.level)).toEqual(['good', 'good', 'good', 'good']);
    expect(offline.at(-1)!.id).toBe('minimax-m2.7');
    expect(offline.every((m) => !m.offline)).toBe(true);
    const partial = arrangeModels(OPENCODE_GO, ['alpha-model']);
    expect(partial.find((m) => m.id === 'glm-5.3')).toMatchObject({ offline: true });
    expect(partial.find((m) => m.id === 'alpha-model')).toMatchObject({ offline: false });
  });

  it('у провайдера без реестра все модели непроверенные', () => {
    expect(arrangeModels(CUSTOM, ['b', 'a']).map((m) => `${m.level}:${m.id}`)).toEqual(['unchecked:a', 'unchecked:b']);
    expect(arrangeModels(CUSTOM, null)).toEqual([]);
  });

  it('реестр не содержит повторов; модель по умолчанию — первая рекомендуемая; неподдерживаемые форматы не рекомендуются', () => {
    const verified = OPENCODE_GO.verified!;
    const ids = verified.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(verified[0]).toMatchObject({ id: OPENCODE_GO.defaultModel.model, level: 'good' });
    for (const v of verified.filter((x) => formatFor(OPENCODE_GO, x.id) === 'messages')) expect(v.level, v.id).toBe('bad');
    // рекомендуемые идут раньше моделей с оговорками, неработающие — в конце (порядок реестра — порядок окна выбора)
    const levels = verified.map((v) => v.level);
    expect(levels).toEqual(levels.toSorted((a, b) => ['good', 'caveats', 'bad'].indexOf(a) - ['good', 'caveats', 'bad'].indexOf(b)));
  });
});

describe('modelTrainsOnData', () => {
  it('признак contributor в id', () => {
    expect(modelTrainsOnData('muse-spark-1.3-contributor')).toBe(true);
    expect(modelTrainsOnData('gpt-5.6-luna')).toBe(false);
    expect(modelTrainsOnData('muse-spark-1.2-contributor')).toBe(true);
    expect(modelTrainsOnData('deepseek-v4-flash')).toBe(false);
  });
});
