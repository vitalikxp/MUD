// Готовые шаблоны персонажей OpenD6. Источники: OpenD6: adventure p.129–138 (Templates), OpenD6: fantasy p.129–136.
// Шаблон задаёт характеристики (ровно 18D, кроме Телохранителя: в книге у него 18D+1), особенности и снаряжение.
// Навыки шаблона в книге не имеют значений: игрок распределяет 7D среди предложенных (`suggestedSkills`).
import type { Item } from '../../engine/types';
import type { Lang, LocalizedText } from '../api';
import { characterEntity, type CharacterData, type Trait } from './character';
import type { VariantId } from './data';

export interface TemplateItem {
  id: string;
  name: LocalizedText;
  qty?: number;
  slot?: string;
  data?: Item['data'];
}

export interface CharacterTemplate {
  id: string;
  variant: VariantId;
  name: LocalizedText;
  description: LocalizedText;
  /** Страница книги (PDF). */
  source: string;
  attributes: Record<string, string>;
  /** Навыки, которые книга перечисляет для этой профессии. */
  suggestedSkills: string[];
  body: number;
  move: number;
  funds?: string;
  silver?: number;
  traits: Trait[];
  items: TemplateItem[];
}

const lt = (ru: string, en: string): LocalizedText => ({ ru, en });
const trait = (kind: Trait['kind'], ru: string, en: string, rank: number | undefined, ruText: string, enText: string): Trait => ({
  kind,
  name: lt(ru, en),
  ...(rank ? { rank } : {}),
  text: lt(ruText, enText),
});
const adv = (ru: string, en: string, rank: number, ruText: string, enText: string) => trait('advantage', ru, en, rank, ruText, enText);
const dis = (ru: string, en: string, rank: number, ruText: string, enText: string) => trait('disadvantage', ru, en, rank, ruText, enText);
const abil = (ru: string, en: string, rank: number, ruText: string, enText: string) => trait('ability', ru, en, rank, ruText, enText);
const item = (id: string, ru: string, en: string, data?: Item['data'], slot?: string, qty?: number): TemplateItem => ({
  id,
  name: lt(ru, en),
  ...(qty ? { qty } : {}),
  ...(slot ? { slot } : {}),
  ...(data ? { data } : {}),
});

