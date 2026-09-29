// Снаряжение D6 Adventure. Источники: OpenD6: adventure p.114–121 (Gear, Protective Gear, Firearms, Explosives, Melee, Missile and Thrown, Vehicles).
// Цены — сложности покупки (VE…L); доступность: A — почти везде, C — города и заказ по почте, U — редкое, N — недоступно до 1990-х.
import { armor, gear, vehicle, weapon, type CatalogEntry } from './types';

const bonus = (skill: string, code: string) => ({ bonus: { skill, code } });

const GEAR: CatalogEntry[] = [
  gear('alarm-clock', 'Будильник', 'Alarm clock', 'VE', undefined, { avail: 'A' }),
  gear('archaeologists-tool-kit', 'Набор инструментов археолога', 'Archaeologist’s tool kit', 'E', undefined, { avail: 'U', data: bonus('investigation', '1D'), note: ['+1D к расследованию (нужен навык)', '+1D to investigation (needs the skill)'] }),
  gear('art-supplies', 'Художественные принадлежности', 'Art supplies', 'E', undefined, { avail: 'C', data: bonus('artist', '1D'), note: ['+1D к искусству (нужен навык)', '+1D to artist (needs the skill)'] }),
  gear('backpack', 'Рюкзак', 'Backpack', 'VE', undefined, { avail: 'A' }),
  gear('basic-clothing', 'Обычная одежда', 'Basic clothing', 'E', undefined, { avail: 'A' }),
  gear('field-rations', 'Полевой паёк на несколько дней', 'Basic field rations, few days’ worth', 'VE', undefined, { avail: 'A' }),
  gear('binoculars', 'Бинокль', 'Binoculars', 'E', undefined, { avail: 'C', note: ['+1D к зрительным броскам дальше 2 м, только днём', '+1D to sight-based rolls beyond two meters, daylight only'] }),
  gear('blanket', 'Одеяло', 'Blanket', 'VE', undefined, { avail: 'A' }),
  gear('camera', 'Простой фотоаппарат', 'Camera, basic point and shoot', 'E', undefined, { avail: 'C' }),
  gear('film', 'Фотоплёнка', 'Film, basic color or B&W', 'VE', undefined, { avail: 'C' }),
  gear('construction-tool-kit', 'Набор плотника и строителя', 'Carpenter’s/construction tool kit', 'E', undefined, { avail: 'A', data: bonus('repair', '1D'), note: ['+1D к соответствующему навыку', '+1D to the relevant skill'] }),
  gear('compass', 'Компас', 'Compass', 'VE', undefined, { avail: 'C' }),
  gear('crowbar', 'Ломик', 'Crowbar', 'VE', undefined, { avail: 'A', note: ['+1D ко взлому рычагом; в ударе Сила удара +2', '+1D to prying; Strength Damage +2 when bashing'] }),
  gear('newspaper', 'Ежедневная газета или еженедельный журнал', 'Daily newspaper, weekly magazine', 'VE', undefined, { avail: 'A' }),
  gear('disguise-kit', 'Набор для переодевания', 'Disguise kit', 'E', undefined, { avail: 'C', data: bonus('disguise', '1D'), note: ['+1D к переодеванию (нужен навык)', '+1D to disguise (needs the skill)'] }),
  gear('duct-tape', 'Изолента, 10 м', 'Duct tape, 10 meters', 'VE', undefined, { avail: 'C', note: ['держит около 90 кг; сопротивление 10', 'holds about 90 kg; damage resistance 10'] }),
  gear('duffel-bag', 'Вещмешок', 'Duffel bag', 'VE', undefined, { avail: 'A' }),
  gear('eating-utensils', 'Столовые приборы', 'Eating utensils', 'VE', undefined, { avail: 'A' }),
  gear('electricians-tool-kit', 'Набор инструментов электрика', 'Electrician’s tool kit', 'E', undefined, { avail: 'C', data: bonus('repair', '1D'), note: ['+1D к соответствующему навыку', '+1D to the relevant skill'] }),
  gear('evidence-kit', 'Набор для сбора улик', 'Evidence kit', 'M', undefined, { avail: 'U', data: bonus('investigation', '1D'), note: ['+1D к расследованию (нужен навык)', '+1D to investigation (needs the skill)'] }),
  gear('field-radio', 'Полевая рация', 'Field radio', 'E', undefined, { avail: 'U' }),
  gear('first-aid-kit', 'Аптечка', 'First-aid kit', 'VE', undefined, { avail: 'C', data: bonus('medicine', '1'), note: ['малая: +1 к медицине на 5–10 применений; большая: +1D на 2–5', 'small: +1 to medicine for 5–10 uses; a larger one adds 1D for 2–5'] }),
  gear('fishing-gear', 'Рыболовные снасти', 'Fishing gear', 'VE', undefined, { avail: 'A' }),
  gear('flashlight', 'Большой фонарь', 'Flashlight, large', 'VE', undefined, { avail: 'C', note: ['−2D к штрафам темноты в конусе до 5 м', 'reduces darkness modifiers by 2D in a cone up to 5 m'] }),
  gear('gas-mask', 'Противогаз', 'Gas mask', 'E', undefined, { avail: 'U', note: ['+2D к выносливости против газа', '+2D to stamina against gas'] }),
  gear('gas-stove', 'Газовая плитка', 'Gas stove', 'E', undefined, { avail: 'C' }),
  gear('geiger-counter', 'Счётчик Гейгера', 'Geiger counter', 'E', undefined, { avail: 'U' }),
  gear('handcuffs', 'Наручники', 'Handcuffs', 'E', undefined, { avail: 'U', note: ['снять ключом или проверкой взлома замков на 10–15; сопротивление 15', 'key or a Moderate lockpicking roll to remove; resistance 15'] }),
  gear('holster', 'Кобура', 'Holster', 'VE', undefined, { avail: 'C' }),
  gear('jungle-pack', 'Набор джунглевого искателя приключений', 'Jungle adventurer’s pack', 'E', undefined, { avail: 'U', note: ['+2 к выживанию в джунглях и густом лесу', '+2 to survival in jungle or heavy forest'] }),
  gear('iron-spikes-piton', 'Железные шипы (8) и скальный крюк', 'Iron spikes (8) and piton', 'VE', undefined, { avail: 'A', data: bonus('climbing', '1D'), note: ['+1D к лазанию (с верёвкой); шип бьёт на Силу удара +1', '+1D to climbing (with a rope); a spike does Strength Damage +1'] }),
  gear('kerosene-heater', 'Керосиновый обогреватель', 'Kerosene heater', 'VE', undefined, { avail: 'C' }),
  gear('lantern', 'Фонарь', 'Lantern', 'VE', undefined, { avail: 'A' }),
  gear('lighter', 'Зажигалка', 'Lighter', 'VE', undefined, { avail: 'A' }),
  gear('lockpicking-tools', 'Отмычки', 'Lockpicking tools', 'VE', undefined, { avail: 'U', data: bonus('lockpicking', '1D'), note: ['+1D ко взлому замков (нужен навык)', '+1D to lockpicking (needs the skill)'] }),
  gear('marbles', 'Шарики', 'Marbles', 'VE', undefined, { avail: 'A', note: ['наступивший делает проверку рефлексов или акробатики на 10 за шаг', 'stepping on them: Moderate Reflexes or acrobatics roll per step'] }),
  gear('mechanics-tool-kit', 'Набор инструментов механика', 'Mechanic’s tool kit', 'E', undefined, { avail: 'C', data: bonus('repair', '1D'), note: ['+1D к ремонту и технике (нужен навык)', '+1D to repair or tech (needs the skill)'] }),
  gear('movie-camera', 'Малая кинокамера', 'Movie camera, small', 'M', undefined, { avail: 'U' }),
  gear('movie-film', 'Плёнка или кассета для кинокамеры', 'Movie camera film or tape', 'VE', undefined, { avail: 'U' }),
  gear('parachute', 'Парашют', 'Parachute', 'E', undefined, { avail: 'U' }),
  gear('hygiene-kit', 'Набор личной гигиены', 'Personal hygiene kit', 'VE', undefined, { avail: 'A' }),
  gear('pda', 'КПК', 'PDA', 'M', undefined, { avail: 'C/N' }),
  gear('quick-draw-holster', 'Кобура быстрого выхвата', 'Quick-draw holster', 'E', undefined, { avail: 'C', note: ['выхват не считается действием; +1D к инициативе в дуэли на выхват', 'drawing is not an action; +1D initiative in a quick-draw contest'] }),
  gear('portable-radio', 'Портативная радиостанция', 'Radio, portable', 'VE', undefined, { avail: 'A' }),
  gear('rifle-scope', 'Оптический прицел', 'Rifle scope', 'E', undefined, { avail: 'C', note: ['+2 к стрельбе на средней и дальней дистанции; нужен раунд на прицеливание', '+2 to marksmanship at Medium or Long range; needs a round of aiming'] }),
  gear('rope-hemp', 'Верёвка пеньковая, 50 м', 'Rope, hemp, 50 meters', 'VE', undefined, { avail: 'A', note: ['удушение: Сила удара +2; сопротивление 5', 'choking: Strength Damage +2; resistance 5'] }),
  gear('rope-cotton', 'Верёвка хлопковая, 50 м', 'Rope, cotton, 50 meters', 'VE', undefined, { avail: 'A', note: ['удушение: Сила удара +1; сопротивление 3', 'choking: Strength Damage +1; resistance 3'] }),
  gear('sewing-machine', 'Швейная машинка', 'Sewing machine, small', 'VE', undefined, { avail: 'A' }),
  gear('shovel', 'Лопата', 'Shovel', 'VE', undefined, { avail: 'A', note: ['+1D к копанию; в ударе Сила удара +2', '+1D to digging; Strength Damage +2 when bashing'] }),
  gear('signal-locator', 'Приёмник сигнала маячков', 'Signal locator', 'D', undefined, { avail: 'U/N' }),
  gear('sleeping-bag', 'Спальный мешок', 'Sleeping bag or bedroll', 'E', undefined, { avail: 'A' }),
  gear('steamer-trunk', 'Дорожный сундук', 'Steamer trunk', 'VE', undefined, { avail: 'A' }),
  gear('tape-recorder', 'Магнитофон', 'Tape recorder', 'E', undefined, { avail: 'A' }),
  gear('recorder-tapes', 'Кассеты для магнитофона', 'Tapes for recorder', 'VE', undefined, { avail: 'A' }),
  gear('telescope', 'Подзорная труба', 'Telescope', 'E', undefined, { avail: 'C', note: ['+2D к зрительному поиску; настройка занимает раунд', '+2D to vision-based search; focusing takes a round'] }),
  gear('tent-1', 'Палатка на одного', 'Tent, 1-person', 'VE', undefined, { avail: 'A' }),
  gear('tent-3', 'Палатка на троих', 'Tent, 3-person', 'E', undefined, { avail: 'A' }),
  gear('tracking-device', 'Маячок слежения', 'Tracking device', 'M', undefined, { avail: 'C/N' }),
  gear('typewriter', 'Печатная машинка', 'Typewriter', 'E', undefined, { avail: 'C' }),
  gear('torch', 'Факел', 'Torch', 'VE', undefined, { avail: 'A', note: ['3D в раунд по горючей поверхности; гасит до 4D темноты рядом', '3D per round on a flammable surface; negates up to 4D of darkness nearby'] }),
  gear('watch', 'Часы', 'Watch', 'VE–E', undefined, { avail: 'A' }),
  gear('wood-stove', 'Дровяная печка', 'Wood stove', 'E', undefined, { avail: 'A' }),
];

