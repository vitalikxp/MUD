// Короткое описание правил для системного промпта Мастера (на английском: модели точнее следуют инструкциям) и справка по темам.
// Все числа — из книг (adventure p.47–66, p.141); при правке сверяйтесь с docs/05-rules-engine.md.
import type { Lang } from '../api';

export function promptPrimer(variant: string): string {
  const fantasy = variant === 'fantasy';
  return `RULES: OpenD6, variant "${variant}" (${fantasy ? 'fantasy, no magic in this preview' : 'modern/post-apocalypse, no magic or psionics in this preview'}).

Die codes. Attributes and skills are written as die codes: 3D+1 = roll three six-sided dice and add 1 (a "pip"); 3 pips = 1D. A skill is its attribute plus extra dice; if a character has no dice in a skill they roll the bare attribute ("untrained").

Resolving actions. When an outcome is uncertain AND failure matters, call the check tool. You choose the skill (or attribute) and a difficulty BEFORE the roll: 5 very easy, 10 easy, 15 moderate, 20 difficult, 25 very difficult, 30 heroic. The roll must meet or beat the difficulty; margin is total minus difficulty. Do not ask for a roll when the outcome is trivial or impossible. NEVER invent dice results, totals or damage: only the tools roll dice, and you narrate what they return.
- Untrained use: add about +5 to the difficulty (less for simple tasks).
- Circumstances: prefer the difficulty. Slight +/-1..5, significant 6..10, decisive 11..15, overpowering 16+. You may also pass modifiers as dice (e.g. "-1D") for gear or situation.
- Opposed actions: use the contest tool; a tie goes to whoever initiated.
- Several actions in one round: every action beyond the first costs -1D on all rolls (pass actions).
- Wild Die: one die of every roll explodes on 6. A 1 on its first throw is a complication: add the dice normally, but something goes wrong or turns out complicated related to the task; higher totals mean a milder complication (funny, "almost didn't do it"), lower totals a serious obstacle. Rarely deadly.
- Character Points (each adds one extra Wild Die) and Fate Points (double the dice) are spent by PLAYERS, before the result is known. The engine applies what the player chose. Never spend them for a player.

Health. Body Points (BP) track injury. Damage total minus the target's armor resistance roll is lost from BP; use the apply_damage tool, never subtract yourself. Wound levels by remaining BP: 81-99% bruised, 60-80% stunned (-1D), 40-59% wounded (-1D), 20-39% severely wounded (-2D), 10-19% incapacitated (-3D; the character may stay up with a moderate (15) stamina roll, otherwise falls unconscious), 1-9% mortally wounded (unconscious, dying without help), 0 dead. Penalties are applied by the engine. Healing: rest heals a die-based amount per day (heal tool, method "rest"), medicine or healing skill helps once per patient per day.

Rewards. Give Character Points for overcoming obstacles, good roleplay and finishing scenes (1-3 for a scene, more at milestones) and Fate Points for heroic deeds that fit the character's moral code (use award_points).

Style. Show the outcome of each roll in the fiction. Failure moves the story forward with a cost, it does not stall it.`;
}

const TOPICS: Record<string, Record<Lang, string>> = {
  difficulty: {
    en: 'Difficulty scale: 0 automatic (no roll), 1-5 very easy, 6-10 easy, 11-15 moderate, 16-20 difficult, 21-25 very difficult, 26-30 heroic, 31+ legendary. Meet or beat it. Opposed rolls: higher total wins, ties go to the initiator. (adventure p.53, p.141)',
    ru: 'Шкала сложности: 0 автоматически (без броска), 1–5 очень легко, 6–10 легко, 11–15 средне, 16–20 трудно, 21–25 очень трудно, 26–30 героически, 31+ легендарно. Нужно достичь или превысить. Встречные броски: побеждает больший итог, при ничьей — инициатор. (adventure p.53, p.141)',
  },
  'wild-die': {
    en: 'Wild Die: one die of each roll. On 6 it is added and rolled again (repeat while 6). A 1 on its first throw is a Critical Failure: the GM either cancels that die and the highest die, or adds normally and a complication happens. Later 1s in the same roll do nothing. (adventure p.47)',
    ru: 'Wild Die: один куб каждого броска. Шестёрка прибавляется и бросается снова (пока выпадают шестёрки). Единица на первом броске — критическая неудача: Мастер либо убирает этот куб и наибольший, либо считает как обычно, но возникает осложнение. Единицы на повторных бросках ничего не значат. (adventure p.47)',
  },
  points: {
    en: 'Character Points: before or after the roll but before the result is announced, +1 extra Wild Die each (campaign limit per roll; a 1 on those dice is just 1). Fate Points: before the roll, doubles the dice of the attribute/skill (not gear); usually one per roll; not for initiative; not with Character Points in the same roll. Start: 5 CP and 1 FP. (adventure p.47-48)',
    ru: 'Очки персонажа: до или после броска, но до объявления результата, каждое даёт ещё один Wild Die (лимит кампании на бросок; единица на них — просто 1). Очко судьбы: до броска, удваивает кубы характеристики или навыка (не снаряжения); обычно одно на бросок; не на инициативу; не вместе с Очками персонажа. Старт: 5 CP и 1 FP. (adventure p.47–48)',
  },
  wounds: {
    en: 'Wound levels by remaining Body Points: 81-99% bruised; 60-80% stunned (-1D); 40-59% wounded (-1D); 20-39% severely wounded (-2D); 10-19% incapacitated (-3D, stamina/mettle 15 to stay conscious); 1-9% mortally wounded (unconscious); 0 dead. Penalties do not stack. (fantasy p.65)',
    ru: 'Уровни ранения по оставшимся Очкам тела: 81–99% ушиб; 60–80% оглушён (−1D); 40–59% ранен (−1D); 20–39% тяжело ранен (−2D); 10–19% недееспособен (−3D, проверка выносливости 15, чтобы остаться в сознании); 1–9% при смерти (без сознания); 0 мёртв. Штрафы не суммируются. (fantasy p.65)',
  },
  healing: {
    en: 'Natural healing, once per day: roll Physique (+1D full day of rest, 0 light activity, -1D fighting/running); recovered BP by total: 0→0, 1-5→2, 6-10→1D, 11-15→2D, 16-20→3D, 21-25→4D, 26-30→5D, 31+→6D. Medicine/healing skill uses the same table, once per patient per day. (adventure p.65-66)',
    ru: 'Естественное лечение раз в сутки: бросок Телосложения (+1D сутки покоя, 0 лёгкая активность, −1D бой и бег); восстановленные Очки тела по итогу: 0→0, 1–5→2, 6–10→1D, 11–15→2D, 16–20→3D, 21–25→4D, 26–30→5D, 31+→6D. Навык медицины/врачевания — по той же таблице, раз в сутки на пациента. (adventure p.65–66)',
  },
  actions: {
    en: 'Rounds last 5 seconds. One action per round with no penalty; each additional declared action gives -1D to all skill and attribute rolls that round (not to damage, resistance or initiative). (adventure p.49-50)',
    ru: 'Раунд — 5 секунд. Одно действие без штрафа; каждое следующее заявленное действие даёт −1D ко всем броскам навыков и характеристик в раунде (но не к урону, сопротивлению и инициативе). (adventure p.49–50)',
  },
};

export function lookup(topic: string, lang: Lang): string | null {
  const key = topic.trim().toLowerCase().replace(/\s+/g, '-');
  return TOPICS[key]?.[lang] ?? null;
}

export const LOOKUP_TOPICS = Object.keys(TOPICS);
