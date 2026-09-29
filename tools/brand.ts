// Подстановка имени проекта из brand.json в index.html и site.webmanifest: `%BRAND_NAME%`, `%BRAND_DOMAIN%`, `%BRAND_DESCRIPTION_RU%`, `%BRAND_DESCRIPTION_EN%`.
import { readFileSync, writeFileSync } from 'node:fs';
import type { Plugin } from 'vite';

interface Brand { name: string; id: string; domain: string; description: { ru: string; en: string } }

export function loadBrand(): Brand {
  return JSON.parse(readFileSync(new URL('../brand.json', import.meta.url), 'utf8')) as Brand;
}

/** JSON-безопасная подстановка: значения попадают и в HTML, и в JSON, поэтому кавычки и слэши экранируются. */
export function applyBrand(text: string, brand: Brand = loadBrand()): string {
  const vars: Record<string, string> = {
    BRAND_NAME: brand.name, BRAND_ID: brand.id, BRAND_DOMAIN: brand.domain,
    BRAND_DESCRIPTION_RU: brand.description.ru, BRAND_DESCRIPTION_EN: brand.description.en,
  };
  return text.replace(/%(BRAND_[A-Z_]+)%/g, (m, key: string) => (key in vars ? vars[key]!.replace(/["\\]/g, '\\$&') : m));
}

const MANIFEST = '/site.webmanifest';

export function brandPlugin(): Plugin {
  let outDir = 'dist';
  return {
    name: 'brand',
    configResolved(config) { outDir = config.build.outDir; },
    transformIndexHtml: (html) => applyBrand(html),
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== MANIFEST) return next();
        res.setHeader('content-type', 'application/manifest+json');
        res.end(applyBrand(readFileSync('public/site.webmanifest', 'utf8')));
      });
    },
    // public/ копируется как есть, поэтому манифест подставляем уже в dist/.
    closeBundle() {
      const file = `${outDir}${MANIFEST}`;
      writeFileSync(file, applyBrand(readFileSync(file, 'utf8')));
    },
  };
}