// Защитное снаряжение (adventure p.115). «*» в книге — недоступно в пульповых сеттингах.
const ARMOR: CatalogEntry[] = [
  armor('woven-metal-light', 'Металлизированная ткань (лёгкая)', 'Woven metal fabric (light)', '1', 'E'),
  armor('hides-and-fur', 'Шкуры и меха', 'Hides and fur', '2', '—'),
  armor('soft-leather', 'Мягкая кожа, парусина, плотная хаки', 'Soft leather, canvas, heavy khaki', '2', 'VE–E'),
  armor('bone-and-hide', 'Кость и шкура', 'Bone and hide', '1D', '—'),
  armor('padded-leather', 'Стёганая кожа, лётная куртка', 'Padded leather, flying jacket', '1D', 'E'),
  armor('woven-metal-heavy', 'Металлизированная ткань (тяжёлая)', 'Woven metal fabric (heavy)', '1D', 'M'),
  armor('hard-leather', 'Твёрдая кожа', 'Hard leather', '1D+1', 'E'),
  armor('chain-mail', 'Кольчуга', 'Chain mail', '2D', 'E'),
  armor('plate-mail', 'Латы', 'Plate mail', '3D', 'M'),
  armor('bulletproof-vest', 'Бронежилет', 'Bulletproof vest', '3D', 'M'),
  armor('reflec', 'Рефлек (только против энергии)', 'Reflec (against energy only)', '3D', 'L'),
  armor('flak-jacket', 'Армейский бронежилет', 'Flak jacket', '3D+1', 'M'),
  armor('light-kevlar', 'Лёгкий кевлар', 'Light Kevlar', '2D+1', 'D'),
  armor('heavy-kevlar', 'Тяжёлый кевлар', 'Heavy Kevlar', '3D', 'D'),
  armor('ceramic-armor', 'Керамическая броня', 'Ceramic armor', '3D+1', 'H'),
];

