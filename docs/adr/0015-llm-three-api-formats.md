# 0015. LLM-клиент поддерживает три формата API

- Статус: Accepted. Адаптер Responses перенесён в M0 решением [0016](0016-default-models-pareto.md); адаптер Anthropic Messages отменён в [0022](0022-no-anthropic-messages.md)
- Дата: 2026-09-28
- Дополняет: [0002](0002-llm-relay-provider-agnostic.md) (там предполагался только OpenAI Chat Completions)

## Контекст
Модели OpenCode Go (пресет по умолчанию) доступны через три разных эндпоинта (документация OpenCode Go, 2026-09-28):
- `chat/completions` (OpenAI Chat Completions): GLM, Kimi, DeepSeek, MiMo, LongCat, Hy;
- `responses` (OpenAI Responses): GPT, Grok, Muse Spark;
- `messages` (Anthropic Messages): Qwen, MiniMax.
Если поддерживать только первый формат, треть моделей Go недоступна. Прямое подключение к OpenAI и Anthropic тоже требует их родных форматов.

## Решение
- `src/llm/` — общий внутренний интерфейс (сообщения, инструменты, стриминг текстовых дельт и tool calls, `usage`) и **три адаптера**:
  `chatCompletions` (M0), `anthropicMessages` и `openaiResponses` (M1).
- Формат задаётся у пресета и может переопределяться для модели (таблица «модель → формат» в пресете OpenCode Go).
- Оркестратор Мастера ничего не знает о формате: адаптер переводит инструменты (JSON Schema из zod) и ответы в общий вид.
- Relay пропускает все три пути (`/v1/chat/completions`, `/v1/responses`, `/v1/messages`) и заголовки авторизации обоих стилей
  (`Authorization: Bearer`, `x-api-key` + `anthropic-version`).
- Контрактные тесты на записанных SSE-ответах есть для каждого адаптера.

## Последствия
- + Доступны все модели OpenCode Go, а также прямое подключение к OpenAI и Anthropic.
- + Выбор модели для Мастера — по качеству (evals), а не по формату API.
- − Три адаптера стриминга с разной семантикой событий, больше тестов.
