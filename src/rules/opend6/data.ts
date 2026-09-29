// Данные OpenD6: характеристики и навыки двух вариантов. Источники: D6 Adventure p.11–13 (PDF p.12–14), D6 Fantasy p.11–13 (PDF p.12–14).
// Названия на русском — рабочие термины проекта (docs/glossary.md).
import type { LocalizedText } from '../api';

export interface SkillDef {
  id: string;
  name: LocalizedText;
}

export interface AttributeDef {
  id: string;
  name: LocalizedText;
  /** Экстранормальная: без кубов по умолчанию, у навыков нет базы (adventure p.11). */
  extranormal?: boolean;
  skills: SkillDef[];
}

export interface VariantDef {
  id: VariantId;
  name: LocalizedText;
  attributes: AttributeDef[];
  /** Характеристика инициативы: Восприятие в Adventure (p.49), Смекалка в Fantasy (p.51). */
  initiativeAttribute: string;
}

export type VariantId = 'fantasy' | 'adventure';

const s = (id: string, ru: string, en: string): SkillDef => ({ id, name: { ru, en } });
const a = (id: string, ru: string, en: string, skills: SkillDef[], extranormal = false): AttributeDef => ({ id, name: { ru, en }, skills, ...(extranormal ? { extranormal } : {}) });

const MAGIC_SKILLS = [s('alteration', 'изменение', 'alteration'), s('apportation', 'перемещение', 'apportation'), s('conjuration', 'сотворение', 'conjuration'), s('divination', 'прорицание', 'divination')];

export const FANTASY: VariantDef = {
  id: 'fantasy',
  name: { ru: 'Фэнтези', en: 'Fantasy' },
  initiativeAttribute: 'acumen',
  attributes: [
    a('agility', 'Ловкость', 'Agility', [
      s('acrobatics', 'акробатика', 'acrobatics'), s('fighting', 'рукопашный бой', 'fighting'), s('climbing', 'лазание', 'climbing'), s('contortion', 'выскальзывание', 'contortion'),
      s('dodge', 'уклонение', 'dodge'), s('flying', 'полёт', 'flying'), s('jumping', 'прыжки', 'jumping'), s('melee-combat', 'ближний бой', 'melee combat'),
      s('riding', 'верховая езда', 'riding'), s('stealth', 'скрытность', 'stealth'),
    ]),
    a('coordination', 'Координация', 'Coordination', [
      s('charioteering', 'управление повозкой', 'charioteering'), s('lockpicking', 'взлом замков', 'lockpicking'), s('marksmanship', 'стрельба', 'marksmanship'),
      s('pilotry', 'судовождение', 'pilotry'), s('sleight-of-hand', 'ловкость рук', 'sleight of hand'), s('throwing', 'метание', 'throwing'),
    ]),
    a('physique', 'Телосложение', 'Physique', [s('lifting', 'поднятие тяжестей', 'lifting'), s('running', 'бег', 'running'), s('stamina', 'выносливость', 'stamina'), s('swimming', 'плавание', 'swimming')]),
    a('intellect', 'Интеллект', 'Intellect', [
      s('cultures', 'знание культур', 'cultures'), s('devices', 'механизмы', 'devices'), s('healing', 'врачевание', 'healing'), s('navigation', 'навигация', 'navigation'),
      s('reading-writing', 'грамота', 'reading/writing'), s('scholar', 'эрудиция', 'scholar'), s('speaking', 'речь', 'speaking'), s('trading', 'торговля', 'trading'), s('traps', 'ловушки', 'traps'),
    ]),
    a('acumen', 'Смекалка', 'Acumen', [
      s('artist', 'искусство', 'artist'), s('crafting', 'ремесло', 'crafting'), s('disguise', 'переодевание', 'disguise'), s('gambling', 'азартные игры', 'gambling'), s('hide', 'сокрытие', 'hide'),
      s('investigation', 'расследование', 'investigation'), s('know-how', 'сноровка', 'know-how'), s('search', 'наблюдательность', 'search'), s('streetwise', 'знание улиц', 'streetwise'),
      s('survival', 'выживание', 'survival'), s('tracking', 'выслеживание', 'tracking'),
    ]),
    a('charisma', 'Обаяние', 'Charisma', [
      s('animal-handling', 'обращение с животными', 'animal handling'), s('bluff', 'блеф', 'bluff'), s('charm', 'очарование', 'charm'), s('command', 'командование', 'command'),
      s('intimidation', 'запугивание', 'intimidation'), s('mettle', 'стойкость духа', 'mettle'), s('persuasion', 'убеждение', 'persuasion'),
    ]),
    a('magic', 'Магия', 'Magic', MAGIC_SKILLS, true),
    a('miracles', 'Чудеса', 'Miracles', [s('miracles-divination', 'божественное прорицание', 'divination (miracles)'), s('favor', 'милость', 'favor'), s('strife', 'кара', 'strife')], true),
  ],
};

