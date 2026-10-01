import type { NarrationSettings } from './prompts/style';
import type { Commit } from '../engine/types';
import type { Completion } from '../llm/client';
import type { ChatRequest, ReasoningEffort, ToolDef, Usage } from '../llm/types';
import type { Lang, RulesOptions } from '../rules/api';

export type { ToolDef as LlmToolDef } from '../llm/types';

/** Что запускает ход: реплика игрока или открытие игры, когда игрок ещё ничего не писал. */
export type TurnInput =
  | { kind: 'player'; text: string; uid: string; charId: string }
  | { kind: 'opening'; charId: string };

/** Вызов LLM. В приложении это `complete` из `src/llm/client.ts` с настройками игрока; в тестах — заглушка. */
export type LlmCall = (req: ChatRequest, onText?: (delta: string) => void) => Promise<Completion>;

export type TurnProgress =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string; args: unknown; result?: unknown; error?: string };

export interface TurnDeps {
  llm: LlmCall;
  model: string;
  maxOutputTokens: number;
  reasoningEffort?: ReasoningEffort;
  signal?: AbortSignal;
  narrationLang: Lang;
  /** Длина и стиль повествования (настройки игрока); без них — по умолчанию. */
  narration?: NarrationSettings;
  campaignTitle: string;
  variant: string;
  options: RulesOptions;
  paletteIds: readonly string[];
  /** Коммиты журнала (для истории диалога). */
  commits: readonly Commit[];
  onProgress?: (p: TurnProgress) => void;
  /** Лимиты цикла (ADR-0018, docs/04-ai-dm.md): по умолчанию 12 итераций и 3 ошибки подряд. */
  maxIterations?: number;
  maxConsecutiveErrors?: number;
}

export interface ToolTrace {
  name: string;
  arguments: string;
  ok: boolean;
  result?: unknown;
  error?: string;
}

export interface TurnReport {
  promptVersion: string;
  iterations: number;
  tools: ToolTrace[];
  usage: Usage;
  /** Модель не вызвала end_turn даже после напоминания: ход закрыт движком. */
  autoClosed: boolean;
  ms: number;
}

export type TurnErrorKind = 'validation' | 'limit';

export class TurnError extends Error {
  constructor(
    readonly kind: TurnErrorKind,
    message: string,
    readonly trace: ToolTrace[] = [],
  ) {
    super(message);
    this.name = 'TurnError';
  }
}

export type { ToolDef };
