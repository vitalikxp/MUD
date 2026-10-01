import { describe, expect, it } from 'vitest';
import { scriptedRng } from '../../engine/testing';
import type { GameEvent, RollRecord } from '../../engine/types';
import { opend6 } from '.';
import { ctxWith, irma } from './fixtures';

type RollEvent = Extract<GameEvent, { t: 'roll' }>;
const rollOf = (events: readonly GameEvent[], index = 0): RollEvent => events.filter((e): e is RollEvent => e.t === 'roll')[index]!;
const plain = (dice: { text: string }[]): string => dice.map((d) => d.text).join('');
const view = (e: RollRecord, lang: 'ru' | 'en' = 'ru', actorName: string | undefined = 'Ирма') => opend6.describeRoll(e, { lang, variant: 'fantasy', ...(actorName ? { actorName } : {}) });

/** Проверка взлома: Координация 3D + навык 1D+1 = 4D+1 (кубов 4: три обычных и Wild Die). */
function lockCheck(over: Parameters<typeof irma>[0] = {}, args: Partial<Parameters<typeof opend6.check>[1]> = {}, rolls = [3, 5, 2, 4]) {
  const r = opend6.check(ctxWith(scriptedRng(rolls), [irma(over)]), { actorId: 'irma', skill: 'lockpicking', difficulty: 12, reason: 'вскрыть замок', ...args });
  if (!r.ok) throw new Error(r.error);
  return rollOf(r.value.events);
}

describe('describeRoll: проверка навыка', () => {
  it('заголовок — причина словами Мастера; отдельная строка: кто и что проверяет с явным «навык» или «характеристика» и значением', () => {
    const v = view(lockCheck());
    expect(v.head).toBe('вскрыть замок');
    expect(v.value).toBe('Ирма — навык «Взлом замков» (Координация), 4D+1');
    expect(v.mods).toBeUndefined();
  });

  it('кубы — результаты в квадратных скобках, вид куба в kind; исход кратко: код = итог ≥ сложность · слово', () => {
    const v = view(lockCheck());
    expect(plain(v.dice)).toBe('[3] + [5] + [2] + [4] + 1 = 15');
    expect(v.dice.filter((d) => d.kind !== 'plain').map((d) => d.kind)).toEqual(['die', 'die', 'die', 'wild']);
    expect(v.verdict).toEqual({ text: '4D+1 = 15 ≥ 12 · успех', success: true });
  });

  it('баффы и дебаффы — теги в скобках с источником (раны, лишние действия, Мастер); итоговый код после них', () => {
    const v = view(lockCheck({ body: { points: 14, max: 30 } }, { actions: 2, modifiers: '+1D+1' }, [3, 5, 2, 4]));
    expect(v.value).toBe('Ирма — навык «Взлом замков» (Координация), 4D+1');
    expect(v.mods).toBe('Модификаторы: [раны −1D] [лишние действия −1D] [Мастер +1D+1] → 3D+2');
  });

  it('траты: Очки персонажа (каждое — Wild Die) и Очко судьбы (кубы ×2)', () => {
    const cp = view(lockCheck({}, { spend: { cp: 2 } }, [3, 5, 2, 4, 6, 3, 2]));
    expect(cp.mods).toBe('Модификаторы: [Очки персонажа ×2: +2 Wild Die]');
    expect(cp.dice.filter((d) => d.kind === 'extra').map((d) => d.text)).toEqual(['[6]', '[3]', '[2]']);
    expect(plain(cp.dice)).toBe('[3] + [5] + [2] + [4] + [6] + [3] + [2] + 1 = 26');
    const fp = view(lockCheck({}, { spend: { fp: true } }, [1, 1, 1, 1, 1, 1, 1, 2]));
    expect(fp.mods).toBe('Модификаторы: [Очко судьбы: кубы ×2] → 8D+2');
  });

  it('навык не изучен: пометка; бросок голой характеристикой — «характеристика», без навыка', () => {
    const attr = lockCheck({}, { skill: undefined, attribute: 'agility' } as never);
    expect(view(attr).value).toBe('Ирма — характеристика «Ловкость», 3D+1');
    const untrained = lockCheck({}, { skill: 'climbing' });
    expect(view(untrained).value).toMatch(/^Ирма — навык «.+» \(.+\), 3D\+1, не изучен$/);
  });

  it('английские подписи', () => {
    const v = view(lockCheck(), 'en');
    expect(v.value).toBe('Ирма — skill "Lockpicking" (Coordination), 4D+1');
    expect(plain(v.dice)).toBe('[3] + [5] + [2] + [4] + 1 = 15');
    expect(v.verdict?.text).toBe('4D+1 = 15 ≥ 12 · success');
  });
});

