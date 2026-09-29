// Создание персонажа из шаблона: выбор шаблона, раскладка 7D навыков, проверка по правилам (OpenD6: adventure p.10–12).
import { formatDieCode, fromPips } from './dice';
import { fail, ok, type CharacterCreation, type CreationBudget, type CreationInput, type CreationTemplate } from '../api';
import { attributeCode, CREATION_SKILL_MAX_PIPS, CREATION_SKILL_PIPS, readCharacter, validateSkills } from './character';
import { findSkill, getVariant } from './data';
import { findTemplate, templateData, templateEntity, templatesFor } from './templates';

const HERO_ID = 'hero';
const NAME_MAX = 40;

function templateView(variantId: string, tplId: string): CreationTemplate | undefined {
  const tpl = findTemplate(variantId, tplId);
  const variant = getVariant(variantId);
  if (!tpl || !variant) return undefined;
  const data = templateData(tpl, 'ru');
  return {
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    attributes: variant.attributes.filter((a) => tpl.attributes[a.id] !== undefined).map((a) => ({ name: a.name, code: tpl.attributes[a.id]! })),
    traits: tpl.traits.map((x) => ({ ru: `${x.name.ru}${x.rank ? ` R${x.rank}` : ''}`, en: `${x.name.en}${x.rank ? ` R${x.rank}` : ''}` })),
    skills: tpl.suggestedSkills.flatMap((id) => {
      const ref = findSkill(variant, id);
      return ref ? [{ id, name: ref.skill.name, attribute: ref.attribute.name, base: formatDieCode(attributeCode(data, ref.attribute.id)) }] : [];
    }),
  };
}

export const creation: CharacterCreation = {
  templates: (variant) => templatesFor(variant).flatMap((t) => templateView(variant, t.id) ?? []),

  budget: (): CreationBudget => ({
    total: CREATION_SKILL_PIPS,
    maxPerSkill: CREATION_SKILL_MAX_PIPS,
    maxNameLength: NAME_MAX,
    // Меньше кубика — просто пипы («+2»), иначе код кубов («+1D+2»).
    format: (points) => (points <= 0 ? '' : points < 3 ? `+${points}` : `+${formatDieCode(fromPips(points))}`),
  }),

  build(input: CreationInput) {
    const tpl = findTemplate(input.variant, input.templateId);
    if (!tpl) return fail(input.lang === 'ru' ? `Нет шаблона «${input.templateId}» в варианте ${input.variant}` : `No template "${input.templateId}" in variant ${input.variant}`);
    const name = input.name.trim();
    if (!name) return fail(input.lang === 'ru' ? 'Введите имя героя' : 'Enter the hero’s name');
    if (Array.from(name).length > NAME_MAX) return fail(input.lang === 'ru' ? `Имя не длиннее ${NAME_MAX} символов` : `The name is at most ${NAME_MAX} characters`);

    const skills: Record<string, string> = {};
    for (const [id, points] of Object.entries(input.skills)) {
      if (points === 0) continue;
      if (!Number.isInteger(points) || points < 0) return fail(input.lang === 'ru' ? `Некорректные очки навыка «${id}»` : `Invalid points for skill "${id}"`);
      if (!tpl.suggestedSkills.includes(id)) return fail(input.lang === 'ru' ? `Навык «${id}» не входит в шаблон «${tpl.name.ru}»` : `Skill "${id}" is not part of the "${tpl.name.en}" template`);
      skills[id] = formatDieCode(fromPips(points));
    }
    const data = templateData(tpl, input.lang, skills);
    const report = validateSkills(data, input.lang);
    if (report.errors.length > 0) return fail(report.errors.join('; '));

    const entity = templateEntity(tpl, { id: HERO_ID, name, lang: input.lang, skills, ...(input.ownerUid ? { ownerUid: input.ownerUid } : {}) });
    const check = readCharacter(entity);
    return check.ok ? ok(entity) : fail(check.error);
  },
};
