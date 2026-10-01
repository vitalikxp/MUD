// Проверки результата хода. Чистые функции над `TurnResult`: тестируются без модели (checks.test.ts).
import type { Entity } from '../src/engine/types';
import type { Check, CheckResult, TurnResult } from './types';

const ok = (name: string, soft = false): CheckResult => ({ name, ok: true, soft });
const bad = (name: string, detail: string, soft = false): CheckResult => ({ name, ok: false, soft, detail });
const result = (name: string, pass: boolean, detail: string, soft = false): CheckResult => (pass ? ok(name, soft) : bad(name, detail, soft));

const failedTurn = (r: TurnResult): boolean => r.error !== undefined;

/** Проверка, которая при упавшем ходе автоматически считается проваленной. */
const guarded = (name: string, soft: boolean, fn: (r: TurnResult) => CheckResult): Check => (r) => (failedTurn(r) ? bad(name, `ход не удался: ${r.error}`, soft) : fn(r));

const letters = (text: string) => ({ cyr: (text.match(/[а-яё]/gi) ?? []).length, lat: (text.match(/[a-z]/gi) ?? []).length });

const bodyOf = (e: Entity): number | undefined => (e.data['body'] as { points?: number } | undefined)?.points;

// ─── общие проверки (для каждого хода) ─────────────────────────────────────────

/** Ход завершён: Мастер сам вызвал end_turn, а не движок за него. */
export const endedByMaster: Check = guarded('Мастер вызвал end_turn', false, (r) => result('Мастер вызвал end_turn', !r.autoClosed, 'ход закрыт движком (Мастер не вызвал end_turn)'));

/** Есть повествование для игрока. */
export const hasNarration: Check = guarded('есть повествование', false, (r) => result('есть повествование', r.text.trim().length >= 40, `текст слишком короткий (${r.text.trim().length} симв.)`));

/** Язык повествования: доля букв нужного алфавита (правило: всё, что читает игрок, на языке кампании). */
export const narrationLanguage: Check = guarded('язык повествования', false, (r) => {
  const { cyr, lat } = letters(r.text);
  const total = cyr + lat;
  if (total === 0) return bad('язык повествования', 'в тексте нет букв');
  const share = (r.lang === 'ru' ? cyr : lat) / total;
  return result('язык повествования', share >= 0.85, `доля ${r.lang === 'ru' ? 'кириллицы' : 'латиницы'} ${(share * 100).toFixed(0)}% (нужно ≥ 85%)`);
});

/** Нет разметки: заголовков, списков, HTML (правило 7). Курсив и жирный допустимы. */
export const plainText: Check = guarded('простой текст без списков и заголовков', true, (r) => {
  const found =
    /^\s*#{1,6}\s/m.test(r.text) ? 'заголовок'
    : /^\s*([-*+•]|\d{1,2}[.)])\s+\S/m.test(r.text) ? 'список'
    : /<\/?[a-z][^>]*>/i.test(r.text) ? 'HTML'
    : '';
  return result('простой текст без списков и заголовков', found === '', `в тексте есть ${found}`, true);
});

/** Нет метакомментариев про инструменты и правила (первое правило «как проходит ход»). */
export const noMeta: Check = guarded('без метакомментариев', false, (r) => {
  const hit = /(end_turn|set_scene|set_flag|give_item|take_item|apply_damage|create_npc|find_item|award_points|rules_lookup)|\b(tool call|function call|tools?\b.*\bresult)\b|(вызываю|вызову|вызвал[аи]?)\s+(инструмент|функци)|бросаю\s+проверк/i.exec(r.text);
  return result('без метакомментариев', !hit, `в тексте служебное «${hit?.[0]}»`);
});

/** Варианты действий: не больше 4, короткие (правило 11). */
export const goodSuggestions: Check = guarded('варианты действий (≤ 4, короткие)', true, (r) => {
  const tooLong = r.suggestions.find((s) => s.length > 80);
  return result('варианты действий (≤ 4, короткие)', r.suggestions.length <= 4 && !tooLong, r.suggestions.length > 4 ? `вариантов ${r.suggestions.length}` : `длинный вариант «${tooLong}»`, true);
});

