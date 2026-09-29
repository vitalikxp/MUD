import { describe, expect, it } from 'vitest';
import { formatSeconds, formatTokens, layoutStatus, llmState } from './statusLine';

const width = (segs: readonly { text: string }[]): number => segs.reduce((n, s) => n + Array.from(s.text).length, 0);

describe('llmState', () => {
  it('приоритеты: не настроен > отвечает > ошибка > готов', () => {
    expect(llmState({ problems: ['key'], busy: true, lastError: 'auth' })).toBe('unconfigured');
    expect(llmState({ problems: [], busy: true, lastError: 'auth' })).toBe('busy');
    expect(llmState({ problems: [], busy: false, lastError: 'auth' })).toBe('error');
    expect(llmState({ problems: [], busy: false, lastError: null })).toBe('ready');
  });
});

describe('форматирование', () => {
  it('секунды и токены', () => {
    expect(formatSeconds(7912)).toBe('7,9 с');
    expect(formatSeconds(0)).toBe('0,0 с');
    expect(formatTokens(474)).toBe('474');
    expect(formatTokens(1234)).toBe('1,2k');
  });
});

describe('layoutStatus', () => {
  const left = [{ text: '● ', fg: 'success' as const }, { text: 'готов · muse-spark-1.3-contributor' }];

  it('строка ровно в cols ячеек, правая часть выровнена по краю', () => {
    const line = layoutStatus(left, 'Терминал · RU', 100);
    expect(width(line)).toBe(100);
    expect(line.at(-1)).toMatchObject({ text: 'Терминал · RU', fg: 'fgDim' });
  });

  it('узко: левая часть обрезается с «…», правая остаётся, если помещается', () => {
    const line = layoutStatus(left, 'RU', 30);
    expect(width(line)).toBe(30);
    expect(line.map((s) => s.text).join('')).toContain('…');
    expect(line.at(-1)?.text).toBe('RU');
  });

  it('очень узко (телефон): правая часть отбрасывается, слева всё, что влезло', () => {
    const line = layoutStatus(left, 'Терминал · RU · 94×33', 43);
    expect(width(line)).toBe(43);
    expect(line.map((s) => s.text).join('')).not.toContain('94×33');
  });

  it('короткая левая часть — добивается пробелами', () => {
    const line = layoutStatus([{ text: 'ok' }], '', 20);
    expect(width(line)).toBe(20);
  });
});
