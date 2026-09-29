// Тестовые персонажи. Только для тестов.
import { Draft } from '../../engine/commits';
import { initialState } from '../../engine/reducer';
import type { Rng } from '../../engine/rng';
import type { Entity } from '../../engine/types';
import type { RulesCtx } from '../api';
import type { OpenD6Options } from './options';
import { characterEntity, type CharacterData } from './character';

export const irmaData: CharacterData = {
  variant: 'fantasy',
  attributes: { agility: '3D+1', coordination: '3D', physique: '3D+1', intellect: '2D+2', acumen: '3D', charisma: '2D' },
  skills: { stealth: '1D', lockpicking: '1D+1', dodge: '1D', 'melee-combat': '1D' },
  body: { points: 30, max: 30 },
  move: 10,
  points: { cp: 5, fp: 1 },
  concept: 'Плутовка',
  traits: [],
};

export const irma = (over: Partial<CharacterData> = {}, items: Entity['items'] = []): Entity =>
  characterEntity({ id: 'irma', name: 'Ирма', ownerUid: 'u1', data: { ...irmaData, ...over }, items });

export function ctxWith(rng: Rng, entities: Entity[], options: Partial<OpenD6Options> = {}): RulesCtx {
  let state = initialState({ id: 'opend6', version: '0.1.0', variant: 'fantasy' });
  const d = new Draft(state, rng, 't');
  for (const entity of entities) d.emit({ t: 'entity.created', entity });
  state = d.state;
  return { state, rng, options: { ...options } };
}
