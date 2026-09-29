import { expect, test, type Page } from '@playwright/test';
import { expectFramesAligned, preconfigured, trackErrors } from './helpers';

test.beforeEach(async ({ page }) => {
  await preconfigured(page);
});

/** Титульный экран смонтирован, список кампаний в фокусе (иначе клавиши уйдут в никуда). */
async function openTitle(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('region', { name: /Кампании/ })).toBeVisible();
  await expect(page.getByRole('listbox', { name: 'Кампании' })).toBeFocused();
}

async function typeInField(page: Page, text: string): Promise<void> {
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+A');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

/** Создать кампанию через диалог: название, вариант (по умолчанию «Фэнтези»). */
async function createCampaign(page: Page, title: string): Promise<void> {
  await page.keyboard.press('F3');
  await expect(page.getByRole('dialog', { name: 'Новая кампания' })).toBeVisible();
  await expect(page.getByRole('menu')).toBeFocused();
  await typeInField(page, title);
  await expect(page.getByRole('menuitem', { name: new RegExp(title) })).toBeVisible();
  await page.keyboard.press('ArrowDown'); // вариант
  await page.keyboard.press('ArrowDown'); // Создать
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: /Создание героя/ })).toBeVisible();
}

test('титульный экран: пустой список, сетка, без ошибок', async ({ page }) => {
  const errors = trackErrors(page);
  await openTitle(page);
  await expect(page.getByText('Кампаний пока нет')).toBeVisible();
  await expect(page.getByRole('option', { name: /Новая кампания/ })).toBeVisible();
  await expectFramesAligned(page);
  expect(errors).toEqual([]);
});

