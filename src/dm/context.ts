// Сборка контекста хода (docs/04-ai-dm.md, «Сборка контекста»). В M1: блоки 1–3 (системный промпт, праймер, библия кампании),
// 6–7 (отряд и сцена), 9 (последние события дословно) и 10 (заявка). Память (сводки, лор, реестр выборов) появится в M2.
import { effectiveCommits } from '../engine/commits';
import type { Commit, GameState } from '../engine/types';
import type { Message } from '../llm/types';
import type { Lang, RulesModule } from '../rules/api';
import { openingInstruction, systemPrompt } from './prompts/system';
import { DEFAULT_NARRATION, type NarrationSettings } from './prompts/style';
import type { TurnInput } from './types';

/** Бюджет истории диалога в символах (≈ 6k токенов при 3.5 символа на токен). */
export const HISTORY_BUDGET_CHARS = 21_000;
const MECHANICS_LINES = 8;

interface ContextInput {
  rules: RulesModule;
  variant: string;
  narrationLang: Lang;
  /** Длина и стиль повествования из настроек игрока. */
  narration?: NarrationSettings;
  campaignTitle: string;
  state: GameState;
  commits: readonly Commit[];
  input: TurnInput;
  historyBudgetChars?: number;
}

/** Блоки 1–3: стабильная часть, одинаковая от хода к ходу (работает кэш промпта). */
export function systemMessage(i: Pick<ContextInput, 'rules' | 'variant' | 'narrationLang' | 'narration' | 'campaignTitle' | 'state'>): string {
  const world = i.state.flags['world'];
  return [
    systemPrompt(i.narrationLang, i.narration ?? DEFAULT_NARRATION),
    i.rules.promptPrimer(i.variant, 'en'),
    [
      'CAMPAIGN',
      `Title: ${i.campaignTitle}`,
      `Rating: 16+ by default (violence without relish, intimate scenes off-screen).`,
      typeof world === 'string' && world ? `World notes (canon):\n${world}` : 'World notes: none yet — the world has not been established.',
    ].join('\n'),
  ].join('\n\n');
}

const narrationOf = (c: Commit): string =>
  c.events.flatMap((e) => (e.t === 'narration' && (e.speaker === undefined || e.speaker === 'dm') ? [e.text] : [])).join('\n\n');

const intentOf = (c: Commit): string => c.events.flatMap((e) => (e.t === 'intent' ? [e.text] : [])).join('\n');

/** Блок 9: прошлые ходы как диалог «игрок → Мастер», самые старые отбрасываются по бюджету. */
export function historyMessages(commits: readonly Commit[], budgetChars: number): Message[] {
  const pairs: { user: string; assistant: string }[] = [];
  for (const c of effectiveCommits(commits)) {
    if (c.kind !== 'turn') continue;
    const assistant = narrationOf(c);
    if (!assistant) continue;
    pairs.push({ user: intentOf(c) || '(the campaign begins)', assistant });
  }
  const kept: typeof pairs = [];
  let used = 0;
  for (const p of pairs.toReversed()) {
    used += p.user.length + p.assistant.length;
    if (used > budgetChars && kept.length > 0) break;
    kept.push(p);
  }
  return kept.toReversed().flatMap((p) => [{ role: 'user' as const, content: p.user }, { role: 'assistant' as const, content: p.assistant }]);
}

/** Броски последнего хода одной строкой каждый — чтобы модель помнила исходы, не выдумывая числа. */
export function recentMechanics(commits: readonly Commit[]): string[] {
  const last = effectiveCommits(commits).filter((c) => c.kind === 'turn').at(-1);
  if (!last) return [];
  const lines: string[] = [];
  for (const e of last.events) {
    if (e.t !== 'roll') continue;
    const code = typeof e.roll['code'] === 'string' ? e.roll['code'] : typeof e.roll['expr'] === 'string' ? e.roll['expr'] : '';
    const verdict = e.success === undefined ? '' : e.success ? ` vs ${e.difficulty ?? '?'}: success` : ` vs ${e.difficulty ?? '?'}: failure`;
    lines.push(`- ${e.reason}: ${code} = ${String(e.roll['total'] ?? '?')}${verdict}`);
  }
  return lines.slice(-MECHANICS_LINES);
}

/** Бытовые действия игрока (надел, выбросил) после последнего хода Мастера: состояние уже изменено, Мастеру нужно об этом знать. */
export function pendingPlayerNotes(commits: readonly Commit[]): string[] {
  const effective = effectiveCommits(commits);
  const lastTurn = effective.findLastIndex((c) => c.kind === 'turn');
  return effective
    .slice(lastTurn + 1)
    .filter((c) => c.kind === 'ui_action')
    .flatMap((c) => c.events.flatMap((e) => (e.t === 'note' ? [e.text] : [])));
}

/** Блоки 6–7: отряд и сцена в текущем состоянии. */
export function stateBlock(rules: RulesModule, state: GameState, commits: readonly Commit[]): string {
  const scene = state.scene ? `${state.scene.name}${state.scene.description ? ` — ${state.scene.description}` : ''}` : 'not set';
  const entities = Object.values(state.entities);
  const mechanics = recentMechanics(commits);
  const notes = pendingPlayerNotes(commits);
  return [
    'CURRENT STATE',
    `Scene: ${scene}`,
    'Characters:',
    entities.map((e) => rules.describe(e)).join('\n') || '(none)',
    ...(notes.length > 0 ? ['Player actions since your last turn (already applied to the state; do not repeat their effects):', ...notes.map((n) => `- ${n}`)] : []),
    ...(mechanics.length > 0 ? ['Mechanics of the previous turn:', ...mechanics] : []),
  ].join('\n');
}

export function buildMessages(i: ContextInput): Message[] {
  const hero = i.state.entities[i.input.charId];
  const request =
    i.input.kind === 'opening'
      ? openingInstruction(hero?.name ?? 'the hero', (i.narration ?? DEFAULT_NARRATION).length)
      : `PLAYER (${hero?.name ?? 'hero'}): ${i.input.text}`;
  return [
    { role: 'system', content: systemMessage(i) },
    ...historyMessages(i.commits, i.historyBudgetChars ?? HISTORY_BUDGET_CHARS),
    { role: 'user', content: `${stateBlock(i.rules, i.state, i.commits)}\n\n${request}` },
  ];
}
