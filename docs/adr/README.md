# Architecture Decision Records

Каждое существенное решение — отдельный файл `NNNN-kebab-name.md`. Принятые ADR не редактируются по сути:
если решение меняется, пишется новый ADR со ссылкой `Supersedes: NNNN`, а у старого меняется статус.

## Шаблон

```markdown
# NNNN. Заголовок

- Статус: Proposed | Accepted | Superseded by NNNN
- Дата: YYYY-MM-DD

## Контекст
Какая проблема и какие силы действуют.

## Решение
Что решили.

## Последствия
Что становится проще, что сложнее, какие риски.

## Альтернативы
Что рассматривали и почему отказались.
```

## Журнал

| # | Решение | Статус |
|---|---|---|
| [0001](0001-static-spa-byok.md) | Статический SPA на GitHub Pages + BYOK | Accepted |
| [0002](0002-llm-relay-provider-agnostic.md) | Stateless-relay на Cloudflare Worker, провайдер-агностичный клиент | Accepted |
| [0003](0003-llm-narrates-engine-decides.md) | LLM рассказывает, движок решает (tool calling) | Accepted |
| [0004](0004-event-sourcing.md) | Журнал событий + проекции | Accepted |
| [0005](0005-host-authoritative-coop.md) | Кооп с хостом-авторитетом и арендой | Accepted |
| [0006](0006-firestore-plus-rtdb.md) | Firestore для состояния, RTDB для присутствия и стрима | Accepted |
| [0007](0007-modular-rules.md) | Модульные правила (первый модуль заменён 0011) | Accepted, частично заменён 0011 |
| [0008](0008-dom-char-grid-preact.md) | TUI на DOM-сетке символов, Preact + Signals | Accepted |
| [0009](0009-local-first-storage.md) | Local-first: соло без Firebase, экспорт JSON | Accepted |
| [0010](0010-dm-secrets-encryption.md) | Шифрование секретов Мастера (AES-GCM, ключ у хоста) | Accepted |
| [0011](0011-opend6-first-module.md) | Первый модуль правил — OpenD6 (варианты `fantasy`, `adventure`) | Accepted |
| [0012](0012-licensing.md) | Лицензии: Unlicense + CC0 1.0 + OGL 1.0a для OpenD6 | Accepted, код заменён 0013 |
| [0013](0013-code-license-0bsd.md) | Лицензия кода — 0BSD | Accepted |
| [0014](0014-reference-books-in-git.md) | Книги OpenD6 в git без LFS | Accepted |
| [0015](0015-llm-three-api-formats.md) | LLM-клиент: Chat Completions, Responses, Anthropic Messages | Accepted, этапы уточнены 0016 |
| [0016](0016-default-models-pareto.md) | Модели по умолчанию: самые дешёвые на парето-фронте «цена / творческое письмо» | Accepted, выбор заменён 0017 |
| [0017](0017-default-model-muse-spark.md) | Модель по умолчанию — Muse Spark 1.3 Contributor; пресеты «Приватный» и «Качество» | Accepted |
| [0018](0018-reasoning-effort-and-go-headers.md) | Уровень рассуждений по ролям, обязательные заголовки OpenCode Go, `enum` в схемах инструментов | Accepted |
| [0019](0019-typescript7-oxlint-font-source.md) | TypeScript 7 + oxlint вместо ESLint; источник шрифта PxPlus, маркер `♦` | Accepted |
| [0020](0020-single-font.md) | Один шрифт (PxPlus), без переключения | Accepted |
