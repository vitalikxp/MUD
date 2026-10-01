import { expect, test, type Page, type Route } from '@playwright/test';
import { CORS, replyFor } from './wire';

const RELAY = 'https://relay.test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript((relay) => {
    localStorage.setItem('mud.llm.v1', JSON.stringify({ remember: true, relayMode: 'custom', relayUrl: relay }));
    localStorage.setItem('mud.llm.key.v1', 'sk-test');
  }, RELAY);
});

/** Фальшивый Мастер (формат ответа — по пути запроса): пишет повествование и закрывает ход через end_turn с вариантами. */
async function mockMaster(page: Page, bodies: Record<string, unknown>[], firstDelayMs = 0, extraCalls: { name: string; arguments: string }[] = [], narration = 'Дождь стучит по крыше таверны «Последний Порог».', failFirst = false): Promise<void> {
  await page.route(`${RELAY}/**`, async (route: Route) => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.method() === 'GET') return route.fulfill({ status: 404, headers: CORS, body: 'no models' });
    bodies.push(req.postDataJSON() as Record<string, unknown>);
    if (failFirst && bodies.length === 1) return route.fulfill({ status: 401, headers: CORS, body: '{"error":"bad key"}' }); // ход не удаётся
    if (bodies.length === 1 && firstDelayMs) await new Promise((r) => setTimeout(r, firstDelayMs));
    const body = replyFor(new URL(req.url()).pathname, {
      deltas: [narration.slice(0, 12), narration.slice(12)],
      calls: [...extraCalls, { name: 'end_turn', arguments: '{"suggestions":["Осмотреть зал","Заказать эль"]}' }],
    });
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

/** Меню действий над выбранным предметом: Enter открывает его, `downs` раз вниз, Enter — выполнить. Каждый шаг ждёт готовности окна. */
async function pickAction(page: Page, item: string, downs = 0): Promise<void> {
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox', { name: item })).toBeFocused();
  for (let i = 0; i < downs; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: item })).toHaveCount(0);
}

/** Открыть вещи: десктоп — F3 переводит фокус в панель справа, телефон — вкладка «Вещи» открывает окно со списком. Возвращает область списка. */
async function openInventory(page: Page): Promise<void> {
  if (test.info().project.name === 'desktop') await page.keyboard.press('F3');
  else await page.getByRole('tab', { name: 'Вещи' }).click();
  await expect(page.getByRole('listbox', { name: 'Вещи' })).toBeFocused();
}

test('вещи и лист героя: панели справа (десктоп) обновляются после хода, у выбранного предмета видны свойства', async ({ page }) => {
  const desktop = test.info().project.name === 'desktop';
  await mockMaster(page, [], 0, [{ name: 'give_item', arguments: JSON.stringify({ targetId: 'hero', name: 'Ржавый ключ', note: 'Тяжёлый, с зазубриной' }) }]);
  await openGame(page);
  if (desktop) {
    await expect(page.getByRole('region', { name: 'Персонаж' })).toContainText('Очки тела');
    await expect(page.getByRole('region', { name: 'Вещи' })).toContainText('Серебро');
    await expect(page.getByRole('region', { name: 'Вещи' })).not.toContainText('Ржавый ключ');
  } else {
    await expect(page.getByRole('region', { name: 'Персонаж' })).toHaveCount(0); // на телефоне панелей нет, есть вкладки
  }
  await page.keyboard.type('/start');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('log')).toContainText('Дождь стучит');
  if (desktop) await expect(page.getByRole('region', { name: 'Вещи' })).toContainText('Ржавый ключ'); // панель обновилась по журналу
  await openInventory(page);
  await page.keyboard.press('End'); // последний предмет — выданный ключ
  const scope = desktop ? page.getByRole('region', { name: 'Вещи' }) : page.getByRole('dialog', { name: 'Вещи' });
  await expect(scope).toContainText('Ржавый ключ');
  await expect(scope).toContainText('Тяжёлый');
  await page.keyboard.press('Escape'); // панель: фокус назад в строку ввода; окно: закрывается
  if (desktop) await expect(page.getByRole('textbox')).toBeFocused();
  else await expect(page.getByRole('dialog', { name: 'Вещи' })).toHaveCount(0);
});

