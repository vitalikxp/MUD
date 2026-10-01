import { describe, expect, it } from 'vitest';
import { DEFAULT_NARRATION, getStyle, lengthRule, openingLength, STYLES, styleBlock } from './style';
import { openingInstruction, systemPrompt } from './system';

describe('длина и стиль повествования в промпте', () => {
  it('по умолчанию промпт прежний: «1-3 short paragraphs», блока стиля нет', () => {
    const prompt = systemPrompt('ru');
    expect(prompt).toContain('6. Be brief: 1-3 short paragraphs per turn.');
    expect(prompt).not.toContain('NARRATION STYLE');
    expect(systemPrompt('ru', DEFAULT_NARRATION)).toBe(prompt);
  });

  it('краткий: один абзац; подробный: 3–5; правило 6 заменяется, а не дублируется', () => {
    const short = systemPrompt('ru', { style: 'classic', length: 'short' });
    expect(short).toContain('ONE short paragraph');
    expect(short).not.toContain('1-3 short paragraphs');
    expect(systemPrompt('ru', { style: 'classic', length: 'long' })).toContain('3-5 paragraphs per turn');
    expect(lengthRule('short')).toMatch(/^Be very brief/);
  });

  it('стиль добавляет блок после правил и оговаривает, что он касается только текста', () => {
    const prompt = systemPrompt('en', { style: 'plain', length: 'normal' });
    expect(prompt).toContain('NARRATION STYLE\nPlain speech.');
    expect(prompt).toContain('applies ONLY to the story text');
    expect(prompt.indexOf('12. Respect')).toBeLessThan(prompt.indexOf('NARRATION STYLE'));
  });

  it('вступительная сцена тоже учитывает длину', () => {
    expect(openingInstruction('Ирма', 'short')).toContain('one short paragraph, 2-4 sentences');
    expect(openingInstruction('Ирма')).toContain('1-3 paragraphs');
    expect(openingLength('long')).toBe('3-5 paragraphs');
  });

  it('неизвестный стиль — классика; у каждого стиля есть названия на двух языках; у «Классики» блок пуст', () => {
    expect(getStyle('нет-такого').id).toBe('classic');
    expect(styleBlock('classic')).toBe('');
    for (const s of STYLES) expect(s.name.ru && s.name.en && s.hint.ru && s.hint.en, s.id).toBeTruthy();
    expect(STYLES.map((s) => s.id)).toEqual(['classic', 'plain', 'children']);
  });
});
