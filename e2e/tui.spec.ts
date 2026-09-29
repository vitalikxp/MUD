import { expect, test } from '@playwright/test';
import { expectFramesAligned, preconfigured, trackErrors } from './helpers';

test.beforeEach(async ({ page }) => {
  await preconfigured(page); // без настроек показывается только окно первого запуска
});

test('главный экран: сетка, панели, рамки, шрифт, без ошибок', async ({ page }, info) => {
  const errors = trackErrors(page);
  await page.goto('/dev/chat');
  const screen = page.locator('.tui-screen');
  await expect(screen).toBeVisible();
  const cols = Number(await screen.getAttribute('data-cols'));
  if (info.project.name === 'desktop') expect(cols).toBeGreaterThanOrEqual(80);
  else expect(cols).toBeLessThan(80);
  await expect(page.getByRole('region', { name: 'Хроника' })).toBeVisible();
  await expectFramesAligned(page);
  expect(await page.evaluate(() => document.fonts.check('16px "SWRD PxPlus IBM VGA"', 'Яж█═'))).toBe(true);
  expect(errors).toEqual([]);
});

test('команды: /palette меняет палитру, /help открывает справку, неизвестная команда даёт подсказку', async ({ page }) => {
  await page.goto('/dev/chat');
  const input = page.getByRole('textbox');
  await input.fill('/palette amber');
  await input.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'amber');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#140c00'); // панель браузера в цвет янтарной палитры
  await expect(page.getByRole('log')).toContainText('Палитра: Янтарь');
  await input.fill('/dance');
  await input.press('Enter');
  await expect(page.getByRole('log')).toContainText('Неизвестная команда: /dance');
  await input.fill('/help');
  await input.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Помощь' })).toBeVisible();
});

test('язык переключается командой и сохраняется после перезагрузки', async ({ page }) => {
  await page.goto('/dev/chat');
  const input = page.getByRole('textbox');
  await input.fill('/lang en');
  await input.press('Enter');
  await expect(page.getByRole('region', { name: 'Chronicle' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.reload();
  await expect(page.getByRole('region', { name: 'Chronicle' })).toBeVisible();
});

test('десктоп: F1 открывает справку, Esc закрывает; F8 — палитры с клавиатуры', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'F-клавиши — десктопная раскладка');
  await page.goto('/dev/chat');
  await expect(page.getByRole('region', { name: 'Хроника' })).toBeVisible(); // экран смонтирован, обработчики клавиш зарегистрированы
  await page.keyboard.press('F1');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectFramesAligned(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('textbox')).toBeFocused(); // диалог вернул фокус на место
  await page.keyboard.press('F8');
  await expect(page.getByRole('dialog', { name: 'Палитра' })).toBeVisible();
  await expect(page.getByRole('listbox')).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'high-contrast'); // предпросмотр сразу
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'high-contrast');
  await expect(page.getByRole('textbox')).toBeFocused();
});

test('палитра в окне: Esc возвращает прежнюю; на главном экране боковых панелей нет', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'F-клавиши — десктопная раскладка');
  await page.goto('/dev/chat');
  await expect(page.getByRole('region', { name: 'Хроника' })).toBeVisible();
  await expect(page.getByRole('listbox')).toHaveCount(0); // палитра больше не висит сбоку
  await expect(page.getByRole('region', { name: 'Состояние' })).toHaveCount(0);
  await expect(page.locator('.tui-panel')).toHaveCount(1); // одна хроника на всю ширину
  await page.keyboard.press('F8');
  await expect(page.getByRole('listbox')).toBeFocused();
  await page.keyboard.press('ArrowDown'); // Янтарь
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'amber');
  await page.keyboard.press('Escape');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'terminal'); // откат
  await expect(page.getByRole('log')).not.toContainText('Палитра: Янтарь'); // и в хронике ничего лишнего
});

