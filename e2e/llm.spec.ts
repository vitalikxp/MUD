import { expect, test, type Page, type Route } from '@playwright/test';

const RELAY = 'https://relay.test';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
const sse = (events: { event: string; data: object }[]): string => events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify({ type: e.event, ...e.data })}\n\n`).join('');

/** Фальшивый relay в формате Responses: с tools — вызов ping, без tools — потоковый текст. */
async function mockRelay(page: Page, seen: { headers: Record<string, string>[]; bodies: Record<string, unknown>[] }, delayMs = 0): Promise<void> {
  await page.route(`${RELAY}/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    seen.headers.push(req.headers());
    const body = req.postDataJSON() as Record<string, unknown>;
    seen.bodies.push(body);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    const reply = body['tools']
      ? sse([
          { event: 'response.output_item.done', data: { item: { type: 'function_call', call_id: 'c1', name: 'ping', arguments: '{"word":"pong"}' } } },
          { event: 'response.completed', data: { response: { usage: { input_tokens: 5, output_tokens: 5 } } } },
        ])
      : sse([
          { event: 'response.output_text.delta', data: { delta: 'Сырой воздух ' } },
          { event: 'response.output_text.delta', data: { delta: 'пахнет воском.' } },
          { event: 'response.completed', data: { response: { usage: { input_tokens: 5, output_tokens: 5 } } } },
        ]);
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/event-stream' }, body: reply });
  });
}

/** Открыть /settings и дождаться, пока форма смонтирована и в фокусе (иначе клавиши уйдут в никуда). */
async function openSettings(page: Page): Promise<void> {
  await page.goto('/settings');
  await expect(page.getByRole('menu')).toBeFocused();
}

/** Открыть настройки и задать: приватный пресет, ключ, свой relay. Управление — клавиатурой. */
async function configure(page: Page): Promise<void> {
  await openSettings(page);
  await page.keyboard.press('ArrowDown'); // Модели
  await page.keyboard.press('ArrowRight'); // → Приватный
  await expect(page.getByRole('menuitem', { name: /Приватный/ })).toBeVisible();
  await page.keyboard.press('ArrowDown'); // Ключ
  await page.keyboard.press('Enter');
  await page.keyboard.type('sk-test-123');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown'); // Запомнить
  await page.keyboard.press('ArrowDown'); // Relay
  await page.keyboard.press('ArrowRight'); // → свой адрес
  await page.keyboard.press('ArrowDown'); // Адрес relay
  await page.keyboard.press('Enter');
  await page.keyboard.type(RELAY);
  await page.keyboard.press('Enter');
}

test('настройки: проверка проходит, запрос уходит на relay с ключом и заголовком сессии', async ({ page }) => {
  const seen = { headers: [] as Record<string, string>[], bodies: [] as Record<string, unknown>[] };
  await mockRelay(page, seen);
  await configure(page);
  await page.keyboard.press('ArrowDown'); // Проверить
  await page.keyboard.press('Enter');
  const log = page.getByRole('log');
  await expect(log).toContainText('✓ Связь и ответ модели');
  await expect(log).toContainText('✓ Потоковая передача текста');
  await expect(log).toContainText('✓ Вызов инструментов');
  await expect(log).toContainText('Готово: все проверки пройдены.');
  expect(seen.headers[0]).toMatchObject({ authorization: 'Bearer sk-test-123', 'x-upstream': 'https://opencode.ai/zen/go/v1' });
  expect(seen.headers[0]!['x-opencode-session']).toMatch(/^[0-9a-f-]{36}$/);
  expect(seen.bodies[0]).toMatchObject({ model: 'gpt-5.6-luna', stream: true, reasoning: { effort: 'medium' } });
  expect(seen.bodies[0]!['max_output_tokens']).toBeGreaterThanOrEqual(1500);
});

test('чат: реплика игрока → потоковый ответ Мастера в хронике', async ({ page }) => {
  const seen = { headers: [], bodies: [] };
  await mockRelay(page, seen);
  await configure(page);
  await page.keyboard.press('Escape'); // назад в игру
  const input = page.getByRole('textbox');
  await input.fill('Вхожу в склеп');
  await input.press('Enter');
  const log = page.getByRole('log');
  await expect(log).toContainText('Вы> Вхожу в склеп');
  await expect(log).toContainText('Сырой воздух пахнет воском.');
});

test('не настроено: чат подсказывает открыть настройки; экономный пресет требует согласия', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox');
  await input.fill('Привет');
  await input.press('Enter');
  await expect(page.getByRole('log')).toContainText('Мастер не настроен: нет ключа API');
  await openSettings(page);
  await expect(page.getByText('Meta', { exact: false }).first()).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); // Обучение на данных (не подтверждено)
  await page.keyboard.press('Enter'); // подтвердить
  await expect(page.getByRole('menuitem', { name: /согласен/ })).toBeVisible();
});

