# 06. Модель данных

## Принцип: журнал событий + проекции

([ADR-0004](adr/0004-event-sourcing.md))
- **Событие** (`GameEvent`) — неизменяемый факт: «брошено 2d6 = 7», «гоблин получил 5 урона», «Мастер рассказал…».
- **Коммит** (`Commit`) — атомарная пачка событий одного хода или действия. Коммиты пишутся **только хостом** и только добавляются.
- **Проекции** — текущее состояние, вычисленное редьюсером `apply(state, event)`: персонажи, сцена, карта, лор, квесты.
  Хранятся ради быстрого чтения. Их **всегда** можно пересчитать из журнала.

Откат хода ([FR-DM-5](02-requirements.md)): хост пишет коммит `revert { targetCommitSeq }`. Проекции пересчитываются от ближайшего чекпоинта.
Физически коммиты не удаляются, откаченные помечаются в UI как зачёркнутые.

## Типы (черновик)

```ts
type Commit = {
  seq: number;              // монотонный номер в кампании (id документа = seq, с ведущими нулями)
  turnId: string;
  kind: "turn" | "ui_action" | "maintenance" | "revert" | "system";
  hostUid: string;
  createdAt: Timestamp;
  rngState: string;         // состояние RNG ПОСЛЕ коммита: детерминированный пересчёт
  promptVersion?: string;
  events: GameEvent[];      // целиком внутри документа (≤ ~200 КБ; иначе ошибка хода)
};

type GameEvent =
  | { t: "narration"; text: string; speaker?: "dm" | EntityId }
  | { t: "intent"; uid: string; charId: string; text: string }       // копия заявок раунда
  | { t: "roll"; code: string;            // "4D+1" или "2d6+1"
      dice: number[]; wild?: number[];     // обычные кубы; цепочка Wild Die (6 → перебросы)
      cpWild?: number[][];                 // доп. Wild Die за каждое потраченное CP (свои цепочки, 1 без осложнения)
      pips: number; total: number; complication?: boolean;
      spent?: { cp?: number; fp?: boolean }; // FP удваивает кубы характеристики/навыка до броска
      reason: string; difficulty?: number; success?: boolean; margin?: number; visibility: "all" | "dm" }
  | { t: "entity.created"; entity: Entity }
  | { t: "entity.patched"; id: EntityId; patch: JsonPatch }           // здоровье, состояния, stats
  | { t: "item.added" | "item.removed" | "item.moved" | "item.equipped"; ... }
  | { t: "combat.started" | "combat.turn" | "combat.ended"; ... }
  | { t: "map.set"; mapId: string } | { t: "token.moved"; ... } | { t: "fog.revealed"; cells: RLE }
  | { t: "scene.set"; ... } | { t: "palette.set"; paletteId: string; reason: string }
  | { t: "lore.upserted"; entry: LoreEntry } | { t: "choice.recorded"; ... }
  | { t: "quest.updated"; ... } | { t: "flag.set"; key: string; value: Json }
  | { t: "summary.written"; level: "scene" | "chapter" | "campaign"; text: string; coversSeq: [number, number] }
  | { t: "card.shown"; kind: string; ref: string }
  | { t: "turn.ended"; suggestions: string[]; addressTo?: string[] };
```

Типы событий версионируются. Удалять или менять смысл существующего типа нельзя, можно только добавить новый и написать апкастер.

## Firestore

```
users/{uid}
  { displayName, locale, createdAt }

campaigns/{cid}
  { title, ownerUid, members: { [uid]: "owner" | "player" }, inviteCodeHash,
    modelConsent: { [uid]: { trainsOnData: true, at } },  // FR-LLM-9: согласие на модель Мастера с обучением на данных
    rules: { id, version, variant }, setting: { templateId, version }, narrationLang,
    rating, safety: { lines[], veils[] },
    hostLease: { uid, expiresAt },        // см. 08-multiplayer
    headSeq, phase: "lobby" | "session_zero" | "explore" | "combat",
    round: { id, openedAt, deadline?, closedBy? },
    schemaVersion, createdAt, updatedAt }

campaigns/{cid}/commits/{seq}           // журнал; create только хостом, без update/delete
campaigns/{cid}/state/core              // проекция: сцена, бой, флаги, квесты, палитра, выборы
campaigns/{cid}/state/party             // проекция: персонажи и NPC-спутники (stats, здоровье, инвентарь)
campaigns/{cid}/maps/{mapId}            // проекция: карта (RLE-слои), фишки, туман
campaigns/{cid}/lore/{entryId}          // проекция: лор-записи
campaigns/{cid}/summaries/{id}          // проекция: сводки
campaigns/{cid}/intents/{roundId_uid}   // заявки: пишет автор, читают все
campaigns/{cid}/drafts/{uid}            // черновик персонажа до принятия хостом
campaigns/{cid}/ooc/{autoId}            // OOC-чат (S)
campaigns/{cid}/secrets/key             // ключ AES-GCM кампании; читает только владелец и текущий хост
```

