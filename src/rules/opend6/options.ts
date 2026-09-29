// Параметры кампании OpenD6. Ядро передаёт их как обычный JSON (`RulesCtx.options`), модуль читает и подставляет значения по умолчанию.
import type { Json } from '../../engine/types';
import type { WildOne } from './dice';

export interface OpenD6Options {
  /** Что делать с единицей на первом Wild Die (решает Мастер по умолчанию; OpenD6: adventure p.47). */
  wildOne: WildOne;
  /** Больше стольких Очков персонажа на один бросок тратить нельзя (OpenD6: adventure p.48: 2 / 5 / без лимита). */
  cpMaxPerRoll: number;
  /** Разрешить CP и FP в одном броске («cinematic», OpenD6: adventure p.47). */
  cinematic: boolean;
}

export const DEFAULT_OPTIONS: OpenD6Options = { wildOne: 'complication', cpMaxPerRoll: 5, cinematic: false };

/** Берёт из сырых параметров только известные значения правильного типа. */
export function resolveOptions(raw: Readonly<Record<string, Json>>): OpenD6Options {
  const wildOne = raw['wildOne'];
  const cp = raw['cpMaxPerRoll'];
  const cinematic = raw['cinematic'];
  return {
    wildOne: wildOne === 'cancel' || wildOne === 'complication' ? wildOne : DEFAULT_OPTIONS.wildOne,
    cpMaxPerRoll: typeof cp === 'number' && Number.isFinite(cp) && cp >= 0 ? cp : DEFAULT_OPTIONS.cpMaxPerRoll,
    cinematic: typeof cinematic === 'boolean' ? cinematic : DEFAULT_OPTIONS.cinematic,
  };
}
