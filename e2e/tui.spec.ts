import { expect, test, type Page } from '@playwright/test';

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

/** Все строки каждой рамки одной длины — рамки смыкаются в сетке. */
async function expectFramesAligned(page: Page): Promise<void> {
  const widths = await page.$$eval('.tui-frame', (frames) =>
    frames.map((f) => [...new Set([...f.querySelectorAll('.tui-row')].map((r) => Array.from(r.textContent ?? '').length))]),
  );
  expect(widths.length).toBeGreaterThan(0);
  for (const w of widths) expect(w).toHaveLength(1);
}

test('главный экран: сетка, панели, рамки, шрифт, без ошибок', async ({ page }, info) => {
  const errors = trackErrors(page);
  await page.goto('/');
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

test('команды: /palette меняет палитру, заявка без настройки LLM даёт подсказку', async ({ page }) => {
  await page.goto('/');
  const input = page.getByRole('textbox');
  await input.fill('осматриваю алтарь');
  await input.press('Enter');
  await expect(page.getByRole('log')).toContainText('Мастер не настроен');
  await input.fill('/palette amber');
  await input.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'amber');
  await expect(page.getByRole('log')).toContainText('Палитра: Янтарь');
});

test('язык переключается командой и сохраняется после перезагрузки', async ({ page }) => {
  await page.goto('/');
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
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Хроника' })).toBeVisible(); // экран смонтирован, обработчики клавиш зарегистрированы
  await page.keyboard.press('F1');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expectFramesAligned(page);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('textbox')).toBeFocused(); // диалог вернул фокус на место
  await page.keyboard.press('F8');
  await expect(page.getByRole('listbox')).toBeFocused();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'high-contrast');
});

test('мобильная раскладка: вкладки вместо F-клавиш', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'только узкий экран');
  await page.goto('/');
  await expect(page.getByRole('tablist')).toBeVisible();
  await page.getByRole('tab', { name: 'Палитра' }).click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.getByRole('option', { name: /Сепия/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'sepia');
});

test('/dev/glyphs открывается по прямой ссылке, рамки ровные', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/dev/glyphs');
  await expect(page.getByText('АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ', { exact: true })).toBeVisible();
  await expectFramesAligned(page);
  expect(errors).toEqual([]);
});

test('курсор мыши: блок в клетке сетки, системный курсор скрыт; на сенсорном экране его нет', async ({ page }, info) => {
  await page.goto('/');
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
