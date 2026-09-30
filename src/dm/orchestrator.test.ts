import { describe, expect, it } from 'vitest';
import { scriptedRng } from '../engine/testing';
import { LlmError } from '../llm/types';
import { opend6 } from '../rules/opend6';
import { runTurn } from './orchestrator';
import { deps, heroDraft, scriptedLlm } from './testing';
import { TurnError } from './types';

const player = { kind: 'player' as const, text: 'Я взламываю замок', uid: 'local', charId: 'hero' };
const endTurn = { name: 'end_turn', args: { suggestions: ['Войти', 'Прислушаться'] } };
const kinds = (events: readonly { t: string }[]): string[] => events.map((e) => e.t);

describe('runTurn: обычный ход', () => {
  it('текст → проверка → результат модели → текст → end_turn; события в черновике по порядку', async () => {
    // взлом: координация вора 4D + 2D (6 очков) = 6D: пять обычных кубов и Wild Die
    const { draft } = heroDraft(scriptedRng([4, 4, 5, 3, 3, 2]));
    const { llm, requests } = scriptedLlm([
      { text: 'Вы достаёте отмычки.', calls: [{ name: 'check', args: { actorId: 'hero', skill: 'lockpicking', difficulty: 15, reason: 'вскрыть замок' } }] },
      { text: 'Замок щёлкает.', calls: [endTurn] },
    ]);
    const report = await runTurn(draft, player, opend6, deps(llm));

    expect(kinds(draft.events)).toEqual(['intent', 'narration', 'roll', 'narration', 'turn.ended']);
    expect(draft.events[0]).toMatchObject({ t: 'intent', uid: 'local', charId: 'hero', text: 'Я взламываю замок' });
    expect(draft.events[2]).toMatchObject({ t: 'roll', skill: 'lockpicking', difficulty: 15, success: true });
    expect(draft.events[4]).toEqual({ t: 'turn.ended', suggestions: ['Войти', 'Прислушаться'] });
    expect(report).toMatchObject({ promptVersion: 'dm-system@2', iterations: 2, autoClosed: false, usage: { inputTokens: 20, outputTokens: 10 } });
    expect(report.tools.map((t) => [t.name, t.ok])).toEqual([['check', true], ['end_turn', true]]);

    // модель получила результат броска от движка и продолжила с ним
    const second = requests[1]!.messages;
    expect(second.at(-2)).toMatchObject({ role: 'assistant', content: 'Вы достаёте отмычки.' });
    const toolMsg = second.at(-1)!;
    expect(toolMsg.role).toBe('tool');
    expect(JSON.parse((toolMsg as { content: string }).content)).toMatchObject({ total: 4 + 4 + 5 + 3 + 3 + 2, success: true, difficulty: 15 });
  });

  it('первый запрос: инструменты со схемами, системный промпт, состояние и заявка игрока', async () => {
    const { draft } = heroDraft(scriptedRng([]));
    const { llm, requests } = scriptedLlm([{ calls: [endTurn] }]);
    await runTurn(draft, player, opend6, deps(llm, { reasoningEffort: 'medium' }));
    const req = requests[0]!;
    expect(req).toMatchObject({ model: 'test-model', maxOutputTokens: 1000, reasoningEffort: 'medium' });
    expect(req.tools!.map((t) => t.name)).toEqual(expect.arrayContaining(['roll', 'check', 'contest', 'apply_damage', 'heal', 'set_condition', 'give_item', 'take_item', 'award_points', 'set_scene', 'set_flag', 'end_turn']));
    expect(req.messages[0]!.role).toBe('system');
    const last = req.messages.at(-1)!;
    expect(last.role).toBe('user');
    expect((last as { content: string }).content).toContain('PLAYER (Ирма): Я взламываю замок');
    expect((last as { content: string }).content).toContain('id: hero');
  });

  it('стрим текста уходит в onProgress, вызовы инструментов — тоже', async () => {
    const { draft } = heroDraft(scriptedRng([]));
    const { llm } = scriptedLlm([{ text: 'Тишина.', calls: [endTurn] }]);
    const seen: string[] = [];
    await runTurn(draft, player, opend6, deps(llm, { onProgress: (p) => seen.push(p.type === 'text' ? `text:${p.delta}` : `tool:${p.name}:${p.error ? 'err' : 'ok'}`) }));
    expect(seen).toEqual(['text:Тишина.', 'tool:end_turn:ok']);
  });

  it('открытие игры: нет заявки игрока, есть инструкция, мир и сцена сохраняются событиями', async () => {
    const { draft } = heroDraft(scriptedRng([]));
    const { llm, requests } = scriptedLlm([
      { calls: [{ name: 'set_flag', args: { key: 'world', value: 'Пограничье у мёртвого леса.' } }, { name: 'set_scene', args: { name: 'Застава', description: 'Дождь.' } }] },
      { text: 'Дождь стучит по крыше заставы.', calls: [endTurn] },
    ]);
    await runTurn(draft, { kind: 'opening', charId: 'hero' }, opend6, deps(llm));
    expect(kinds(draft.events)).toEqual(['flag.set', 'scene.set', 'narration', 'turn.ended']);
    expect(draft.state.flags['world']).toBe('Пограничье у мёртвого леса.');
    expect(draft.state.scene).toEqual({ name: 'Застава', description: 'Дождь.' });
    expect((requests[0]!.messages.at(-1) as { content: string }).content).toContain('Open the game');
  });
});

