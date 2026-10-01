// Хроника кампании из журнала коммитов: реплики игрока, повествование Мастера, броски и варианты действий последнего хода.
// Чистая функция без сигналов: лента после перезагрузки страницы строится так же, как после хода.
import { effectiveCommits } from '../engine/commits';
import type { Commit, RollRecord } from '../engine/types';
import type { RollView } from '../rules/api';
import type { Entry } from './chronicle';

const BLANK: Entry = { text: '', fg: 'dm' };
const NOTE_MARK = '· ';

const ROLL_MARK = '♦ ';
const ROLL_BAR = '│ ';

/** Как описать бросок для ленты: по умолчанию — модуль правил (`RulesModule.describeRoll`), имя бросавшего подставляется из состояния. */
export type RollDescriber = (roll: RollRecord, actorName: string | undefined) => RollView;

const plainDescriber: RollDescriber = (roll) => ({ head: roll.reason, dice: roll.roll['total'] === undefined ? [] : [{ text: `= ${String(roll.roll['total'])}`, kind: 'plain' }] });

/** Цвета видов кубов: обычные белым, Wild Die жёлтым, дополнительный Wild Die (за Очко персонажа) цветом магии. */
const DICE_TOKEN = { die: 'fgBright', wild: 'accent2', extra: 'magic', plain: 'fgDim' } as const;

/** Блок броска: заголовок (кто, что проверяет, зачем), значение с баффами и дебаффами, кубы, исход. Строки блока под заголовком помечены `│`. */
function rollEntries(roll: RollRecord, actorName: string | undefined, describe: RollDescriber): Entry[] {
  const v = describe(roll, actorName);
  return [
    { text: `${ROLL_MARK}${v.head}`, fg: 'accent' },
    ...(v.value ? [{ text: `${ROLL_BAR}${v.value}`, fg: 'fgDim' as const, hang: ROLL_BAR }] : []),
    ...(v.mods ? [{ text: `${ROLL_BAR}${v.mods}`, fg: 'fgDim' as const, hang: ROLL_BAR }] : []),
    ...(v.dice.length > 0
      ? [{ text: `${ROLL_BAR}${v.dice.map((d) => d.text).join('')}`, fg: 'fgDim' as const, hang: ROLL_BAR, spans: [{ text: ROLL_BAR, fg: 'fgDim' as const }, ...v.dice.map((d) => ({ text: d.text, fg: DICE_TOKEN[d.kind] }))] }]
      : []),
    ...(v.verdict ? [{ text: `${ROLL_BAR}${v.verdict.success ? '✓' : '×'} ${v.verdict.text}`, fg: v.verdict.success ? ('success' as const) : ('failure' as const), hang: ROLL_BAR }] : []),
  ];
}

/** Варианты действий, которые сейчас показаны под лентой: из последнего действующего хода Мастера. */
export function lastSuggestions(commits: readonly Commit[]): string[] {
  const last = effectiveCommits(commits).filter((c) => c.kind === 'turn').at(-1);
  return last?.events.flatMap((e) => (e.t === 'turn.ended' ? e.suggestions : [])) ?? [];
}

/**
 * Игрок ввёл номер варианта («2», «2.», «№2») — вместо него уходит текст этого варианта: модель номер без списка не понимает.
 * Только голый номер из показанного списка; всё прочее (число в предложении, номер вне списка) отправляется как написано.
 */
export function resolveChoice(typed: string, options: readonly string[]): string {
  const match = /^(?:№|#)?\s*([1-9]\d?)\s*[.)]?$/.exec(typed.trim());
  return (match ? options[Number(match[1]) - 1] : undefined) ?? typed;
}

/** Записи хроники по журналу: ходы Мастера и заметки о бытовых действиях игрока. `prompt` — приглашение перед репликой игрока («Вы>»). Броски Мастера (`visibility: 'dm'`) не показываются. */
export function entriesFromCommits(commits: readonly Commit[], prompt: string, describe: RollDescriber = plainDescriber): Entry[] {
  const effective = effectiveCommits(commits);
  // Имена персонажей из событий создания: подпись «кто бросал» в блоке броска.
  const names = new Map(effective.flatMap((c) => c.events.flatMap((e) => (e.t === 'entity.created' ? [[e.entity.id, e.entity.name] as const] : []))));
  const out: Entry[] = [];
  for (const c of effective) {
    if (c.kind !== 'turn' && c.kind !== 'ui_action') continue;
    for (const e of c.events) {
      if (e.t === 'intent') out.push(BLANK, { text: `${prompt} ${e.text}`, fg: 'player' });
      else if (e.t === 'narration' && (e.speaker === undefined || e.speaker === 'dm')) out.push(BLANK, { text: e.text, fg: 'dm', md: true });
      else if (e.t === 'roll' && e.visibility === 'all') {
        const last = out.at(-1);
        if (last && !('text' in last && last.text === '')) out.push(BLANK); // пустая строка отделяет бросок от реплики игрока и от предыдущего блока
        out.push(...rollEntries(e, e.actorId ? names.get(e.actorId) : undefined, describe));
      }
      else if (e.t === 'note') {
        const last = out.at(-1);
        if (!last || !('text' in last) || !last.text.startsWith(NOTE_MARK)) out.push(BLANK);
        out.push({ text: `${NOTE_MARK}${e.text}`, fg: 'system' });
      }
    }
  }
  const suggestions = lastSuggestions(commits);
  if (suggestions.length > 0) out.push(BLANK, { key: 'game.suggestions', fg: 'fgDim' }, ...suggestions.map<Entry>((s, i) => ({ text: `${i + 1}. ${s}`, fg: 'accent' })));
  return out;
}