test('бытовые действия с вещами: надеть, снять, выбросить без Мастера; запись в хронике и журнале, «Использовать» — заявка Мастеру', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await mockMaster(page, bodies);
  await openGame(page);
  const log = page.getByRole('log');
  const list = page.getByRole('listbox', { name: 'Вещи' });
  await openInventory(page);

  // Кинжал — первый предмет: надеть (первое действие меню)
  await pickAction(page, 'Кинжал');
  await expect(list).toContainText('[основная рука]');
  await expect(list).toBeFocused();
  await expect(log).toContainText('Ирма берёт «Кинжал» в руку.');
  expect(bodies).toHaveLength(0); // Мастер не вызывался

  // снять
  await pickAction(page, 'Кинжал');
  await expect(list).not.toContainText('[основная рука]');
  await expect(log).toContainText('Ирма убирает «Кинжал» в рюкзак.');

  // выбросить: в меню третье действие
  await pickAction(page, 'Кинжал', 2);
  await expect(log).toContainText('Ирма выбрасывает «Кинжал».');
  await expect(list).not.toContainText('Кинжал');
  expect(bodies).toHaveLength(0);

  // после перезагрузки записи и состояние на месте
  await page.reload();
  await expect(page.getByRole('log')).toContainText('Ирма выбрасывает «Кинжал».');

  // использовать: реплика уходит Мастеру
  await openInventory(page);
  await pickAction(page, 'Кожаная куртка (защита +2)', 1); // первый предмет теперь — куртка; второе действие — «Использовать»
  await expect(async () => expect(bodies).toHaveLength(1)).toPass();
  expect(JSON.stringify(bodies[0])).toContain('Использую «Кожаная куртка (защита +2)»');
  expect(JSON.stringify(bodies[0])).toContain('Player actions since your last turn'); // и Мастер узнал о снятом/выброшенном
  await expect(page.getByRole('log')).toContainText('Дождь стучит');
});

test('пустая сумка: F3 и вкладка всё равно открывают окно вещей', async ({ page }) => {
  await mockMaster(page, []);
  await openGame(page);
  await openInventory(page);
  for (const name of ['Кинжал', 'Кожаная куртка (защита +2)', 'Бумага', 'Перо и чернила', 'Тубус для свитков']) {
    await page.keyboard.press('Enter');
    const menu = page.getByRole('listbox', { name });
    await expect(menu).toBeFocused();
    // у стопки два пункта «Выбросить» (1 / все): нужен последний из них
    const stack = (await menu.getByRole('option').count()) === 5;
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    if (stack) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name })).toHaveCount(0);
    await expect(page.getByRole('option', { name: new RegExp(`^.\\s${name.split(' ')[0]}`) })).toHaveCount(0); // предмет ушёл из списка: коммит завершён
  }
  await page.keyboard.press('Escape'); // панель: фокус в строку ввода (Esc работает, хотя список исчез); окно: закрывается
  if (test.info().project.name === 'desktop') {
    await expect(page.getByRole('textbox')).toBeFocused();
    await page.keyboard.press('F3');
  } else {
    await expect(page.getByRole('dialog', { name: 'Вещи' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Вещи' }).click();
  }
  const dialog = page.getByRole('dialog', { name: 'Вещи' });
  await expect(dialog).toContainText('Сумка пуста');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
});

/** Отправить строку в поле ввода (десктоп: фокус уже там). */
async function send(page: Page, text: string): Promise<void> {
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('/undo и /retry: откат хода по одному шагу, ход заново без дубля строк', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await mockMaster(page, bodies);
  await openGame(page);
  const log = page.getByRole('log');
  const count = async () => ((await log.innerText()).match(/Дождь стучит/g) ?? []).length;

  await send(page, '/start');
  await expect(log).toContainText('Дождь стучит');
  await send(page, '/retry');
  await expect(async () => expect(bodies).toHaveLength(2)).toPass();
  await expect(log).toContainText('Дождь стучит');
  expect(await count()).toBe(1); // старый ответ убран, новый один

  await send(page, '/undo');
  await expect(log).toContainText('Отменён последний ход');
  await expect(log).not.toContainText('Дождь стучит');
  await expect(log).toContainText('/start'); // игра снова не начата
  await send(page, '/undo');
  await expect(log).toContainText('Отменять нечего');
  await send(page, '/retry');
  await expect(log).toContainText('Повторять нечего');
  expect(bodies).toHaveLength(2); // откат и пустой /retry Мастера не вызывают
});

test('/retry после неудавшегося хода отправляет ту же реплику заново, строка игрока не дублируется', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await mockMaster(page, bodies, 0, [], undefined, true);
  await openGame(page);
  const log = page.getByRole('log');
  await send(page, 'Оглядываюсь');
  await expect(log).toContainText('ключ'); // причина отказа провайдера
  await send(page, '/retry');
  await expect(log).toContainText('Дождь стучит');
  expect(bodies).toHaveLength(2);
  expect(JSON.stringify(bodies[1])).toContain('Оглядываюсь');
  expect(((await log.innerText()).match(/Вы> Оглядываюсь/g) ?? []).length).toBe(1);
});

