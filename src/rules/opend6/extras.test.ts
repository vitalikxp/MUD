import { describe, expect, it } from 'vitest';
import { scriptedRng } from '../../engine/testing';
import { opend6 } from '.';
import { ctxWith, irma } from './fixtures';

const emptyCtx = () => ctxWith(scriptedRng([]), []);

describe('roll: произвольный бросок', () => {
  it('классическая формула — кубы и модификатор, событие в журнале', () => {
    const r = opend6.roll(ctxWith(scriptedRng([3, 4]), []), { expr: '2d6+1', reason: 'таблица слухов' });
    expect(r.ok && r.value.result).toEqual({ expr: '2d6+1', dice: [3, 4], modifier: 1, total: 8 });
    expect(r.ok && r.value.events).toEqual([expect.objectContaining({ t: 'roll', reason: 'таблица слухов', visibility: 'all' })]);
  });

  it('код кубов OpenD6 — с Wild Die; тайный бросок помечается dm', () => {
    const r = opend6.roll(ctxWith(scriptedRng([2, 5, 3]), []), { expr: '3D+1', reason: 'ловушка', visibility: 'dm' });
    expect(r.ok && r.value.result).toMatchObject({ expr: '3D+1', total: 2 + 5 + 3 + 1, dice: [2, 5], wildDie: [3] });
    expect(r.ok && r.value.events[0]).toMatchObject({ visibility: 'dm' });
  });

  it('отказы: мусор, ноль кубов, слишком много кубов, выход за границы формулы', () => {
    expect(opend6.roll(emptyCtx(), { expr: 'много', reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('Некорректная формула') });
    expect(opend6.roll(emptyCtx(), { expr: '+2', reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('нет кубов') });
    expect(opend6.roll(emptyCtx(), { expr: '31D', reason: 'r' })).toMatchObject({ ok: false, error: expect.stringContaining('не больше 30D') });
    expect(opend6.roll(emptyCtx(), { expr: '0d6', reason: 'r' }).ok).toBe(false);
    expect(opend6.roll(emptyCtx(), { expr: '101d6', reason: 'r' }).ok).toBe(false);
  });
});

describe('apply_damage: оружие с «+» прибавляется к Силе удара атакующего (adventure p.60–61)', () => {
  const guard = { ...irma({ attributes: { ...irma().data['attributes'] as Record<string, string>, physique: '4D' }, skills: {} }), id: 'guard', name: 'Стражник', kind: 'npc' as const };

  it('Телосложение 4D → Сила удара 2D; «+1D» даёт 3D', () => {
    // 3D урона: два обычных куба и Wild Die
    const r = opend6.applyDamage(ctxWith(scriptedRng([2, 3, 4]), [irma(), guard]), { targetId: 'irma', damage: '+1D', attackerId: 'guard', reason: 'меч' });
    expect(r.ok && r.value.result).toMatchObject({ damageRolled: '3D', damageTotal: 2 + 3 + 4, bodyPointsLost: 9 });
  });

  it('«+2» (нож) к 2D даёт 2D+2', () => {
    const r = opend6.applyDamage(ctxWith(scriptedRng([1, 1]), [irma(), guard]), { targetId: 'irma', damage: '+2', attackerId: 'guard', reason: 'нож' });
    expect(r.ok && r.value.result).toMatchObject({ damageRolled: '2D+2' });
  });

  it('без attackerId или с неизвестным атакующим — отказ, кубы не тронуты; фиксированный код attackerId не требует', () => {
    const rng = scriptedRng([]);
    expect(opend6.applyDamage(ctxWith(rng, [irma()]), { targetId: 'irma', damage: '+1D', reason: 'меч' })).toMatchObject({ ok: false, error: expect.stringContaining('attackerId') });
    expect(opend6.applyDamage(ctxWith(rng, [irma()]), { targetId: 'irma', damage: '+1D', attackerId: 'призрак', reason: 'меч' })).toMatchObject({ ok: false, error: expect.stringContaining('Нет персонажа') });
    const fixed = opend6.applyDamage(ctxWith(scriptedRng([3, 3, 3]), [irma()]), { targetId: 'irma', damage: '3D', reason: 'падение' });
    expect(fixed.ok).toBe(true);
  });
});

describe('каталог предметов через модуль правил', () => {
  it('ids и make: предмет из каталога с ref и языком названия', () => {
    expect(opend6.items.ids('fantasy')).toContain('long-bow');
    expect(opend6.items.ids('adventure')).toContain('glock-17');
    expect(opend6.items.ids('space')).toEqual([]);
    expect(opend6.items.make('fantasy', 'long-bow', 'ru', 2)).toMatchObject({ id: 'long-bow', ref: 'opend6:fantasy:long-bow', name: 'Длинный лук со стрелой', qty: 2 });
    expect(opend6.items.make('fantasy', 'glock-17', 'en', 1)).toBeUndefined();
  });
});

describe('NPC, описание для промпта, поиск по каталогу', () => {
  it('NPC по уровню: все обычные характеристики одного кода, очки тела, без очков персонажа', () => {
    const r = opend6.npc.create('fantasy', { id: 'npc-1', name: 'Стражник', tier: 'strong', role: 'страж ворот' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ id: 'npc-1', kind: 'npc', name: 'Стражник' });
    expect(r.value.data).toMatchObject({ concept: 'страж ворот', body: { points: 34, max: 34 }, points: { cp: 0, fp: 0 }, attributes: { agility: '4D', intellect: '4D' } });
    expect(r.value.data['attributes']).not.toHaveProperty('magic');
    expect(opend6.npc.tiers).toEqual(['weak', 'average', 'strong', 'elite']);
    expect(opend6.derive(r.value)).toMatchObject({ strengthDamage: '2D' });
    expect(opend6.npc.create('space', { id: 'n', name: 'X', tier: 'weak' })).toMatchObject({ ok: false });
  });

  it('описание героя: id, коды, Очки тела, очки персонажа, предметы, состояния', () => {
    const hero = irma({}, [{ id: 'dagger', name: 'Кинжал', qty: 1, slot: 'hand' }]);
    const text = opend6.describe({ ...hero, conditions: ['poisoned'] });
    expect(text).toContain('Ирма (id: irma, player hero) — Плутовка');
    expect(text).toContain('agility 3D+1');
    expect(text).toContain('stealth 4D+1');
    expect(text).toContain('Body Points 30/30 (healthy)');
    expect(text).toContain('Кинжал [id dagger] (hand)');
    expect(text).toContain('Conditions: poisoned.');
    expect(opend6.describe({ ...hero, data: { broken: true } })).toContain('data error');
  });

  it('поиск: по слову на любом языке, по id, лимит, пустой запрос', () => {
    expect(opend6.items.search('fantasy', 'кольчуга', 'ru').map((x) => x.id)).toContain('chain-mail');
    expect(opend6.items.search('fantasy', 'chain mail', 'en')[0]).toMatchObject({ id: 'chain-mail', price: 'M' });
    expect(opend6.items.search('adventure', 'glock', 'en')).toHaveLength(1);
    expect(opend6.items.search('fantasy', 'щит', 'ru', 2).length).toBeLessThanOrEqual(2);
    expect(opend6.items.search('fantasy', '  ', 'ru')).toEqual([]);
    expect(opend6.lookupTopics).toContain('healing');
  });
});