export const ADVENTURE: VariantDef = {
  id: 'adventure',
  name: { ru: 'Приключения', en: 'Adventure' },
  initiativeAttribute: 'perception',
  attributes: [
    a('reflexes', 'Рефлексы', 'Reflexes', [
      s('acrobatics', 'акробатика', 'acrobatics'), s('brawling', 'драка', 'brawling'), s('climbing', 'лазание', 'climbing'), s('contortion', 'выскальзывание', 'contortion'),
      s('dodge', 'уклонение', 'dodge'), s('flying', 'полёт', 'flying'), s('jumping', 'прыжки', 'jumping'), s('melee-combat', 'ближний бой', 'melee combat'),
      s('riding', 'верховая езда', 'riding'), s('sneak', 'скрытность', 'sneak'),
    ]),
    a('coordination', 'Координация', 'Coordination', [
      s('lockpicking', 'взлом замков', 'lockpicking'), s('marksmanship', 'стрельба', 'marksmanship'), s('missile-weapons', 'стрельба из луков', 'missile weapons'),
      s('piloting', 'управление машиной', 'piloting'), s('sleight-of-hand', 'ловкость рук', 'sleight of hand'), s('throwing', 'метание', 'throwing'),
    ]),
    a('physique', 'Телосложение', 'Physique', [s('lifting', 'поднятие тяжестей', 'lifting'), s('running', 'бег', 'running'), s('stamina', 'выносливость', 'stamina'), s('swimming', 'плавание', 'swimming')]),
    a('knowledge', 'Знания', 'Knowledge', [
      s('business', 'торговое дело', 'business'), s('demolitions', 'подрывное дело', 'demolitions'), s('forgery', 'подделка', 'forgery'), s('languages', 'языки', 'languages'),
      s('medicine', 'медицина', 'medicine'), s('navigation', 'навигация', 'navigation'), s('scholar', 'эрудиция', 'scholar'), s('security', 'системы охраны', 'security'), s('tech', 'техника', 'tech'),
    ]),
    a('perception', 'Восприятие', 'Perception', [
      s('artist', 'искусство', 'artist'), s('gambling', 'азартные игры', 'gambling'), s('hide', 'сокрытие', 'hide'), s('investigation', 'расследование', 'investigation'),
      s('know-how', 'сноровка', 'know-how'), s('repair', 'ремонт', 'repair'), s('search', 'наблюдательность', 'search'), s('streetwise', 'знание улиц', 'streetwise'),
      s('survival', 'выживание', 'survival'), s('tracking', 'выслеживание', 'tracking'),
    ]),
    a('presence', 'Присутствие', 'Presence', [
      s('animal-handling', 'обращение с животными', 'animal handling'), s('charm', 'очарование', 'charm'), s('command', 'командование', 'command'), s('con', 'обман', 'con'),
      s('disguise', 'переодевание', 'disguise'), s('intimidation', 'запугивание', 'intimidation'), s('persuasion', 'убеждение', 'persuasion'), s('willpower', 'сила воли', 'willpower'),
    ]),
    a('magic', 'Магия', 'Magic', MAGIC_SKILLS, true),
    a('psionics', 'Псионика', 'Psionics', [
      s('astral-projection', 'астральная проекция', 'astral projection'), s('empathy', 'эмпатия', 'empathy'), s('far-sensing', 'дальнее чувство', 'far-sensing'), s('healing', 'исцеление разумом', 'healing'),
      s('medium', 'медиум', 'medium'), s('protection', 'защита разума', 'protection'), s('psychometry', 'психометрия', 'psychometry'), s('strike', 'психический удар', 'strike'),
      s('telekinesis', 'телекинез', 'telekinesis'), s('telepathy', 'телепатия', 'telepathy'),
    ], true),
  ],
};

export const VARIANTS: Record<VariantId, VariantDef> = { fantasy: FANTASY, adventure: ADVENTURE };

export function getVariant(id: string): VariantDef | undefined {
  return (VARIANTS as Record<string, VariantDef | undefined>)[id];
}

export interface SkillRef {
  attribute: AttributeDef;
  skill: SkillDef;
}

/** Найти навык по id в варианте. */
export function findSkill(variant: VariantDef, skillId: string): SkillRef | undefined {
  for (const attribute of variant.attributes) {
    const skill = attribute.skills.find((x) => x.id === skillId);
    if (skill) return { attribute, skill };
  }
  return undefined;
}

export const findAttribute = (variant: VariantDef, id: string): AttributeDef | undefined => variant.attributes.find((x) => x.id === id);