Все записи хоста за ход делаются **одним batch**: новый коммит, изменённые проекции, `headSeq`, закрытие раунда.
`headSeq` проверяется в транзакции, поэтому два хоста не запишут коммит с одним номером.

### Ограничения документа

- 1 МиБ на документ. Карты хранятся RLE-строками по слоям, карта 120×60 занимает порядка 10–30 КБ.
- `state/party` при 5 персонажах с инвентарём занимает около 50 КБ. Если вырастет, дробится на `party/{charId}`.

## Realtime Database

```
/presence/{cid}/{uid}  { online: true, lastSeen: ts, role: "host"|"player" }   // onDisconnect → online:false
/stream/{cid}          { turnId, text, done: bool, updatedAt }                  // пишет только хост
/typing/{cid}/{uid}    { at: ts }                                               // S
```
Стрим очищается после коммита хода. Окончательный текст берётся из коммита.

## Шифрование секретов Мастера

([ADR-0010](adr/0010-dm-secrets-encryption.md))

- При создании облачной кампании владелец генерирует ключ AES-GCM 256 (WebCrypto) и пишет его в `secrets/key`.
- Всё, что помечено `visibility: "dm"`, хост перед записью шифрует в `src/net/secrets.ts`:
  - лор-запись: наружу остаются `id`, `kind`, `visibility`, `updatedAt`, а имя, факты и связи уходят в поле `enc`;
  - событие в коммите: `{ t, visibility: "dm", enc }`, тип виден, содержимое нет;
  - полный статблок монстра: игрокам видна только часть по `knowledge`, остальное в `enc`.
- `enc` = base64(`iv[12] || ciphertext`), в AAD передаются `cid` и id документа (нельзя переставить шифротекст между документами).
- Не-хосты ключа не получают: в их клиенте и в DevTools видно только шифротекст. Хост видит всё, это принято.
- Новый хост получает ключ сразу после захвата аренды (правило чтения). Прежний хост мог сохранить ключ, это принято.
- В RTDB-стрим хост не пишет строки инструментов с `visibility: "dm"`.
- Локальные (соло) кампании не шифруются. Экспорт хоста содержит ключ, экспорт не-хоста содержит только шифротекст.

## Локальное хранилище (IndexedDB)

База `swrd`: `campaigns`, `commits`, `projections` (ключ `[cid, name]`), `settings`, `debugTurns`.
Схема та же, что в Firestore, поэтому перенос local → cloud означает загрузку экспорта.

## Экспорт (`.swrd.json`)

```json
{ "format": "swrd/campaign", "formatVersion": 1, "exportedAt": "...",
  "campaign": {...}, "commits": [...], "projections": {...}, "rules": {"id": "opend6", "version": "0.1.0", "variant": "fantasy"} }
```
При импорте кампания пересобирается из `commits`, проекции проверяются сравнением.

## Правила безопасности (суть)

```
campaigns/{cid}: read, если uid в members. create: ownerUid == uid. update: owner (настройки)
                 или участник, если меняется только hostLease (захват по истечении, см. 08)
                 или участник, если меняется только его собственный modelConsent[uid]
commits/{seq}:   read — участник; create — uid == campaign.hostLease.uid && request.time < hostLease.expiresAt; update/delete — никогда
state/*, maps/*, lore/*, summaries/*: read — участник; write — действующий хост
intents/{rid_uid}: read — участник; write — только если rid_uid оканчивается на свой uid и раунд открыт
drafts/{uid}:    read — участник; write — сам uid
secrets/key:     create — владелец при создании кампании; read — uid == ownerUid или (uid == hostLease.uid && аренда действует); update/delete — никогда
members join:    по inviteCode (хэш сверяется в правиле при добавлении себя в members)
```
Правила лежат в `firebase/firestore.rules` и `firebase/database.rules.json` и покрываются тестами `pnpm test:rules`.

## Бюджет бесплатного тарифа

Лимиты Spark (проверено 2026-09): Firestore 50K чтений, 20K записей, 20K удалений в сутки, 1 ГиБ;
RTDB 100 одновременных соединений, 1 ГБ хранения, 10 ГБ/мес трафика.

Оценка на один ход кооп-партии из 5 человек:

| Операция | Записи | Чтения |
|---|---|---|
| 5 заявок | 5 | 5 × 5 слушателей = 25 |
| Коммит + 2–4 проекции + campaign | ~5 | ~5 × 5 = 25 |
| Итого за ход | **~10** | **~50** |

При 60 ходах в час, 4 часах в день и одной группе получается 2 400 записей и 12 000 чтений, то есть 12% и 24% дневного лимита.
Этого хватает на 3–4 одновременно играющие группы. Если проекту понадобится больше, нужно будет объединять проекции или брать на каждую группу свой Firebase-проект (форк).
Стриминг текста идёт через RTDB, а не Firestore: в RTDB нет поштучной оплаты операций.

**Правило для агентов**: изменение, которое добавляет слушатель или запись на ход, должно обновить эту таблицу.
