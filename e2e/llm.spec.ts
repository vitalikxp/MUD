import { expect, test, type Page, type Route } from '@playwright/test';
import { CORS, replyFor } from './wire';

const RELAY = 'https://relay.test';

/** Фальшивый relay (Chat Completions или Responses — по пути запроса): с tools — вызов ping, без tools — потоковый текст. */
async function mockRelay(page: Page, seen: { headers: Record<string, string>[]; bodies: Record<string, unknown>[] }, delayMs = 0): Promise<void> {
  await page.route(`${RELAY}/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.method() === 'GET') return route.fulfill({ status: 404, headers: CORS, body: 'no models' }); // список моделей подгружается сам после ввода ключа
    seen.headers.push(req.headers());
    const body = req.postDataJSON() as Record<string, unknown>;
    seen.bodies.push(body);
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    const reply = replyFor(new URL(req.url()).pathname, body['tools'] ? { calls: [{ name: 'ping', arguments: '{"word":"pong"}' }] } : { deltas: ['Сырой воздух ', 'пахнет воском.'] });
    await route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'text/event-stream' }, body: reply });
  });
}

/** Первый запуск без настроек: на экране только окно настроек, форма смонтирована и в фокусе (иначе клавиши уйдут в никуда). */
async function openSettings(page: Page): Promise<void> {
  await page.goto('/dev/chat');
  await expect(page.getByRole('dialog', { name: 'Настройки LLM' })).toBeVisible();
  await expect(page.getByRole('menu')).toBeFocused();
}

/** В окне первого запуска задать: ключ, свой relay (модель — по умолчанию). Управление — клавиатурой. Курсор остаётся на «Адрес relay». */
async function configure(page: Page): Promise<void> {
  await openSettings(page);
  await page.keyboard.press('ArrowDown'); // Провайдер
  await page.keyboard.press('ArrowDown'); // Ключ
  await page.keyboard.press('Enter');
  await page.keyboard.type('sk-test-123');
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown'); // Запомнить
  await page.keyboard.press('ArrowDown'); // Модель (выбор из списка)
  await page.keyboard.press('ArrowDown'); // Relay
  await page.keyboard.press('ArrowRight'); // → свой адрес
  await page.keyboard.press('ArrowDown'); // Адрес relay
  await page.keyboard.press('Enter');
  await page.keyboard.type(RELAY);
  await page.keyboard.press('Enter');
}

/** Из «Адрес relay» вниз до «Начать игру» и нажать. */
async function startGame(page: Page): Promise<void> {
  await page.keyboard.press('ArrowDown'); // Проверить
  await page.keyboard.press('ArrowDown'); // Начать игру
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Хроника' })).toBeVisible();
  await expect(page.getByRole('textbox')).toBeFocused();
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
  expect(seen.bodies[0]).toMatchObject({ model: 'deepseek-v4-flash', stream: true }); // модель по умолчанию, Chat Completions
  expect(seen.bodies[0]!['max_tokens']).toBeGreaterThanOrEqual(1500);
  expect(seen.bodies[0]!['reasoning_effort']).toBeUndefined();
});

test('чат: реплика игрока → потоковый ответ Мастера в хронике', async ({ page }) => {
  const seen = { headers: [], bodies: [] };
  await mockRelay(page, seen);
  await configure(page);
  await startGame(page);
  const input = page.getByRole('textbox');
  await input.fill('Вхожу в склеп');
  await input.press('Enter');
  const log = page.getByRole('log');
  await expect(log).toContainText('Вы> Вхожу в склеп');
  await expect(log).toContainText('Сырой воздух пахнет воском.');
});

test('первый запуск без настроек: только окно настроек, закрыть нельзя, «Начать игру» ждёт заполнения', async ({ page }) => {
  await openSettings(page);
  await expect(page.getByText('Первый запуск')).toBeVisible();
  // Ничего, кроме окна: ни хроники, ни строки состояния, ни F-клавиш/вкладок.
  await expect(page.getByRole('region', { name: 'Хроника' })).toHaveCount(0);
  await expect(page.locator('.tui-statusbar, .tui-fkeys, .tui-tabs')).toHaveCount(0);
  // Закрыть нельзя: Esc и F-клавиши не действуют.
  await page.keyboard.press('Escape');
  await page.keyboard.press('F1');
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: 'Настройки LLM' })).toBeVisible();
  // Язык переключается прямо в окне.
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('dialog', { name: 'LLM settings' })).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('dialog', { name: 'Настройки LLM' })).toBeVisible();
  // Модель по умолчанию не отдаёт данные на обучение: строки согласия нет.
  await expect(page.getByRole('menuitem', { name: /согласен/ })).toHaveCount(0);
  // «Начать игру» без ключа — не пускает и говорит, чего не хватает.
  for (let n = 0; n < 7; n++) await page.keyboard.press('ArrowDown'); // провайдер, ключ, запомнить, модель, relay, проверить, начать
  await page.keyboard.press('Enter');
  await expect(page.getByRole('log')).toContainText('Сначала исправьте: нет ключа API');
  await expect(page.getByRole('region', { name: 'Хроника' })).toHaveCount(0);
});

test('ключ и настройки переживают перезагрузку; без «запомнить» ключ остаётся только в sessionStorage', async ({ page }) => {
  await openSettings(page);
  await page.keyboard.press('ArrowDown'); // Провайдер
  await page.keyboard.press('ArrowDown'); // Ключ
  await page.keyboard.press('Enter');
  await page.keyboard.type('sk-keep-me');
  await page.keyboard.press('Enter');
  await page.reload();
  // Настройки есть — окно первого запуска не навязывается, игра открыта.
  await expect(page.getByRole('region', { name: 'Хроника' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('mud.llm.key.v1'))).toBe('sk-keep-me');
  await page.keyboard.press('F4');
  await expect(page.getByRole('dialog', { name: 'Настройки LLM' })).toBeVisible();
  await expect(page.getByRole('menu')).toBeFocused();
  for (let n = 0; n < 3; n++) await page.keyboard.press('ArrowDown'); // до «Запомнить ключ»
  await page.keyboard.press('Enter'); // выключить
  expect(await page.evaluate(() => localStorage.getItem('mud.llm.key.v1'))).toBeNull();
  expect(await page.evaluate(() => sessionStorage.getItem('mud.llm.key.v1'))).toBe('sk-keep-me');
  // Ключ не попадает ни в общий блок настроек, ни в текст страницы
  expect(await page.evaluate(() => localStorage.getItem('mud.llm.v1'))).not.toContain('sk-keep-me');
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
  await expect(page.getByRole('log')).toContainText('× Связь и ответ модели: ошибка');
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
  await startGame(page);
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
  await startGame(page);
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

test('строка состояния: готов + токены и время после ответа; ошибка провайдера; во время ответа — «отвечает»', async ({ page }) => {
  const seen = { headers: [], bodies: [] };
  await mockRelay(page, seen, 1200);
  await configure(page);
  await startGame(page);
  const bar = page.locator('.tui-statusbar');
  await expect(bar).toContainText('● готов · deepseek-v4-flash');
  const input = page.getByRole('textbox');
  await input.fill('Вхожу в склеп');
  await input.press('Enter');
  await expect(bar).toContainText('Мастер отвечает…');
  await expect(bar).toContainText('↑5 ↓5 ток.'); // usage из мока
  // время ответа: на телефоне длинное имя модели обрезает строку состояния (layoutStatus режет левую часть с «…»)
  if (test.info().project.name === 'desktop') await expect(bar).toContainText('с');
  await expect(bar).not.toContainText('Мастер отвечает…');

  await page.unroute(`${RELAY}/**`);
  await page.route(`${RELAY}/**`, (route) =>
    route.request().method() === 'OPTIONS' ? route.fulfill({ status: 204, headers: CORS }) : route.fulfill({ status: 429, headers: CORS, body: '{}' }),
  );
  await input.fill('Ещё ход');
  await input.press('Enter');
  await expect(bar).toContainText('ошибка: исчерпан лимит подписки');
});

test('настройки LLM — окно по F4: повторное нажатие закрывает; ключ убрали → строка состояния «не настроен»', async ({ page }) => {
  await mockRelay(page, { headers: [], bodies: [] });
  await configure(page);
  await startGame(page);
  await page.keyboard.press('F4');
  await expect(page.getByRole('menu')).toBeFocused();
  await page.keyboard.press('F4');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.keyboard.press('F4');
  await expect(page.getByRole('menu')).toBeFocused();
  for (let n = 0; n < 2; n++) await page.keyboard.press('ArrowDown'); // Ключ
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter'); // пустой ключ
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('.tui-statusbar')).toContainText('LLM не настроен: нет ключа API');
  // Игра не падает: реплика подсказывает, что делать (окно первого запуска при этом не возвращается).
  const input = page.getByRole('textbox');
  await input.fill('Привет');
  await input.press('Enter');
  await expect(page.getByRole('log')).toContainText('Мастер не настроен: нет ключа API');
});

/** Список моделей провайдера: GET /v1/models через фальшивый relay. */
async function mockModels(page: Page, ids: string[] | 'fail'): Promise<{ requests: string[] }> {
  const seen = { requests: [] as string[] };
  await page.route(`${RELAY}/v1/models`, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { ...CORS, 'access-control-allow-methods': 'GET, POST, OPTIONS' } });
    seen.requests.push(`${req.method()} ${req.headers()['authorization'] ?? ''}`);
    if (ids === 'fail') return route.fulfill({ status: 500, headers: CORS, body: 'boom' });
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify({ object: 'list', data: ids.map((id) => ({ id })) }) });
  });
  return seen;
}