/** Ошибки инструментов: не больше одной за ход (модель ошибается в аргументах — это цена ретраев). */
export const fewToolErrors: Check = guarded('ошибок инструментов не больше 1', false, (r) => {
  const errors = r.tools.filter((t) => !t.ok);
  return result('ошибок инструментов не больше 1', errors.length <= 1, `${errors.length}: ${errors.map((t) => `${t.name}: ${t.error}`).join('; ').slice(0, 200)}`);
});

/** Длина ответа не больше выбранной: абзацев 1 / 3 / 5 (`DM_LENGTH`; по умолчанию «обычная»). */
export const paragraphLimit: Check = guarded('число абзацев в пределах выбранной длины', true, (r) => {
  const length = r.narration?.length ?? 'normal';
  const max = { short: 1, normal: 3, long: 5 }[length];
  const n = r.text.split(/\n\s*\n/).filter((p) => p.trim()).length;
  return result('число абзацев в пределах выбранной длины', n <= max, `абзацев ${n}, нужно не больше ${max} (${length})`, true);
});

/** «Простая речь»: средняя длина предложения не больше 14 слов (остальным стилям проверка не нужна). */
export const plainSpeech: Check = guarded('простая речь: короткие предложения', true, (r) => {
  if (r.narration?.style !== 'plain') return ok('простая речь: короткие предложения', true);
  const sentences = r.text.split(/[.!?…]+\s/).map((s) => s.trim().split(/\s+/).filter(Boolean).length).filter((n) => n > 0);
  const avg = sentences.length > 0 ? sentences.reduce((a, b) => a + b, 0) / sentences.length : 0;
  return result('простая речь: короткие предложения', avg <= 14, `среднее предложение ${avg.toFixed(1)} слов (нужно ≤ 14)`, true);
});

export const baselineChecks: readonly Check[] = [endedByMaster, hasNarration, narrationLanguage, noMeta, plainText, goodSuggestions, fewToolErrors, paragraphLimit, plainSpeech];

// ─── проверки под сценарии ─────────────────────────────────────────────────────

const calls = (r: TurnResult, name: string) => r.tools.filter((t) => t.name === name && t.ok);

export const calledTool = (name: string): Check => guarded(`вызван ${name}`, false, (r) => result(`вызван ${name}`, calls(r, name).length > 0, `${name} не вызывался (или без успеха): ${r.tools.map((t) => t.name).join(', ') || 'инструментов не было'}`));

export const notCalledTool = (name: string): Check => guarded(`не вызван ${name}`, false, (r) => result(`не вызван ${name}`, calls(r, name).length === 0, `${name} вызван ${calls(r, name).length} раз`));

/** `first` вызван раньше `second` (например, create_npc до apply_damage). Если `second` не вызывался, проверка проходит. */
export const calledBefore = (first: string, second: string): Check => {
  const name = `${first} раньше ${second}`;
  return guarded(name, false, (r) => {
    const a = r.tools.findIndex((t) => t.name === first && t.ok);
    const b = r.tools.findIndex((t) => t.name === second && t.ok);
    if (b === -1) return ok(name);
    return result(name, a !== -1 && a < b, `${second} вызван${a === -1 ? `, а ${first} — нет` : ` раньше ${first}`}`);
  });
};

/** Вызов инструмента с нужными аргументами (например, `set_flag` с ключом `world`). */
export const toolCalledWhere = (name: string, label: string, pred: (args: Record<string, unknown>) => boolean): Check =>
  guarded(label, false, (r) => {
    const hit = r.tools.some((t) => {
      if (t.name !== name || !t.ok) return false;
      try {
        return pred(JSON.parse(t.arguments) as Record<string, unknown>);
      } catch {
        return false;
      }
    });
    return result(label, hit, `${name} не вызван с нужными аргументами`);
  });

/** Проходит, если выполнилась хотя бы одна из проверок (например, «бросил или спросил про очки»). */
export const either = (name: string, ...checks: Check[]): Check => (r) => {
  const results = checks.map((c) => c(r));
  return results.some((c) => c.ok) ? ok(name) : bad(name, results.map((c) => c.detail ?? c.name).join(' / '));
};

