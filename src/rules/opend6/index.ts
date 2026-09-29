// Модуль правил OpenD6 (OGL 1.0a; см. src/rules/opend6/LICENSE). Собирает механику в интерфейс RulesModule.
import type { Entity } from '../../engine/types';
import type { RulesModule } from '../api';
import { check, contest } from './checks';
import { catalogFor, catalogItem, findCatalogEntry } from './catalog';
import { creation } from './creation';
import { describeForPrompt } from './describe';
import { createNpc, NPC_TIERS } from './npc';
import { deriveStats } from './character';
import { applyDamage, awardPoints, heal } from './damage';
import { ADVENTURE, FANTASY } from './data';
import { LOOKUP_TOPICS, lookup, promptPrimer } from './primer';
import { roll } from './roll';
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

  roll,
  check,
  contest,
  applyDamage,
  heal,
  awardPoints,

  npc: { tiers: NPC_TIERS, create: createNpc },
  describe: describeForPrompt,

  items: {
    ids: (variant) => catalogFor(variant).map((e) => e.id),
    make(variant, id, lang, qty) {
      const entry = findCatalogEntry(variant, id);
      return entry ? catalogItem(entry, variant, lang, qty) : undefined;
    },
    search(variant, query, lang, limit = 8) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const words = q.split(/\s+/);
      return catalogFor(variant)
        .filter((e) => {
          const hay = `${e.id} ${e.name.ru} ${e.name.en}`.toLowerCase();
          return words.every((w) => hay.includes(w));
        })
        .slice(0, limit)
        .map((e) => ({ id: e.id, name: e.name[lang], ...(e.price ? { price: e.price.level } : {}), ...(e.note ? { note: e.note[lang] } : {}) }));
    },
  },

  promptPrimer: (variant) => promptPrimer(variant),
  lookup,
  lookupTopics: LOOKUP_TOPICS,
};

export * from './catalog';
export * from './character';
export * from './data';
export * from './templates';