// Огнестрельное и энергетическое оружие (adventure p.116). Цена: оружие (патроны). Дальность, м: короткая/средняя/дальняя.
const f = (id: string, ru: string, en: string, damage: string, ammo: number | string, r: [number | string, number | string, number | string], level: string, ammoLevel: string, o: { single?: boolean; slow?: boolean; cls?: 'firearm' | 'energy' } = {}) =>
  weapon(id, ru, en, o.cls ?? 'firearm', damage, level, undefined, {
    range: r,
    ammo,
    ammoPrice: ammoLevel,
    // «*» в книге: нельзя стрелять одиночным как несколькими; «**»: перезарядка — восемь раундов или стрельба на 8 за один
    extra: { ...(o.single ? { noMultiFire: true } : {}), ...(o.slow ? { reloadRounds: 8, quickReloadDifficulty: 8 } : {}) },
  });

const FIREARMS: CatalogEntry[] = [
  f('m1-carbine', 'Карабин M1 .30', '.30 M1 Carbine', '5D+1', 8, [45, 450, 600], 'M', 'E'),
  f('colt-snub-38', 'Револьвер Colt Snub .38', 'Colt Snub .38 revolver', '4D', 6, [5, 10, 15], 'E', 'VE'),
  f('colt-45-peacemaker', 'Colt .45 Peacemaker', 'Colt .45 Peacemaker', '4D+1', 6, [15, 30, 45], 'E', 'VE'),
  f('glock-17', 'Пистолет Glock 17 9 мм', 'Glock 17 9mm pistol', '3D+2', 16, [8, 16, 24], 'D', 'E'),
  f('luger-p08', 'Luger P08 9 мм', 'Luger P08 9mm', '3D+2', 8, [10, 20, 30], 'E', 'VE'),
  f('derringer-45', 'Дерринджер .45', 'Derringer .45 pistol', '4D', 2, [10, 20, 30], 'E', 'VE', { single: true }),
  f('sw-38-revolver', 'Револьвер Smith & Wesson .38', 'Smith & Wesson .38 revolver', '4D', 6, [15, 30, 45], 'E', 'VE'),
  f('sw-357-magnum', 'Smith & Wesson .357 Magnum', 'Smith & Wesson .357 Magnum', '5D', 6, [20, 35, 50], 'E', 'VE'),
  f('walther-ppk', 'Walther PPK 9 мм короткий', 'Walter PPK 9mm short', '3D', 7, [7, 14, 21], 'M', 'E', { single: true }),
  f('blunderbuss', 'Мушкетон', 'Blunderbuss', '4D', 1, [12, 20, 30], 'M', 'E', { single: true, slow: true }),
  f('flintlock-musket', 'Кремнёвый мушкет', 'Flintlock musket', '3D+2', 1, [25, 40, 100], 'M', 'E', { single: true, slow: true }),
  f('springfield-m1903', 'Винтовка Springfield M1903 (.30-06)', 'Springfield M1903 Rifle (.30-06)', '7D', 5, [40, 80, 160], 'E', 'VE'),
  f('remington-mod-30', 'Винтовка Remington Mod 30', 'Remington Mod 30', '5D+1', 6, [20, 75, 200], 'E', 'VE'),
  f('winchester-94', 'Винчестер 94 (30-30)', 'Winchester 94 lever action (30-30)', '6D+1', 6, [30, 60, 120], 'M', 'E'),
  f('mossberg-m500', 'Помповое ружьё Mossberg M500 (12 калибр)', 'Mossberg M500 (12-gauge pump)', '6D', 5, [20, 40, 60], 'M', 'E'),
  f('remington-30-shotgun', 'Двустволка Remington 30 (12 калибр)', 'Remington 30 (12-gauge side by side)', '6D', 2, [20, 40, 60], 'E', 'VE'),
  f('sawed-off', 'Обрез (12 калибр)', 'Sawed-off (12-gauge)', '6D', 2, [15, 20, 30], 'E', 'VE'),
  f('ak-47', 'Автомат Калашникова АК-47 (7,62×39)', 'Kalashnikov AK-47 (7.62x39mm)', '6D', 30, [45, 85, 170], 'D', 'E', { single: true }),
  f('bergmann-mp18', 'Пистолет-пулемёт Bergmann MP18 (9 мм)', 'Bergmann MP18 (9mm)', '3D+2', 12, [15, 30, 60], 'E', 'VE'),
  f('schmeisser-mp40', 'Пистолет-пулемёт Schmeisser MP38/40 (9 мм)', 'Schmeisser MP38/40 (9mm)', '3D+2', 32, [30, 60, 90], 'E', 'VE'),
  f('tec-9', 'Автоматический пистолет TEC-9 (9 мм)', 'TEC-9 machine pistol (9mm)', '3D+2', 30, [15, 30, 45], 'M', 'E'),
  f('thompson', 'Пистолет-пулемёт Thompson M1928/M1 (.45 ACP)', 'Thompson M1928/M1 (.45ACP)', '4D+2', '30/100-drum', [25, 50, 75], 'E', 'VE'),
  f('uzi', 'Пистолет-пулемёт Uzi (9 мм)', 'Israeli Uzi (9mm)', '3D+2', 30, [20, 40, 60], 'M', 'E'),
  f('mg42', 'Пулемёт MG42 «Шпандау» (7,92×57)', 'MG42 “Spandau” (7.92x57mm)', '8D+2', 500, [300, 600, '1.2K'], 'M', 'VE'),
  f('vickers-mk1', 'Пулемёт Vickers Mk.1 (.303)', 'Vickers MK.1 (.303)', '7D+1', 250, [150, 300, 900], 'M', 'VE'),
  f('laser-pistol', 'Лазерный пистолет', 'Laser pistol', '4D', 15, [25, 75, 150], 'L', 'VD', { cls: 'energy' }),
  f('laser-rifle', 'Лазерная винтовка', 'Laser rifle', '4D+2', 20, [30, 250, 1000], 'L', 'VD', { cls: 'energy' }),
  f('blaster-pistol', 'Бластер-пистолет', 'Blaster pistol', '4D+1', 12, [20, 50, 150], 'L', 'VD', { cls: 'energy' }),
  f('blaster-rifle', 'Бластер-винтовка', 'Blaster rifle', '7D', 30, [25, 150, 300], 'L', 'VD', { cls: 'energy' }),
];

