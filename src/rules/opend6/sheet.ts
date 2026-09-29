// Лист персонажа для интерфейса: система-независимое представление (SheetView), которое рисует панель «Лист».
import { formatDieCode, parseDieCode, toPips } from './dice';
import type { Entity } from '../../engine/types';
import type { Lang, SheetView } from '../api';
import { attributeCode, readCharacter, skillCode, strengthDamage, woundLevel, type WoundLevel } from './character';
import { getVariant } from './data';

export const WOUND_NAMES: Record<WoundLevel, { ru: string; en: string }> = {
  healthy: { ru: 'здоров', en: 'healthy' },
  bruised: { ru: 'ушиб', en: 'bruised' },
  stunned: { ru: 'оглушён', en: 'stunned' },
  wounded: { ru: 'ранен', en: 'wounded' },
  'severely-wounded': { ru: 'тяжело ранен', en: 'severely wounded' },
  incapacitated: { ru: 'недееспособен', en: 'incapacitated' },
  'mortally-wounded': { ru: 'при смерти', en: 'mortally wounded' },
  dead: { ru: 'мёртв', en: 'dead' },
};

const L = {
  attrs: { ru: 'Характеристики', en: 'Attributes' },
  skills: { ru: 'Навыки', en: 'Skills' },
  health: { ru: 'Здоровье', en: 'Health' },
  points: { ru: 'Очки', en: 'Points' },
  other: { ru: 'Прочее', en: 'Other' },
  body: { ru: 'Очки тела', en: 'Body Points' },
  wound: { ru: 'Состояние', en: 'Condition' },
  cp: { ru: 'Очки персонажа', en: 'Character Points' },
  fp: { ru: 'Очки судьбы', en: 'Fate Points' },
  move: { ru: 'Движение', en: 'Move' },
  meters: { ru: 'м/раунд', en: 'm/round' },
  sd: { ru: 'Сила удара', en: 'Strength Damage' },
  funds: { ru: 'Средства', en: 'Funds' },
  silver: { ru: 'Серебро', en: 'Silver' },
  traits: { ru: 'Особенности', en: 'Traits' },
  advantage: { ru: 'Преимущество', en: 'Advantage' },
  disadvantage: { ru: 'Недостаток', en: 'Disadvantage' },
  ability: { ru: 'Способность', en: 'Ability' },
};

export function buildSheet(entity: Entity, lang: Lang): SheetView {
  const parsed = readCharacter(entity);
  if (!parsed.ok) return { title: entity.name, sections: [{ heading: lang === 'ru' ? 'Ошибка' : 'Error', rows: [{ label: '', value: parsed.error }] }] };
  const data = parsed.value;
  const variant = getVariant(data.variant)!;

  const attrRows = variant.attributes
    .filter((a) => !a.extranormal || toPips(attributeCode(data, a.id)) > 0)
    .map((a) => ({ label: a.name[lang], value: formatDieCode(attributeCode(data, a.id)) }));

  const skillRows = variant.attributes.flatMap((a) =>
    a.skills
      .filter((s) => data.skills[s.id] !== undefined)
      .map((s) => ({ label: s.name[lang], value: formatDieCode(skillCode(data, variant, s.id)!), hint: `${a.name[lang]} +${formatDieCode(parseDieCode(data.skills[s.id]!))}` })),
  );

  const level = woundLevel(data.body.points, data.body.max);
  const penalty = level.penaltyDice > 0 ? ` (−${level.penaltyDice}D)` : '';
  return {
    title: `${entity.name}${data.concept ? ` — ${data.concept}` : ''}`,
    sections: [
      { heading: L.attrs[lang], rows: attrRows },
      { heading: L.skills[lang], rows: skillRows },
      {
        heading: L.health[lang],
        brief: true,
        rows: [
          { label: L.body[lang], value: `${data.body.points}/${data.body.max}` },
          { label: L.wound[lang], value: `${WOUND_NAMES[level.id][lang]}${penalty}` },
        ],
      },
      {
        heading: L.points[lang],
        brief: true,
        rows: [
          { label: L.cp[lang], value: String(data.points.cp) },
          { label: L.fp[lang], value: String(data.points.fp) },
        ],
      },
      {
        heading: L.other[lang],
        rows: [
          { label: L.move[lang], value: `${data.move} ${L.meters[lang]}` },
          { label: L.sd[lang], value: formatDieCode(strengthDamage(attributeCode(data, 'physique'))) },
          ...(data.funds ? [{ label: L.funds[lang], value: data.funds }] : []),
          ...(data.silver !== undefined ? [{ label: L.silver[lang], value: String(data.silver) }] : []),
        ],
      },
      ...(data.traits.length > 0
        ? [{ heading: L.traits[lang], rows: data.traits.map((t) => ({ label: `${t.name[lang]}${t.rank ? ` R${t.rank}` : ''}`, value: L[t.kind][lang], hint: t.text[lang], block: true })) }]
        : []),
    ],
  };
}