describe('describeRoll: расшифровка исхода', () => {
  it('успех с запасом, успех впритык, провал', () => {
    expect(view(lockCheck()).verdict).toEqual({ text: '4D+1 = 15 ≥ 12 · успех', success: true });
    expect(view(lockCheck({}, { difficulty: 15 })).verdict).toEqual({ text: '4D+1 = 15 ≥ 15 · успех', success: true });
    expect(view(lockCheck({}, { difficulty: 20 })).verdict).toEqual({ text: '4D+1 = 15 < 20 · провал', success: false });
  });

  it('единица на Wild Die: осложнение или убранный наибольший куб', () => {
    const complication = view(lockCheck({}, {}, [3, 5, 2, 1]));
    expect(complication.verdict!.text).toContain('осложнение: на Wild Die выпала единица');
    const cancel = opend6.check(ctxWith(scriptedRng([3, 5, 2, 1]), [irma()], { wildOne: 'cancel' }), { actorId: 'irma', skill: 'lockpicking', difficulty: 5, reason: 'r' });
    expect(cancel.ok && view(rollOf(cancel.value.events)).verdict!.text).toContain('единица на Wild Die: убран наибольший куб (5)');
  });

  it('встречная проверка: победа и поражение против броска противника', () => {
    const r = opend6.contest(ctxWith(scriptedRng([3, 5, 2, 4, 1, 1, 1, 2]), [irma(), { ...irma(), id: 'guard', name: 'Стражник' }]), {
      a: { actorId: 'irma', skill: 'lockpicking' }, b: { actorId: 'guard', attribute: 'agility' }, reason: 'схватка',
    });
    expect(r.ok).toBe(true);
    const a = view(rollOf(r.ok ? r.value.events : []));
    expect(a.head).toBe('схватка (инициатор)');
    expect(a.verdict?.text).toMatch(/^4D\+1 = \d+ ≥ \d+ · победа$/);
    const b = view(rollOf(r.ok ? r.value.events : [], 1), 'ru', 'Стражник');
    expect(b.verdict?.success).toBe(false);
    expect(b.verdict?.text).toMatch(/ < \d+ · поражение/);
  });
});

describe('describeRoll: броски без персонажа и старые записи', () => {
  it('свободный бросок кубами: только причина и кубы с итогом; без исхода', () => {
    const r = opend6.roll(ctxWith(scriptedRng([3, 4]), []), { expr: '2d6+1', reason: 'таблица слухов' });
    const v = view(rollOf(r.ok ? r.value.events : []), 'ru', undefined);
    expect(v.head).toBe('таблица слухов');
    expect(plain(v.dice)).toBe('[3] + [4] + 1 = 8');
    expect(v.value).toBeUndefined();
    expect(v.verdict).toBeUndefined();
  });

  it('запись из журнала без новых полей (база и баффы не сохранены): показывается то, что есть', () => {
    const old = { t: 'roll', roll: { code: '4D+1', dice: [3, 5, 2], wild: [4], cpWild: [], pips: 1, total: 15, complication: false, cancelled: null, wildOne: false, spent: { cp: 0, fp: false } }, reason: 'взлом', skill: 'lockpicking', attribute: 'coordination', difficulty: 12, success: true, margin: 3, visibility: 'all' } as RollRecord;
    const v = view(old);
    expect(v.value).toBe('Ирма — навык «Взлом замков» (Координация)');
    expect(v.verdict?.text).toBe('4D+1 = 15 ≥ 12 · успех');
  });
});