test('ключ и настройки переживают перезагрузку; без «запомнить» ключ остаётся только в sessionStorage', async ({ page }) => {
  await openSettings(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await page.keyboard.type('sk-keep-me');
  await page.keyboard.press('Enter');
  await page.reload();
  await expect(page.getByRole('menu')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('swrd.llm.key.v1'))).toBe('sk-keep-me');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); // Запомнить ключ
  await page.keyboard.press('Enter'); // выключить
  expect(await page.evaluate(() => localStorage.getItem('swrd.llm.key.v1'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('swrd.llm.key.v1'))).toBe('sk-keep-me');
  // Ключ не попадает ни в общий блок настроек, ни в текст страницы
  expect(await page.evaluate(() => localStorage.getItem('swrd.llm.v1'))).not.toContain('sk-keep-me');
  expect(await page.locator('body').innerText()).not.toContain('sk-keep-me');
});

test('ошибка провайдера показывается понятным текстом', async ({ page }) => {
  await page.route(`${RELAY}/**`, (route) =>
    route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers: CORS })
      : route.fulfill({ status: 401, headers: CORS, body: '{"error":"bad key"}' }),
  );
  await configure(page);
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('log')).toContainText('✗ Связь и ответ модели: ошибка');
  await expect(page.getByRole('log')).toContainText('неверный ключ или нет доступа');
});

/** Строки хроники (только видимые). */
const chronicleRows = (page: Page): Promise<string[]> => page.$$eval('.tui-scroll-area .tui-row', (rows) => rows.map((r) => r.textContent ?? ''));

async function askAndFinish(page: Page, text: string, answerPart: string): Promise<void> {
  const input = page.getByRole('textbox');
  await input.fill(text);
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('');
  await expect.poll(async () => (await chronicleRows(page)).join('\n')).toContain(answerPart);
}

test('пока Мастер думает — анимация, потом ответ; между репликой и ответом пустая строка', async ({ page }) => {
  await mockRelay(page, { headers: [], bodies: [] }, 1500);
  await configure(page);
  await page.keyboard.press('Escape');
  const input = page.getByRole('textbox');
  await input.fill('Вхожу в склеп');
  await input.press('Enter');

  const thinking = page.locator('.tui-scroll-area').getByText(/Мастер думает \[/);
  await expect(thinking).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Мастер думает…'); // для скринридеров
  const frame1 = await thinking.textContent();
  await expect.poll(async () => thinking.textContent()).not.toBe(frame1); // кадр меняется
  expect(await page.$eval('.tui-scroll-area [aria-hidden="true"]', (el) => el.textContent)).toContain('Мастер думает'); // декоративная строка скрыта от скринридеров

  await expect(page.getByText('пахнет воском.')).toBeVisible();
  await expect(thinking).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveText('');

  const rows = await chronicleRows(page);
  const i = rows.findIndex((r) => r.startsWith('Вы> Вхожу в склеп'));
  expect(i).toBeGreaterThanOrEqual(0);
  expect(rows[i + 1]!.trim()).toBe(''); // пустая строка-отступ
  expect(rows[i + 2]).toContain('Сырой воздух');
});

test('хроника прокручивается: PgUp/PgDn, колесо, полоса; своя реплика возвращает к концу', async ({ page }) => {
  await mockRelay(page, { headers: [], bodies: [] });
  await configure(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tui-scrollbar')).toHaveCount(0); // пока всё помещается — полосы нет
  for (let n = 1; n <= 14; n++) await askAndFinish(page, `Ход ${n}`, 'пахнет воском.');
  const scrollbar = page.locator('.tui-scrollbar');
  await expect(scrollbar).toBeVisible();

  const bottom = await chronicleRows(page);
  expect(bottom.join('\n')).toContain('Вы> Ход 14');
  const thumbTop = async () => scrollbar.locator('.tui-row').evaluateAll((rows) => rows.findIndex((r) => r.textContent === '█'));
  const thumbAtBottom = await thumbTop();

  await page.keyboard.press('PageUp');
  const up = await chronicleRows(page);
  expect(up).not.toEqual(bottom);
  expect(up.join('\n')).not.toContain('Вы> Ход 14');
  expect(await thumbTop()).toBeLessThan(thumbAtBottom); // ползунок поднялся

  await page.keyboard.press('PageDown');
  expect(await chronicleRows(page)).toEqual(bottom);

  await page.locator('.tui-scroll-area').hover();
  await page.mouse.wheel(0, -300);
  await expect.poll(async () => (await chronicleRows(page)).join('\n')).not.toContain('Вы> Ход 14');
  await page.mouse.wheel(0, 3000);
  await expect.poll(async () => chronicleRows(page)).toEqual(bottom);

  // Прокрутили вверх и отправили реплику — снова видим конец.
  await page.keyboard.press('PageUp');
  await askAndFinish(page, 'Ход 15', 'пахнет воском.');
  expect((await chronicleRows(page)).join('\n')).toContain('Вы> Ход 15');
});
