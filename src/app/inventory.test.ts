// oxlint-disable-next-line no-unassigned-import -- подключает IndexedDB-эмуляцию глобально
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { LocalAdapter } from '../net/local';
import { closeSession, createCampaign, createHero, heroOf, openSession, session, useStorage } from './campaigns';
import { campaignEntries, chronicle, enterChronicle } from './chronicle';
import { inventoryAction } from './inventory';
import { busy } from './master';

let n = 0;
beforeEach(async () => {
  useStorage(new LocalAdapter(`inv-${++n}`));
  closeSession();
  busy.value = false;
  const id = await createCampaign({ title: 'Пограничье', variant: 'fantasy', lang: 'ru' });
  await openSession(id);
  await createHero({ templateId: 'thief', name: 'Ирма', skills: { lockpicking: 6 } });
  enterChronicle(`campaign:${id}`, campaignEntries(session.peek()!));
});

const items = () => heroOf(session.peek()!.state)!.items;
const texts = () => chronicle.value.flatMap((e) => ('text' in e ? [e.text] : []));

describe('inventoryAction: бытовые действия без Мастера', () => {
  it('надеть: слот в состоянии, коммит ui_action с заметкой, строка в хронике, после перезагрузки всё на месте', async () => {
    const before = session.peek()!.meta.headSeq;
    await inventoryAction({ kind: 'equip', itemId: 'dagger' });
    const s = session.peek()!;
    expect(s.meta.headSeq).toBe(before + 1);
    expect(s.commits.at(-1)).toMatchObject({ kind: 'ui_action' });
    expect(s.commits.at(-1)!.events.map((e) => e.t)).toEqual(['item.slot', 'note']);
    expect(items().find((i) => i.id === 'dagger')!.slot).toBe('main-hand');
    expect(texts().at(-1)).toMatch(/^· Ирма берёт «Кинжал» в руку\.$/);

    const id = s.meta.id;
    closeSession();
    await openSession(id);
    expect(items().find((i) => i.id === 'dagger')!.slot).toBe('main-hand');
  });

  it('снять и выбросить: слот освобождается, предмет уходит из рюкзака', async () => {
    await inventoryAction({ kind: 'equip', itemId: 'dagger' });
    await inventoryAction({ kind: 'unequip', itemId: 'dagger' });
    expect(items().find((i) => i.id === 'dagger')!.slot).toBeNull();
    await inventoryAction({ kind: 'drop', itemId: 'rope' });
    expect(items().some((i) => i.id === 'rope')).toBe(false);
    expect(texts().at(-1)).toBe('· Ирма выбрасывает «Верёвка».');
  });

  it('отклонённое правилом действие не пишется в журнал, причина — в хронике', async () => {
    const before = session.peek()!.meta.headSeq;
    await inventoryAction({ kind: 'unequip', itemId: 'dagger' }); // не надет
    await inventoryAction({ kind: 'equip', itemId: 'ghost' });
    expect(session.peek()!.meta.headSeq).toBe(before);
    expect(texts().filter(Boolean).slice(-2)).toEqual(['«Кинжал» не надет', 'У Ирма нет предмета «ghost»']);
  });

  it('пока Мастер отвечает, действия не выполняются', async () => {
    busy.value = true;
    const before = session.peek()!.meta.headSeq;
    await inventoryAction({ kind: 'equip', itemId: 'dagger' });
    expect(session.peek()!.meta.headSeq).toBe(before);
    expect(chronicle.value.at(-1)).toMatchObject({ key: 'msg.busy' });
  });
});
