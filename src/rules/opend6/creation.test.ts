import { describe, expect, it } from 'vitest';
import { opend6 } from '.';
import type { CreationInput } from '../api';

const { creation } = opend6;

describe('создание персонажа из шаблона', () => {
  it('шаблоны варианта с навыками и базой; бюджет 7D, не больше +3D в навык', () => {
    const fantasy = creation.templates('fantasy');
    expect(fantasy.map((t) => t.id)).toEqual(['bard', 'gladiator', 'healer', 'monster-slayer', 'ranger', 'thief']);
    expect(creation.templates('adventure')).toHaveLength(6);
    expect(creation.templates('space')).toEqual([]);
    const thief = fantasy.find((t) => t.id === 'thief')!;
    expect(thief.skills.find((s) => s.id === 'lockpicking')).toMatchObject({ base: '4D', attribute: { ru: 'Координация', en: 'Coordination' } });
    expect(thief.attributes.map((a) => `${a.name.en} ${a.code}`)).toEqual(['Agility 3D', 'Coordination 4D', 'Physique 3D', 'Intellect 2D+1', 'Acumen 2D+2', 'Charisma 3D']);
    expect(thief.traits.map((x) => x.en)).toEqual(['Enemy R1', 'Skill Bonus: Nimble Fingers R1']);
    const budget = creation.budget('fantasy');
    expect(budget).toMatchObject({ total: 21, maxPerSkill: 9, maxNameLength: 40 });
    expect([0, 1, 2, 3, 5, 9].map(budget.format)).toEqual(['', '+1', '+2', '+1D', '+1D+2', '+3D']);
  });

  const good: CreationInput = { variant: 'fantasy', templateId: 'thief', name: '  Тень ', lang: 'ru', skills: { lockpicking: 6, stealth: 0, 'sleight-of-hand': 5, climbing: 9, dodge: 1 } };
  const fail = (over: Partial<CreationInput>) => creation.build({ ...good, ...over });

  it('собирает героя: имя, навыки как коды, владелец, язык названий предметов', () => {
    const r = creation.build({ ...good, ownerUid: 'u1' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ id: 'hero', kind: 'pc', name: 'Тень', ownerUid: 'u1' });
    expect(r.value.data['skills']).toEqual({ lockpicking: '2D', 'sleight-of-hand': '1D+2', climbing: '3D', dodge: '0D+1' });
    expect(r.value.items.map((i) => i.name)).toContain('Кинжал');
    const en = creation.build({ ...good, lang: 'en' });
    expect(en.ok && en.value.items.map((i) => i.name)).toContain('Dagger');
    expect(opend6.sheet(r.value, 'ru').title).toBe('Тень — Вор');
  });

  it('можно не тратить все очки и не брать навыки вообще', () => {
    expect(creation.build({ ...good, skills: {} }).ok).toBe(true);
    expect(creation.build({ ...good, skills: { stealth: 3 } }).ok).toBe(true);
  });

  it('отказы: имя, шаблон, чужой навык, отрицательные и дробные очки, превышения', () => {
    expect(fail({ name: '   ' })).toMatchObject({ ok: false, error: expect.stringContaining('имя') });
    expect(fail({ name: 'Я'.repeat(41) })).toMatchObject({ ok: false });
    expect(fail({ templateId: 'nobody' })).toMatchObject({ ok: false, error: expect.stringContaining('Нет шаблона') });
    expect(fail({ skills: { levitation: 3 } })).toMatchObject({ ok: false, error: expect.stringContaining('не входит') });
    expect(fail({ skills: { stealth: -1 } }).ok).toBe(false);
    expect(fail({ skills: { stealth: 1.5 } }).ok).toBe(false);
    expect(fail({ skills: { stealth: 10 } })).toMatchObject({ ok: false, error: expect.stringContaining('+3D') });
    expect(fail({ skills: { stealth: 9, climbing: 9, dodge: 4 } })).toMatchObject({ ok: false, error: expect.stringContaining('7D') });
    expect(fail({ lang: 'en', name: '' })).toMatchObject({ error: 'Enter the hero’s name' });
    expect(fail({ lang: 'en', skills: { stealth: 10 } })).toMatchObject({ error: expect.stringContaining('at most +3D') });
  });

  it('Телохранитель (18D+1 в книге) создаётся: характеристики шаблона не пересчитываются', () => {
    const r = creation.build({ variant: 'adventure', templateId: 'bodyguard', name: 'Борис', lang: 'ru', skills: { brawling: 6 } });
    expect(r.ok).toBe(true);
  });
});
