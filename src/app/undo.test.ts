// oxlint-disable-next-line no-unassigned-import -- подключает IndexedDB-эмуляцию глобально
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scriptedLlm } from '../dm/testing';
import { t } from '../i18n';
import { LocalAdapter } from '../net/local';
import type { CampaignMeta } from '../net/storage';
import { closeSession, createCampaign, createHero, heroOf, lastRetryAction, openSession, session, undoLastAction, useStorage } from './campaigns';
import { campaignEntries, chronicle, enterChronicle, retryTurn, undoTurn } from './chronicle';
import { inventoryAction } from './inventory';
import * as llmSettings from './llm';
import { takeTurn, type TurnConfig } from './turn';

/** Хранилище, у которого запись коммита можно сломать (нехватка квоты, конфликт вкладок). */
class FlakyAdapter extends LocalAdapter {
  failCommits = false;
  override async commit(...args: Parameters<LocalAdapter['commit']>): Promise<CampaignMeta> {
    if (this.failCommits) throw new Error('QuotaExceededError');
    return super.commit(...args);
  }
}

let n = 0;
let adapter: FlakyAdapter;
beforeEach(async () => {
  adapter = new FlakyAdapter(`undo-${++n}`);
  useStorage(adapter);
  closeSession();
  const id = await createCampaign({ title: 'Пограничье', variant: 'fantasy', lang: 'ru' });
  await openSession(id);
  await createHero({ templateId: 'thief', name: 'Ирма', skills: { lockpicking: 6 } });
});

const config = (llm: TurnConfig['llm']): TurnConfig => ({ llm, model: 'test', maxOutputTokens: 1000, paletteIds: ['terminal'] });
const endTurn = { name: 'end_turn', args: { suggestions: [] } };
const openingSteps = [{ calls: [{ name: 'set_scene', args: { name: 'Застава' } }, { name: 'set_flag', args: { key: 'world', value: 'Лес.' } }] }, { text: 'Дождь.', calls: [endTurn] }];
const lockCheck = () => [
  { text: 'Вы у замка.', calls: [{ name: 'check', args: { actorId: 'hero', skill: 'lockpicking', difficulty: 10, reason: 'замок' } }] },
  { text: 'Щёлк.', calls: [endTurn] },
];
const rollTotals = () => session.peek()!.commits.flatMap((c) => c.events.flatMap((e) => (e.t === 'roll' ? [e.roll['total']] : [])));

describe('undoLastAction: откат хода и бытовых действий', () => {
  it('ход отменяется: состояние возвращается, в журнале коммит-откат, после перезагрузки то же', async () => {
    await takeTurn({ kind: 'opening' }, config(scriptedLlm(openingSteps).llm));
    expect(session.peek()!.state.scene?.name).toBe('Застава');
    const undone = await undoLastAction();
    expect(undone?.kind).toBe('turn');
    const s = session.peek()!;
    expect(s.state.scene).toBeNull();
    expect(s.state.flags['world']).toBeUndefined();
    expect(s.commits.at(-1)).toMatchObject({ kind: 'revert', events: [{ t: 'revert', targetSeq: undone!.seq }] });
    const id = s.meta.id;
    closeSession();
    await openSession(id);
    expect(session.peek()!.state.scene).toBeNull();
    expect(heroOf(session.peek()!.state)?.name).toBe('Ирма');
  });

  it('повторяемо, по одному шагу, до создания героя (его не отменить); дальше — «нечего»', async () => {
    await takeTurn({ kind: 'opening' }, config(scriptedLlm(openingSteps).llm));
    await inventoryAction({ kind: 'equip', itemId: 'dagger' });
    expect((await undoLastAction())?.kind).toBe('ui_action');
    expect(heroOf(session.peek()!.state)!.items.find((i) => i.id === 'dagger')!.slot).toBeNull();
    expect((await undoLastAction())?.kind).toBe('turn');
    expect(await undoLastAction()).toBeNull();
    expect(heroOf(session.peek()!.state)).toBeDefined();
    expect(session.peek()!.meta.phase).toBe('play');
  });

  it('те же кубы: после отката и повторного хода бросок выпадает тем же', async () => {
    await takeTurn({ kind: 'opening' }, config(scriptedLlm(openingSteps).llm));
    await takeTurn({ kind: 'player', text: 'Вскрываю замок' }, config(scriptedLlm(lockCheck()).llm));
    const first = rollTotals();
    expect(first).toHaveLength(1);
    await undoLastAction();
    await takeTurn({ kind: 'player', text: 'Вскрываю замок' }, config(scriptedLlm(lockCheck()).llm));
    expect(rollTotals()).toEqual([first[0], first[0]]);
  });

  it('следующий ход после отката видит только оставшуюся историю', async () => {
    await takeTurn({ kind: 'opening' }, config(scriptedLlm(openingSteps).llm));
    await takeTurn({ kind: 'player', text: 'Вскрываю замок' }, config(scriptedLlm(lockCheck()).llm));
    await undoLastAction();
    const next = scriptedLlm([{ text: 'Иначе.', calls: [endTurn] }]);
    await takeTurn({ kind: 'player', text: 'Ухожу' }, config(next.llm));
    const sent = JSON.stringify(next.requests[0]!.messages);
    expect(sent).toContain('Дождь.');
    expect(sent).not.toContain('Щёлк.');
    expect(sent).not.toContain('Вскрываю замок');
  });

  it('без открытой кампании и с пустым журналом отменять нечего', async () => {
    closeSession();
    expect(await undoLastAction()).toBeNull();
  });
});

