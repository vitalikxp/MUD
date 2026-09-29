import { describe, expect, it } from 'vitest';
import { scriptedRng } from '../../../engine/testing';
import { applyDamage, armorCode } from '../damage';
import { parseDieCode, toPips } from '../dice';
import { ctxWith, irma } from '../fixtures';
import { ADVENTURE_CATALOG, FANTASY_CATALOG, catalogFor, catalogItem, findCatalogEntry } from './index';

const LEVELS = /^(VE|E|M|D|VD|H|L|—)(–(VE|E|M|D|VD|H|L))?$/;
const COINS = /^\d+(–\d+)? [CSG]$/;

const count = (c: readonly { kind: string }[], kind: string) => c.filter((e) => e.kind === kind).length;

describe.each([
  ['fantasy', FANTASY_CATALOG],
  ['adventure', ADVENTURE_CATALOG],
] as const)('каталог %s', (variant, catalog) => {
  it('id уникальны, названия на RU и EN, цены в допустимых форматах', () => {
    const ids = catalog.map((e) => e.id);
    expect(new Set(ids).size, ids.filter((id, i) => ids.indexOf(id) !== i).join()).toBe(ids.length);
    for (const e of catalog) {
      expect(e.name.ru.length, e.id).toBeGreaterThan(0);
      expect(e.name.en.length, e.id).toBeGreaterThan(0);
      expect(e.price?.level, e.id).toMatch(LEVELS);
      if (e.price?.coins) expect(e.price.coins, e.id).toMatch(COINS);
      if (e.note) expect(e.note.ru.length && e.note.en.length, e.id).toBeGreaterThan(0);
    }
  });

  it('броня и оружие разбираются как коды кубов', () => {
    for (const e of catalog) {
      const armor = e.data['armor'];
      if (typeof armor === 'string') expect(toPips(parseDieCode(armor)), e.id).toBeGreaterThan(0);
      const damage = e.data['damage'];
      if (typeof damage === 'string') expect(() => parseDieCode(damage), e.id).not.toThrow();
      const range = e.data['range'];
      if (range !== undefined) expect(Array.isArray(range) && range.length === 3, e.id).toBe(true);
    }
  });

  it('поиск записи и перевод в предмет инвентаря', () => {
    const first = catalog[0]!;
    expect(catalogFor(variant)).toBe(catalog);
    expect(findCatalogEntry(variant, first.id)).toBe(first);
    expect(catalogItem(first, variant, 'en')).toMatchObject({ id: first.id, ref: `opend6:${variant}:${first.id}`, name: first.name.en, qty: 1, slot: null });
    expect(catalogItem(first, variant, 'ru', 3)).toMatchObject({ name: first.name.ru, qty: 3 });
  });
});

describe('содержимое каталогов: сверка с таблицами книг', () => {
  it('размеры разделов (adventure p.114–120, fantasy p.115–119)', () => {
    expect(count(ADVENTURE_CATALOG, 'armor')).toBe(15);
    expect(count(ADVENTURE_CATALOG, 'vehicle')).toBe(24);
    expect(count(FANTASY_CATALOG, 'armor')).toBe(10);
    expect(count(FANTASY_CATALOG, 'shield')).toBe(4);
    expect(count(FANTASY_CATALOG, 'vehicle')).toBe(12);
    expect(count(FANTASY_CATALOG, 'clothing')).toBe(11);
    expect(count(FANTASY_CATALOG, 'food')).toBe(23);
  });

  it('выборочные строки таблиц', () => {
    const glock = findCatalogEntry('adventure', 'glock-17')!;
    expect(glock.data).toMatchObject({ weapon: 'firearm', damage: '3D+2', ammo: 16, range: [8, 16, 24], ammoPrice: 'E' });
    expect(glock.price?.level).toBe('D');
    expect(findCatalogEntry('adventure', 'ak-47')!.data).toMatchObject({ damage: '6D', ammo: 30, noMultiFire: true });
    expect(findCatalogEntry('adventure', 'blaster-rifle')!.data).toMatchObject({ weapon: 'energy', damage: '7D', range: [25, 150, 300] });
    expect(findCatalogEntry('adventure', 'katana')!.data).toMatchObject({ damage: '+3D', unwieldy: true });
    expect(findCatalogEntry('adventure', 'ceramic-armor')!.data['armor']).toBe('3D+1');
    expect(findCatalogEntry('fantasy', 'plate-mail')).toMatchObject({ data: { armor: '3D' }, price: { level: 'D', coins: '40 G' } });
    expect(findCatalogEntry('fantasy', 'medium-shield')!.data).toMatchObject({ armor: '2D+1', shield: true });
    expect(findCatalogEntry('fantasy', 'long-bow')!.data).toMatchObject({ damage: '+2D+2', range: [10, 100, 250] });
    expect(findCatalogEntry('fantasy', 'bedroll')!.price?.coins).toBe('3 S'); // в книге «3 SP»
    expect(findCatalogEntry('fantasy', 'galleon')!.data).toMatchObject({ toughness: '7D+2', scale: 14 });
  });
});

describe('предметы каталога в игре', () => {
  it('надетая кольчуга (2D) даёт бросок сопротивления, запись каталога работает как предмет', () => {
    const mail = { ...catalogItem(findCatalogEntry('fantasy', 'chain-mail')!, 'fantasy', 'ru'), slot: 'body' };
    expect(toPips(armorCode(irma({}, [mail])))).toBe(6);
    // урон 8 (число); сопротивление 2D: обычный куб 3 и Wild Die 4 = 7 → потеряно 1
    const r = applyDamage(ctxWith(scriptedRng([3, 4]), [irma({}, [mail])]), { targetId: 'irma', damage: 8, reason: 'r' });
    expect(r.ok && r.value.result).toMatchObject({ armor: '2D', resistanceTotal: 7, bodyPointsLost: 1 });
  });
});