/** Открыть окно выбора модели из настроек (курсор на строке «Модель»). */
async function openModelPicker(page: Page): Promise<void> {
  await page.keyboard.press('F4');
  await expect(page.getByRole('menu')).toBeFocused();
  await page.keyboard.press('ArrowDown'); // Провайдер
  await page.keyboard.press('ArrowDown'); // Ключ
  await page.keyboard.press('ArrowDown'); // Запомнить
  await page.keyboard.press('ArrowDown'); // Модель
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Выбор модели' })).toBeVisible();
  await expect(page.getByRole('listbox', { name: 'Выбор модели' })).toBeFocused();
}

test('выбор модели: проверенные первыми и цветом, остальные из ответа провайдера; выбор сохраняется', async ({ page }) => {
  const seen = { headers: [] as Record<string, string>[], bodies: [] as Record<string, unknown>[] };
  await mockRelay(page, seen);
  const models = await mockModels(page, ['zzz-unknown', 'aaa-unknown', 'longcat-2.0', 'glm-5.3', 'gpt-5.6-luna', 'deepseek-v4-flash', 'mimo-v2.6-flash', 'qwen3.8-max', 'grok-4.7']);
  await configure(page);
  await startGame(page);
  await openModelPicker(page);
  const options = page.getByRole('option');
  await expect(page.getByRole('dialog', { name: 'Выбор модели' })).toContainText('Моделей у провайдера: 9'); // список подгружен после ввода ключа
  await expect(options.first()).toContainText('gpt-5.6-luna');
  await expect(options.first()).toContainText('рекомендуем');
  // порядок: рекомендуемые, с оговорками, непроверенные по алфавиту, неработающие
  const names = (await options.allTextContents()).map((t) => t.replace(/[●○×•]/g, '').trim().split(/\s+/)[0]);
  expect(names.slice(0, 4)).toEqual(['gpt-5.6-luna', 'glm-5.3', 'deepseek-v4-flash', 'mimo-v2.6-flash']);
  expect(names.indexOf('aaa-unknown')).toBeLessThan(names.indexOf('zzz-unknown'));
  expect(names.at(-1)).toBe('longcat-2.0');
  expect(models.requests[0]).toMatch(/^GET Bearer sk-test-123$/);
  // цвет проверенной модели — токен палитры, непроверенная — обычный
  const color = (name: string) => page.getByRole('option', { name: new RegExp(name) }).evaluate((el) => getComputedStyle(el).color);
  expect(await color('deepseek-v4-flash')).not.toBe(await color('aaa-unknown'));
  // заметка к выбранной строке: курсор стоит на текущей модели (по умолчанию), идём к началу списка и на строку ниже
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('dialog', { name: 'Выбор модели' })).toContainText('Богатый язык');
  // непроверенная модель: предупреждение; формат Messages — «нельзя играть»
  await page.locator('#menu-item-grok-4\\.7').click(); // непроверенная модель с форматом Responses (его говорит фальшивый relay)
  await expect(page.getByRole('dialog', { name: 'Настройки LLM' })).toContainText('grok-4.7');
  await expect(page.getByRole('dialog', { name: 'Выбор модели' })).toHaveCount(0);

  // выбор запомнился и попал в запрос проверки
  await page.keyboard.press('ArrowDown'); // Relay
  await page.keyboard.press('ArrowDown'); // Адрес relay
  await page.keyboard.press('ArrowDown'); // Проверить
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Настройки LLM' }).getByRole('log')).toContainText('Готово');
  expect(seen.bodies.at(-1)).toMatchObject({ model: 'grok-4.7' });
  expect(seen.bodies.at(-1)!['reasoning']).toBeUndefined(); // для модели не по умолчанию усилие рассуждений не задаётся
  await page.reload();
  await expect(page.getByRole('textbox')).toBeFocused(); // обработчики F-клавиш подключены
  await page.keyboard.press('F4');
  await expect(page.getByRole('dialog', { name: 'Настройки LLM' })).toContainText('grok-4.7');
});

