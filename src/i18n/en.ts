import type { Dict } from './types';

export const en: Dict = {
  app: {
    name: 'SWRD',
    tagline: 'AI game master for tabletop role-playing',
  },
  fkeys: {
    help: 'Help',
    lang: 'Lang',
    font: 'Font',
    palette: 'Palette',
    glyphs: 'Glyphs',
    back: 'Back',
  },
  panels: {
    chronicle: 'Chronicle',
    palettes: 'Palette',
    status: 'Status',
    help: 'Help',
    glyphs: 'Glyph check',
    swatches: 'Palette tokens',
  },
  tabs: {
    chronicle: 'Chron',
    palettes: 'Palette',
    status: 'Status',
  },
  intro: {
    p1: 'Welcome to SWRD. Here an AI will run a tabletop role-playing game: it knows the rules, remembers the world and rolls the dice honestly.',
    p2: 'Right now this is the foundation (milestone M0): character grid, frames, palettes and fonts. The game master arrives in later milestones.',
    roll: '♦ Search 4D+1: 3 5 2 W6→4 +1 = 21 ≥ 15 ✓',
    p3: 'Try it: Tab switches panels, F8 palettes, F2 language, F3 font. Or type the /help command.',
  },
  input: {
    prompt: 'You>',
    placeholder: 'Type an action or a /command',
  },
  status: {
    grid: 'Grid',
    cell: 'Cell',
    scale: 'Scale',
    layout: 'Layout',
    desktop: 'desktop',
    mobile: 'mobile',
    palette: 'Palette',
    font: 'Font',
    lang: 'Lang',
  },
  fonts: {
    pxplus: 'PxPlus IBM VGA 9x16',
    jetbrains: 'JetBrains Mono',
  },
  msg: {
    palette: 'Palette: {name}',
    lang: 'Interface language: English',
    font: 'Font: {name}',
    unknown: 'Unknown command: {cmd}. See /help',
    echo: '{text}',
  },
  help: {
    title: 'Help',
    lines: [
      'Tab / Shift+Tab — switch the active panel',
      'F1 or Alt+1 — this help',
      'F2 or Alt+2 — language (RU/EN)',
      'F3 or Alt+3 — font',
      'F8 or Alt+8 — palettes',
      'F9 or Alt+9 — glyph check page',
      '/palette <id>, /lang ru|en, /font pxplus|jetbrains, /help',
      '',
      'Esc — close',
    ],
  },
  glyphs: {
    intro: 'Every glyph must sit on the grid and frames must join without gaps.',
    cyrillic: 'Cyrillic',
    latin: 'Latin and digits',
    boxSingle: 'Single frames',
    boxDouble: 'Double frames',
    blocks: 'Blocks and bars',
    symbols: 'Symbols',
  },
};
