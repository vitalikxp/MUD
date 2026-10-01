# AI Dungeon Master: правила для AI-агентов

Обязательно для всех агентов (Claude Code, OpenCode, Codex, Gemini и др.), работающих с репозиторием.
`CLAUDE.md` и `GEMINI.md` ссылаются на этот файл. Правила пишутся здесь, а не там.

## 1. О проекте

Веб-сайт, на котором ИИ ведёт настольную ролевую игру как Мастер (Dungeon Master) для одного или нескольких игроков.
Это не чат с ИИ: система **знает правила и применяет их через код**, **помнит лор, историю, выборы и характеристики**,
показывает состояние игры в инструментах (лист персонажа, инвентарь, карта, карточки монстров).
Интерфейс выглядит как текстовый терминал в духе Norton Commander: моноширинный шрифт, символьные рамки, палитры, которые переключает Мастер.

Главное требование к инфраструктуре: **проект должен работать годами без присмотра и без денег**.
Поэтому здесь только статический сайт, бесплатные тарифы и ключ LLM, который приносит сам игрок (BYOK).

Домен: **https://mud.vitalik.dev**. Рабочее название проекта «AI Dungeon Master» временное: имя и домен лежат в [brand.json](brand.json) (в коде — `src/brand.ts`), литералов имени в коде и UI нет. Технический идентификатор `mud` (ключи localStorage, IndexedDB) при смене имени не меняется. Репозиторий: `git remote -v`, основная ветка `master`.

С документов начинать всегда: [docs/README.md](docs/README.md).

## 2. Git

- **Не коммитить по своей инициативе.** `git commit`, `git push` и создание PR допустимы только по прямой просьбе пользователя.
- По завершении задачи: сборка, тесты, обновлённая документация. Изменения остаются в рабочей директории.
- Файлы больше 50 МиБ не добавлять; Git LFS не используется (квоты трафика, [ADR-0014](docs/adr/0014-reference-books-in-git.md)).

## 3. Стек и команды

- TypeScript 7 (strict, `tsc --noEmit`), Preact + `@preact/signals`, Vite, **pnpm** (npm и yarn не используются), oxlint (не ESLint: `typescript-eslint` несовместим с TS 7, [ADR-0019](docs/adr/0019-typescript7-oxlint-font-source.md)), Vitest, Playwright, Zod.
- UI на Preact: импорты из `preact`, `preact/hooks` и `@preact/signals`, **не из `react`**. `preact/compat` не подключается без отдельного ADR.
  Глобальное состояние хранится в сигналах в `src/app/`, сторонних библиотек стора нет.
- Firebase (тариф Spark): Auth, Firestore, Realtime Database. **Cloud Functions не используются**, на Spark их нет.
- LLM-relay: Cloudflare Worker (`relay/`, бесплатный тариф).
- Модели по умолчанию меняются только новым ADR по методике [ADR-0016](docs/adr/0016-default-models-pareto.md): цены и лимиты — https://opencode.ai/docs/go/, Elo — CSV внутри `https://eqbench.com/creative_writing.js` (HTML-таблица рисуется скриптом, `WebFetch` её не видит).
- Хостинг: GitHub Pages через GitHub Actions.
- Внешние сервисы владельца: relay — Cloudflare Worker `mud-relay` (`pnpm relay:deploy`, нужен `wrangler login`; сертификат нового поддомена выпускается ~1–2 мин); Pages деплоит из `master` (окружение `github-pages` должно разрешать эту ветку).

Команды (`test:rules` появится в следующих вехах, см. [дорожную карту](docs/10-roadmap.md)):

