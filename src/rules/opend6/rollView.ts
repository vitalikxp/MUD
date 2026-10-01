// Запись броска → строки хроники (RulesModule.describeRoll). Читает то, что кладут в `RollRecord.roll` проверки (`checks.ts`):
// итоговый код, кубы, цепочки Wild Die, траты и (с M1.7) базу и составляющие штрафов и бонусов. Старые записи без них показываются как есть.
import type { RollRecord } from '../../engine/types';
import type { DiceSpan, Lang, RollView, RollViewContext } from '../api';
import { findAttribute, findSkill, getVariant } from './data';

const T = {
  ru: {
    attribute: 'характеристика', skill: 'навык', untrained: 'не изучен', open: '«', close: '»',
    mods: 'Модификаторы', wounds: 'раны', actions: 'лишние действия', modifier: 'Мастер',
    cp: (n: number) => `Очки персонажа ×${n}: +${n} Wild Die`, fp: 'Очко судьбы: кубы ×2',
    success: 'успех', failure: 'провал', win: 'победа', loss: 'поражение',
    complication: 'осложнение: на Wild Die выпала единица', cancelled: (n: number) => `единица на Wild Die: убран наибольший куб (${n})`,
  },
  en: {
    attribute: 'attribute', skill: 'skill', untrained: 'untrained', open: '"', close: '"',
    mods: 'Modifiers', wounds: 'wounds', actions: 'extra actions', modifier: 'GM',
    cp: (n: number) => `Character Points ×${n}: +${n} Wild Die`, fp: 'Fate Point: dice ×2',
    success: 'success', failure: 'failure', win: 'victory', loss: 'defeat',
    complication: 'complication: the Wild Die came up 1', cancelled: (n: number) => `Wild Die came up 1: the highest die (${n}) is removed`,
  },
} as const;

const cap = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const minus = (code: string): string => code.replace(/-/g, '−');
const signed = (code: string): string => minus(code.startsWith('-') ? code : `+${code}`);
const nums = (v: unknown): number[] => (Array.isArray(v) ? v.filter((n): n is number => typeof n === 'number') : []);

interface ModPart {
  kind: 'wounds' | 'actions' | 'modifier';
  code: string;
}

function parts(v: unknown): ModPart[] {
  return Array.isArray(v) ? v.filter((p): p is ModPart => typeof p === 'object' && p !== null && typeof (p as ModPart).code === 'string') : [];
}

function nameOf(roll: RollRecord, lang: Lang, variantId: string): { skill?: string; attribute?: string } {
  let variant;
  try {
    variant = getVariant(variantId as 'fantasy' | 'adventure');
  } catch {
    variant = undefined;
  }
  const skill = roll.skill ? (variant && findSkill(variant, roll.skill)?.skill.name[lang]) || roll.skill : undefined;
  const attribute = roll.attribute ? (variant && findAttribute(variant, roll.attribute)?.name[lang]) || roll.attribute : undefined;
  return { ...(skill ? { skill: cap(skill) } : {}), ...(attribute ? { attribute: cap(attribute) } : {}) };
}

const dieSpans = (results: number[], kind: DiceSpan['kind']): DiceSpan[] => results.map((n) => ({ text: `[${n}]`, kind }));

export function describeRoll(record: RollRecord, ctx: RollViewContext): RollView {
  const t = T[ctx.lang];
  const d = record.roll;
  const { skill, attribute } = nameOf(record, ctx.lang, ctx.variant);
  const code = typeof d['code'] === 'string' ? d['code'] : undefined;
  const base = typeof d['base'] === 'string' ? d['base'] : undefined;
  const quoted = (name: string): string => `${t.open}${name}${t.close}`;

  // Заголовок — слова Мастера о причине броска; что именно проверяется и с каким значением — отдельной строкой, с явным «навык» или «характеристика».
  const who = ctx.actorName ? `${ctx.actorName} — ` : '';
  const kind = skill ? `${t.skill} ${quoted(skill)}${attribute ? ` (${attribute})` : ''}` : attribute ? `${t.attribute} ${quoted(attribute)}` : '';
  const note = d['untrained'] === true ? `, ${t.untrained}` : '';
  const what = kind ? cap(`${who}${kind}${base !== undefined ? `, ${base}${note}` : ''}`) : '';

  // Баффы и дебаффы тегами в скобках: откуда взялась поправка видно по подписи.
  const spent = (d['spent'] ?? {}) as { cp?: number; fp?: boolean };
  const tags = [
    ...parts(d['mods']).map((p) => `[${t[p.kind]} ${signed(p.code)}]`),
    ...(spent.cp ? [`[${t.cp(spent.cp)}]`] : []),
    ...(spent.fp ? [`[${t.fp}]`] : []),
  ];
  const mods = tags.length > 0 ? `${t.mods}: ${tags.join(' ')}${code !== undefined && base !== undefined && code !== base ? ` → ${code}` : ''}` : '';

  // Выпавшее: пул OpenD6 (обычные кубы, цепочки Wild Die) или классическая формула.
  const dice = nums(d['dice']);
  const wild = nums(d['wild']);
  const cpWild = Array.isArray(d['cpWild']) ? (d['cpWild'] as unknown[]).map(nums) : [];
  const pips = typeof d['pips'] === 'number' ? d['pips'] : typeof d['modifier'] === 'number' ? d['modifier'] : 0;
  const pieces: DiceSpan[][] = [
    ...(dice.length > 0 ? [dieSpans(dice, 'die')] : []),
    ...(wild.length > 0 ? [dieSpans(wild, 'wild')] : []),
    ...cpWild.filter((c) => c.length > 0).map((c) => dieSpans(c, 'extra')),
  ];
  const diceSpans: DiceSpan[] = pieces.flat().flatMap((die, i): DiceSpan[] => (i === 0 ? [die] : [{ text: ' + ', kind: 'plain' }, die]));
  if (diceSpans.length > 0 && pips !== 0) diceSpans.push({ text: pips > 0 ? ` + ${pips}` : ` − ${-pips}`, kind: 'plain' });
  const total = typeof d['total'] === 'number' ? d['total'] : undefined;
  if (diceSpans.length > 0 && total !== undefined) diceSpans.push({ text: ` = ${total}`, kind: 'plain' });

  // Исход кратко, как в старой ленте: «4D+1 = 15 ≥ 12», затем словом. Против сложности или против броска противника.
  let verdict: RollView['verdict'];
  if (record.success !== undefined && total !== undefined) {
    const against = record.difficulty ?? (record.margin !== undefined ? total - record.margin : undefined);
    const contest = record.difficulty === undefined;
    const word = contest ? (record.success ? t.win : t.loss) : record.success ? t.success : t.failure;
    const extra = d['complication'] === true ? `; ${t.complication}` : d['wildOne'] === true && typeof d['cancelled'] === 'number' ? `; ${t.cancelled(d['cancelled'])}` : '';
    const sum = `${code !== undefined ? `${code} = ` : ''}${total}`;
    verdict = { text: `${sum}${against !== undefined ? ` ${record.success ? '≥' : '<'} ${against}` : ''} · ${word}${extra}`, success: record.success };
  }
  return { head: record.reason, ...(what ? { value: what } : {}), ...(mods ? { mods } : {}), dice: diceSpans, ...(verdict ? { verdict } : {}) };
}