describe('lastRetryAction: что повторит /retry', () => {
  it('последний действующий ход — реплика игрока или открытие игры; бытовое действие после хода — повторять нечего', async () => {
    expect(lastRetryAction(session.peek()!.commits)).toBeNull();
    await takeTurn({ kind: 'opening' }, config(scriptedLlm(openingSteps).llm));
    expect(lastRetryAction(session.peek()!.commits)).toEqual({ kind: 'opening' });
    await takeTurn({ kind: 'player', text: 'Вскрываю замок' }, config(scriptedLlm(lockCheck()).llm));
    expect(lastRetryAction(session.peek()!.commits)).toEqual({ kind: 'player', text: 'Вскрываю замок' });
    await inventoryAction({ kind: 'equip', itemId: 'dagger' });
    expect(lastRetryAction(session.peek()!.commits)).toBeNull();
    await undoLastAction();
    expect(lastRetryAction(session.peek()!.commits)).toEqual({ kind: 'player', text: 'Вскрываю замок' });
  });
});

/** Строки ленты как их видит игрок (ключи словаря переведены). */
const shown = (): string[] => chronicle.value.flatMap((e) => ('key' in e ? [t(e.key, e.params ?? {})] : 'text' in e ? [e.text] : [])).filter(Boolean);

async function startedGame(): Promise<void> {
  await takeTurn({ kind: 'opening' }, config(scriptedLlm(openingSteps).llm));
  enterChronicle(`campaign:${session.peek()!.meta.id}`, campaignEntries(session.peek()!));
}

describe('/undo и /retry при сбое хранилища', () => {
  afterEach(() => { vi.unstubAllGlobals(); llmSettings.apiKey.value = ''; });

  it('/undo: ошибка записи не всплывает необработанной, игрок видит причину, состояние не тронуто', async () => {
    await startedGame();
    adapter.failCommits = true;
    await expect(undoTurn()).resolves.toBeUndefined();
    expect(shown().at(-1)).toContain('QuotaExceededError');
    expect(session.peek()!.state.scene?.name).toBe('Застава'); // откат не записан — ход на месте
    expect(session.peek()!.commits.at(-1)!.kind).toBe('turn');
  });

  it('/retry: при сбое отката повторный ход не отправляется', async () => {
    await startedGame();
    llmSettings.apiKey.value = 'k';
    llmSettings.relayMode.value = 'direct';
    const fetchSpy = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', fetchSpy);
    adapter.failCommits = true;
    await expect(retryTurn()).resolves.toBeUndefined();
    expect(shown().at(-1)).toContain('QuotaExceededError');
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(session.peek()!.commits.at(-1)!.kind).toBe('turn');
  });
});