| Команда | Назначение |
|---|---|
| `pnpm dev` | dev-сервер Vite |
| `pnpm preview` | раздача собранного `dist/` на :4173 (её же использует `test:e2e`) |
| `pnpm build` | `tsc --noEmit && vite build` + копия `404.html` для SPA |
| `pnpm test` | unit-тесты (Vitest) |
| `pnpm test <путь>` / `pnpm test -t "<часть имени>"` | один файл или тест по имени, например `pnpm test src/rules/opend6/dice.test.ts` |
| `pnpm test:watch` | Vitest в режиме наблюдения |
| `pnpm test:rules` | тесты правил безопасности Firebase (эмулятор) |
| `pnpm test:e2e` | Playwright по собранному сайту, проекты `desktop` (1280) и `mobile` (390); позже — mock-LLM и эмулятор Firebase |
| `pnpm eval:dm` | сценарные проверки ИИ-мастера на реальной модели: `DM_MODELS=a,b` (или `DM_MODEL`), `DM_SCENARIOS=id,id`, `DM_EFFORT`, `DM_FORMAT`, `DM_LENGTH`, `DM_STYLE`; отчёт в `evals/reports/` ([docs/04](docs/04-ai-dm.md#evals); ключ — см. ниже) |
| `pnpm eval:rescore` | пересчёт проверок evals по сохранённым отчётам без запросов к моделям: `DM_RESCORE=evals/reports/<папка>`, `DM_DROP=id,id` |
| `pnpm lint` / `pnpm typecheck` | oxlint и проверка типов |
| `pnpm docs:check` | то же, что `python3 scripts/check_docs.py` |
| `pnpm relay:dev` / `pnpm relay:deploy` | локальный запуск и деплой relay через `wrangler` ([relay/README.md](relay/README.md)); деплой требует `wrangler login` владельца |
| `python3 scripts/ref/search.py …` | поиск по книгам OpenD6 (работает уже сейчас, см. §8) |
| `python3 scripts/ref/extract.py` | пересобрать `ref/OpenD6/text/` и `INDEX.md` после добавления PDF (запись в `CATALOG`) |
| `python3 scripts/check_docs.py` | проверка документации: ссылки, якоря, ширина ASCII-рамок (код выхода 1 при ошибках) |

- `index.html` и `public/site.webmanifest` содержат плейсхолдеры `%BRAND_NAME%`, `%BRAND_DOMAIN%` и др. Подставляет `tools/brand.ts` (vite-плагин; манифест — в `dist/` после сборки, в dev — middleware). Тест манифеста ждёт плейсхолдеры, а не готовое имя.
- Ключ LLM для dev и evals: `.env.local` → `OPENCODE_GO_API_KEY` (без префикса `VITE_`, иначе Vite вложит ключ в сборку). Значение ключа не выводить в логи и ответы.
- Публичные значения по умолчанию (например `VITE_RELAY_URL`) лежат в `.env.default` (в git, **только `VITE_*`, секретов нет** — это проверяет тест). Приоритет: окружение/CI > `.env.local` > `.env.default`.
  В CI `VITE_RELAY_URL` берётся из переменной репозитория `RELAY_URL` и перекрывает `.env.default`: при смене адреса relay обнови её (`gh variable set RELAY_URL --body <url>`, проверка — `gh variable list`) и перезапусти деплой (`gh workflow run deploy.yml --ref master`).
- Ручной запрос к Go: `POST https://opencode.ai/zen/go/v1/{chat/completions|responses}` (формат зависит от модели) с заголовками `Authorization: Bearer`, `x-opencode-session: <uuid>` (иначе `400 MissingSessionID`) и `User-Agent`.
- Думающим моделям (Muse Spark и др.) задавай `reasoning.effort` и `max_output_tokens` ≥ 1500, иначе ответ может прийти `incomplete` без текста ([ADR-0018](docs/adr/0018-reasoning-effort-and-go-headers.md)).

## 4. Архитектурные инварианты (нарушать нельзя)

1. **LLM рассказывает, движок решает.** Броски, урон, здоровье (Очки тела), предметы, позиции на карте, Очки персонажа и судьбы меняет только код движка
   в ответ на вызовы инструментов (tool calls). Числа, которые модель пишет в тексте, не являются источником истины. См. [04-ai-dm.md](docs/04-ai-dm.md).
2. **`src/engine/` и `src/rules/` чистые.** В них нет Preact, Firebase, `fetch`, `Date.now()` и `Math.random()` (проверяет `src/engine/purity.test.ts`: сканирует все не-тестовые файлы обоих каталогов, кроме `testing.ts`).
   Время и случайность приходят параметрами (сидированный RNG). Любая логика здесь детерминирована и покрыта тестами.
3. **Event sourcing.** Состояние кампании — это свёртка журнала событий. Изменение состояния = новое событие.
   Прямая мутация проекций запрещена. См. [06-data-model.md](docs/06-data-model.md).
4. **Один хост-авторитет.** В кооп-сессии события пишет только клиент, который держит аренду хоста (`hostLease`).
   Остальные клиенты пишут только свои заявки (intents). См. [08-multiplayer.md](docs/08-multiplayer.md).
5. **Ключ LLM не покидает браузер игрока.** Ключ не пишется в Firestore, RTDB, логи или аналитику.
   Relay пересылает запрос дальше и ничего не хранит.
6. **Провайдер-агностичность.** Код работает с двумя форматами API: OpenAI Chat Completions и OpenAI Responses ([ADR-0015](docs/adr/0015-llm-three-api-formats.md), Anthropic Messages не делаем: [ADR-0022](docs/adr/0022-no-anthropic-messages.md)). OpenCode Go только один из пресетов.
   Имена моделей и провайдеров в логике не хардкодятся.
7. **Модуль правил подключаемый.** Ядро и ИИ-мастер обращаются к правилам только через интерфейс `RulesModule`
   ([05-rules-engine.md](docs/05-rules-engine.md)). Конкретику OpenD6 за пределы `src/rules/opend6/` не выносить.
8. **Сетка символов.** Весь UI рисуется в ячейках (колонки × строки). Никаких пиксельных отступов внутри TUI-панелей.
   Цвета берутся только из токенов палитры. См. [07-ui-tui.md](docs/07-ui-tui.md).
   Текст Мастера (запись хроники с `md: true`) рисуется через `markdownLines`; жирный и курсив передаются цветом токенов (`fgBright`, `accent2`), начертание не синтезируется (шрифт один, [ADR-0020](docs/adr/0020-single-font.md)).
9. **Все строки UI идут через i18n** (RU и EN). Литералы на русском или английском в JSX запрещены.
   Имя проекта и домен — только из `brand.json` (`BRAND_NAME`, `BRAND_DOMAIN` в `src/brand.ts`); ключи localStorage — через `storageKey()`. Литералов имени в коде, тестах и UI нет.
10. **Бесплатные тарифы.** Изменения, из-за которых вырастет число чтений/записей Firestore, проверяются по бюджету из
    [06-data-model.md](docs/06-data-model.md#бюджет-бесплатного-тарифа).
11. **Секреты Мастера шифруются.** Всё с `visibility: "dm"` (скрытый лор, тайные броски, полные статблоки) уходит в облако только
    через `src/net/secrets.ts` (AES-GCM, ключ читает только текущий хост). Открытым текстом в Firestore или RTDB — никогда. См. [ADR-0010](docs/adr/0010-dm-secrets-encryption.md).
12. **Лицензии не смешиваются.** Код проекта — 0BSD, контент — CC0 1.0, а `src/rules/opend6/` — OGL 1.0a.
    Не копировать текст или данные OpenD6 за пределы этого каталога (кроме справочника `ref/OpenD6/`, который тоже под OGL). Не использовать товарный знак «D6 System». См. [ADR-0012](docs/adr/0012-licensing.md).
13. **Обучение на данных — только с согласием.** Если модель Мастера отдаёт данные на обучение (`*-contributor`), это раскрывается в UI,
    а участник кооп-кампании подтверждает согласие (`modelConsent`) до отправки заявок. См. FR-LLM-9, [ADR-0017](docs/adr/0017-default-model-muse-spark.md).

## 5. Структура репозитория (целевая; сейчас в `src/` есть `app/`, `dm/`, `engine/`, `i18n/`, `llm/`, `net/`, `rules/`, `theme/`, `ui/`, `brand.ts`; ещё нет `firebase/`, `src/content/`)

```
src/
  app/          композиция, роутинг, провайдеры, стор (сигналы `@preact/signals`)
  engine/       ядро: события, редьюсер, проекции, RNG, кости (чистый TS)
  rules/        api.ts (RulesModule) + модули: opend6/ (OGL 1.0a) ...
  dm/           ИИ-мастер: оркестратор хода, контекст, инструменты, память, промпты
  llm/          провайдер-агностичный клиент: пресеты, стриминг, tool calls
  net/          адаптеры хранилища (local / firebase), присутствие, аренда хоста
  content/      загрузка и валидация контента (шаблоны сеттингов)
  ui/tui/       примитивы TUI: Grid, Frame, Panel, Menu, FKeyBar, Dialog, Input
  ui/panels/    панели правой колонки: Sheet, Inventory (есть); Map, Party, Lore, Log, Dice (позже). Хроника — в `ui/screens/HomeScreen.tsx`
  ui/screens/   экраны: Title, Settings, Lobby, SessionZero, CharacterCreation, Game
  theme/        палитры, шрифты, метрики ячейки
  i18n/         словари ru/en
content/        шаблоны сеттингов, палитры (данные, не код; палитры — content/palettes/*.json)
public/         статика: шрифты (public/fonts/), CNAME
relay/          Cloudflare Worker (src/index.ts, тесты, wrangler.toml, README)
firebase/       firestore.rules, database.rules.json, firebase.json
e2e/            Playwright
evals/          evals ИИ-мастера на реальной модели: scenarios.ts, checks.ts (+тесты), runner.ts, report.ts, dm.eval.ts, rescore.eval.ts; отчёты в evals/reports/ (не в git)
docs/           документация, ADR
ref/OpenD6/     книги OpenD6 (PDF, OGL) + постраничный текстовый индекс (§8)
scripts/ref/    extract.py, search.py — индекс и поиск по книгам
scripts/        check_docs.py — проверка документации
tools/          env-default.ts — загрузчик .env.default для vite.config.ts; brand.ts — подстановка brand.json в index.html и манифест
```

Направление зависимостей: `ui → app → dm → (engine, rules, llm)`, `app → net → engine`.
`engine` и `rules` не импортируют ничего из остальных слоёв.
Исключение только одно: `rules` импортирует `engine` (RNG, типы событий). Обратного нет.
`src/rules/opend6/fixtures.ts` и `src/engine/testing.ts` нужны только тестам; из прикладного кода их не импортировать.
Коды кубов и пулы с Wild Die — это OpenD6, они лежат в `src/rules/opend6/dice.ts`. В `engine/` только сидированный RNG и классические `NdX±M` (`classic.ts`); подробности броска в журнале (`RollRecord.roll`) для движка непрозрачный JSON.

## 6. Документация

- Язык документации и комментариев **русский**. Идентификаторы, имена файлов и коммитов **английские**.
- Существенное архитектурное решение оформляется новым ADR: `docs/adr/NNNN-kebab-name.md` по шаблону [docs/adr/README.md](docs/adr/README.md).
  Принятый ADR не переписывается. Если решение изменилось, пишется новый ADR со статусом `Supersedes NNNN`.
- Изменил поведение, модель данных, набор инструментов Мастера или правила: обнови соответствующий документ в `docs/` в той же задаче.
- Закончил веху или пункт дорожной карты: отметь его в [docs/10-roadmap.md](docs/10-roadmap.md).
- Нашёл противоречие между документами: сообщи пользователю и не выбирай молча.
- У заменённого ADR меняется только строка статуса (`Accepted. … заменено в [NNNN](NNNN-name.md)`) плюс строка в `docs/adr/README.md`.
- Вопросы к владельцу: `docs/README.md` → «Открытые вопросы» (следующий номер Q10+, веха-срок). После ответа — перенести в «Принятые решения».
- Скриптовые замены в `docs/`: проверяй, что заменяемый фрагмент встречается ровно один раз. Символы рамок (`╔═[ … ]`) есть и в тексте, и в ASCII-макетах, так что неуникальная замена может удалить целый раздел.
  При замене «от заголовка A до заголовка B» проверь, что B стоит после A: иначе срез склеится и продублирует половину файла (после правки сверь `grep -n '^##' <файл>`).
  Если скрипт упал на середине, предыдущие замены уже записаны: не перезапускай его целиком, допиши оставшиеся.
- ASCII-макеты: все строки одной рамки одинаковой длины в символах (кириллица занимает одну ячейку).
- После правок `docs/` или любых `*.md` запусти `python3 scripts/check_docs.py` — он проверяет ссылки, якоря и ширину рамок.
  Переименовал заголовок — найди ссылки на старый якорь: `grep -rn '#<старый-slug>' docs AGENTS.md ref`.

## 7. Как работать с задачами

1. Прочитай раздел `docs/`, относящийся к задаче, и связанные ADR.
2. Для engine и rules сначала пиши тест (Vitest), потом код.
3. Промпты Мастера лежат в `src/dm/prompts/` как версионируемые файлы. Изменил промпт — подними `SYSTEM_PROMPT_VERSION` и прогони `pnpm eval:dm` (другая модель — `DM_MODEL=<id>`), если есть ключ.
   Если ключа нет, так и напиши в отчёте.
   Evals: отчёт пишется в конце процесса, а фоновая команда живёт не дольше часа — прогоны по многим моделям дроби на отдельные запуски (`DM_MODEL=<id>`, до 5 параллельных потоков). Одинаковый провал у многих моделей — сначала подозревай проверку или сценарий (`evals/checks.ts`, `evals/scenarios.ts`): исправь и пересчитай сохранённые отчёты `pnpm eval:rescore`, не гоняя модели заново.
   После новых прогонов обнови реестр `verified` в `src/llm/presets.ts` (правило уровней — [docs/04](docs/04-ai-dm.md#evals)): порядок реестра и текст заметок зашиты в e2e окна выбора модели (`e2e/llm.spec.ts`), правь их вместе.
4. Перед завершением: `pnpm typecheck && pnpm lint && pnpm test && pnpm docs:check`; для UI — ещё `pnpm test:e2e`.
   Для UI-изменений нужна визуальная проверка в браузере на ширине 1280 и 390 px.
   Порядок скриншотов — в [docs/dev-notes.md](docs/dev-notes.md).
5. В отчёте честно указывай, что не проверено.
6. E2E (Playwright): перед `keyboard.press` жди готовности экрана (`toBeFocused` / `toBeVisible`), после закрытия окна — его исчезновения (`toHaveCount(0)`); новый тест гоняй в цикле 5–10 раз: флаки чинить, а не терпеть. Адреса, скриншоты, ловушки TUI, тестов бросков и IndexedDB, oxlint — в [docs/dev-notes.md](docs/dev-notes.md).
7. Ловушки клавиш в TUI: `Form`/`Input` с вложенным `<input>` (обработчик контейнера игнорирует `.tui-native-input`, Input гасит Enter) и `Menu`/`Form` не гасят обработанные клавиши — свою логику на них вешай на `onKeyDownCapture` с `stopPropagation()`.

## 8. Книги правил OpenD6 (справочник)

Книги лежат в `ref/OpenD6/`, текст проиндексирован. **Полная инструкция: [ref/OpenD6/README.md](ref/OpenD6/README.md).**

- **Когда**: любая работа с `src/rules/opend6/`, с правилами и числами в `docs/05-rules-engine.md`, с `promptPrimer`, статблоками, снаряжением, заклинаниями, evals по правилам.
  Новое правило добавляется только со ссылкой на страницу книги.
- **Как**: [ref/OpenD6/TOPICS.md](ref/OpenD6/TOPICS.md) → `python3 scripts/ref/search.py page <книга> <стр>` → при необходимости поиск `python3 scripts/ref/search.py "<англ. термин>"`.
- **Нельзя**: читать `ref/OpenD6/text/*.md` целиком (до 200k токенов), читать PDF напрямую, брать числа по памяти.
- Числа из `fantasy` сверять с `adventure` или картинкой страницы (`search.py render`): в тексте D6 Fantasy ошибки распознавания.
- Таблицы (снаряжение, шаблоны) из текста PDF теряют колонки: цены и характеристики читай с картинки. `search.py render <книга> <стр>` даёт PNG в `/tmp/opend6-<книга>-<стр>.png` (100 dpi; в вывод попадают и старые PNG, своя страница не обязательно последняя). Для мелкой печати режь страницу: `pdftoppm -png -r 150 -f N -l N -x X -y Y -W W -H H <pdf> <префикс>` и открывай кроп.
- Ссылаться на источник в коде и документах: `OpenD6: adventure p.63`.

