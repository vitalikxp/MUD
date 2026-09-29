import { describe, expect, it } from 'vitest';
import { createRng } from '../../engine/rng';
import { scriptedRng } from '../../engine/testing';
import { toPips, parseDieCode } from './dice';
import { applyDamage, armorCode } from './damage';
import { readCharacter, validateCreation } from './character';
import { findSkill, getVariant } from './data';
import { ctxWith, irma } from './fixtures';
import { buildSheet } from './sheet';
import { TEMPLATES, findTemplate, templateData, templateEntity, templatesFor } from './templates';
import { deriveStats } from './character';

/** Strength Damage из книги (лист шаблона), для сверки формулы. */
const BOOK_STRENGTH_DAMAGE: Record<string, string> = {
  bodyguard: '2D', correspondent: '1D', doctor: '1D', 'field-scientist': '1D', 'reformed-thief': '1D', 'weapons-master': '2D',
  bard: '1D', gladiator: '2D', healer: '1D', 'monster-slayer': '2D', ranger: '2D', thief: '2D',
};

describe('шаблоны персонажей (adventure p.129–138, fantasy p.129–136)', () => {
  it('по шесть на вариант, id уникальны внутри варианта', () => {
    expect(templatesFor('fantasy')).toHaveLength(6);
    expect(templatesFor('adventure')).toHaveLength(6);
    for (const v of ['fantasy', 'adventure']) {
      const ids = templatesFor(v).map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
    expect(findTemplate('fantasy', 'bard')?.name.ru).toBe('Бард');
    expect(findTemplate('adventure', 'bard')).toBeUndefined();
  });

  for (const tpl of TEMPLATES) {
    describe(`${tpl.variant}/${tpl.id}`, () => {
      const variant = getVariant(tpl.variant)!;

      it('характеристики: 6 обычных, сумма 18D (в книге у Телохранителя 18D+1)', () => {
        const pips = Object.values(tpl.attributes).reduce((s, c) => s + toPips(parseDieCode(c)), 0);
        expect(Object.keys(tpl.attributes)).toHaveLength(6);
        expect(pips).toBe(tpl.id === 'bodyguard' ? 55 : 54);
      });

      it('все предложенные навыки существуют в варианте, повторов нет', () => {
        for (const id of tpl.suggestedSkills) expect(findSkill(variant, id), id).toBeDefined();
        expect(new Set(tpl.suggestedSkills).size).toBe(tpl.suggestedSkills.length);
      });

      it('данные проходят схему, Strength Damage совпадает с книгой, тексты RU и EN не пустые', () => {
        const entity = templateEntity(tpl, { id: 'hero', name: 'Герой', lang: 'ru' });
        expect(readCharacter(entity).ok).toBe(true);
        const derived = deriveStats(entity);
        expect(derived.ok && derived.value.strengthDamage).toBe(BOOK_STRENGTH_DAMAGE[tpl.id]);
        for (const t of [tpl.name, tpl.description, ...tpl.traits.flatMap((x) => [x.name, x.text]), ...tpl.items.map((i) => i.name)]) {
          expect(t.ru.length).toBeGreaterThan(0);
          expect(t.en.length).toBeGreaterThan(0);
        }
      });

      it('лист персонажа строится на обоих языках', () => {
        const entity = templateEntity(tpl, { id: 'hero', name: 'Герой', lang: 'en' });
        for (const lang of ['ru', 'en'] as const) {
          const sheet = buildSheet(entity, lang);
          expect(sheet.sections.map((s) => s.heading)).not.toContain(lang === 'ru' ? 'Ошибка' : 'Error');
          if (tpl.traits.length > 0) expect(sheet.sections.at(-1)!.rows).toHaveLength(tpl.traits.length);
        }
      });
    });
  }

  it('шаблон без навыков не проходит проверку 7D, а с распределёнными — проходит', () => {
    const tpl = findTemplate('fantasy', 'thief')!;
    const withSkills = templateData(tpl, 'ru', { lockpicking: '2D', stealth: '2D', 'sleight-of-hand': '1D', climbing: '2D' });
    expect(validateCreation(withSkills).errors).toEqual([]);
    const tooMany = templateData(tpl, 'ru', { lockpicking: '3D', stealth: '3D', climbing: '3D' });
    expect(validateCreation(tooMany).errors.join()).toContain('7D');
  });

  it('предметы шаблона: язык названий, слоты и количество', () => {
    const tpl = findTemplate('adventure', 'weapons-master')!;
    const en = templateEntity(tpl, { id: 'w', name: 'W', lang: 'en' });
    expect(en.items.find((i) => i.id === 'throwing-stars')).toMatchObject({ name: 'Throwing stars', qty: 7, slot: null });
    const ru = templateEntity(findTemplate('fantasy', 'gladiator')!, { id: 'g', name: 'Г', lang: 'ru' });
    expect(ru.items.find((i) => i.id === 'small-shield')).toMatchObject({ name: 'Малый щит (защита +2D)', slot: 'shield' });
  });
});

describe('броня из одних пипов и зоны (fantasy p.117)', () => {
  const jerkin = { id: 'j', name: 'Куртка', qty: 1, slot: 'body', data: { armor: '2' } };
  const pants = { id: 'p', name: 'Штаны', qty: 1, slot: 'legs', data: { armor: '2', zone: 'legs' } };

  it('«Armor Value +2» — постоянные 2 очка сопротивления без броска', () => {
    const r = applyDamage(ctxWith(scriptedRng([]), [irma({}, [jerkin])]), { targetId: 'irma', damage: 5, reason: 'r' });
    expect(r.ok && r.value.result).toMatchObject({ resistanceTotal: 2, bodyPointsLost: 3, bodyPoints: 27 });
    expect(r.ok && r.value.events.some((e) => e.t === 'roll')).toBe(false);
  });

  it('броня с зоной работает только при попадании в эту зону', () => {
    const entity = irma({}, [jerkin, pants]);
    expect(toPips(armorCode(entity))).toBe(2);
    expect(toPips(armorCode(entity, 'legs'))).toBe(4);
    // 2 + 2 пипа = 1D+1: складываются как коды и бросаются (Wild Die = 4 → сопротивление 5)
    const hit = applyDamage(ctxWith(scriptedRng([4]), [entity]), { targetId: 'irma', damage: 6, reason: 'r', zone: 'legs' });
    expect(hit.ok && hit.value.result).toMatchObject({ armor: '1D+1', resistanceTotal: 5, bodyPointsLost: 1 });
  });

  it('щит защищает, только когда Мастер указал shielded (fantasy p.116)', () => {
    const gladiator = templateEntity(findTemplate('fantasy', 'gladiator')!, { id: 'irma', name: 'Г', lang: 'ru' });
    expect(toPips(armorCode(gladiator))).toBe(4); // 1D+1 твёрдой кожи
    expect(toPips(armorCode(gladiator, undefined, true))).toBe(10); // + 2D щита = 3D+1
    // со щитом бросается 3D+1 (два обычных куба и Wild Die), без щита — 1D+1 (один Wild Die: 4+1 = 5)
    const blocked = applyDamage(ctxWith(scriptedRng([2, 3, 4]), [{ ...irma(), items: gladiator.items }]), { targetId: 'irma', damage: 20, reason: 'r', shielded: true });
    expect(blocked.ok && blocked.value.result).toMatchObject({ armor: '3D+1' });
    const open = applyDamage(ctxWith(scriptedRng([4]), [{ ...irma(), items: gladiator.items }]), { targetId: 'irma', damage: 20, reason: 'r' });
    expect(open.ok && open.value.result).toMatchObject({ armor: '1D+1', resistanceTotal: 5 });
  });

  it('снятая броня и неверный код не защищают и не роняют ход', () => {
    const inPack = { ...jerkin, slot: null };
    const broken = { id: 'b', name: 'Странная', qty: 1, slot: 'head', data: { armor: 'плотная' } };
    const r = applyDamage(ctxWith(createRng('x'), [irma({}, [inPack, broken])]), { targetId: 'irma', damage: 4, reason: 'r' });
    expect(r.ok && r.value.result).toMatchObject({ resistanceTotal: 0, bodyPointsLost: 4 });
  });
});
