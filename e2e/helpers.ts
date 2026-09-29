import type { Page } from '@playwright/test';

/** Настройки LLM уже заданы (приватный пресет без согласия на обучение + ключ), релей — встроенный из .env.default. */
export async function preconfigured(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('swrd.llm.v1', JSON.stringify({ preset: 'private', remember: true }));
    localStorage.setItem('swrd.llm.key.v1', 'sk-test');
  });
}
