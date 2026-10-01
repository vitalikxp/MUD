// Хроника кампании из журнала коммитов: реплики игрока, повествование Мастера, броски и варианты действий последнего хода.
// Чистая функция без сигналов: лента после перезагрузки страницы строится так же, как после хода.
import { effectiveCommits } from '../engine/commits';
import type { Commit, GameEvent } from '../engine/types';
import type { Entry } from './chronicle';

const BLANK: Entry = { text: '', fg: 'dm' };
const NOTE_MARK = '· ';

function rollLine(e: Extract<GameEvent, { t: 'roll' }>): Entry {
  const code = typeof e.roll['code'] === 'string' ? e.roll['code'] : typeof e.roll['expr'] === 'string' ? e.roll['expr'] : '';
  const total = e.roll['total'] === undefined ? '' : ` = ${String(e.roll['total'])}`;
  const verdict = e.success === undefined ? '' : ` ${e.difficulty !== undefined ? `≥ ${e.difficulty} ` : ''}${e.success ? '✓' : '✗'}`;
  return { text: `♦ ${e.reason}${code ? ` ${code}` : ''}${total}${verdict}`, fg: e.success === undefined ? 'accent' : e.success ? 'success' : 'failure' };
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
export function entriesFromCommits(commits: readonly Commit[], prompt: string): Entry[] {
  const effective = effectiveCommits(commits);
  const out: Entry[] = [];
  for (const c of effective) {
    if (c.kind !== 'turn' && c.kind !== 'ui_action') continue;
    for (const e of c.events) {
      if (e.t === 'intent') out.push(BLANK, { text: `${prompt} ${e.text}`, fg: 'player' });
      else if (e.t === 'narration' && (e.speaker === undefined || e.speaker === 'dm')) out.push(BLANK, { text: e.text, fg: 'dm', md: true });
      else if (e.t === 'roll' && e.visibility === 'all') out.push(rollLine(e));
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
