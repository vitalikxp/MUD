import { expect, test, type Page, type Route } from '@playwright/test';

const RELAY = 'https://relay.test';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
const sse = (events: { event: string; data: object }[]): string => events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify({ type: e.event, ...e.data })}\n\n`).join('');

/** Фальшивый relay в формате Responses: с tools — вызов ping, без tools — потоковый текст. */
async function mockRelay(page: Page, seen: { headers: Record<string, string>[]; bodies: Record<string, unknown>[] }): Promise<void> {
  await page.route(`${RELAY}/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    seen.headers.push(req.headers());
    const body = req.postDataJSON() as Record<string, unknown>;
    seen.bodies.push(body);
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
