import { describe, expect, it } from 'vitest';
import { markdownLines } from './markdown';
import type { Line } from './types';

const plain = (lines: readonly Line[]): string[] => lines.map((l) => l.map((s) => s.text).join(''));
/** Отрезки одной строки как «текст:стиль» — для проверки разметки (цвет — токен палитры). */
const segs = (line: Line): string[] =>
  line.map((s) => `${s.text}:${[s.strike && 's', s.underline && 'u', s.bg && 'bg', s.fg].filter(Boolean).join(',')}`);

describe('markdownLines: инлайн', () => {
  it('жирный — fgBright, курсив — accent2, зачёркнутый — приглушённый с чертой; маркеры не остаются на экране', () => {
    const [line] = markdownLines('Это **важно**, *тихо* и ~~зря~~.', 60, 'dm');
    expect(plain([line!])).toEqual(['Это важно, тихо и зря.']);
    expect(segs(line!)).toEqual(['Это :dm', 'важно:fgBright', ', :dm', 'тихо:accent2', ' и :dm', 'зря:s,fgDim', '.:dm']);
  });

  it('вложенность: курсив внутри жирного, и жирный внутри курсива', () => {
    expect(segs(markdownLines('**a *b* c**', 40)[0]!)).toEqual(['a :fgBright', 'b:accent', ' c:fgBright']);
    expect(segs(markdownLines('*a **b** c*', 40)[0]!)).toEqual(['a :accent2', 'b:accent', ' c:accent2']);
  });

  it('***жирный курсив*** — оба стиля сразу (accent)', () => {
    expect(segs(markdownLines('a ***b*** c', 40)[0]!)).toEqual(['a :', 'b:accent', ' c:']);
  });

  it('_курсив_ работает, а подчёркивания внутри слов — нет', () => {
    expect(plain(markdownLines('_шёпот_ и snake_case_name', 40))).toEqual(['шёпот и snake_case_name']);
    expect(segs(markdownLines('_шёпот_', 40)[0]!)).toEqual(['шёпот:accent2']);
  });

  it('код: отдельный фон, разметка внутри не разбирается', () => {
    const [line] = markdownLines('Введи `*не курсив*` сейчас', 60);
    expect(plain([line!])).toEqual(['Введи *не курсив* сейчас']);
    expect(segs(line!)[1]).toBe('*не курсив*:bg,accent');
  });

  it('ссылка: подчёркнутый текст, адрес приглушённо; совпадающий адрес не дублируется', () => {
    expect(plain(markdownLines('см. [карту](https://x.io/m)', 60))).toEqual(['см. карту (https://x.io/m)']);
    expect(plain(markdownLines('[a.io](a.io)', 60))).toEqual(['a.io']);
    expect(segs(markdownLines('[карту](u)', 60)[0]!)[0]).toBe('карту:u,info');
  });

  it('экранирование и незакрытая разметка остаются буквальными', () => {
    expect(plain(markdownLines('цена \\*5\\* и **не закрыто', 60))).toEqual(['цена *5* и **не закрыто']);
    expect(plain(markdownLines('2 * 3 * 4', 60))).toEqual(['2 * 3 * 4']);
    expect(plain(markdownLines('пусто ** ** тут', 60))).toEqual(['пусто ** ** тут']);
  });
});

describe('markdownLines: блоки', () => {
  it('заголовки: без решёток, акцентным цветом', () => {
    const [h] = markdownLines('## Таверна ##', 40, 'dm');
    expect(plain([h!])).toEqual(['Таверна']);
    expect(segs(h!)).toEqual(['Таверна:accent']);
  });

  it('маркированные и нумерованные списки, вложенность, висячий отступ при переносе', () => {
    const out = plain(markdownLines('- первый пункт длинного списка\n  - вложенный\n1. раз\n2) два', 16));
    expect(out).toEqual(['• первый пункт', '  длинного', '  списка', '  • вложенный', '1. раз', '2) два']);
  });

  it('цитата и разделитель', () => {
    expect(plain(markdownLines('> сказано\n---\nдальше', 20))).toEqual(['│ сказано', '─'.repeat(20), 'дальше']);
  });

  it('блок кода: строки как есть, без разбора разметки; незакрытый блок идёт до конца', () => {
    const out = markdownLines('до\n```js\n**x**  y\n```\nпосле', 30);
    expect(plain(out)).toEqual(['до', '**x**  y', 'после']);
    expect(segs(out[1]!)).toEqual(['**x**  y:bg,accent']);
    expect(plain(markdownLines('```\nоткрыт', 30))).toEqual(['открыт']);
  });

  it('пустые строки сохраняются, длинные слова режутся, ширина не превышена', () => {
    const out = plain(markdownLines('раз\n\nодинадцатьсимволов **жирный** конец', 8));
    expect(out[1]).toBe('');
    for (const line of out) expect(Array.from(line).length).toBeLessThanOrEqual(8);
    expect(out.join(' ')).toContain('жирный');
  });

  it('обычный текст без разметки переносится как раньше', () => {
    expect(plain(markdownLines('Сырой воздух пахнет воском и гнилью.', 20, 'dm'))).toEqual(['Сырой воздух пахнет', 'воском и гнилью.']);
  });
});