test('выбор модели: список не получен — показаны проверенные и причина; выбранная модель заменяет модель по умолчанию; модель с обучением на данных требует согласия', async ({ page }) => {
  const seen = { headers: [] as Record<string, string>[], bodies: [] as Record<string, unknown>[] };
  await mockRelay(page, seen);
  await mockModels(page, 'fail');
  await configure(page);
  await startGame(page);
  await openModelPicker(page);
  await expect(page.getByRole('dialog', { name: 'Выбор модели' })).toContainText('Список не получен');
  await expect(page.getByRole('option').first()).toContainText('gpt-5.6-luna');
  await page.locator('#menu-item-glm-5\\.3').click();
  await expect(page.getByRole('menuitem', { name: /Модель\s+glm-5.3/ })).toBeVisible();
  // Модель с обучением на данных: раскрытие и строка согласия.
  await page.keyboard.press('Enter');
  await page.locator('#menu-item-muse-spark-1\\.3-contributor').click();
  await expect(page.getByText('Meta', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('menuitem', { name: /нет согласия/ })).toBeVisible();
});

test('после ввода ключа список моделей подгружается сам: число моделей в настройках, без открытия окна выбора', async ({ page }) => {
  await mockRelay(page, { headers: [], bodies: [] });
  const models = await mockModels(page, ['aaa-unknown', 'glm-5.3', 'gpt-5.6-luna']);
  await openSettings(page);
  await expect(page.getByRole('dialog', { name: 'Настройки LLM' })).toContainText('Введите ключ API');
  await page.keyboard.press('ArrowDown'); // Провайдер
  await page.keyboard.press('ArrowDown'); // Ключ
  await page.keyboard.press('ArrowDown'); // Запомнить
  await page.keyboard.press('ArrowDown'); // Модель
  await page.keyboard.press('ArrowDown'); // Relay
  await page.keyboard.press('ArrowRight'); // → свой адрес
  await page.keyboard.press('ArrowDown'); // Адрес relay
  await page.keyboard.press('Enter');
  await page.keyboard.type(RELAY);
  await page.keyboard.press('Enter');
  for (let n = 0; n < 4; n++) await page.keyboard.press('ArrowUp'); // Ключ
  await page.keyboard.press('Enter');
  await page.keyboard.type('sk-test-123');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Настройки LLM' })).toContainText('Моделей у провайдера: 3');
  expect(models.requests).toEqual(['GET Bearer sk-test-123']);
});
