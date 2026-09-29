// Модуль правил OpenD6 (OGL 1.0a; см. src/rules/opend6/LICENSE). Собирает механику в интерфейс RulesModule.
import type { Entity } from '../../engine/types';
import type { RulesModule } from '../api';
import { check, contest } from './checks';
import { creation } from './creation';
import { deriveStats } from './character';
import { applyDamage, awardPoints, heal } from './damage';
import { ADVENTURE, FANTASY } from './data';
import { lookup, promptPrimer } from './primer';
import { buildSheet } from './sheet';

export const OPEND6_VERSION = '0.1.0';

export const opend6: RulesModule = {
  id: 'opend6',
  version: OPEND6_VERSION,
  name: { ru: 'OpenD6', en: 'OpenD6' },
  variants: [FANTASY, ADVENTURE].map((v) => ({
    id: v.id,
    name: v.name,
    initiativeAttribute: v.initiativeAttribute,
    attributes: v.attributes.map((a) => ({ id: a.id, name: a.name, extranormal: a.extranormal ?? false, skills: a.skills })),
  })),

  creation,

  derive(entity: Entity) {
    const r = deriveStats(entity);
    if (!r.ok) throw new Error(r.error);
    return r.value;
  },
  sheet: buildSheet,

  check,
  contest,
  applyDamage,
  heal,
  awardPoints,

  promptPrimer: (variant) => promptPrimer(variant),
  lookup,
};

export * from './catalog';
export * from './character';
export * from './data';
export * from './templates';
