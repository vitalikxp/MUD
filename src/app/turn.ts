// Ход Мастера в кампании: оркестратор (src/dm) + черновик + атомарный коммит (commitTurn). Без UI: экран игры (M1.6) вызывает `takeTurn`.
import { runTurn } from '../dm/orchestrator';
import { SYSTEM_PROMPT_VERSION } from '../dm/prompts/system';
import type { LlmCall, TurnInput, TurnProgress, TurnReport } from '../dm/types';
import type { ReasoningEffort } from '../llm/types';
import { commitTurn, heroOf, session } from './campaigns';
import { rulesModule } from './rules';

/** Что нужно ходу от настроек игрока. Собирается из настроек LLM (`dmConfig`) или подставляется в тестах и evals. */
export interface TurnConfig {
  llm: LlmCall;
  model: string;
  maxOutputTokens: number;
  reasoningEffort?: ReasoningEffort;
  signal?: AbortSignal;
  paletteIds: readonly string[];
  onProgress?: (p: TurnProgress) => void;
}

export type PlayerAction = { kind: 'player'; text: string } | { kind: 'opening' };

/**
 * Один ход: реплика игрока (или открытие игры) → Мастер → события → коммит. Если Мастер или сеть подвели, в журнал ничего не попадает
 * и ход можно повторить: генератор кубов остаётся на месте, поэтому повтор бросит те же кубы.
 */
export async function takeTurn(action: PlayerAction, config: TurnConfig): Promise<TurnReport> {
  const start = session.peek();
  if (!start) throw new Error('Нет открытой кампании');
  if (start.meta.phase !== 'play') throw new Error('Сначала создайте героя');
  const hero = heroOf(start.state);
  if (!hero) throw new Error('В кампании нет героя');
  const input: TurnInput = action.kind === 'opening' ? { kind: 'opening', charId: hero.id } : { kind: 'player', text: action.text, uid: hero.ownerUid ?? 'local', charId: hero.id };

  let report: TurnReport | undefined;
  await commitTurn(
    'turn',
    async (draft, current) => {
      report = await runTurn(draft, input, rulesModule, {
        llm: config.llm,
        model: config.model,
        maxOutputTokens: config.maxOutputTokens,
        ...(config.reasoningEffort ? { reasoningEffort: config.reasoningEffort } : {}),
        ...(config.signal ? { signal: config.signal } : {}),
        narrationLang: current.meta.narrationLang,
        campaignTitle: current.meta.title,
        variant: current.meta.rules.variant,
        options: {},
        paletteIds: config.paletteIds,
        commits: current.commits,
        ...(config.onProgress ? { onProgress: config.onProgress } : {}),
      });
    },
    { promptVersion: SYSTEM_PROMPT_VERSION },
  );
  return report!;
}