describe('runTurn: ошибки инструментов', () => {
  it('ошибка схемы возвращается модели текстом, она исправляется, ход завершается', async () => {
    const { draft } = heroDraft(scriptedRng([2, 2, 2, 2, 2, 2]));
    const { llm, requests } = scriptedLlm([
      { calls: [{ name: 'check', args: { actorId: 'hero', skill: 'levitation', difficulty: 10, reason: 'r' } }] },
      { calls: [{ name: 'check', args: { actorId: 'hero', skill: 'lockpicking', difficulty: 10, reason: 'r' } }] },
      { calls: [endTurn] },
    ]);
    const report = await runTurn(draft, player, opend6, deps(llm));
    expect(report.tools.map((t) => t.ok)).toEqual([false, true, true]);
    const errorReply = JSON.parse((requests[1]!.messages.at(-1) as { content: string }).content) as { error: string };
    expect(errorReply.error).toContain('skill');
    expect(kinds(draft.events)).toEqual(['intent', 'roll', 'turn.ended']);
  });

  it('отказ правил (например, лишние очки) тоже возвращается модели', async () => {
    const { draft } = heroDraft(scriptedRng([]));
    const { llm, requests } = scriptedLlm([
      { calls: [{ name: 'check', args: { actorId: 'hero', skill: 'stealth', difficulty: 10, spend: { cp: 9 }, reason: 'r' } }] },
      { calls: [endTurn] },
    ]);
    await runTurn(draft, player, opend6, deps(llm));
    expect(JSON.parse((requests[1]!.messages.at(-1) as { content: string }).content)).toMatchObject({ error: expect.stringContaining('Очков персонажа') });
    expect(kinds(draft.events)).not.toContain('roll');
  });

  it('неизвестный инструмент и битый JSON: понятная ошибка, ход продолжается', async () => {
    const { draft } = heroDraft(scriptedRng([]));
    const { llm, requests } = scriptedLlm([
      { calls: [{ name: 'teleport', args: {} }] },
      { raw: '{"suggestions": [', calls: [{ name: 'end_turn', args: {} }] },
      { calls: [endTurn] },
    ]);
    const report = await runTurn(draft, player, opend6, deps(llm));
    expect(report.tools.map((t) => t.error)).toEqual(['unknown tool "teleport"', 'arguments are not valid JSON', undefined]);
    expect(JSON.parse((requests[1]!.messages.at(-1) as { content: string }).content).tools).toContain('check');
  });

  it('три ошибки подряд — TurnError, счётчик сбрасывается успешным вызовом', async () => {
    const bad = { name: 'check', args: { actorId: 'hero', difficulty: 10, reason: 'r' } }; // нет навыка и характеристики
    const { draft } = heroDraft(scriptedRng([]));
    const { llm } = scriptedLlm([{ calls: [bad] }, { calls: [bad] }, { calls: [bad] }]);
    const err = await runTurn(draft, player, opend6, deps(llm)).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TurnError);
    expect(err).toMatchObject({ kind: 'validation' });
    expect((err as TurnError).trace).toHaveLength(3);

    const { draft: d2 } = heroDraft(scriptedRng([1, 1]));
    const ok = { name: 'roll', args: { expr: '1d6', reason: 'r' } };
    const { llm: llm2 } = scriptedLlm([{ calls: [bad, bad, ok] }, { calls: [bad, bad, endTurn] }]);
    await expect(runTurn(d2, player, opend6, deps(llm2))).resolves.toMatchObject({ iterations: 2 });
  });

  it('лимит итераций: модель без конца просит бросок — TurnError limit', async () => {
    const { draft } = heroDraft(scriptedRng([1, 2, 3, 4, 5, 6]));
    const roll = { name: 'roll', args: { expr: '1d6', reason: 'r' } };
    const { llm } = scriptedLlm([{ calls: [roll] }, { calls: [roll] }, { calls: [roll] }, { calls: [roll] }]);
    await expect(runTurn(draft, player, opend6, deps(llm, { maxIterations: 3 }))).rejects.toMatchObject({ name: 'TurnError', kind: 'limit' });
  });
});