// Взрывчатка (adventure p.118). Радиусы поражения, м: зона 1 (полный урон) / зона 2 (половина) / зона 3 (четверть).
const EXPLOSIVES: CatalogEntry[] = [
  weapon('mortar-81mm', 'Миномёт 81 мм', '81mm mortar', 'explosive', '5D', 'M', undefined, { range: [400, 750, '1k'], extra: { burst: [[0, 3], [3, 8], [8, 16]] } }),
  weapon('dynamite', 'Динамит (шашка)', 'Dynamite (per stick)', 'explosive', '5D', 'VE', undefined, { range: ['PHYS-3', 'PHYS-2', 'PHYS+1'], extra: { burst: [[0, 2], [2, 5], [5, 10]] } }),
  weapon('fragmentation-grenade', 'Осколочная граната', 'Fragmentation grenade', 'explosive', '6D', 'E', undefined, { range: ['PHYS-4', 'PHYS-3', 'PHYS+3'], extra: { burst: [[0, 3], [3, 8], [8, 16]] } }),
  weapon('plastic-explosive', 'Пластичная взрывчатка', 'Plastic explosive', 'explosive', '5D', 'E', undefined, { range: [1, '—', '—'], extra: { burst: [[0, 3]] } }),
  weapon('smoke-grenade', 'Дымовая или слезоточивая граната', 'Smoke grenade, tear gas', 'explosive', null, 'E', undefined, { range: ['PHYS-4', 'PHYS-3', 'PHYS+3'], note: ['облако 9,5 м²; −1D к рефлексам, координации и зрительному восприятию внутри', '9.5 m² cloud; -1D to Reflexes, Coordination and sight-based Perception inside'] }),
];

