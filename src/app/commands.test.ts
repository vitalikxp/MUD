import { describe, expect, it } from 'vitest';
import { parseCommand } from './commands';

const P = ['terminal', 'amber'];

describe('parseCommand', () => {
  it('обычный текст — заявка', () => {
    expect(parseCommand('  осматриваю алтарь ', P)).toEqual({ kind: 'say', text: 'осматриваю алтарь' });
  });
  it('команды с аргументами', () => {
    expect(parseCommand('/palette amber', P)).toEqual({ kind: 'palette', id: 'amber' });
    expect(parseCommand('/LANG EN', P)).toEqual({ kind: 'lang', locale: 'en' });
    expect(parseCommand('/font jetbrains', P)).toEqual({ kind: 'font', font: 'jetbrains' });
    expect(parseCommand('/help', P)).toEqual({ kind: 'help' });
    expect(parseCommand('/glyphs', P)).toEqual({ kind: 'glyphs' });
  });
  it('неизвестные команды и аргументы', () => {
    expect(parseCommand('/palette neon', P).kind).toBe('unknown');
    expect(parseCommand('/lang de', P).kind).toBe('unknown');
    expect(parseCommand('/dance', P)).toEqual({ kind: 'unknown', raw: '/dance' });
  });
});