/** За ход был хотя бы один открытый бросок движка. */
export const rolledDice: Check = guarded('бросок сделан движком', false, (r) => result('бросок сделан движком', r.events.some((e) => e.t === 'roll'), 'в журнале хода нет броска'));

/** Ни один бросок хода не потратил Очки персонажа или судьбы (правило 4: траты только по просьбе игрока). */
export const noPointsSpent: Check = guarded('очки не потрачены за игрока', false, (r) => {
  const spent = r.events.some((e) => e.t === 'roll' && ((e.roll['spent'] as { cp?: number; fp?: boolean } | undefined)?.cp ?? 0) + Number((e.roll['spent'] as { fp?: boolean } | undefined)?.fp === true) > 0);
  return result('очки не потрачены за игрока', !spent, 'Очки потрачены без просьбы игрока');
});

/**
 * Игрок согласился потратить N Очков персонажа: бросок с этой тратой выполнен движком, а запас уменьшен событием (`inc points.cp −N`).
 * Итоговый запас не сравнивается: после успеха Мастер вправе наградить очками (`award_points`), и остаток остаётся прежним.
 */
export const spentCharacterPoints = (n: number): Check => {
  const name = `потрачено ${n} Очк. персонажа движком`;
  return guarded(name, false, (r) => {
    const roll = r.events.find((e) => e.t === 'roll' && ((e.roll['spent'] as { cp?: number } | undefined)?.cp ?? 0) === n);
    const deducted = r.events.some((e) => e.t === 'entity.patched' && e.ops.some((o) => o.op === 'inc' && o.path === 'points.cp' && o.by === -n));
    return result(name, roll !== undefined && deducted, `бросок с тратой ${roll ? 'есть' : 'не найден'}, списание ${deducted ? 'есть' : 'не найдено'}`);
  });
};

/** Ход закончился вопросом о тратах, без броска: перед решающей проверкой игрока спрашивают (правило 4). */
export const askedBeforeRolling: Check = guarded('спросил про очки, не бросая', false, (r) => {
  const rolled = r.events.some((e) => e.t === 'roll');
  // Вопрос без знака вопроса тоже вопрос: «Решай», «потратить очко или нет».
  const asks = /(очк|point)/i.test(r.text) && /(\?|потрат|вложи|решай|хочешь|хотите)/i.test(r.text);
  return result('спросил про очки, не бросая', !rolled && asks, rolled ? 'бросок сделан до ответа игрока' : 'в тексте нет вопроса про очки');
});

/** Текст ссылается на факт из состояния (предмет, имя, сцену) — Мастер видит лист героя и заметки о действиях. */
export const mentions = (label: string, pattern: RegExp): Check => guarded(`в тексте: ${label}`, false, (r) => result(`в тексте: ${label}`, pattern.test(r.text), `в тексте нет ${label}`));

/** Урон нанесён только через движок: если Очки тела цели изменились, был вызов apply_damage. Здоровье героя без вызова не меняется. */
export const damageOnlyThroughEngine: Check = guarded('урон только через apply_damage', false, (r) => {
  const before = bodyOf(r.heroBefore);
  const after = bodyOf(r.heroAfter);
  const changed = before !== after;
  return result('урон только через apply_damage', !changed || calls(r, 'apply_damage').length > 0, `Очки тела героя ${before} → ${after} без apply_damage`);
});

/** Мастер не решает за героя (правило 5): в тексте нет прямой речи героя, вложенной ему в уста («Ирма шепчет: «…»»). */
export const doesNotSpeakForHero = (heroName: string): Check => guarded('не говорит за героя', true, (r) => {
  const verbs = 'говорит|говорила|шепчет|шепнула|отвечает|ответила|восклицает|воскликнула|кричит|крикнула|спрашивает|спросила|произносит|произнесла|бормочет|пробормотала|сказала|says|whispers|replies|answers|shouts|asks';
  const speech = new RegExp(`${heroName}\\s+(?:\\S+\\s+)?(?:${verbs})[^.!?\\n]{0,20}(?:—|:)\\s*[«"“]`, 'i').exec(r.text);
  return result('не говорит за героя', !speech, `реплика героя в тексте: «${speech?.[0]}»`, true);
});