// Оружие ближнего боя (adventure p.119). Урон с «+» складывается с Силой удара. «*» — длиннее 60 см (громоздкое).
const m = (id: string, ru: string, en: string, damage: string, level: string, unwieldy = false) => weapon(id, ru, en, 'melee', damage, level, undefined, { unwieldy });

const MELEE: CatalogEntry[] = [
  m('awl-ice-pick', 'Шило, ледоруб, ножницы, карманный нож, отвёртка, кол', 'Awl, ice pick, household scissors, pocket knife, screwdriver, stake', '+2', 'VE'),
  m('arrow-bolt-dart', 'Стрела, арбалетный болт, дротик (в руке)', 'Arrow, crossbow bolt, dart', '+1', 'VE'),
  m('large-axe', 'Большой топор', 'Axe (large)', '+3D', 'E', true),
  m('ball-and-chain', 'Кистень', 'Ball and chain', '+2D', 'E', true),
  m('baton', 'Дубинка, полицейская палка, кочерга', 'Baton, night stick, fire iron', '+1D+1', 'VE–E'),
  m('blackjack', 'Кастет-дубинка', 'Blackjack', '+2', 'VE'),
  m('brass-knuckles', 'Кастет', 'Brass knuckles', '+1D+1', 'VE'),
  m('bullwhip', 'Бычий кнут', 'Bullwhip', '+1D', 'E', true),
  m('club', 'Дубина, бейсбольная бита, палка', 'Club, baseball bat, large stick, walking stick', '+1D+1', 'VE', true),
  m('hatchet', 'Топорик', 'Hatchet', '+1D+1', 'VE'),
  m('hedge-clippers', 'Секатор, садовые ножницы', 'Hedge clippers, garden shears', '+1D', 'VE'),
  m('katana', 'Катана', 'Katana', '+3D', 'M', true),
  m('knife', 'Нож (выживальщика, кухонный), кинжал, штык', 'Knife (survival, large kitchen), dagger, bayonet', '+1D', 'VE–E'),
  m('mace', 'Булава', 'Mace', '+1D+1', 'E', true),
  m('machete', 'Мачете', 'Machete', '+1D+2', 'E', true),
  m('manrikigusari', 'Манрикигусари', 'Manrikigusari', '+1D+2', 'E', true),
  m('nunchaku', 'Нунчаки', 'Nunchaku', '+1D+2', 'VE', true),
  m('quarterstaff', 'Боевой шест', 'Quarterstaff', '+1D+2', 'E', true),
  m('rapier', 'Рапира', 'Rapier', '+2D', 'E', true),
  m('sai', 'Сай', 'Sai', '+1D+1', 'E', true),
  m('sap-hammer', 'Свинчатка, молоток', 'Sap, hammer (tool)', '+1D', 'VE'),
  m('broad-sword', 'Меч широкий', 'Sword, broad', '+2D+2', 'E', true),
  m('short-sword', 'Меч короткий', 'Sword, short', '+1D+2', 'E'),
  m('two-handed-sword', 'Меч двуручный', 'Sword, two-handed', '+3D+1', 'E', true),
  m('tonfa', 'Тонфа', 'Tonfa', '+1D+2', 'E'),
];

