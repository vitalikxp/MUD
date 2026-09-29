# Relay проекта

Stateless-прокси на Cloudflare Worker (бесплатный тариф): браузеру нужен CORS, а у OpenCode Go его нет
(проверено 2026-09-28: предзапрос `OPTIONS` даёт 404 без `Access-Control-*`). Relay пересылает запрос к провайдеру и **ничего не хранит и не логирует**
(тест `relay does not log` проверяет, что `console.*` не вызывается).

## Контракт

```
POST {relay}/v1/chat/completions | /v1/responses
GET  {relay}/v1/models            (список моделей провайдера для окна выбора модели)
Headers: Authorization, x-opencode-session, X-Upstream: https://opencode.ai/zen/go/v1
```
Запрос уходит на `X-Upstream + / + <endpoint>`. Ответ (включая SSE-поток и коды ошибок провайдера) возвращается как есть.

Что проверяется:
- `Origin` — из `ALLOWED_ORIGINS` (по умолчанию `https://mud.vitalik.dev`, берётся из `brand.json`); `http://localhost:*` разрешён всегда; иначе 403;
- хост `X-Upstream` — только `https` и только из allowlist: `opencode.ai`, `openrouter.ai`, `generativelanguage.googleapis.com`, `api.openai.com`
  (+ `EXTRA_UPSTREAM_HOSTS`); адреса с логином/паролем и IP-адреса отклоняются;
- путь — только два эндпоинта для `POST` (`chat/completions`, `responses`) и `/v1/models` для `GET`; другие методы и пути отвергаются (405/404).

Провайдеру передаются лишь `content-type`, `accept`, `authorization`, `x-opencode-session` и собственный `User-Agent: mud-relay/0.1`
(браузер не позволяет странице менять `User-Agent`, поэтому его выставляет relay). Cookie, Origin и `cf-*` отбрасываются.

## Relay проекта

Worker `mud-relay` (Cloudflare, аккаунт владельца): `https://mud-relay.swrd.workers.dev`. Разрешённый сайт: `https://mud.vitalik.dev`. Проверен боевыми запросами: CORS, отказ чужому origin и чужому провайдеру, потоковый ответ модели.

## Развернуть свой (5 минут)

Нужен бесплатный аккаунт Cloudflare.

```bash
pnpm dlx wrangler@4 login                       # один раз, откроет браузер
# при необходимости поправьте ALLOWED_ORIGINS в relay/wrangler.toml (для форка — ваш домен)
pnpm relay:deploy                               # напечатает адрес вида https://mud-relay.<аккаунт>.workers.dev
```
Дальше адрес relay — в игре: **Настройки LLM → Relay → свой адрес**, либо `VITE_RELAY_URL` в `.env.default` (значение по умолчанию для сборки; режим «встроенный» использует его) или в `.env.local` / переменной репозитория `RELAY_URL` (переопределяют).

Локально: `pnpm relay:dev` (порт 8787), в игре на `http://localhost:5173` укажите `http://localhost:8787`.

## Лимиты бесплатного тарифа Workers

100 000 запросов в сутки на весь relay; 10 мс CPU на запрос, ожидание сети в CPU не входит, потоковые ответы разрешены. Один ход Мастера — 1–12 запросов.
Если лимита не хватает — разверните свою копию.
