import { expect, test, type Page, type Route } from '@playwright/test';

const RELAY = 'https://relay.test';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
const sse = (events: { event: string; data: object }[]): string => events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify({ type: e.event, ...e.data })}\n\n`).join('');

test.beforeEach(async ({ page }) => {
  await page.addInitScript((relay) => {
    localStorage.setItem('mud.llm.v1', JSON.stringify({ remember: true, relayMode: 'custom', relayUrl: relay }));
    localStorage.setItem('mud.llm.key.v1', 'sk-test');
  }, RELAY);
});

/** Фальшивый Мастер (формат Responses): пишет повествование и закрывает ход через end_turn с вариантами. */
async function mockMaster(page: Page, bodies: Record<string, unknown>[], firstDelayMs = 0): Promise<void> {
  await page.route(`${RELAY}/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.method() === 'GET') return route.fulfill({ status: 404, headers: CORS, body: 'no models' });
    bodies.push(req.postDataJSON() as Record<string, unknown>);
    if (bodies.length === 1 && firstDelayMs) await new Promise((r) => setTimeout(r, firstDelayMs));
    const body = sse([
      { event: 'response.output_text.delta', data: { delta: 'Дождь стучит по крыше ' } },
      { event: 'response.output_text.delta', data: { delta: 'таверны «Последний Порог».' } },
      { event: 'response.output_item.done', data: { item: { type: 'function_call', call_id: 'c1', name: 'end_turn', arguments: '{"suggestions":["Осмотреть зал","Заказать эль"]}' } } },
      { event: 'response.completed', data: { response: { usage: { input_tokens: 50, output_tokens: 20 } } } },
    ]);
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/event-stream' }, body });
  });
}

/** Кампания «Пограничье» с героем Ирма (первый шаблон, навыки по умолчанию) — экран игры. */
async function openGame(page: Page): Promise<void> {
  await page.goto('/');
  await createCampaignWithHero(page);
}

/** С титульного экрана (список кампаний в фокусе): новая кампания, герой Ирма, вход в игру. */
async function createCampaignWithHero(page: Page): Promise<void> {
  await expect(page.getByRole('listbox', { name: 'Кампании' })).toBeFocused();
  await page.keyboard.press('F3');
  await expect(page.getByRole('menu')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Шаблон' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Герой' })).toBeFocused();
  await page.keyboard.type('Ирма');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Навык' })).toBeFocused();
  await page.keyboard.press('F10');
  await expect(page.getByRole('region', { name: /Хроника/ })).toBeVisible();
  await expect(page.getByRole('textbox')).toBeFocused();
}

test('ход в кампании: /start и реплика идут Мастеру с листом героя, ответ и варианты в хронике, после перезагрузки лента на месте', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await mockMaster(page, bodies);
  await openGame(page);
  const log = page.getByRole('log');
  await expect(log).toContainText('/start');

  await page.keyboard.type('/start');
  await page.keyboard.press('Enter');
  await expect(log).toContainText('Дождь стучит');
  await expect(log).toContainText('1. Осмотреть зал');
  await expect(log).toContainText('2. Заказать эль');
  expect(bodies).toHaveLength(1);
  expect(JSON.stringify(bodies[0])).toContain('Ирма'); // лист героя в контексте

  await page.keyboard.type('Оглядываюсь');
  await page.keyboard.press('Enter');
  await expect(log).toContainText('Вы> Оглядываюсь');
  await expect(async () => expect(bodies).toHaveLength(2)).toPass();
  expect(JSON.stringify(bodies[1])).toContain('PLAYER (Ирма): Оглядываюсь');

  await page.reload();
  await expect(page.getByRole('log')).toContainText('Вы> Оглядываюсь');
  await expect(page.getByRole('log')).toContainText('Дождь стучит');
});

test('уход в другую кампанию во время хода: ход прерывается, чужая лента не портится, Мастер не «занят»', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await mockMaster(page, bodies, 6000); // первый ответ (кампании A) приходит поздно
  await openGame(page);
  await page.keyboard.type('/start');
  await page.keyboard.press('Enter');
  await expect(async () => expect(bodies).toHaveLength(1)).toPass();

  await page.keyboard.press('F10'); // ход A ещё идёт
  await createCampaignWithHero(page); // кампания B
  await page.keyboard.type('/start');
  await page.keyboard.press('Enter');
  const log = page.getByRole('log');
  await expect(log).toContainText('Дождь стучит');
  await expect(log).not.toContainText('Мастер ещё отвечает');
  await expect(log).not.toContainText('Ход не удался');
  await page.waitForTimeout(4000); // поздний ответ A не должен ничего дописать в ленту B
  expect((await log.innerText()).match(/Дождь стучит/g)).toHaveLength(1);
  expect(bodies).toHaveLength(2);
});