// Метательное и стрелковое на мускульной силе (adventure p.119). Цена стрел/болтов/дротиков отдельно.
const t = (id: string, ru: string, en: string, cls: 'missile' | 'thrown', damage: string, r: [number | string, number | string, number | string], level: string, note?: [string, string]) =>
  weapon(id, ru, en, cls, damage, level, undefined, { range: r, ...(note ? { note } : {}) });

const MISSILE: CatalogEntry[] = [
  t('blowgun', 'Духовая трубка с дротиком', 'Blowgun and dart', 'missile', '1D', [10, 40, 100], 'VE', ['обычно с ядом; урон яда добавляется', 'usually poisoned; poison damage is added']),
  t('composite-bow', 'Составной лук со стрелой', 'Composite bow and arrow', 'missile', '+3D+1', [10, 60, 250], 'M'),
  t('long-bow', 'Длинный лук со стрелой', 'Long bow and arrow', 'missile', '+2D+2', [10, 100, 250], 'M'),
  t('short-bow', 'Короткий лук со стрелой', 'Short bow and arrow', 'missile', '+1D+2', [10, 100, 250], 'M'),
  t('light-crossbow', 'Лёгкий арбалет с болтом', 'Light crossbow and bolt', 'missile', '4D', [10, 100, 200], 'M'),
  t('heavy-crossbow', 'Тяжёлый арбалет с болтом', 'Heavy crossbow and bolt', 'missile', '4D+1', [10, 100, 300], 'M', ['перезарядка занимает целый раунд', 'requires one full round to reload']),
  t('wrist-crossbow', 'Наручный арбалет с дротиком', 'Wrist-mounted crossbow and dart', 'missile', '4D', [10, 25, 50], 'M'),
  t('heavy-boomerang', 'Тяжёлый бумеранг', 'Boomerang, heavy', 'thrown', '+1D+1', [5, 40, 100], 'E'),
  t('dart', 'Дротик', 'Dart', 'thrown', '+1', ['PHYS', 'PHYS+1', 'PHYS+2'], 'VE'),
  t('gasoline-bomb', 'Бутылка с горючей смесью', 'Gasoline bomb', 'thrown', '6D+2', ['PHYS-3', 'PHYS-2', 'PHYS-1'], 'VE'),
  t('javelin', 'Метательное копьё', 'Javelin', 'thrown', '+2D', [5, 25, 40], 'E'),
  t('rock', 'Камень с кулак', 'Rock, fist-sized', 'thrown', '+1', ['PHYS-2', 'PHYS-1', 'PHYS'], '—'),
  t('throwing-dagger', 'Метательный кинжал', 'Throwing dagger', 'thrown', '+1D', [5, 10, 15], 'E'),
  t('throwing-star', 'Метательная звезда (сюрикен)', 'Throwing star (shuriken)', 'thrown', '+1D', [5, 10, 15], 'VE'),
];

