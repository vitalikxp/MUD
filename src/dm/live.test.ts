// Живая проверка Мастера на реальной модели (не входит в обычный прогон): DM_LIVE=1 pnpm test src/dm/live
// Ключ берётся из .env.local (OPENCODE_GO_API_KEY), в вывод не попадает. Полноценные evals — `pnpm eval:dm` (M1.7).
// oxlint-disable-next-line no-unassigned-import -- подключает IndexedDB-эмуляцию глобально
import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { closeSession, createCampaign, createHero, openSession, session, useStorage } from '../app/campaigns';
import { takeTurn } from '../app/turn';
import { complete } from '../llm/client';
import { OPENCODE_GO } from '../llm/presets';
import type { ApiFormat, ReasoningEffort } from '../llm/types';
import { LocalAdapter } from '../net/local';

const key = ((): string => {
  if (!existsSync('.env.local')) return '';
  return /^OPENCODE_GO_API_KEY=(.+)$/m.exec(readFileSync('.env.local', 'utf8'))?.[1]?.trim() ?? '';
})();

const withUa: typeof fetch = (input, init) => fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string>), 'User-Agent': 'mud-live-check' } });

describe.skipIf(process.env['DM_LIVE'] !== '1' || !key)('Мастер на реальной модели', () => {
  it('открытие игры и ход игрока с проверкой', { timeout: Number(process.env['DM_TIMEOUT'] ?? 240_000) }, async () => {
    useStorage(new LocalAdapter('live'));
    closeSession();
    // Модель: DM_MODEL=<id> (формат — DM_FORMAT или по таблице провайдера, усилие рассуждений — DM_EFFORT) либо пресет DM_PRESET.
    const preset = OPENCODE_GO.presets.find((p) => p.id === (process.env['DM_PRESET'] ?? 'economy'))!;
    const model = process.env['DM_MODEL'] ?? preset.dm.model;
    const format = (process.env['DM_FORMAT'] as ApiFormat | undefined) ?? OPENCODE_GO.formatByModel?.[model] ?? OPENCODE_GO.format;
    const effort = process.env['DM_MODEL'] ? (process.env['DM_EFFORT'] as ReasoningEffort | undefined) : preset.dm.effort;
    const provider = { format, baseUrl: OPENCODE_GO.baseUrl, apiKey: key, sessionId: crypto.randomUUID() };
    const config = {
      llm: (req: Parameters<typeof complete>[1], onText?: (d: string) => void) => complete(provider, req, onText, { fetch: withUa }),
      model,
      maxOutputTokens: preset.dm.maxOutputTokens,
      ...(effort ? { reasoningEffort: effort } : {}),
      paletteIds: ['terminal', 'amber'],
    };

    const id = await createCampaign({ title: 'Пограничье', variant: 'fantasy', lang: 'ru' });
    await openSession(id);
    await createHero({ templateId: 'thief', name: 'Ирма', skills: { lockpicking: 6, stealth: 3 } });

    const opening = await takeTurn({ kind: 'opening' }, config);
    const first = session.value!.commits.at(-1)!;
    console.log('OPENING tools:', opening.tools.map((t) => `${t.name}${t.ok ? '' : '!' + t.error}`).join(', '), '| iterations', opening.iterations, '| autoClosed', opening.autoClosed, '| tokens', opening.usage.inputTokens, '/', opening.usage.outputTokens);
    console.log('OPENING text:', first.events.filter((e) => e.t === 'narration').map((e) => (e as { text: string }).text).join('\n---\n'));
    expect(first.events.some((e) => e.t === 'narration')).toBe(true);

    const turn = await takeTurn({ kind: 'player', text: 'Я замечаю запертый сундук и пытаюсь вскрыть замок отмычками.' }, config);
    const second = session.value!.commits.at(-1)!;
    console.log('TURN tools:', turn.tools.map((t) => `${t.name}${t.ok ? '' : '!' + t.error}`).join(', '), '| iterations', turn.iterations, '| autoClosed', turn.autoClosed);
    console.log('TURN text:', second.events.filter((e) => e.t === 'narration').map((e) => (e as { text: string }).text).join('\n---\n'));
    console.log('TURN rolls:', JSON.stringify(second.events.filter((e) => e.t === 'roll').map((e) => (e as { reason: string; success?: boolean; roll: { total?: number } }))).slice(0, 400));
    expect(second.events.some((e) => e.t === 'intent')).toBe(true);

    // Третий ход: игрок соглашается потратить очко — Мастер должен бросить проверку и передать трату движку.
    const third = await takeTurn({ kind: 'player', text: 'Да, трачу одно Очко персонажа и вскрываю замок.' }, config);
    const last = session.value!.commits.at(-1)!;
    console.log('THIRD tools:', third.tools.map((t) => `${t.name}${t.ok ? '' : '!' + t.error}`).join(', '), '| iterations', third.iterations, '| autoClosed', third.autoClosed);
    console.log('THIRD text:', last.events.filter((e) => e.t === 'narration').map((e) => (e as { text: string }).text).join('\n---\n'));
    const hero = Object.values(session.value!.state.entities).find((e) => e.kind === 'pc')!;
    console.log('THIRD rolls:', JSON.stringify(last.events.filter((e) => e.t === 'roll').map((e) => ({ reason: (e as { reason: string }).reason, success: (e as { success?: boolean }).success, total: (e as { roll: { total?: number } }).roll.total }))), '| CP left', (hero.data['points'] as { cp: number }).cp);
    console.log('USAGE total input/output tokens over 3 turns:', opening.usage.inputTokens + turn.usage.inputTokens + third.usage.inputTokens, '/', opening.usage.outputTokens + turn.usage.outputTokens + third.usage.outputTokens);
  });
});