const ADVENTURE_TEMPLATES: CharacterTemplate[] = [
  {
    id: 'bodyguard',
    variant: 'adventure',
    name: lt('Телохранитель', 'Bodyguard'),
    description: lt(
      'Влиятельные бизнесмены, высокопоставленные чиновники и богатые артисты нанимают вас, чтобы защитить от тех, кто яростно не согласен с их делами. Вы особенно хороши с короткоствольным оружием, в безоружном бою и в запугивании.',
      'Powerful businesspeople, high-ranking government officials, and wealthy entertainers have hired you to protect them from those who violently disagree with what they are doing. You are especially good with small arms, unarmed fighting, and frightening others.',
    ),
    source: 'OpenD6: adventure p.129',
    attributes: { reflexes: '3D+1', coordination: '3D+1', physique: '3D+2', knowledge: '2D+1', perception: '2D+2', presence: '3D' },
    suggestedSkills: ['brawling', 'climbing', 'dodge', 'jumping', 'melee-combat', 'sneak', 'marksmanship', 'piloting', 'throwing', 'lifting', 'running', 'stamina', 'command', 'intimidation', 'persuasion', 'willpower', 'business', 'medicine', 'scholar', 'hide', 'investigation', 'search', 'streetwise', 'survival', 'tracking'],
    body: 33,
    move: 10,
    funds: '3D',
    traits: [
      dis('Преданность', 'Devotion', 2, 'Вы сделаете всё необходимое, чтобы защитить нанимателя.', 'You will do what is necessary to protect the employer.'),
      abil('Амбидекстр', 'Ambidextrous', 1, 'Одинаково хорошо работаете обеими руками.', 'Adept at working with either hand.'),
    ],
    items: [
      item('pocket-knife', 'Карманный нож', 'Pocket knife', { weapon: 'melee', damage: '+2' }),
      item('handgun', 'Пистолет', 'Handgun', { weapon: 'ranged', damage: '4D+2', ammo: 6, range: [10, 25, 40] }),
      item('hidden-holster', 'Скрытая кобура', 'Hidden holster'),
      item('overcoat', 'Длинное тёмное пальто', 'Long, dark overcoat'),
    ],
  },
  {
    id: 'correspondent',
    variant: 'adventure',
    name: lt('Корреспондент', 'Correspondent'),
    description: lt(
      'Вы ищете горячие точки мира: в бизнесе, политике или науке. Фотографиями и словами вы сообщаете публике о событиях, острых вопросах и прорывных теориях.',
      'You look for the hot spots in the world, whether it be in business, politics, or academics. Through pictures and words, you inform the public about events, current issues, and ground-breaking theories.',
    ),
    source: 'OpenD6: adventure p.130',
    attributes: { reflexes: '2D+2', coordination: '2D', physique: '2D+1', knowledge: '4D', perception: '4D', presence: '3D' },
    suggestedSkills: ['brawling', 'climbing', 'dodge', 'melee-combat', 'marksmanship', 'piloting', 'lifting', 'running', 'stamina', 'swimming', 'charm', 'con', 'intimidation', 'persuasion', 'willpower', 'business', 'forgery', 'languages', 'medicine', 'navigation', 'scholar', 'tech', 'artist', 'hide', 'investigation', 'know-how', 'repair', 'search', 'streetwise', 'survival', 'tracking'],
    body: 28,
    move: 10,
    funds: '4D',
    traits: [
      adv('Связи', 'Contacts', 1, 'Несколько приятелей в одной области (наука, политика, бизнес).', 'A number of casual friends in a particular field (academics, politics, or business).'),
      adv('Снаряжение', 'Equipment', 2, 'Друг разрешает пользоваться личным самолётом в любые выходные.', 'A friend allows you to use her personal airplane any weekend you would like.'),
      adv('Известность', 'Fame', 1, 'Вас знают по хорошо проработанным статьям.', 'You are well-known for your well-researched tracts.'),
      dis('Изъян преимущества: Связи', 'Advantage Flaw: Contacts', 1, 'Источники требуют делиться сведениями о ваших делах в обмен на знания.', 'Your contacts insist you exchange details on your activities for their expertise.'),
      dis('На службе', 'Employed', 1, 'Нужно регулярно публиковать статьи, чтобы сохранить известность.', 'You have to periodically publish articles in order to keep your Fame.'),
      dis('Преданность', 'Devotion', 1, 'Вы считаете необходимым, чтобы правда выходила наружу.', 'You feel a great need to make sure that the truth comes out.'),
      dis('Причуда', 'Quirk', 2, 'Вы почти навязчиво честны.', 'You are almost compulsively honest.'),
      abil('Удача', 'Good Luck', 1, 'Везение выручает в трудный момент.', 'Good luck helps you out at a tough moment.'),
    ],
    items: [
      item('radio', 'Рация', 'Radio'),
      item('flashlight', 'Фонарик', 'Flashlight'),
      item('backpack', 'Рюкзак', 'Backpack'),
      item('spare-clothes', 'Сменная одежда', 'Spare clothes'),
      item('personal-kit', 'Личный набор', 'Personal kit'),
      item('camera', 'Фотоаппарат', 'Camera'),
      item('journal', 'Блокнот и ручки', 'Journal and pens'),
    ],
  },
  {
    id: 'doctor',
    variant: 'adventure',
    name: lt('Врач', 'Doctor'),
    description: lt(
      'Вы используете медицинские знания и деньги, чтобы приносить исцеление и утешение. Это часто ставит вас в опасные ситуации в глухих местах, но ваш комфорт заботит вас меньше, чем благо других.',
      'You employ your medical knowledge and wealth to bring healing and comfort to others. This often puts you in dangerous situations in remote places, but your comfort is of less concern to you than the well-being of others.',
    ),
    source: 'OpenD6: adventure p.131',
    attributes: { reflexes: '2D+1', coordination: '2D', physique: '2D+2', knowledge: '4D', perception: '3D+2', presence: '3D+1' },
    suggestedSkills: ['brawling', 'dodge', 'melee-combat', 'marksmanship', 'piloting', 'sleight-of-hand', 'throwing', 'lifting', 'running', 'stamina', 'swimming', 'charm', 'command', 'persuasion', 'willpower', 'business', 'languages', 'medicine', 'scholar', 'artist', 'hide', 'investigation', 'search', 'streetwise', 'survival', 'tracking'],
    body: 28,
    move: 10,
    funds: '4D',
    traits: [
      adv('Связи', 'Contacts', 1, 'Небольшие знакомства на чёрном рынке медикаментов.', 'Some low-level contacts in the black market medicine business.'),
      adv('Богатство', 'Wealth', 2, '+4 к результатам Средств; около 10 000 долларов наличными.', '+4 to Funds totals; about US$10,000 in cash.'),
      dis('Изъян преимущества: Связи', 'Advantage Flaw: Contacts', 1, 'Вы достаёте лекарства только для пациентов, но огласка связей разрушила бы вашу репутацию.', 'You use them only to get medicines for your patients, but revelation of your contacts would ruin you in society.'),
      dis('Преданность', 'Devotion', 2, 'Вы свято верите в клятву Гиппократа и рискуете ради исцеления других.', 'You believe very strongly in the principles of your Hippocratic Oath and will take risks to heal others.'),
    ],
    items: [
      item('handgun', 'Пистолет', 'Handgun', { weapon: 'ranged', damage: '4D+2', ammo: 6, range: [10, 25, 50] }),
      item('adventurer-pack', 'Набор джунглевого искателя приключений', 'Jungle adventurer’s pack'),
      item('tent', 'Палатка на одного', 'One-man tent'),
      item('medical-kit', 'Медицинская сумка (+1D к медицине)', 'Medical kit (+1D to medicine rolls)', { bonus: { skill: 'medicine', code: '1D' } }),
    ],
  },
  {
    id: 'field-scientist',
    variant: 'adventure',
    name: lt('Полевой учёный', 'Field Scientist'),
    description: lt(
      'Вы переносите теории лаборатории в реальный мир. Обычно вы годами работали на одном месте, но участвовали и в коротких проектах по поиску и подготовке объектов. Ваша область — биология, геология, палеонтология, археология или другая наука о природе.',
      'You take the theories of the lab into the real world. Generally, you have worked long-term assignments in one area, but you have also enjoyed a few short-term projects involving finding sites and setting them up for others. Your expertise could be in biology, geology, paleontology, archeology, or any of the disciplines studying animals, plants, and other parts of nature.',
    ),
    source: 'OpenD6: adventure p.132',
    attributes: { reflexes: '2D+2', coordination: '3D', physique: '2D+2', knowledge: '3D+2', perception: '4D', presence: '2D' },
    suggestedSkills: ['brawling', 'climbing', 'dodge', 'jumping', 'melee-combat', 'riding', 'sneak', 'marksmanship', 'piloting', 'lockpicking', 'throwing', 'lifting', 'running', 'stamina', 'swimming', 'animal-handling', 'charm', 'con', 'intimidation', 'persuasion', 'willpower', 'business', 'languages', 'navigation', 'scholar', 'tech', 'hide', 'investigation', 'know-how', 'repair', 'search', 'streetwise', 'survival'],
    body: 30,
    move: 10,
    funds: '3D',
    traits: [
      adv('Связи', 'Contacts', 1, 'Вы умеете находить людей, которые достанут сведения, а иногда и снаряжение.', 'You have a knack for finding the right person who can get you the information, and sometimes equipment, you need.'),
      adv('Покровитель', 'Patron', 2, 'Ваши экспедиции оплачивает крупный университет или компания.', 'Your expeditions are funded by a large university or business.'),
      dis('Изъян преимущества: Навыки', 'Advantage Flaw: Skills', 1, 'Теряетесь и лишаетесь перебросов критического успеха при провале очарования, убеждения или языков.', 'You get flustered and lose Critical Success rerolls when you fail a charm, persuasion, or languages roll.'),
      dis('На службе', 'Employed', 1, 'Чтобы сохранить финансирование, нужны регулярные подробные отчёты покровителю.', 'To continue getting funding, you need to make regular and thorough reports to your Patron.'),
      dis('Причуда', 'Quirk', 1, 'Вы забываете, что другие не так увлечены вашей любимой темой.', 'You often forget that people are not quite as enthusiastic about your beloved area of study as you are.'),
    ],
    items: [
      item('leather-jacket', 'Кожаная куртка (защита +1D)', 'Leather jacket (Armor Value +1D)', { armor: '1D' }, 'body'),
      item('handgun', 'Пистолет', 'Handgun', { weapon: 'ranged', damage: '4D+1', ammo: 6, range: [5, 15, 40] }),
      item('binoculars', 'Бинокль', 'Binoculars'),
      item('adventurer-pack', 'Набор джунглевого искателя приключений', 'Jungle adventurer’s pack'),
      item('journal', 'Дневник и ручки', 'Journal and pens'),
      item('sampling-kit', 'Набор для испытаний и проб', 'Testing and sampling kit'),
    ],
  },
  {
    id: 'reformed-thief',
    variant: 'adventure',
    name: lt('Завязавший вор', 'Reformed Thief'),
    description: lt(
      'Из-за дурного влияния вы решили, что быстрее всего выбраться из нищеты — брать у других. Но что-то изменилось: вы были хороши, однако завязали. Теперь у вас приличная работа, а прежние умения нужны, лишь чтобы «украшать» дома друзей в их отсутствие и помогать знакомым из правительственного агентства.',
      'Growing up with a lot of bad influences, you figured the fastest way to get out was to take from others. But something happened along the way, and though you were good at what you did, you got out. Now you have a respectable job, and the only time you use your former skills is to decorate friends’ houses while they are gone and help out some contacts in a government agency.',
    ),
    source: 'OpenD6: adventure p.136',
    attributes: { reflexes: '3D+2', coordination: '3D+2', physique: '2D+1', knowledge: '2D+1', perception: '3D+2', presence: '2D+1' },
    suggestedSkills: ['acrobatics', 'brawling', 'climbing', 'contortion', 'dodge', 'jumping', 'melee-combat', 'sneak', 'lockpicking', 'marksmanship', 'missile-weapons', 'sleight-of-hand', 'throwing', 'lifting', 'running', 'stamina', 'charm', 'con', 'disguise', 'persuasion', 'willpower', 'business', 'demolitions', 'forgery', 'languages', 'scholar', 'security', 'tech', 'hide', 'gambling', 'investigation', 'know-how', 'repair', 'search', 'streetwise', 'survival', 'tracking'],
    body: 32,
    move: 10,
    funds: '3D',
    traits: [
      adv('Покровитель', 'Patron', 1, 'Тайное правительственное агентство оплачивает ваши расходы на жизнь.', 'A secret government agency provides you with living expenses.'),
      dis('Дурная слава', 'Infamy', 1, 'Знающие о вашем прошлом иногда относятся с пренебрежением: +3 к сложности таких взаимодействий.', 'Those who know about your past thieving deeds sometimes treat you with some disdain: +3 to the difficulty of all such interactions.'),
      dis('На службе', 'Employed', 1, 'Агентство требует выполнять для него задания.', 'The agency requires you to do jobs for them.'),
      abil('Бонус к навыку: гибкость', 'Skill Bonus: Supple', 1, '+1 к результатам акробатики, выскальзывания и уклонения.', '+1 to acrobatics, contortion, and dodge totals.'),
    ],
    items: [
      item('lockpicks', 'Отмычки (+1D к взлому простых механических замков)', 'Lockpicking tools (+1D to lockpicking for simple mechanical locks)', { bonus: { skill: 'lockpicking', code: '1D' } }),
      item('climbing-tools', 'Снаряжение для лазания (+1D к лазанию)', 'Climbing tools (+1D to climbing)', { bonus: { skill: 'climbing', code: '1D' } }),
    ],
  },
  {
    id: 'weapons-master',
    variant: 'adventure',
    name: lt('Мастер оружия', 'Weapons Master'),
    description: lt(
      'Вы посвятили жизнь тайнам стали, дерева и плоти, раскрывая их скрытую энергию ради цели стать почти непобедимым в бою. Разнообразие для вас — путь к победе.',
      'You have devoted your life to learning the secret of steel, wood, and flesh, discovering their latent energies and harnessing them with the goal of becoming virtually invincible in combat. You consider diversity to be the road to victory.',
    ),
    source: 'OpenD6: adventure p.138',
    attributes: { reflexes: '4D', coordination: '4D', physique: '3D', knowledge: '2D', perception: '3D', presence: '2D' },
    suggestedSkills: ['acrobatics', 'brawling', 'dodge', 'jumping', 'melee-combat', 'marksmanship', 'missile-weapons', 'sleight-of-hand', 'throwing', 'lifting', 'running', 'stamina', 'command', 'intimidation', 'persuasion', 'willpower', 'demolitions', 'medicine', 'scholar', 'security', 'tech', 'know-how', 'repair', 'search', 'survival'],
    body: 38,
    move: 10,
    funds: '3D',
    traits: [
      adv('Фирменное оружие', 'Trademark Specialization', 1, '+2D при использовании одного любимого оружия; вас могут узнавать по нему.', 'You are very good at using one of your weapons: +2D when using it, and you may be recognized by those watching.'),
      adv('Богатство', 'Wealth', 1, '+2 к результатам Средств; около 5000 долларов наличными.', '+2 to Funds totals; about US$5,000 in cash.'),
      dis('Враг', 'Enemy', 1, 'Время от времени бойцы ищут вас, чтобы испытать своё мастерство.', 'Occasionally, fighters seek you to test their skills against yours.'),
      dis('Плата', 'Price', 2, 'Каждый день 30 минут на медитацию и тренировку, иначе −1 ко всем боевым навыкам до конца дня.', 'You must spend 30 minutes each day in meditation and practice or you are at -1 to all combat skill totals for the rest of the day.'),
      abil('Бонус к навыку: атлетика', 'Skill Bonus: Athletics', 1, '+1 к результатам акробатики, поднятия тяжестей и бега.', '+1 skill total bonus to acrobatics, lifting, and running.'),
    ],
    items: [
      item('katana', 'Катана', 'Katana', { weapon: 'melee', damage: '+3D' }),
      item('dagger', 'Кинжал', 'Dagger', { weapon: 'melee', damage: '+1D' }),
      item('throwing-stars', 'Метательные звёзды', 'Throwing stars', { weapon: 'thrown', damage: '+1D', range: [5, 10, 15] }, undefined, 7),
    ],
  },
];