test('/undo отменяет и бытовое действие с вещами', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'фокус в строке ввода: сценарий десктопной раскладки');
  await mockMaster(page, []);
  await openGame(page);
  const list = page.getByRole('listbox', { name: 'Вещи' });
  await openInventory(page);
  await pickAction(page, 'Кинжал');
  await expect(list).toContainText('[основная рука]');
  await page.keyboard.press('Escape'); // фокус из панели в строку ввода
  await expect(page.getByRole('textbox')).toBeFocused();
  await send(page, '/undo');
  await expect(page.getByRole('log')).toContainText('Отменено последнее действие с вещами');
  await expect(list).not.toContainText('[основная рука]');
  await expect(page.getByRole('log')).not.toContainText('берёт «Кинжал»');
});

test('номер варианта вместо текста: «2» уходит Мастеру текстом второго варианта и так же записан в ленте', async ({ page }) => {
  const bodies: Record<string, unknown>[] = [];
  await mockMaster(page, bodies);
  await openGame(page);
  const log = page.getByRole('log');
  const bar = page.locator('.tui-statusbar');
  await send(page, '/start');
  await expect(log).toContainText('2. Заказать эль');
  await expect(bar).not.toContainText('Мастер отвечает');

  await send(page, '2');
  await expect(async () => expect(bodies).toHaveLength(2)).toPass();
  expect(JSON.stringify(bodies[1])).toContain('PLAYER (Ирма): Заказать эль');
  expect(JSON.stringify(bodies[1])).not.toContain('PLAYER (Ирма): 2');
  await expect(log).toContainText('Вы> Заказать эль');
  await expect(bar).not.toContainText('Мастер отвечает');

  // номер вне списка и число в предложении уходят как написано
  await send(page, '7');
  await expect(async () => expect(bodies).toHaveLength(3)).toPass();
  expect(JSON.stringify(bodies[2])).toContain('PLAYER (Ирма): 7');
});

test('Markdown в ответе Мастера: разметка не попадает на экран, заголовок, жирный, курсив и список выглядят как текст', async ({ page }) => {
  await mockMaster(page, [], 0, [], '## Таверна\n\nЭто **важно** и *тихо*, см. `ключ`.\n\n- первое\n- второе');
  await openGame(page);
  await page.keyboard.type('/start');
  await page.keyboard.press('Enter');
  const log = page.getByRole('log');
  await expect(log).toContainText('Таверна');
  await expect(log).toContainText('• первое');
  await expect(log).toContainText('• второе');
  const text = await log.innerText();
  expect(text).not.toMatch(/\*\*|##|`/);
  expect(text).toContain('Это важно и тихо, см. ключ.');
  // жирный и курсив — цветом токенов палитры (terminal: fgBright, accent2), а не символами
  await expect(log.locator('span', { hasText: /^важно$/ })).toHaveCSS('color', 'rgb(255, 255, 255)'); // fgBright
  await expect(log.locator('span', { hasText: /^тихо$/ })).toHaveCSS('color', 'rgb(232, 197, 71)'); // accent2
});