test('окно состояния (F7): сетка, палитра, модель', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'F-клавиши — десктопная раскладка');
  await page.goto('/dev/chat');
  await expect(page.getByRole('region', { name: 'Хроника' })).toBeVisible();
  await page.keyboard.press('F7');
  const dialog = page.getByRole('dialog', { name: 'Состояние' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Сетка: ');
  await expect(dialog).toContainText('Палитра: Терминал');
  await expect(dialog).toContainText('Последний ответ: —');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('строка состояния: готов, модель; помещается в одну строку сетки', async ({ page }) => {
  await page.goto('/dev/chat');
  const bar = page.locator('.tui-statusbar');
  await expect(bar).toContainText('● готов · gpt-5.6-luna');
  const overflow = await bar.evaluate((el) => el.querySelector('.tui-row')!.scrollWidth > el.clientWidth + 0.5);
  expect(overflow).toBe(false);
  expect((await bar.boundingBox())!.height).toBeCloseTo(16, 0);
});

test('мобильная раскладка: вкладки вместо F-клавиш', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'только узкий экран');
  await page.goto('/dev/chat');
  await expect(page.getByRole('tablist')).toBeVisible();
  await page.getByRole('tab', { name: 'Палитра' }).click();
  await expect(page.getByRole('dialog', { name: 'Палитра' })).toBeVisible();
  await page.getByRole('option', { name: /Сепия/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'sepia');
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.getByRole('tab', { name: 'Состояние' }).click();
  await expect(page.getByRole('dialog', { name: 'Состояние' })).toBeVisible();
});

test('/dev/glyphs открывается по прямой ссылке, рамки ровные', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/dev/glyphs');
  await expect(page.getByText('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', { exact: true })).toBeVisible();
  await expectFramesAligned(page);
  expect(errors).toEqual([]);
});

test('курсор мыши: блок в клетке сетки, системный курсор скрыт; на сенсорном экране его нет', async ({ page }, info) => {
  await page.goto('/dev/chat');
  await expect(page.getByRole('region', { name: 'Хроника' })).toBeVisible();
  const cursor = page.locator('.tui-mouse-cursor');
  if (info.project.name === 'mobile') {
    await expect(cursor).toBeHidden();
    await expect(page.locator('.tui-screen')).not.toHaveClass(/has-mouse-cursor/);
    return;
  }
  await expect(cursor).toBeHidden(); // до первого движения — системный курсор
  await page.mouse.move(305, 203);
  await expect(cursor).toBeVisible();
  await expect(page.locator('.tui-screen')).toHaveClass(/has-mouse-cursor/);
  const { cellW, cellH, screenLeft, screenTop } = await page.evaluate(() => {
    const s = document.querySelector('.tui-screen')!;
    const r = s.getBoundingClientRect();
    const cs = getComputedStyle(s);
    return { cellW: parseFloat(cs.getPropertyValue('--cw')), cellH: parseFloat(cs.getPropertyValue('--ch')), screenLeft: r.left, screenTop: r.top };
  });
  const box = (await cursor.boundingBox())!;
  expect(box.width).toBeCloseTo(cellW, 1);
  expect(box.height).toBeCloseTo(cellH, 1);
  expect((box.x - screenLeft) / cellW).toBeCloseTo(Math.floor((305 - screenLeft) / cellW), 1); // привязан к клетке
  expect((box.y - screenTop) / cellH).toBeCloseTo(Math.floor((203 - screenTop) / cellH), 1);
  expect(await page.locator('.tui-panel').first().evaluate((el) => getComputedStyle(el).cursor)).toBe('none');
  await page.mouse.down();
  await expect(cursor).toHaveClass(/is-pressed/);
  await page.mouse.up();
  await expect(cursor).not.toHaveClass(/is-pressed/);
  await expect(page.locator('.tui-mouse-cursor')).toHaveCSS('mix-blend-mode', 'difference');
});

