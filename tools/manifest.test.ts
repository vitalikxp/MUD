import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../public/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('site.webmanifest', root), 'utf8')) as {
  name: string; short_name: string; description: string; start_url: string; scope: string; display: string;
  background_color: string; theme_color: string; lang: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
};

/** Размер PNG из заголовка IHDR. */
function pngSize(file: URL): [number, number] {
  const b = readFileSync(file);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('site.webmanifest', () => {
  it('заполнен, без значений из шаблона генератора', () => {
    expect(manifest.name).toContain('SWRD');
    expect(manifest.short_name).toBe('SWRD');
    expect(manifest.description).not.toMatch(/Application description/i);
    expect(`${manifest.name} ${manifest.short_name}`).not.toMatch(/Your Application Name|\bApp\b/);
    expect(manifest.lang).toBe('ru');
    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    expect(manifest.display).toBe('standalone');
  });

  it('цвета совпадают с палитрой по умолчанию (terminal), а не с белым фоном шаблона', () => {
    const terminal = JSON.parse(readFileSync(new URL('../content/palettes/terminal.json', import.meta.url), 'utf8')) as { colors: { bg: string } };
    expect(manifest.background_color).toBe(terminal.colors.bg);
    expect(manifest.theme_color).toBe(terminal.colors.bg);
  });

  it('иконки существуют и заявленные размеры совпадают с файлами; maskable не заявлен (логотип без полей)', () => {
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    for (const icon of manifest.icons) {
      const file = new URL(icon.src.replace(/^\//, ''), root);
      expect(existsSync(file), icon.src).toBe(true);
      if (icon.type === 'image/png') {
        const [w, h] = icon.sizes.split('x').map(Number);
        expect(pngSize(file), icon.src).toEqual([w, h]);
      }
      expect(icon.purpose).not.toContain('maskable');
    }
    expect(manifest.icons.some((i) => i.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === '512x512')).toBe(true);
  });
});
