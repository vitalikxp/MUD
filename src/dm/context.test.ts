import { describe, expect, it } from 'vitest';
import { revertCommit } from '../engine/commits';
import { scriptedRng } from '../engine/testing';
import type { Commit, GameEvent } from '../engine/types';
import { opend6 } from '../rules/opend6';
import { buildMessages, historyMessages, recentMechanics, stateBlock, systemMessage } from './context';
import { heroDraft } from './testing';

const turn = (seq: number, events: GameEvent[]): Commit => ({ seq, turnId: `t${seq}`, kind: 'turn', createdAt: seq, rngState: 'x', events });
const say = (text: string): GameEvent => ({ t: 'narration', text, speaker: 'dm' });
const ask = (text: string): GameEvent => ({ t: 'intent', uid: 'local', charId: 'hero', text });

describe('системное сообщение (блоки 1–3)', () => {
  it('промпт с языком повествования, праймер правил и библия кампании', () => {
    const { state } = heroDraft(scriptedRng([]));
    const text = systemMessage({ rules: opend6, variant: 'fantasy', narrationLang: 'ru', campaignTitle: 'Пограничье', state });
    expect(text).toContain('NARRATION LANGUAGE: Russian');
    expect(text).toContain('RULES: OpenD6');
    expect(text).toContain('Title: Пограничье');
    expect(text).toContain('the world has not been established');
    expect(systemMessage({ rules: opend6, variant: 'fantasy', narrationLang: 'en', campaignTitle: 'X', state })).toContain('NARRATION LANGUAGE: English');
  });

  it('набросок мира из флага world попадает в канон', () => {
    const { draft } = heroDraft(scriptedRng([]));
    draft.emit({ t: 'flag.set', key: 'world', value: 'Мёртвый лес и застава.' });
    expect(systemMessage({ rules: opend6, variant: 'fantasy', narrationLang: 'ru', campaignTitle: 'X', state: draft.state })).toContain('World notes (canon):\nМёртвый лес и застава.');
  });
});

describe('история (блок 9)', () => {
  const commits = [
    turn(1, [say('Открытие.')]),
    turn(2, [ask('Иду в лес'), say('Деревья смыкаются.')]),
    { ...turn(3, [{ t: 'entity.created', entity: { id: 'x', kind: 'npc', name: 'X', data: {}, items: [], conditions: [] } }]), kind: 'system' as const },
    turn(4, [ask('Кричу'), say('Эхо.')]),
  ];

  it('ходы как диалог; ход без заявки — «кампания начинается»; системные коммиты пропускаются', () => {
    expect(historyMessages(commits, 10_000)).toEqual([
      { role: 'user', content: '(the campaign begins)' },
      { role: 'assistant', content: 'Открытие.' },
      { role: 'user', content: 'Иду в лес' },
      { role: 'assistant', content: 'Деревья смыкаются.' },
      { role: 'user', content: 'Кричу' },
      { role: 'assistant', content: 'Эхо.' },
    ]);
  });

  it('откатанные ходы не попадают в историю', () => {
    const log = [...commits, revertCommit(5, 4, 'r', 5, 'x')];
    expect(historyMessages(log, 10_000).map((m) => m.content)).not.toContain('Эхо.');
  });

  it('бюджет режет самые старые ходы, но последний остаётся всегда', () => {
    const msgs = historyMessages(commits, 30);
    expect(msgs.map((m) => m.content)).toEqual(['Кричу', 'Эхо.']);
    expect(historyMessages(commits, 1).map((m) => m.content)).toEqual(['Кричу', 'Эхо.']);
    expect(historyMessages([], 1000)).toEqual([]);
  });
});

describe('состояние и заявка (блоки 6, 7, 10)', () => {
  it('лист героя с id навыков, сцена и броски прошлого хода без выдуманных чисел', () => {
    const { draft, state } = heroDraft(scriptedRng([]));
    draft.emit({ t: 'scene.set', scene: { name: 'Застава', description: 'Дождь.' } });
    const prev = turn(1, [{ t: 'roll', roll: { code: '6D', total: 21 }, reason: 'взлом', difficulty: 15, success: true, visibility: 'all' }]);
    const block = stateBlock(opend6, draft.state, [prev]);
    expect(block).toContain('Scene: Застава — Дождь.');
    expect(block).toContain('Ирма (id: hero, player hero) — Вор');
    expect(block).toContain('lockpicking 6D');
    expect(block).toContain('Character Points 5, Fate Points 1');
    expect(block).toContain('- взлом: 6D = 21 vs 15: success');
    expect(stateBlock(opend6, state, [])).toContain('Scene: not set');
    expect(recentMechanics([])).toEqual([]);
  });

  it('заявка игрока подписана именем героя; открытие игры — инструкция', () => {
    const { state } = heroDraft(scriptedRng([]));
    const base = { rules: opend6, variant: 'fantasy', narrationLang: 'ru' as const, campaignTitle: 'X', state, commits: [] };
    const player = buildMessages({ ...base, input: { kind: 'player', text: 'Осматриваюсь', uid: 'local', charId: 'hero' } });
    expect(player.map((m) => m.role)).toEqual(['system', 'user']);
    expect((player[1] as { content: string }).content).toMatch(/CURRENT STATE[\s\S]*PLAYER \(Ирма\): Осматриваюсь$/);
    const opening = buildMessages({ ...base, input: { kind: 'opening', charId: 'hero' } });
    expect((opening[1] as { content: string }).content).toContain('Open the game');
    expect((opening[1] as { content: string }).content).toContain('(Ирма)');
  });
});
