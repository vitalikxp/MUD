// oxlint-disable-next-line no-unassigned-import -- подключает IndexedDB-эмуляцию глобально
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalAdapter } from '../net/local';
import { campaigns, closeSession, commitTurn, createCampaign, createHero, deleteCampaign, openSession, refreshCampaigns, session, storageError, useStorage } from './campaigns';

let n = 0;
beforeEach(() => {
  useStorage(new LocalAdapter(`app-${++n}`));
  closeSession();
  campaigns.value = null;
});

const skills = { lockpicking: 6, 'sleight-of-hand': 5 };

describe('кампании', () => {
  it('создание: пустая кампания в фазе creation, список обновляется, id уникальны', async () => {
    const a = await createCampaign({ title: '  Пограничье ', variant: 'fantasy', lang: 'ru' });
    const b = await createCampaign({ title: 'Пепел', variant: 'adventure', lang: 'en' });
    expect(a).not.toBe(b);
    expect(campaigns.value!.map((c) => c.title).toSorted()).toEqual(['Пепел', 'Пограничье']);
    expect(campaigns.value!.find((c) => c.id === a)).toMatchObject({ phase: 'creation', headSeq: 0, narrationLang: 'ru', rules: { id: 'opend6', variant: 'fantasy' } });
    expect(campaigns.value!.find((c) => c.id === a)!.seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it('открытие несуществующей кампании: false, сессия пуста', async () => {
    expect(await openSession('nope')).toBe(false);
    expect(session.value).toBeNull();
  });

  it('герой: создание переводит кампанию в игру, состояние и журнал сохраняются, после «перезагрузки» всё на месте', async () => {
    const id = await createCampaign({ title: 'Тест', variant: 'fantasy', lang: 'ru' });
    await openSession(id);
    expect(session.value!.state.entities).toEqual({});
    const r = await createHero({ templateId: 'thief', name: 'Тень', skills });
    expect(r.ok).toBe(true);
    expect(session.value!.meta).toMatchObject({ phase: 'play', headSeq: 1 });
    expect(session.value!.state.entities['hero']!.name).toBe('Тень');

    closeSession();
    await refreshCampaigns();
    expect(campaigns.value![0]).toMatchObject({ id, phase: 'play', headSeq: 1 });
    expect(await openSession(id)).toBe(true);
    expect(session.value!.state.entities['hero']).toMatchObject({ name: 'Тень', kind: 'pc', ownerUid: 'local' });
    expect(session.value!.commits).toHaveLength(1);
  });

  it('героя нельзя создать дважды или без кампании; ошибки правил не пишутся в журнал', async () => {
    expect(await createHero({ templateId: 'thief', name: 'X', skills: {} })).toMatchObject({ ok: false });
    const id = await createCampaign({ title: 'Тест', variant: 'fantasy', lang: 'en' });
    await openSession(id);
    expect(await createHero({ templateId: 'thief', name: '', skills: {} })).toMatchObject({ ok: false, error: 'Enter the hero’s name' });
    expect(await createHero({ templateId: 'thief', name: 'A', skills: { stealth: 10 } })).toMatchObject({ ok: false });
    expect(session.value!.meta.headSeq).toBe(0);
    expect((await createHero({ templateId: 'thief', name: 'A', skills: {} })).ok).toBe(true);
    expect(await createHero({ templateId: 'bard', name: 'B', skills: {} })).toMatchObject({ ok: false, error: 'The hero already exists' });
    expect(session.value!.meta.headSeq).toBe(1);
  });

  it('коммиты идут строго по очереди: параллельные вызовы получают seq 1, 2, 3; RNG продолжается', async () => {
    const id = await createCampaign({ title: 'Тест', variant: 'fantasy', lang: 'ru' });
    await openSession(id);
    const rolls: number[] = [];
    await Promise.all([1, 2, 3].map((k) => commitTurn('turn', (d) => { rolls.push(d.rng.d6()); d.emit({ t: 'flag.set', key: `k${k}`, value: k }); })));
    expect(session.value!.commits.map((c) => c.seq)).toEqual([1, 2, 3]);
    expect(session.value!.state.flags).toEqual({ k1: 1, k2: 2, k3: 3 });
    // после перезагрузки следующий бросок продолжает последовательность, а не начинается заново
    const before = session.value!.rng.clone().d6();
    await openSession(id);
    expect(session.value!.rng.d6()).toBe(before);
  });

  it('исключение в build не пишет ничего; конфликт двух вкладок подтягивает чужое состояние', async () => {
    const id = await createCampaign({ title: 'Тест', variant: 'fantasy', lang: 'ru' });
    await openSession(id);
    await expect(commitTurn('turn', (d) => { d.emit({ t: 'flag.set', key: 'a', value: 1 }); throw new Error('boom'); })).rejects.toThrow('boom');
    expect(session.value!.meta.headSeq).toBe(0);

    const stale = session.value!;
    // «другая вкладка» продвигает журнал
    await commitTurn('turn', (d) => d.emit({ t: 'flag.set', key: 'other', value: true }));
    session.value = stale; // эта вкладка ничего не знает о новом коммите
    await expect(commitTurn('turn', (d) => d.emit({ t: 'flag.set', key: 'mine', value: true }))).rejects.toThrow('Конфликт');
    expect(session.value!.meta.headSeq).toBe(1);
    expect(session.value!.state.flags).toEqual({ other: true });
  });

  it('удаление стирает кампанию и закрывает её сессию', async () => {
    const id = await createCampaign({ title: 'Тест', variant: 'fantasy', lang: 'ru' });
    const keep = await createCampaign({ title: 'Оставить', variant: 'fantasy', lang: 'ru' });
    await openSession(id);
    await deleteCampaign(id);
    expect(session.value).toBeNull();
    expect(campaigns.value!.map((c) => c.id)).toEqual([keep]);
    expect(await openSession(id)).toBe(false);
  });

  it('недоступное хранилище: список пуст, причина в storageError', async () => {
    useStorage({ ...new LocalAdapter(`app-broken`), listCampaigns: () => Promise.reject(new Error('IndexedDB заблокирован')) } as unknown as LocalAdapter);
    await refreshCampaigns();
    expect(campaigns.value).toEqual([]);
    expect(storageError.value).toBe('IndexedDB заблокирован');
  });
});
