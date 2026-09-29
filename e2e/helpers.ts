import { expect, type Page } from '@playwright/test';

/** Настройки LLM уже заданы (приватный пресет без согласия на обучение + ключ), релей — встроенный из .env.default. */
export async function preconfigured(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('swrd.llm.v1', JSON.stringify({ preset: 'private', remember: true }));
    localStorage.setItem('swrd.llm.key.v1', 'sk-test');
  });
}

/** Ошибки страницы и консоли за время теста. */
export function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  return errors;
}

/** Все строки каждой рамки одной длины — рамки смыкаются в сетке. */
export async function expectFramesAligned(page: Page): Promise<void> {
  const widths = await page.$$eval('.tui-frame', (frames) =>
    frames.map((f) => [...new Set([...f.querySelectorAll('.tui-row')].map((r) => Array.from(r.textContent ?? '').length))]),
  );
  expect(widths.length).toBeGreaterThan(0);
  for (const w of widths) expect(w).toHaveLength(1);
}