test('кампания: создать, выбрать шаблон, имя и навыки, игра; после перезагрузки всё на месте; удаление', async ({ page }) => {
  const errors = trackErrors(page);
  await openTitle(page);
  await createCampaign(page, 'Пограничье');

  // 1. шаблон: третий по списку — Целитель
  await expect(page.getByRole('listbox', { name: 'Шаблон' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByText('Ловкость 2D+2')).toBeVisible();
  await page.keyboard.press('Enter');

  // 2. имя
  await expect(page.getByRole('textbox', { name: 'Герой' })).toBeFocused();
  await page.keyboard.type('Ирма');
  await page.keyboard.press('Enter');

  // 3. навыки: 7D в бюджете, +1D на первый навык
  await expect(page.getByText('Осталось очков навыков: 7D (из 7D)')).toBeVisible();
  await expect(page.getByRole('listbox', { name: 'Навык' })).toBeFocused();
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Осталось очков навыков: 6D (из 7D)')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText('Осталось очков навыков: 6D+1 (из 7D)')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expectFramesAligned(page);
  await page.keyboard.press('F10');

  // игра: вступление, лист героя
  await expect(page.getByRole('region', { name: /Хроника · Пограничье/ })).toBeVisible();
  await expect(page.getByRole('log')).toContainText('Герой: Ирма');
  await page.keyboard.press('F2');
  const sheet = page.getByRole('dialog', { name: 'Ирма — Целитель' });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText('Ловкость');
  await expect(sheet).toContainText('2D+2');
  await expect(sheet).toContainText('26/26');
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  // перезагрузка: тот же адрес, тот же герой
  const url = page.url();
  expect(url).toMatch(/\/game\/[0-9a-f-]{36}$/);
  await page.reload();
  await expect(page.getByRole('log')).toContainText('Герой: Ирма');
  await page.keyboard.press('F2');
  await expect(page.getByRole('dialog', { name: 'Ирма — Целитель' })).toBeVisible();
  await page.keyboard.press('Escape');

  // список кампаний: ходов 1, удаление с подтверждением
  await page.keyboard.press('F10');
  const listbox = page.getByRole('listbox', { name: 'Кампании' });
  await expect(listbox).toBeFocused();
  const item = page.getByRole('option', { name: /Пограничье/ });
  await expect(item).toContainText('ходов: 1');
  await page.keyboard.press('Delete');
  const confirm = page.getByRole('dialog', { name: 'Удаление кампании' });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText('«Пограничье»');
  await expect(page.getByRole('menu')).toBeFocused();
  await page.keyboard.press('Escape'); // отмена ничего не удаляет
  await expect(confirm).toHaveCount(0);
  await expect(listbox).toBeFocused();
  await expect(item).toBeVisible();
  await page.keyboard.press('Delete');
  await expect(confirm).toBeVisible();
  await expect(page.getByRole('menu')).toBeFocused();
  await page.keyboard.press('Enter'); // первый пункт — «Отмена»
  await expect(confirm).toHaveCount(0);
  await expect(listbox).toBeFocused();
  await expect(item).toBeVisible();
  await page.keyboard.press('Delete');
  await expect(confirm).toBeVisible();
  await expect(page.getByRole('menu')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter'); // «Удалить»
  await expect(item).toHaveCount(0);
  await expect(page.getByText('Кампаний пока нет')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Кампаний пока нет')).toBeVisible();
  expect(errors).toEqual([]);
});

test('создание героя: Esc возвращает на шаг назад, лишние очки не выдаются, кампания без героя остаётся в списке', async ({ page }) => {
  await openTitle(page);
  await createCampaign(page, 'Черновик');
  await page.keyboard.press('Enter'); // шаблон → имя
  await expect(page.getByRole('textbox', { name: 'Герой' })).toBeFocused();
  await page.keyboard.press('Escape'); // имя → шаблон
  await expect(page.getByRole('listbox', { name: 'Шаблон' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Тень');
  await page.keyboard.press('Enter');
  // в один навык не больше +3D (девять очков)
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByText('Осталось очков навыков: 4D (из 7D)')).toBeVisible();
  await page.keyboard.press('Escape'); // навыки → имя
  await expect(page.getByRole('textbox', { name: 'Герой' })).toBeFocused();
  await page.keyboard.press('Escape'); // имя → шаблон
  await expect(page.getByRole('listbox', { name: 'Шаблон' })).toBeFocused();
  await page.keyboard.press('Escape'); // шаблон → список кампаний
  await expect(page.getByRole('listbox', { name: 'Кампании' })).toBeFocused();
  await expect(page.getByRole('option', { name: /Черновик/ })).toContainText('герой не создан');
  await page.keyboard.press('Enter'); // продолжить создание
  await expect(page.getByRole('region', { name: /Создание героя/ })).toBeVisible();
});

test('адреса: несуществующая кампания и неизвестный путь', async ({ page }) => {
  await page.goto('/game/00000000-0000-0000-0000-000000000000');
  await expect(page.getByText('Такой кампании нет')).toBeVisible();
  await page.getByRole('button', { name: /Кампании/ }).click();
  await expect(page.getByRole('region', { name: /Кампании/ })).toBeVisible();
  await page.goto('/nope');
  await expect(page.getByRole('region', { name: /Кампании/ })).toBeVisible();
});

test('второй вариант правил и английский: кампания «Adventure» с шаблоном Bodyguard', async ({ page }) => {
  await openTitle(page);
  await page.keyboard.press('F9'); // язык интерфейса → English
  await expect(page.getByRole('region', { name: /Campaigns/ })).toBeVisible();
  await page.keyboard.press('F3');
  await expect(page.getByRole('dialog', { name: 'New campaign' })).toBeVisible();
  await expect(page.getByRole('menu')).toBeFocused();
  await page.keyboard.press('ArrowDown'); // вариант
  await page.keyboard.press('ArrowRight'); // → Adventure
  await expect(page.getByRole('menuitem', { name: /Adventure/ })).toBeVisible();
  await page.keyboard.press('ArrowDown'); // Create
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: /Hero creation/ })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Bodyguard' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Boris');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Skill points left: 7D (of 7D)')).toBeVisible();
  await page.keyboard.press('F10');
  await expect(page.getByRole('region', { name: /Chronicle · Campaign/ })).toBeVisible();
  await expect(page.getByRole('log')).toContainText('Hero: Boris');
  await expect(page.locator('.tui-fkeys, .tui-tabs')).toContainText(/Character|Sheet/); // F2 (десктоп) / вкладка (телефон)
  await expect(page.locator('.tui-fkeys, .tui-tabs')).not.toContainText('Glyph'); // раздела «Глифы» в меню больше нет
  await page.keyboard.press('F2');
  const sheet = page.getByRole('dialog', { name: 'Boris — Bodyguard' });
  await expect(sheet).toContainText('Reflexes');
  await expect(sheet).toContainText('33/33');
});

test('очки навыков: PgUp/PgDn меняют очки выбранного навыка на кубик и не двигают курсор', async ({ page }) => {
  await openTitle(page);
  await createCampaign(page, 'Кубики');
  await expect(page.getByRole('listbox', { name: 'Шаблон' })).toBeFocused();
  await page.keyboard.press('Enter');
  await page.keyboard.type('Тень');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Навык' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); // третий навык
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  const row = page.getByRole('option', { name: /рукопашный бой/ });
  await expect(row).toContainText('+2');
  await page.keyboard.press('PageUp');
  await expect(row).toContainText('+1D+2');
  await expect(row).toHaveAttribute('aria-selected', 'true'); // курсор остался на месте
  await expect(page.getByText('Осталось очков навыков: 5D+1 (из 7D)')).toBeVisible();
  await page.keyboard.press('PageDown');
  await page.keyboard.press('PageDown');
  await expect(row).toHaveAttribute('aria-selected', 'true');
  await expect(row).not.toContainText('+');
  await expect(page.getByText('Осталось очков навыков: 7D (из 7D)')).toBeVisible();
});

test('слишком длинное имя героя и название кампании отвергаются сразу, на своём шаге', async ({ page }) => {
  await openTitle(page);
  await page.keyboard.press('F3');
  await expect(page.getByRole('menu')).toBeFocused();
  await typeInField(page, 'Ы'.repeat(81));
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Название не длиннее 80 символов')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Новая кампания' })).toBeVisible();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await typeInField(page, 'Обычное');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Шаблон' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('textbox', { name: 'Герой' })).toBeFocused();
  await page.keyboard.type('Я'.repeat(41));
  await page.keyboard.press('Enter');
  await expect(page.getByText('Имя не длиннее 40 символов')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Герой' })).toBeFocused(); // остались на шаге имени
  await page.keyboard.type('Тень');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Осталось очков навыков: 7D (из 7D)')).toBeVisible();
});

test('поле ввода в форме: текст начинается с первой ячейки значения, без отступа приглашения', async ({ page }) => {
  await openTitle(page);
  await page.keyboard.press('F3');
  await expect(page.getByRole('menu')).toBeFocused();
  await page.keyboard.press('Enter'); // правка названия
  const row = page.locator('.tui-input .tui-row');
  await expect(row).toBeVisible();
  const text = (await row.textContent()) ?? '';
  expect(text.startsWith('Кампания')).toBe(true);
  // значение в строке формы и в поле ввода начинается в одной и той же ячейке
  const editX = await page.locator('.tui-input').evaluate((el) => el.getBoundingClientRect().left);
  const variantX = await page.getByRole('menuitem', { name: /Вариант правил/ }).evaluate((el) => {
    const value = el.querySelectorAll('span')[1]!;
    return value.getBoundingClientRect().left;
  });
  expect(Math.abs(editX - variantX)).toBeLessThan(1);
});

test('малый экран: описание шаблона и список навыков прокручиваются, лист героя листается и показывает особенности в одну колонку', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 420 });
  await openTitle(page);
  await createCampaign(page, 'Малый экран');

  // описание не помещается: полоса прокрутки, хвост виден только после PgDn
  await expect(page.getByRole('listbox', { name: 'Шаблон' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); // Истребитель чудовищ
  await expect(page.getByText('Когда банда чудовищ')).toBeVisible();
  await expect(page.locator('.tui-scrollbar')).toHaveCount(1);
  await expect(page.getByText('Особенности:')).toHaveCount(0);
  await page.keyboard.press('PageDown');
  await expect(page.getByText('Особенности:')).toBeVisible();
  await expect(page.getByRole('option', { name: 'Истребитель чудовищ' })).toHaveAttribute('aria-selected', 'true'); // курсор списка не сдвинулся
  await page.keyboard.press('PageUp');
  await expect(page.getByText('Особенности:')).toHaveCount(0);
  await page.mouse.move(200, 330);
  await page.mouse.wheel(0, 400); // колесо над описанием
  await expect(page.getByText('Особенности:')).toBeVisible();

  // список навыков длиннее экрана: полоса у списка, до последнего пункта добираемся клавишей End
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp'); // Бард
  await page.keyboard.press('Enter');
  await page.keyboard.type('Тень');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listbox', { name: 'Навык' })).toBeFocused();
  await expect(page.locator('.tui-scrollbar')).toHaveCount(1);
  await page.keyboard.press('End');
  await expect(page.getByRole('option', { name: /Создать героя/ })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('F10');

  // лист героя: длиннее окна, особенности в одну колонку (заголовок и описание отдельными строками)
  await expect(page.getByRole('region', { name: /Хроника · Малый экран/ })).toBeVisible();
  await expect(page.getByRole('textbox')).toBeFocused(); // обработчики F-клавиш уже подключены
  await page.keyboard.press('F2');
  const sheet = page.getByRole('dialog', { name: 'Тень — Бард' });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator('.tui-scrollbar')).toHaveCount(1);
  await expect(sheet.getByText('Причуда R1 · Недостаток')).toHaveCount(0);
  await page.keyboard.press('End');
  await expect(sheet.getByText('Причуда R1 · Недостаток')).toBeVisible();
  await expect(sheet.getByText('Муза настигает вас')).toBeVisible();
  const rows = await sheet.locator('.tui-row').allTextContents();
  expect(rows.some((r) => /Недостаток\s+Муза/.test(r))).toBe(false); // не в две колонки
});
