import { describe, expect, it } from 'vitest';
import type { Commit, GameEvent } from '../engine/types';
import type { RollView } from '../rules/api';
import { entriesFromCommits, lastSuggestions, resolveChoice, type RollDescriber } from './chronicleLog';

const commit = (seq: number, events: GameEvent[], kind: Commit['kind'] = 'turn'): Commit => ({ seq, turnId: `t${seq}`, kind, createdAt: 0, rngState: '', events });
/** Описание броска как в модуле правил, но простое: проверяем компоновку ленты, а не формулировки (они в `rollView.test.ts`). */
const stubDescriber: RollDescriber = (roll, actor) => {
  const view: RollView = {
    head: `${actor ? `${actor}: ` : ''}${roll.reason}`,
    dice: [{ text: `= ${String(roll.roll['total'])}`, kind: 'plain' }],
    ...(roll.roll['base'] ? { value: `Значение ${String(roll.roll['base'])}` } : {}),
    ...(roll.success !== undefined ? { verdict: { text: roll.success ? 'Успех' : 'Провал', success: roll.success } } : {}),
  };
  return view;
};
const texts = (commits: Commit[]): string[] => entriesFromCommits(commits, 'Вы>', stubDescriber).flatMap((e) => ('text' in e ? [e.text] : 'key' in e ? [`[${e.key}]`] : []));

describe('resolveChoice: номер варианта вместо текста', () => {
  const options = ['Осмотреть зал', 'Заказать эль', 'Уйти'];

  it('голый номер из списка заменяется текстом варианта; допустимы «2.», «2)», «№2», пробелы', () => {
    for (const typed of ['2', ' 2 ', '2.', '2)', '№2', '№ 2', '#2']) expect(resolveChoice(typed, options), typed).toBe('Заказать эль');
    expect(resolveChoice('1', options)).toBe('Осмотреть зал');
    expect(resolveChoice('3', options)).toBe('Уйти');
  });

  it('всё остальное уходит как есть: номер вне списка, нуль, число в предложении, несколько чисел, пустой список', () => {
    expect(resolveChoice('4', options)).toBe('4');
    expect(resolveChoice('0', options)).toBe('0');
    expect(resolveChoice('02', options)).toBe('02');
    expect(resolveChoice('Беру 2 монеты', options)).toBe('Беру 2 монеты');
    expect(resolveChoice('1 и 2', options)).toBe('1 и 2');
    expect(resolveChoice('2', [])).toBe('2');
    expect(resolveChoice('осмотреть зал', options)).toBe('осмотреть зал');
  });
});

describe('lastSuggestions: варианты, которые сейчас показаны игроку', () => {
  it('варианты последнего действующего хода; откатанный ход и бытовые действия их не меняют', () => {
    const first = commit(1, [{ t: 'turn.ended', suggestions: ['А', 'Б'] }]);
    const second = commit(2, [{ t: 'turn.ended', suggestions: ['В'] }]);
    expect(lastSuggestions([first, second])).toEqual(['В']);
    expect(lastSuggestions([first, commit(2, [{ t: 'note', text: 'x' }], 'ui_action')])).toEqual(['А', 'Б']);
    expect(lastSuggestions([first, second, commit(3, [{ t: 'revert', targetSeq: 2 }], 'revert')])).toEqual(['А', 'Б']);
    expect(lastSuggestions([])).toEqual([]);
  });
});

describe('entriesFromCommits: бытовые действия', () => {
  it('заметки ui_action идут по порядку между ходами, подряд без пустых строк; откатанные пропускаются', () => {
    const lines = texts([
      commit(1, [{ t: 'narration', text: 'Первый ход.', speaker: 'dm' }]),
      commit(2, [{ t: 'note', text: 'Ирма надевает «Кольчуга».' }], 'ui_action'),
      commit(3, [{ t: 'note', text: 'Ирма выбрасывает «Факел».' }], 'ui_action'),
      commit(4, [{ t: 'note', text: 'Отменённое.' }], 'ui_action'),
      commit(5, [{ t: 'revert', targetSeq: 4 }], 'revert'),
      commit(6, [{ t: 'narration', text: 'Второй ход.', speaker: 'dm' }]),
    ]);
    expect(lines).toEqual(['', 'Первый ход.', '', '· Ирма надевает «Кольчуга».', '· Ирма выбрасывает «Факел».', '', 'Второй ход.']);
  });

  it('заметка — системного цвета', () => {
    expect(entriesFromCommits([commit(1, [{ t: 'note', text: 'x' }], 'ui_action')], '>')).toEqual([{ text: '', fg: 'dm' }, { text: '· x', fg: 'system' }]);
  });
});