describe('runTurn: завершение хода', () => {
  it('нет end_turn: напоминание, потом модель вызывает его', async () => {
    const { draft } = heroDraft(scriptedRng([]));
    const { llm, requests } = scriptedLlm([{ text: 'Ночь.' }, { calls: [endTurn] }]);
    const report = await runTurn(draft, player, opend6, deps(llm));
    expect(report.autoClosed).toBe(false);
    expect((requests[1]!.messages.at(-1) as { content: string }).content).toContain('did not call end_turn');
    expect(kinds(draft.events)).toEqual(['intent', 'narration', 'turn.ended']);
  });

  it('модель и после напоминания молчит про end_turn — ход закрывает движок, повествование сохранено', async () => {
    const { draft } = heroDraft(scriptedRng([]));
    const { llm } = scriptedLlm([{ text: 'Ночь.' }, { text: 'Утро.' }]);
    const report = await runTurn(draft, player, opend6, deps(llm));
    expect(report.autoClosed).toBe(true);
    expect(kinds(draft.events)).toEqual(['intent', 'narration', 'narration', 'turn.ended']);
    expect(draft.events.at(-1)).toEqual({ t: 'turn.ended', suggestions: [] });
  });

  it('псевдовызов end_turn в тексте вырезается; при настоящем вызове варианты берутся у него', async () => {
    const { draft } = heroDraft(scriptedRng([]));
    const { llm } = scriptedLlm([{ text: 'Ночь тиха. Что делает Ирма?\n\n(end_turn tool call required)', calls: [endTurn] }]);
    await runTurn(draft, player, opend6, deps(llm));
    expect(draft.events[1]).toEqual({ t: 'narration', text: 'Ночь тиха. Что делает Ирма?', speaker: 'dm' });
    expect(draft.events.at(-1)).toEqual({ t: 'turn.ended', suggestions: ['Войти', 'Прислушаться'] });
  });

  it('модель написала end_turn текстом, но не вызвала: мусор вырезан, варианты из него попадают в ход', async () => {
    const { draft } = heroDraft(scriptedRng([]));
    const leaked = 'Ночь тиха. Что делает Ирма?\n\nend_turn(["Бежать", "Драться"])';
    const { llm } = scriptedLlm([{ text: leaked }, { text: leaked }]);
    const report = await runTurn(draft, player, opend6, deps(llm));
    expect(report.autoClosed).toBe(true);
    expect(draft.events.filter((e) => e.t === 'narration').map((e) => (e as { text: string }).text)).toEqual(['Ночь тиха. Что делает Ирма?', 'Ночь тиха. Что делает Ирма?']);
    expect(draft.events.at(-1)).toEqual({ t: 'turn.ended', suggestions: ['Бежать', 'Драться'] });
  });

  it('в историю диалога модели идёт очищенный текст: мусор не закрепляется как образец', async () => {
    const { draft } = heroDraft(scriptedRng([1]));
    const { llm, requests } = scriptedLlm([
      { text: 'Вы достаёте отмычки.\n(end_turn)', calls: [{ name: 'roll', args: { expr: '1d6', reason: 'проба' } }] },
      { calls: [endTurn] },
    ]);
    await runTurn(draft, player, opend6, deps(llm));
    expect(requests[1]!.messages.find((m) => m.role === 'assistant')).toMatchObject({ content: 'Вы достаёте отмычки.' });
  });

  it('вызовы после end_turn игнорируются, но отвечаем на каждый', async () => {
    const { draft } = heroDraft(scriptedRng([1]));
    const { llm } = scriptedLlm([{ calls: [endTurn, { name: 'roll', args: { expr: '1d6', reason: 'поздно' } }] }]);
    const report = await runTurn(draft, player, opend6, deps(llm));
    expect(kinds(draft.events)).toEqual(['intent', 'turn.ended']);
    expect(report.tools).toHaveLength(1);
  });
});

describe('runTurn: сбои LLM', () => {
  it('ошибка провайдера пробрасывается как есть, черновик остаётся у вызывающего', async () => {
    const { draft } = heroDraft(scriptedRng([]));
    const { llm } = scriptedLlm([{ error: new LlmError('rate', 'лимит') }]);
    await expect(runTurn(draft, player, opend6, deps(llm))).rejects.toMatchObject({ kind: 'rate' });
  });

  it('отмена игроком между шагами — LlmError aborted', async () => {
    const { draft } = heroDraft(scriptedRng([1]));
    const controller = new AbortController();
    const { llm } = scriptedLlm([{ calls: [{ name: 'roll', args: { expr: '1d6', reason: 'r' } }] }, { calls: [endTurn] }]);
    const abortAfterFirst: typeof llm = async (req, onText) => {
      const c = await llm(req, onText);
      controller.abort();
      return c;
    };
    await expect(runTurn(draft, player, opend6, deps(abortAfterFirst, { signal: controller.signal }))).rejects.toMatchObject({ kind: 'aborted' });
  });
});
