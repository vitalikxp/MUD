import { describe, expect, it } from 'vitest';
import { cleanNarration } from './narration';

describe('cleanNarration: служебный мусор в повествовании модели', () => {
  it('обычный текст остаётся как есть (с обрезкой пробелов), markdown и слова про инструменты в игре не трогаются', () => {
    expect(cleanNarration('  Дождь стучит по крыше. *Тихо.*  ')).toEqual({ text: 'Дождь стучит по крыше. *Тихо.*', suggestions: [] });
    expect(cleanNarration('Ирма достаёт набор инструментов для ловушек.').text).toBe('Ирма достаёт набор инструментов для ловушек.');
  });

  it('псевдовызов end_turn в конце вырезается: скобки, JSON-объект, вызов со списком, «tool call required»', () => {
    const story = 'Стражник поднимает голову.\n\nЧто делает Ирма?';
    expect(cleanNarration(`${story}\n\n(end_turn tool call required)`).text).toBe(story);
    expect(cleanNarration(`${story}\n\n(end_turn)\n{"suggestions":["Бежать","Драться"]}`)).toEqual({ text: story, suggestions: ['Бежать', 'Драться'] });
    expect(cleanNarration(`${story}\n\nend_turn(["Бежать", "Драться"])`)).toEqual({ text: story, suggestions: ['Бежать', 'Драться'] });
    expect(cleanNarration(`${story} end_turn:0`).text).toBe(story);
    expect(cleanNarration(`${story}\n\n(end_turn suggestions: ["Follow", "Hide"])`).suggestions).toEqual(['Follow', 'Hide']);
  });

  it('повтор псевдовызова и не более четырёх вариантов', () => {
    const out = cleanNarration('Тишина.\n\nend_turn(["а", "б", "в", "г", "д"])\n\nend_turn(["а", "б"])');
    expect(out.text).toBe('Тишина.');
    expect(out.suggestions).toEqual(['а', 'б', 'в', 'г']);
  });

  it('блоки рассуждений <think> вырезаются: закрытые и незакрытый хвост', () => {
    expect(cleanNarration('<think>сначала бросок</think>\n\nЗамок щёлкает.').text).toBe('Замок щёлкает.');
    expect(cleanNarration('Замок щёлкает.\n\n<think>теперь end_turn').text).toBe('Замок щёлкает.');
    expect(cleanNarration('Замок щёлкает.</think>').text).toBe('Замок щёлкает.');
  });

  it('текст, целиком состоящий из мусора, становится пустым', () => {
    expect(cleanNarration('(end_turn)')).toEqual({ text: '', suggestions: [] });
    expect(cleanNarration('<think>только мысли</think>').text).toBe('');
  });

  it('обычные квадратные скобки в повествовании не принимаются за варианты', () => {
    expect(cleanNarration('Запись гласит: ["ключ", "замок"].').suggestions).toEqual([]);
  });
});