test('F1/F7/F8: повторное нажатие закрывает своё окно, а не уходит браузеру; другая клавиша переключает окно', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'F-клавиши — десктопная раскладка');
  await page.goto('/dev/chat');
  await expect(page.getByRole('region', { name: 'Хроника' })).toBeVisible();
  // Слушатель, зарегистрированный ПОСЛЕ приложения: увидит, погасило ли оно событие (иначе клавишу получит браузер).
  await page.evaluate(() => {
    (window as unknown as { pressedKeys: [string, boolean][] }).pressedKeys = [];
    window.addEventListener('keydown', (e) => (window as unknown as { pressedKeys: [string, boolean][] }).pressedKeys.push([e.key, e.defaultPrevented]));
  });
  const dialog = page.getByRole('dialog');

  for (const [key, name] of [['F1', 'Помощь'], ['F7', 'Состояние'], ['F8', 'Палитра']] as const) {
    await page.keyboard.press(key);
    await expect(page.getByRole('dialog', { name })).toBeVisible();
    await page.keyboard.press(key);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('textbox')).toBeFocused();
  }
  const keys = await page.evaluate(() => (window as unknown as { pressedKeys: [string, boolean][] }).pressedKeys);
  expect(keys.filter(([k]) => /^F\d+$/.test(k))).toHaveLength(6);
  expect(keys.filter(([k, prevented]) => /^F\d+$/.test(k) && !prevented)).toEqual([]); // ни одна F-клавиша не ушла браузеру

  // Из одного окна — в другое одной клавишей.
  await page.keyboard.press('F1');
  await expect(page.getByRole('dialog', { name: 'Помощь' })).toBeVisible();
  await page.keyboard.press('F7');
  await expect(page.getByRole('dialog', { name: 'Состояние' })).toBeVisible();
  await expect(dialog).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('палитра: закрытие без выбора любым способом откатывает предпросмотр; выбор — сохраняет', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'F-клавиши — десктопная раскладка');
  await page.goto('/dev/chat');
  await expect(page.getByRole('region', { name: 'Хроника' })).toBeVisible();
  const palette = page.locator('html');

  await page.keyboard.press('F8');
  await expect(page.getByRole('listbox')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(palette).toHaveAttribute('data-palette', 'amber');
  await page.keyboard.press('F8'); // повторная клавиша = отмена
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(palette).toHaveAttribute('data-palette', 'terminal');

  await page.keyboard.press('F8');
  await expect(page.getByRole('listbox')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(palette).toHaveAttribute('data-palette', 'amber');
  await page.keyboard.press('F1'); // переход в другое окно = отмена
  await expect(page.getByRole('dialog', { name: 'Помощь' })).toBeVisible();
  await expect(palette).toHaveAttribute('data-palette', 'terminal');
  await page.keyboard.press('Escape');

  await page.keyboard.press('F8');
  await expect(page.getByRole('listbox')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter'); // подтверждение
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(palette).toHaveAttribute('data-palette', 'amber');
  await expect(page.getByRole('log')).toContainText('Палитра: Янтарь');
});

test('черновой чат: лента не теряется после захода на другой экран и возврата назад', async ({ page }) => {
  await page.goto('/dev/chat');
  const input = page.getByRole('textbox');
  await expect(input).toBeFocused();
  await input.fill('/palette amber');
  await input.press('Enter');
  await expect(page.getByRole('log')).toContainText('Палитра: Янтарь');
  await input.fill('/glyphs');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/dev\/glyphs$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/dev\/chat$/);
  await expect(page.getByRole('log')).toContainText('Палитра: Янтарь');
});

test('окно, закрытое сразу после открытия (до первого кадра), возвращает фокус в поле ввода', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'F-клавиши — десктопная раскладка');
  await page.goto('/dev/chat');
  await expect(page.getByRole('textbox')).toBeFocused();
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('F1');
    await page.keyboard.press('F1'); // без ожиданий между нажатиями
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('textbox')).toBeFocused();
  }
});