const FANTASY_TEMPLATES: CharacterTemplate[] = [
  {
    id: 'bard',
    variant: 'fantasy',
    name: lt('Бард', 'Bard'),
    description: lt(
      'Другие берут сюжеты для сказок из третьих рук. Вы предпочитаете смотреть, как по-настоящему захватывающие части истории разворачиваются у вас на глазах.',
      'Others get ideas for their tales second or third hand. You prefer to see the really exciting parts of history unfold for yourself.',
    ),
    source: 'OpenD6: fantasy p.129',
    attributes: { agility: '2D', coordination: '2D', physique: '2D', intellect: '4D', acumen: '4D', charisma: '4D' },
    suggestedSkills: ['climbing', 'dodge', 'fighting', 'melee-combat', 'riding', 'stealth', 'lockpicking', 'running', 'cultures', 'healing', 'navigation', 'reading-writing', 'scholar', 'speaking', 'trading', 'artist', 'disguise', 'gambling', 'hide', 'investigation', 'know-how', 'search', 'streetwise', 'survival', 'bluff', 'charm', 'intimidation', 'mettle', 'persuasion'],
    body: 24,
    move: 10,
    funds: '5D',
    silver: 300,
    traits: [
      dis('Причуда', 'Quirk', 1, 'Муза настигает вас и заставляет тут же сочинять песню или рассказ.', 'Your muse often overcomes you and inspires you to create a song or story on the spot.'),
      abil('Бонус к навыку: эйдетическая память', 'Skill Bonus: Eidetic', 1, '+1 к результатам речи, эрудиции и расследования.', '+1 bonus to speaking, scholar, and investigation totals.'),
    ],
    items: [
      item('dagger', 'Кинжал', 'Dagger', { weapon: 'melee', damage: '+1D' }),
      item('leather-jerkin', 'Кожаная куртка (защита +2)', 'Leather jerkin (Armor Value +2)', { armor: '2' }, 'body'),
      item('paper', 'Бумага', 'Paper'),
      item('quill-ink', 'Перо и чернила', 'Quill and ink'),
      item('scroll-tube', 'Тубус для свитков', 'Scroll tube'),
    ],
  },
  {
    id: 'gladiator',
    variant: 'fantasy',
    name: lt('Гладиатор', 'Gladiator'),
    description: lt(
      'Вы так сосредоточились на битве, что трудно отказаться от драки. На арене вы прославились владением определённым оружием.',
      'You have so focused yourself on battle that you find it hard to resist a fight when you have the opportunity. From your time in the arena circuit, you have become famous for the use of a particular weapon.',
    ),
    source: 'OpenD6: fantasy p.131',
    attributes: { agility: '4D', coordination: '3D', physique: '4D', intellect: '2D', acumen: '3D', charisma: '2D' },
    suggestedSkills: ['acrobatics', 'climbing', 'dodge', 'fighting', 'jumping', 'melee-combat', 'riding', 'stealth', 'charioteering', 'marksmanship', 'throwing', 'lifting', 'running', 'stamina', 'swimming', 'healing', 'crafting', 'gambling', 'know-how', 'streetwise', 'survival', 'command', 'intimidation', 'mettle', 'persuasion'],
    body: 38,
    move: 10,
    funds: '3D',
    silver: 180,
    traits: [
      adv('Фирменное оружие', 'Trademark Specialization', 1, '+2D при использовании одного оружия по вашему выбору; вас могут узнавать зрители.', 'Gain +2D when using one weapon (your choice), and you may be recognized by those watching.'),
      dis('Преданность', 'Devotion', 1, 'Вы преданы бою.', 'You are devoted to fighting.'),
    ],
    items: [
      item('short-sword', 'Короткий меч', 'Short sword', { weapon: 'melee', damage: '+1D+2' }),
      item('hard-leather', 'Доспех из твёрдой кожи (защита +1D+1)', 'Hard leather armor (Armor Value +1D+1)', { armor: '1D+1' }, 'body'),
      item('small-shield', 'Малый щит (защита +2D)', 'Small shield (Armor Value +2D)', { armor: '2D', shield: true }, 'shield'),
    ],
  },
  {
    id: 'healer',
    variant: 'fantasy',
    name: lt('Целитель', 'Healer'),
    description: lt(
      'Вас всегда тянуло заботиться о других. Кроме моментов, когда вы нервничаете и заикаетесь, людям приятно быть рядом с вами.',
      'You have always had a predilection toward caring for others. Except when you get nervous and stutter, people like to be around you.',
    ),
    source: 'OpenD6: fantasy p.132',
    attributes: { agility: '2D+2', coordination: '2D', physique: '2D+1', intellect: '4D', acumen: '3D+2', charisma: '3D+1' },
    suggestedSkills: ['climbing', 'dodge', 'melee-combat', 'riding', 'sleight-of-hand', 'throwing', 'lifting', 'running', 'stamina', 'swimming', 'cultures', 'healing', 'reading-writing', 'scholar', 'speaking', 'trading', 'artist', 'hide', 'investigation', 'know-how', 'search', 'survival', 'animal-handling', 'charm', 'command', 'mettle', 'persuasion'],
    body: 26,
    move: 10,
    funds: '4D',
    silver: 240,
    traits: [
      dis('Причуда: заикание', 'Quirk: Stutter', 1, 'После каждого проваленного броска навыка вы теряетесь и заикаетесь: +3 ко всем сложностям общения, пока не выпадет критический успех.', 'Whenever you fail a skill check, you become flustered and stutter, getting a +3 to all interaction difficulties, until you get a Critical Success on a roll.'),
      abil('Бонус к навыку: успокаивающее присутствие', 'Skill Bonus: Naturally Soothing', 1, '+1 к результатам обращения с животными, очарования и врачевания.', '+1 bonus to animal handling, charm, and healing totals.'),
    ],
    items: [
      item('knife', 'Нож', 'Knife', { weapon: 'melee', damage: '+1D' }),
      item('candles', 'Свечи', 'Candles', undefined, undefined, 3),
      item('tinderbox', 'Огниво', 'Tinderbox'),
      item('herbs', 'Мешочек трав (+1 к врачеванию; шесть применений)', 'Pouch of herbs (+1 bonus to healing totals; six uses)', { bonus: { skill: 'healing', code: '1' }, uses: 6 }),
    ],
  },
  {
    id: 'monster-slayer',
    variant: 'fantasy',
    name: lt('Истребитель чудовищ', 'Monster Slayer'),
    description: lt(
      'Когда банда чудовищ убила дорогих вам людей, вы пошли странствовать, чтобы избавить мир от подобных исчадий. Священник благословил ваше дело, дав устойчивость к некоторым видам физического вреда.',
      'After a band of monsters killed those you loved, you have been wandering the world, seeking to rid it of such diabolical creatures. A priest blessed your cause, giving you a resistance to certain kinds of physical harm.',
    ),
    source: 'OpenD6: fantasy p.134',
    attributes: { agility: '3D+2', coordination: '3D+1', physique: '3D+2', intellect: '2D', acumen: '3D+1', charisma: '2D' },
    suggestedSkills: ['acrobatics', 'climbing', 'dodge', 'fighting', 'jumping', 'melee-combat', 'stealth', 'marksmanship', 'throwing', 'lifting', 'running', 'stamina', 'swimming', 'healing', 'traps', 'gambling', 'crafting', 'hide', 'investigation', 'search', 'streetwise', 'survival', 'tracking', 'animal-handling', 'command', 'intimidation', 'mettle', 'persuasion'],
    body: 35,
    move: 10,
    funds: '3D',
    silver: 180,
    traits: [
      dis('Возраст', 'Age', 1, 'Вы моложе, чем принято, и вас не всегда принимают всерьёз.', 'You are slightly younger than typical, so people do not always take you seriously.'),
      dis('Преданность', 'Devotion', 1, 'Вы защищаете простых людей от необыкновенных исчадий.', 'Devoted to protecting ordinary people from extraordinary fiends.'),
      abil('Сопротивление атакам: неволшебное оружие', 'Attack Resistance: Nonenchanted Weapons', 1, '+1D к сопротивлению урону от такого оружия.', '+1D to your damage resistance total against such weapons.'),
    ],
    items: [
      item('battle-axe', 'Боевой топор', 'Battle axe', { weapon: 'melee', damage: '+3D' }),
      item('leather-pants', 'Кожаные штаны (защита +2, только ноги)', 'Leather pants (Armor Value +2 to legs only)', { armor: '2', zone: 'legs' }, 'legs'),
    ],
  },
  {
    id: 'ranger',
    variant: 'fantasy',
    name: lt('Следопыт', 'Ranger'),
    description: lt(
      'Вы выросли в лесах и много путешествовали по дикой местности. Прежде всего вы защищаете землю, растения и зверей, а затем уже путников.',
      'You grew up in forests, and you have traveled through a lot of wilderness. You firstly seek to protect the land, plants, and animals, and secondly, any travelers.',
    ),
    source: 'OpenD6: fantasy p.135',
    attributes: { agility: '3D+1', coordination: '3D+1', physique: '3D', intellect: '2D+2', acumen: '2D+2', charisma: '3D' },
    suggestedSkills: ['climbing', 'dodge', 'fighting', 'jumping', 'melee-combat', 'riding', 'stealth', 'marksmanship', 'throwing', 'lifting', 'running', 'stamina', 'swimming', 'healing', 'navigation', 'scholar', 'speaking', 'traps', 'crafting', 'hide', 'investigation', 'know-how', 'search', 'survival', 'tracking', 'animal-handling', 'charm', 'command', 'intimidation', 'mettle', 'persuasion'],
    body: 33,
    move: 10,
    funds: '3D',
    silver: 180,
    traits: [
      adv('Связи', 'Contacts', 1, 'Вы помогли многим, и многие готовы вернуть услугу.', 'You have helped a lot of people, many of whom would be willing to return the favor.'),
      dis('Преданность', 'Devotion', 2, 'Вы яро защищаете дикие земли и их обитателей.', 'Fiercely devoted to protecting wilderness areas and their inhabitants.'),
      abil('Бонус к навыку: зоркий глаз', 'Skill Bonus: Keen Eye', 1, '+1 к результатам стрельбы, наблюдательности и выслеживания.', '+1 bonus to marksmanship, search, and tracking.'),
    ],
    items: [
      item('cloak', 'Плащ', 'Cloak'),
      item('long-bow', 'Длинный лук и колчан со стрелами', 'Long bow and quiver of arrows', { weapon: 'missile', damage: '+2D+2' }),
      item('leather-jerkin', 'Кожаная куртка (защита +2)', 'Leather jerkin (Armor Value +2)', { armor: '2' }, 'body'),
    ],
  },
  {
    id: 'thief',
    variant: 'fantasy',
    name: lt('Вор', 'Thief'),
    description: lt(
      'Одни зарабатывают на жизнь полем или мечом. Вы предпочитаете испытывать свою смекалку против бдительности обитателей дома. Если выиграете, оставляете что-нибудь себе.',
      'Some people farm or fight professionally to earn a living. You prefer to test your wits against the awareness of a household. If you win, you get to keep something.',
    ),
    source: 'OpenD6: fantasy p.136',
    attributes: { agility: '3D', coordination: '4D', physique: '3D', intellect: '2D+1', acumen: '2D+2', charisma: '3D' },
    suggestedSkills: ['acrobatics', 'climbing', 'contortion', 'dodge', 'fighting', 'jumping', 'melee-combat', 'stealth', 'lockpicking', 'sleight-of-hand', 'throwing', 'lifting', 'running', 'cultures', 'reading-writing', 'trading', 'traps', 'artist', 'crafting', 'disguise', 'gambling', 'hide', 'investigation', 'search', 'streetwise', 'survival', 'bluff', 'charm', 'mettle', 'persuasion'],
    body: 30,
    move: 10,
    funds: '3D',
    silver: 180,
    traits: [
      dis('Враг', 'Enemy', 1, 'Кто-то поймал вас на краже; вы сбежали, но теперь за вами охотятся.', 'Someone caught you while you were stealing — though you managed to escape, you now have someone after you.'),
      abil('Бонус к навыку: ловкие пальцы', 'Skill Bonus: Nimble Fingers', 1, '+1 к результатам взлома замков, ловкости рук и азартных игр.', '+1 bonus to lockpicking, sleight of hand, and gambling totals.'),
    ],
    items: [
      item('dagger', 'Кинжал', 'Dagger', { weapon: 'melee', damage: '+1D' }),
      item('cloak', 'Плащ', 'Cloak'),
      item('rope', 'Верёвка', 'Rope'),
      item('sack', 'Мешок', 'Sack'),
      item('trap-tools', 'Инструменты для ловушек', 'A few tools to spring traps'),
    ],
  },
];

