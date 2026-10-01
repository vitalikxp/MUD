// Evals Мастера (docs/04-ai-dm.md#evals): сценарий = подготовка состояния + ходы игрока + проверки результата каждого хода.
import type { Entity, GameEvent } from '../src/engine/types';
import type { Usage } from '../src/llm/types';
import type { NarrationSettings } from '../src/dm/prompts/style';
import type { ToolTrace } from '../src/dm/types';
import type { Lang } from '../src/rules/api';

/** Что произошло за один ход на реальной модели (или ошибка, если ход не удался). */
export interface TurnResult {
  /** Реплика игрока (или `/start` для открытия). */
  input: string;
  tools: ToolTrace[];
  /** События коммита хода: повествование, броски, изменения. */
  events: GameEvent[];
  /** Всё повествование хода одной строкой. */
  text: string;
  suggestions: string[];
  autoClosed: boolean;
  iterations: number;
  ms: number;
  usage: Usage;
  heroBefore: Entity;
  heroAfter: Entity;
  lang: Lang;
  /** Длина и стиль, с которыми шёл ход (`DM_LENGTH`, `DM_STYLE`); нет в старых отчётах — тогда по умолчанию. */
  narration?: NarrationSettings;
  /** Ход не удался (ошибка провайдера, лимит шагов, ошибки инструментов подряд): остальные поля пустые. */
  error?: string;
}

export interface CheckResult {
  name: string;
  ok: boolean;
  /** Мягкая проверка: провал — предупреждение (качество текста), а не провал сценария. */
  soft: boolean;
  detail?: string;
}

export type Check = (r: TurnResult) => CheckResult;

export type Action = { kind: 'opening' } | { kind: 'player'; text: string };

/** Шаг подготовки: выполняется до хода на реальной модели и детерминирован (заглушка LLM или бытовое действие). */
export type Prelude =
  | { kind: 'scripted'; action: Action; steps: { text?: string; calls?: { name: string; args: unknown }[] }[] }
  | { kind: 'equip'; itemId: string };

export interface EvalTurn {
  action: Action;
  checks: Check[];
}

export interface Scenario {
  id: string;
  title: string;
  /** Что проверяем и по какому правилу промпта. */
  rule: string;
  lang?: Lang;
  hero?: { templateId: string; name: string; skills: Record<string, number> };
  prelude?: Prelude[];
  turns: EvalTurn[];
}
