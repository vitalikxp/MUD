import { navigate } from '../../app/router';
import { paletteId } from '../../app/settings';
import { locale, t } from '../../i18n';
import { PALETTES, TOKENS, getPalette } from '../../theme/palettes';
import { FKeyBar, useFKeys, type FKey } from '../tui/FKeyBar';
import { Panel } from '../tui/Panel';
import type { ScreenInfo } from '../tui/Screen';
import { Row, TextView } from '../tui/TextView';
import { bar, frame, separator } from '../tui/text';
import type { Line } from '../tui/types';

const GROUPS: { key: 'glyphs.cyrillic' | 'glyphs.latin' | 'glyphs.symbols'; rows: string[] }[] = [
  { key: 'glyphs.cyrillic', rows: ['АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'] },
  { key: 'glyphs.latin', rows: ['ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz', '0123456789 !?.,:;()[]{}<>/\\|+-*=_#@&%$"\''] },
  { key: 'glyphs.symbols', rows: ['·•♦♥♣♠✓→←↑↓≥≤−×…«»—–№'] },
];

/** Страница проверки шрифта: глифы, рамки, блоки и все токены палитры (docs/07: /dev/glyphs). */
export function GlyphsScreen({ screen }: { screen: ScreenInfo }) {
  const { cols, rows } = screen;
  const loc = locale.value;
  const fkeys: FKey[] = [
    { n: 8, label: t('fkeys.palette'), action: () => {
      const i = PALETTES.findIndex((p) => p.id === paletteId.value);
      paletteId.value = PALETTES[(i + 1) % PALETTES.length]!.id;
    } },
    { n: 10, label: t('fkeys.back'), action: () => navigate({ page: 'title' }) },
  ];
  useFKeys(fkeys);

  const lines: Line[] = [[{ text: t('glyphs.intro'), fg: 'fgDim' }], []];
  for (const g of GROUPS) {
    lines.push([{ text: t(g.key), fg: 'title' }]);
    for (const r of g.rows) lines.push([{ text: r }]);
    lines.push([]);
  }
  // Рамки: одинарная и двойная рядом, с разделителями — стыки не должны расходиться.
  lines.push([{ text: `${t('glyphs.boxSingle')} / ${t('glyphs.boxDouble')}`, fg: 'title' }]);
  const single = frame(14, 5, 'single', { title: 'Ab' });
  const double = frame(14, 5, 'double', { title: 'Яж' });
  single[2] = separator(14, 'single');
  double[2] = separator(14, 'double');
  const joints = ['', '┌─┬─┐ ╔═╦═╗ ╒═╤═╕ ╓─╥─╖', '├─┼─┤ ╠═╬═╣ ╞═╪═╡ ╟─╫─╢', '└─┴─┘ ╚═╩═╝ ╘═╧═╛ ╙─╨─╜', ''];
  for (let i = 0; i < 5; i++) lines.push([{ text: single[i]!, fg: 'frame' }, { text: '  ' }, { text: double[i]!, fg: 'frameActive' }, { text: `  ${joints[i]}` }]);
  lines.push([]);
  lines.push([{ text: t('glyphs.blocks'), fg: 'title' }]);
  lines.push([{ text: '█▓▒░ ▀▄▌▐ ' }, { text: bar(11, 16, 16), fg: 'hp' }, { text: ' ' }, { text: bar(3, 16, 16), fg: 'hpLow' }]);
  for (let i = 0; i < 3; i++) lines.push([{ text: '████████████████████', fg: 'accent' }]);

  const palette = getPalette(paletteId.value);
  const swatches: Line[] = TOKENS.map((tk) => [
    { text: '██', fg: tk },
    { text: ` ${tk.padEnd(12)}`, fg: 'fgDim' },
    { text: palette.colors[tk], fg: tk === 'bg' || tk === 'bgAlt' || tk === 'bgPanel' || tk === 'mapFog' || tk === 'selBg' ? 'fg' : tk },
  ]);

  const h = rows - 1;
  const leftW = screen.mobile ? cols : Math.min(cols - 28, Math.max(60, Math.floor(cols * 0.7)));
  return (
    <>
      <Panel x={0} y={0} w={leftW} h={h} title={`${t('panels.glyphs')} · PxPlus IBM VGA 9x16`} active>
        <TextView lines={lines} width={leftW - 2} height={h - 2} anchor="top" />
      </Panel>
      {!screen.mobile ? (
        <Panel x={leftW} y={0} w={cols - leftW} h={h} title={`${t('panels.swatches')} · ${palette.name[loc]}`}>
          <div class="tui-text">
            {swatches.slice(0, h - 2).map((l, i) => <Row key={i} line={l} width={cols - leftW - 2} />)}
          </div>
        </Panel>
      ) : null}
      <FKeyBar keys={fkeys} y={rows - 1} cols={cols} />
    </>
  );
}