describe('entriesFromCommits', () => {
  it('реплика, повествование, открытый бросок и варианты последнего хода', () => {
    const lines = texts([
      commit(1, [{ t: 'narration', text: 'Дождь стучит по крыше.', speaker: 'dm' }, { t: 'turn.ended', suggestions: ['Уйти'] }]),
      commit(2, [
        { t: 'intent', uid: 'u', charId: 'pc', text: 'Открываю замок' },
        { t: 'roll', roll: { code: '4D+1', total: 14 }, reason: 'Взлом', difficulty: 12, success: true, visibility: 'all' },
        { t: 'narration', text: 'Замок щёлкает.', speaker: 'dm' },
        { t: 'turn.ended', suggestions: ['Войти', 'Прислушаться'] },
      ]),
    ]);
    expect(lines).toEqual(['', 'Дождь стучит по крыше.', '', 'Вы> Открываю замок', '', '♦ Взлом', '│ = 14', '│ ✓ Успех', '', 'Замок щёлкает.', '', '[game.suggestions]', '1. Войти', '2. Прислушаться']);
  });

  it('тайные броски Мастера и откатанные ходы не показываются, не-ходы пропускаются', () => {
    const lines = texts([
      commit(1, [{ t: 'roll', roll: { total: 3 }, reason: 'тайный', visibility: 'dm' }, { t: 'narration', text: 'Первый ход.', speaker: 'dm' }]),
      commit(2, [{ t: 'narration', text: 'Отменённый ход.', speaker: 'dm' }]),
      commit(3, [{ t: 'revert', targetSeq: 2 }], 'revert'),
    ]);
    expect(lines).toEqual(['', 'Первый ход.']);
  });

  it('бросок: пустая строка отделяет его от реплики игрока и от предыдущего броска; блок из заголовка, значения, кубов и исхода', () => {
    const lines = texts([commit(1, [
      { t: 'intent', uid: 'u', charId: 'hero', text: 'Прыгаю' },
      { t: 'roll', roll: { code: '3D', total: 7, base: '3D' }, reason: 'Прыжок', actorId: 'hero', difficulty: 10, success: false, visibility: 'all' },
      { t: 'roll', roll: { code: '1D', total: 2 }, reason: 'Жребий', visibility: 'all' },
    ])]);
    expect(lines).toEqual(['', 'Вы> Прыгаю', '', '♦ Прыжок', '│ Значение 3D', '│ = 7', '│ × Провал', '', '♦ Жребий', '│ = 2']);
  });

  it('цвета: заголовок акцентом, значение и кубы приглушены, исход зелёный или красный; блок без исхода без строки исхода', () => {
    const e = entriesFromCommits([commit(1, [
      { t: 'roll', roll: { code: '3D', total: 7, base: '3D' }, reason: 'Прыжок', difficulty: 10, success: false, visibility: 'all' },
      { t: 'roll', roll: { code: '3D', total: 17, base: '3D' }, reason: 'Рывок', difficulty: 10, success: true, visibility: 'all' },
    ])], '>', stubDescriber);
    const colors = e.filter((x) => 'text' in x && x.text !== '').map((x) => x.fg);
    expect(colors).toEqual(['accent', 'fgDim', 'fgDim', 'failure', 'accent', 'fgDim', 'fgDim', 'success']);
  });

  it('имя бросавшего берётся из события создания персонажа и передаётся описанию', () => {
    const hero = { id: 'hero', kind: 'pc', name: 'Ирма', data: {}, items: [], conditions: [] } as never;
    const lines = texts([
      commit(1, [{ t: 'entity.created', entity: hero }], 'system'),
      commit(2, [{ t: 'roll', roll: { total: 9 }, reason: 'взлом', actorId: 'hero', visibility: 'all' }]),
    ]);
    expect(lines).toContain('♦ Ирма: взлом');
  });
});
