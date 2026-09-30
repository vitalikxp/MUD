// Сценарии evals Мастера: кампания «Пограничье» (fantasy), герой-вор Ирма. Подготовка детерминирована (заглушка LLM),
// на реальной модели идёт только проверяемый ход. Каждый сценарий привязан к правилу системного промпта (src/dm/prompts/system.ts).
import { askedBeforeRolling, baselineChecks, calledBefore, calledTool, damageOnlyThroughEngine, doesNotSpeakForHero, either, mentions, noPointsSpent, notCalledTool, rolledDice, spentCharacterPoints, toolCalledWhere } from './checks';
import type { Prelude, Scenario } from './types';

const HERO = { templateId: 'thief', name: 'Ирма', skills: { lockpicking: 6, stealth: 3 } };

/** Готовое открытие игры: мир, сцена и первый абзац. Все сценарии, кроме открытия, начинаются с него: результат не зависит от модели. */
const OPENING: Prelude = {
  kind: 'scripted',
  action: { kind: 'opening' },
  steps: [
    { calls: [
      { name: 'set_flag', args: { key: 'world', value: 'Пограничье умирающей империи: серые холмы, вечные дожди, брошенные заставы. Ирма пришла в деревню Гнилой Брод по слуху о тайнике старого сборщика налогов. Тон: мрачный, без пафоса.' } },
      { name: 'set_scene', args: { name: 'Трактир «Гнилой Брод»', description: 'Тёмный зал с очагом; в углу под лестницей окованный сундук.' } },
    ] },
    { text: 'Дождь стучит по крыше трактира «Гнилой Брод». В углу под лестницей стоит окованный железом сундук с тяжёлым замком, а хозяин делает вид, что не замечает его.', calls: [{ name: 'end_turn', args: { suggestions: ['Осмотреть сундук', 'Заговорить с хозяином'] } }] },
  ],
};

/** Обычный ход Мастера, который спрашивает про Очки персонажа и не бросает (правило 4). */
const ASKS_ABOUT_POINTS: Prelude = {
  kind: 'scripted',
  action: { kind: 'player', text: 'Я подхожу к сундуку и берусь за отмычки.' },
  steps: [{ text: 'Замок хитрый, а за стеной слышны чьи-то шаги. Потратишь Очко персонажа, чтобы вскрыть его наверняка?', calls: [{ name: 'end_turn', args: { suggestions: ['Потратить очко', 'Попробовать без очков'] } }] }],
};

const rolledOrAsked = either('бросил движок или спросил про очки', rolledDice, askedBeforeRolling);

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'opening',
    title: 'Открытие игры',
    rule: 'Открытие: мир (`set_flag world`) и сцена (`set_scene`) инструментами, затем сцена текстом',
    hero: HERO,
    turns: [{ action: { kind: 'opening' }, checks: [...baselineChecks, toolCalledWhere('set_flag', 'мир записан в set_flag world', (a) => a['key'] === 'world'), calledTool('set_scene'), notCalledTool('apply_damage')] }],
  },
  {
    id: 'opening-en',
    title: 'Открытие игры на английском',
    rule: 'Язык повествования — язык кампании (англоязычная кампания)',
    lang: 'en',
    hero: { ...HERO, name: 'Irma' },
    turns: [{ action: { kind: 'opening' }, checks: [...baselineChecks, calledTool('set_scene')] }],
  },
  {
    id: 'uncertain-action',
    title: 'Неопределённое действие → бросок или вопрос про очки',
    rule: 'Правило 2 и 4: исход решает движок; перед решающим броском спрашивают про очки, а не тратят их сами',
    hero: HERO,
    prelude: [OPENING],
    turns: [{ action: { kind: 'player', text: 'Я пытаюсь незаметно вытащить кошелёк у пьяного завсегдатая за соседним столом.' }, checks: [...baselineChecks, rolledOrAsked, noPointsSpent] }],
  },
  {
    id: 'high-stakes',
    title: 'Высокие ставки: не тратить очки за игрока',
    rule: 'Правило 4: очки принадлежат игроку; трата только по его просьбе',
    hero: HERO,
    prelude: [OPENING],
    turns: [{ action: { kind: 'player', text: 'Хозяин ушёл в погреб и вернётся с минуты на минуту. Это мой единственный шанс: я берусь за отмычки и вскрываю замок сундука под лестницей.' }, checks: [...baselineChecks, rolledOrAsked, noPointsSpent] }],
  },
  {
    id: 'spend-agreed',
    title: 'Игрок согласился потратить очко',
    rule: 'Правило 4: трата передаётся движку (`spend`), только если игрок просил в последнем сообщении',
    hero: HERO,
    prelude: [OPENING, ASKS_ABOUT_POINTS],
    turns: [{ action: { kind: 'player', text: 'Да, трачу одно Очко персонажа и вскрываю замок.' }, checks: [...baselineChecks, calledTool('check'), spentCharacterPoints(1)] }],
  },
  {
    id: 'combat-guard',
    title: 'Атака по новому NPC',
    rule: 'Правило 8 и 10: NPC создаётся (`create_npc`) до броска и урона; урон только через `apply_damage`',
    hero: HERO,
    prelude: [OPENING],
    turns: [{ action: { kind: 'player', text: 'Я выхватываю кинжал и бью стражника у двери.' }, checks: [...baselineChecks, calledBefore('create_npc', 'apply_damage'), damageOnlyThroughEngine] }],
  },
  {
    id: 'gear-awareness',
    title: 'Знание о вещах героя',
    rule: 'Контекст: надетое (бытовое действие игрока) и лист героя видны Мастеру',
    hero: HERO,
    prelude: [OPENING, { kind: 'equip', itemId: 'dagger' }],
    turns: [{ action: { kind: 'player', text: 'Что у меня сейчас в руке? Опиши коротко.' }, checks: [...baselineChecks, mentions('кинжал', /кинжал/i)] }],
  },
  {
    id: 'hero-agency',
    title: 'Мастер не говорит за героя',
    rule: 'Правило 5: мир и NPC — Мастера, слова и решения героя — игрока',
    hero: HERO,
    prelude: [OPENING],
    turns: [{ action: { kind: 'player', text: 'Ирма молча смотрит на хозяина трактира.' }, checks: [...baselineChecks, doesNotSpeakForHero('Ирма')] }],
  },
];