// Транспорт (adventure p.120). Move: метров за раунд (км/ч). Бросок, если «Physique or lifting roll».
const v = (id: string, ru: string, en: string, move: string, passengers: string, toughness: string, maneuver: string, level: string, note?: [string, string]) =>
  vehicle(id, ru, en, { move, passengers, toughness, maneuverability: maneuver }, level, undefined, note);

const VEHICLES: CatalogEntry[] = [
  v('bicycle', 'Велосипед', 'Bicycle', 'Move + Physique/lifting roll', '1–2', '2D', '+2D+2', 'E–M'),
  v('wagon', 'Повозка, почтовая карета', 'Wagon, stage coach', 'animal Move ×50%', '5–8', '4D+1', '0', 'D', ['управлять — навыком обращения с животными', 'use animal handling to maneuver']),
  v('motorcycle-small', 'Мотоцикл малый', 'Motorcycle, small street', '84 (60 km/h)', '1–2', '3D+2', '+3D', 'D'),
  v('motorcycle-large', 'Мотоцикл большой', 'Motorcycle, large', '98 (70 km/h)', '1–2', '4D', '+2D', 'D'),
  v('car-small', 'Малолитражка', 'Car, small', '49 (35 km/h)', '3–4', '4D+1', '+2D', 'D'),
  v('car-mid', 'Легковой автомобиль среднего класса', 'Car, mid-size', '70 (50 km/h)', '5–6', '4D+2', '+1D+1', 'VD'),
  v('car-large', 'Большой автомобиль', 'Car, large', '70 (50 km/h)', '6–8', '5D', '+1D', 'VD'),
  v('car-sports', 'Спортивный автомобиль', 'Car, sports', '107 (75 km/h)', '2–4', '4D+1', '+3D', 'VD'),
  v('minivan', 'Минивэн', 'Minivan', '63 (45 km/h)', '7', '5D+1', '+1D', 'H', ['недоступен до 1950-х', 'not available prior to the 1950s']),
  v('van', 'Фургон с сиденьями', 'Van, full-size (with seats)', '63 (45 km/h)', '15', '5D+2', '0', 'H', ['недоступен до 1950-х', 'not available prior to the 1950s']),
  v('truck-pickup', 'Пикап', 'Truck, pickup', '63 (45 km/h)', '3 (cab)', '5D+2', '0', 'H'),
  v('truck-delivery', 'Грузовик развозной', 'Truck, delivery', '63 (45 km/h)', '2–3 (cab)', '6D', '-1D', 'H'),
  v('bus-city', 'Автобус городской', 'Bus, in-city', '49 (35 km/h)', '81', '5D+2', '-4D', 'L'),
  v('bus-intercity', 'Автобус междугородний', 'Bus, between city', '49 (35 km/h)', '43', '5D+2', '-4D', 'L'),
  v('tractor-trailer', 'Седельный тягач с прицепом', 'Tractor trailer cab and trailer', '49 (35 km/h)', '2 (cab)', '6D+2', '-6D', 'L', ['недоступен до 1950-х', 'not available prior to the 1950s']),
  v('canoe', 'Каноэ', 'Canoe', 'Physique/lifting roll', '4', '2D', '+1D', 'E–M'),
  v('rowboat', 'Гребная лодка', 'Rowboat', 'Physique/lifting roll', '6', '3D+2', '0', 'E'),
  v('sailboat-small', 'Парусная лодка малая', 'Sailboat, small', 'Wind + 25% piloting total', '2', '4D', '+2D', 'D'),
  v('sailboat-large', 'Парусная лодка большая', 'Sailboat, large', 'Wind + 50% piloting total', '6–18 (2 crew)', '6D', '+1D', 'VD'),
  v('powerboat', 'Моторная лодка средняя', 'Powerboat, medium', '42 (30 km/h)', '9', '4D+2', '+1D', 'H', ['недоступна до 1950-х', 'not available prior to the 1950s']),
  v('helicopter', 'Гражданский вертолёт', 'Helicopter, civilian', '126 (90 km/h)', '5', '6D+1', '+3D', 'L', ['недоступен до 1950-х', 'not available prior to the 1950s']),
  v('prop-plane-small', 'Малый винтовой самолёт', 'Prop plane, small', '98 (70 km/h)', '4–8 (1–2 crew)', '5D', '+1D', 'L'),
  v('prop-plane-medium', 'Средний винтовой самолёт', 'Prop plane, medium', '133 (95 km/h)', '6–20 (2 crew)', '6D+1', '0', 'L'),
  v('small-jet', 'Малый реактивный самолёт', 'Small jet', '308 (220 km/h)', '8–20 (2 crew)', '6D+1', '0', 'L', ['недоступен до 1950-х', 'not available prior to the 1950s']),
];

export const ADVENTURE_CATALOG: readonly CatalogEntry[] = [...GEAR, ...ARMOR, ...FIREARMS, ...EXPLOSIVES, ...MELEE, ...MISSILE, ...VEHICLES];
