// Простой NPC для соло-игры без бестиария (M1): все обычные характеристики одного уровня, навыки — по характеристике.
import { formatDieCode } from './dice';
import type { Entity } from '../../engine/types';
import { fail, ok, type NpcInput, type NpcTier, type Result } from '../api';
import { characterEntity, type CharacterData } from './character';
import { getVariant } from './data';

/** Кубы всех характеристик по уровню: слабый 2D, обычный 3D, сильный 4D, элитный 5D. */
const TIER_DICE: Record<NpcTier, number> = { weak: 2, average: 3, strong: 4, elite: 5 };

export const NPC_TIERS = Object.keys(TIER_DICE) as NpcTier[];

/** Очки тела: среднее значение броска Телосложения + 20 (OpenD6: adventure p.15). */
const bodyPoints = (dice: number): number => Math.floor(dice * 3.5) + 20;

export function createNpc(variantId: string, input: NpcInput): Result<Entity> {
  const variant = getVariant(variantId);
  if (!variant) return fail(`Нет варианта ${variantId}`);
  const dice = TIER_DICE[input.tier];
  const code = formatDieCode({ dice, pips: 0 });
  const attributes: Record<string, string> = {};
  for (const a of variant.attributes) if (!a.extranormal) attributes[a.id] = code;
  const max = bodyPoints(dice);
  const data: CharacterData = {
    variant: variant.id,
    attributes,
    skills: {},
    body: { points: max, max },
    move: 10,
    points: { cp: 0, fp: 0 },
    traits: [],
    ...(input.role ? { concept: input.role } : {}),
  };
  return ok(characterEntity({ id: input.id, name: input.name, kind: 'npc', data }));
}