export const TEMPLATES: readonly CharacterTemplate[] = [...FANTASY_TEMPLATES, ...ADVENTURE_TEMPLATES];

export const templatesFor = (variant: string): CharacterTemplate[] => TEMPLATES.filter((t) => t.variant === variant);

export const findTemplate = (variant: string, id: string): CharacterTemplate | undefined => TEMPLATES.find((t) => t.variant === variant && t.id === id);

/** Данные персонажа из шаблона. `skills` — распределённые игроком надбавки (id → «2D»); по умолчанию пусто. */
export function templateData(template: CharacterTemplate, lang: Lang, skills: Record<string, string> = {}): CharacterData {
  return {
    variant: template.variant,
    attributes: { ...template.attributes },
    skills: { ...skills },
    body: { points: template.body, max: template.body },
    move: template.move,
    points: { cp: 5, fp: 1 },
    concept: template.name[lang],
    ...(template.funds ? { funds: template.funds } : {}),
    ...(template.silver !== undefined ? { silver: template.silver } : {}),
    traits: template.traits.map((t) => ({ ...t })),
  };
}

/** Сущность-персонаж из шаблона: предметы получают названия на языке кампании. */
export function templateEntity(template: CharacterTemplate, input: { id: string; name: string; ownerUid?: string; lang: Lang; skills?: Record<string, string> }) {
  return characterEntity({
    id: input.id,
    name: input.name,
    ...(input.ownerUid ? { ownerUid: input.ownerUid } : {}),
    data: templateData(template, input.lang, input.skills),
    items: template.items.map((i) => ({ id: i.id, name: i.name[input.lang], qty: i.qty ?? 1, slot: i.slot ?? null, ...(i.data ? { data: i.data } : {}) })),
  });
}
