// Снаряжение D6 Fantasy. Источники: OpenD6: fantasy p.115–120 (Adventuring Gear, Fashion, Food and Drink, Armor, Shields, Weapons, Vehicles).
// Цена: сложность покупки и в скобках монеты (C — медь, S — серебро, G — золото; 8 C = 1 S, 8 S = 1 G). «SP» в книге — опечатка серебра.
import { armor, gear, vehicle, weapon, type CatalogEntry } from './types';

const bonus = (skill: string, code: string) => ({ bonus: { skill, code } });

const GEAR: CatalogEntry[] = [
  gear('basket', 'Корзина плетёная', 'Basket, woven', 'VE', '8 C'),
  gear('bell', 'Колокольчик металлический', 'Bell, small metal', 'E', '2 G'),
  gear('bedroll', 'Скатка для сна', 'Bedroll', 'E', '3 SP'),
  gear('blanket', 'Одеяло фланелевое', 'Blanket, flannel single', 'E', '2 SP'),
  gear('soup-bowl', 'Миска деревянная', 'Bowl, wooden soup', 'VE', '6 C'),
  gear('brazier', 'Жаровня бронзовая переносная', 'Brazier, portable bronze', 'M', '5 G'),
  gear('bucket', 'Ведро деревянное', 'Bucket, wooden', 'E', '4 SP'),
  gear('candle', 'Свеча сальная; факел', 'Candle, tallow taper; torch', 'VE', '1 C', { note: ['лампа или свеча: 1D в раунд по горючему; гасит до 2D темноты; факел: 3D в раунд, гасит до 4D', 'candle or lamp: 1D per round on flammable surface, negates up to 2D of darkness; torch: 3D per round, up to 4D'] }),
  gear('small-chest', 'Сундучок деревянный', 'Chest, small wooden', 'M', '3 G'),
  gear('flannel-cloth', 'Ткань фланелевая, около 1 м²', 'Cloth, flannel, about 1 square meter', 'VE', '8 C'),
  gear('compass', 'Компас', 'Compass', 'D', '30 G'),
  gear('handheld-drum', 'Барабан ручной', 'Drum, handheld', 'M', '15 S'),
  gear('fishing-hook-line', 'Рыболовный крючок с леской', 'Fishing hook and line', 'VE', '5 C'),
  gear('flute', 'Флейта', 'Flute', 'E', '2 G'),
  gear('grappling-hook', 'Абордажный крюк', 'Grappling hook', 'E', '8 S', { data: bonus('climbing', '1D'), note: ['+1D к лазанию (с верёвкой); Сила удара +1', '+1D to climbing (with a rope); Strength Damage +1'] }),
  gear('hammer', 'Молоток', 'Hammer', 'E', '3 S', { note: ['помогает в ремесле; Сила удара +1', 'helps some crafting; Strength Damage +1'] }),
  gear('healers-pack', 'Сумка целителя', 'Healer’s pack', 'VE', '16 C', { data: bonus('healing', '1'), note: ['+1 к врачеванию на 3–6 применений', '+1 to healing for 3 to 6 attempts'] }),
  gear('holy-symbol', 'Священный символ серебряный, неблагословлённый', 'Holy symbol, silver unblessed', 'M', '10 G'),
  gear('ink-vial', 'Чернила в стеклянном флаконе', 'Ink in small glass vial', 'M', '3 G'),
  gear('incense', 'Благовония (2 длинные палочки)', 'Incense (2 long sticks)', 'E', '8 S'),
  gear('pottery-lamp', 'Лампа гончарная', 'Lamp, pottery', 'VE', '8 C'),
  gear('lamp-oil', 'Масло для ламп, средняя фляга', 'Lamp oil, medium flask', 'VE', '5 C'),
  gear('lockpicking-tools', 'Отмычки', 'Lockpicking tools', 'VD', '27 G', { data: bonus('lockpicking', '1D'), note: ['+1D ко взлому замков (нужен навык)', '+1D to lockpicking (needs the skill)'] }),
  gear('lute', 'Лютня', 'Lute', 'M', '4 G'),
  gear('marbles', 'Шарики глиняные', 'Marbles, hard clay', 'VE', '8 C', { note: ['наступивший делает проверку ловкости или акробатики на 10 за шаг', 'stepping on them: Moderate Agility or acrobatics roll per step'] }),
  gear('makeup-kit', 'Набор для грима (5 применений)', 'Makeup kit (5 uses)', 'E', '8 S', { data: bonus('disguise', '1D'), note: ['+1D к переодеванию', 'adds 1D to disguise attempts'] }),
  gear('silver-mirror', 'Зеркало серебряное', 'Mirror, silver', 'M', '5 G'),
  gear('steel-mirror', 'Зеркало из полированной стали или бронзы', 'Mirror, polished steel or bronze', 'M', '3 G'),
  gear('parchment', 'Пергамент, рисовая бумага или веллум', 'Parchment, rice paper, or vellum', 'E', '8 S'),
  gear('mining-pick', 'Кирка горная', 'Pick, mining', 'E', '16 S', { note: ['+1D к копанию; Сила удара +2', '+1D to digging; Strength Damage +2'] }),
  gear('perfumed-water', 'Душистая вода в стеклянном флаконе', 'Perfumed water in small glass vial', 'E', '10 S'),
  gear('large-pouch', 'Кошель большой кожаный', 'Pouch, large leather', 'E', '4 S'),
  gear('small-pouch', 'Кошель малый фланелевый', 'Pouch, small flannel', 'VE', '6 C'),
  gear('cooking-pot', 'Котелок железный', 'Pot, iron cooking', 'E', '16 S'),
  gear('quill', 'Перо', 'Quill', 'VE', '16 C'),
  gear('quiver', 'Колчан', 'Quiver', 'E', '8 S'),
  gear('inn-room', 'Комната на постоялом дворе (в сутки на человека)', 'Room in an inn (average per day per person)', 'M', '1 S'),
  gear('inn-bed', 'Койка в общей комнате', 'Room in an inn (common room bed)', 'VE', '1 C'),
  gear('rope-hemp', 'Верёвка пеньковая тяжёлая, 15 м', 'Rope, heavy (hemp, 15 meters)', 'E', '4 S', { note: ['удушение: Сила удара +2; сопротивление 5; выдерживает 100 кг', 'choking: Strength Damage +2; resistance 5; holds 100 kg'] }),
  gear('rope-silk', 'Верёвка шёлковая лёгкая, 15 м', 'Rope, light (silk, 15 meters)', 'M', '15 G', { note: ['удушение: Сила удара +1; сопротивление 3; выдерживает 140 кг', 'choking: Strength Damage +1; resistance 3; holds 140 kg'] }),
  gear('sack', 'Мешок из грубой ткани', 'Sack, rough cloth', 'VE', '6 C'),
  gear('scabbard', 'Ножны', 'Scabbard', 'E', '8 S'),
  gear('sealing-wax', 'Сургуч', 'Sealing wax', 'VE', '16 C'),
  gear('shovel', 'Лопата', 'Shovel', 'E', '8 S', { note: ['+1D к копанию; в ударе Сила удара +2', '+1D to digging; Strength Damage +2 when bashing'] }),
  gear('cutlery', 'Ложка или вилка латунная (за штуку)', 'Spoon or fork, brass dinner (each)', 'VE', '3 C'),
  gear('iron-spikes', 'Железные костыли', 'Spikes, iron', 'E', '6 S', { data: bonus('climbing', '1D'), note: ['+1D к лазанию при нескольких шипах; Сила удара +1', '+1D to climbing when several are used; Strength Damage +1'] }),
  gear('tent-2', 'Палатка на двоих', 'Tent, two-person', 'M', '7 G'),
  gear('tinderbox', 'Огниво с кремнём и кресалом', 'Tinder box with flint and steel', 'VE', '8 C'),
  gear('ceramic-vial', 'Пузырёк с пробкой керамический', 'Vial with stopper, ceramic', 'VE', '2 C'),
  gear('glass-vial', 'Пузырёк с пробкой стеклянный', 'Vial with stopper, glass', 'VE', '7 C'),
  gear('waterskin', 'Бурдюк для воды', 'Waterskin', 'E', '7 S'),
  gear('whetstone', 'Точильный камень', 'Whetstone', 'VE', '1 C'),
];

const FASHION: CatalogEntry[] = [
  gear('belt', 'Пояс', 'Belt', 'VE', '6 C', { kind: 'clothing' }),
  gear('boots', 'Сапоги', 'Boots', 'E', '16 S', { kind: 'clothing' }),
  gear('flannel-cloak', 'Плащ фланелевый', 'Cloak, flannel', 'E', '7 S', { kind: 'clothing' }),
  gear('dress', 'Платье', 'Dress', 'E', '5 S', { kind: 'clothing' }),
  gear('hat', 'Шляпа', 'Hat', 'E', '3 S', { kind: 'clothing' }),
  gear('jerkin', 'Камзол', 'Jerkin', 'E', '5 S', { kind: 'clothing' }),
  gear('robe', 'Мантия', 'Robe', 'E', '8 S', { kind: 'clothing' }),
  gear('sandals', 'Сандалии', 'Sandals', 'VE', '7 C', { kind: 'clothing' }),
  gear('shoes', 'Башмаки', 'Shoes', 'VE', '16 C', { kind: 'clothing' }),
  gear('skirt', 'Юбка', 'Skirt', 'E', '3 S', { kind: 'clothing' }),
  gear('tunic', 'Туника', 'Tunic', 'E', '5 S', { kind: 'clothing' }),
];

const food = (id: string, ru: string, en: string, level: string, coins: string) => gear(id, ru, en, level, coins, { kind: 'food' });

const FOOD: CatalogEntry[] = [
  food('ale', 'Эль (кружка)', 'Ale (mug)', 'VE', '2 C'),
  food('bread', 'Хлеб (буханка)', 'Bread (loaf)', 'VE', '2 C'),
  food('butter', 'Масло сливочное (горшочек)', 'Butter (small crock)', 'VE', '5 C'),
  food('cheese', 'Сыр (круг)', 'Cheese (wheel)', 'VE', '7 C'),
  food('cookies', 'Печенье сладкое (несколько штук)', 'Cookies, sweet (a few)', 'VE', '4 C'),
  food('eggs', 'Яйца (несколько)', 'Eggs (a few)', 'VE', '1 C'),
  food('animal-feed', 'Корм для животных', 'Feed (for animals)', 'VE', '5 C'),
  food('fruit', 'Фрукты свежие или сушёные (штука или горсть)', 'Fruit, fresh or dried (each or handful)', 'VE', '2 C'),
  food('flour', 'Зерно, мука (несколько килограммов)', 'Grains, flour (a few kilograms)', 'E', '8 S'),
  food('gruel', 'Каша (миска)', 'Gruel (bowl)', 'VE', '1 C'),
  food('herbs', 'Травы свежие или сушёные (пучок)', 'Herbs, fresh or dried (bunch)', 'VE', '3 C'),
  food('jam', 'Варенье, желе, соленья (горшочек)', 'Jam, jelly, preserves (small crock)', 'VE', '5 C'),
  food('fresh-meat', 'Мясо свежее: свинина, баранина, говядина, птица, рыба (несколько килограммов)', 'Meat, fresh local pork, mutton, beef, fowl, or fish (a few kilograms)', 'VE', '16 C'),
  food('smoked-meat', 'Мясо копчёное (несколько килограммов)', 'Meat, smoked (a few kilograms)', 'E', '16 S'),
  food('milk', 'Молоко (несколько литров)', 'Milk (a few liters)', 'VE', '8 C'),
  food('nuts', 'Орехи (горсть)', 'Nuts (handful)', 'VE', '8 C'),
  food('pastry', 'Выпечка (штука)', 'Pastry (each)', 'VE', '8 C'),
  food('rations', 'Паёк (на день)', 'Rations (day)', 'VE', '8 C'),
  food('spices', 'Редкие пряности (маленький мешочек)', 'Spices, rare (small pouch)', 'E', '8 S'),
  food('stew', 'Рагу (миска)', 'Stew (bowl)', 'VE', '5 C'),
  food('vegetables', 'Овощи (несколько)', 'Vegetable (a few)', 'VE', '2 C'),
  food('water', 'Вода (стакан)', 'Water (glass)', 'VE', '1 C'),
  food('wine', 'Вино (бокал)', 'Wine (glass)', 'VE', '8 C'),
];

// Доспехи и щиты (fantasy p.116). Щит защищает, только если удерживается между атакующим и владельцем.
const ARMOR: CatalogEntry[] = [
  armor('hides-and-fur', 'Шкуры и меха, меховой плащ', 'Hides and fur, fur cloak', '2', 'M', '5 G'),
  armor('soft-leather', 'Мягкая кожа, плотная ткань', 'Soft leather, heavy fabric', '2', 'M', '3 G'),
  armor('quilted-silk', 'Стёганый шёлк', 'Quilted silk', '2', 'M', '4 G'),
  armor('bone-and-hide', 'Кость и шкура', 'Bone and hide', '1D', 'M', '7 G'),
  armor('padded-leather', 'Стёганая кожа', 'Padded leather', '1D', 'M', '8 G'),
  armor('hard-leather', 'Твёрдая кожа', 'Hard leather', '1D+1', 'M', '9 G'),
  armor('ring-mail', 'Колечная броня', 'Ring mail', '1D+2', 'M', '11 G'),
  armor('chain-mail', 'Кольчуга', 'Chain mail', '2D', 'M', '15 G'),
  armor('bronze', 'Бронзовый доспех', 'Bronze', '2D', 'M', '16 G'),
  armor('plate-mail', 'Латы', 'Plate mail', '3D', 'D', '40 G'),
  armor('buckler', 'Баклер (0,5 м)', 'Buckler (0.5 meters long)', '2', 'E', '7 S', { shield: true }),
  armor('small-shield', 'Малый щит (1 м)', 'Small shield (1 meter long)', '2D', 'E', '16 S', { shield: true }),
  armor('medium-shield', 'Средний щит (1,5 м)', 'Medium shield (1.5 meters long)', '2D+1', 'M', '3 G', { shield: true }),
  armor('large-shield', 'Большой щит (2 м)', 'Large shield (2 meters long)', '2D+2', 'M', '4 G', { shield: true }),
];

// Оружие ближнего боя (fantasy p.118). «*» — длиннее 60 см (громоздкое). Урон с «+» складывается с Силой удара.
const m = (id: string, ru: string, en: string, damage: string, level: string, coins: string, unwieldy = false) => weapon(id, ru, en, 'melee', damage, level, coins, { unwieldy });

const MELEE: CatalogEntry[] = [
  m('awl', 'Шило, малый нож, кол', 'Awl, small knife, stake', '+2', 'VE', '8 C'),
  m('arrow-bolt-dart', 'Стрела, арбалетный болт, дротик (в руке)', 'Arrow, crossbow bolt, dart', '+1', 'VE', '7 C'),
  m('battle-axe', 'Боевой топор', 'Axe, battle', '+3D', 'M', '3 G', true),
  m('ball-and-chain', 'Кистень', 'Ball and chain', '+2D', 'E', '16 S', true),
  m('bullwhip', 'Бычий кнут', 'Bullwhip', '+1D', 'E', '4 S', true),
  m('club', 'Дубина (гладкая), большая палка', 'Club (nonspiked), large stick', '+1D+1', 'E', '4 S', true),
  m('spiked-club', 'Дубина шипованная', 'Club (spiked)', '+1D+2', 'E', '16 S', true),
  m('hatchet', 'Топорик', 'Hatchet', '+1D+1', 'E', '15 S'),
  m('halberd', 'Алебарда', 'Halberd', '+3D', 'M', '4 G', true),
  m('katana', 'Катана', 'Katana', '+3D', 'M', '5 G', true),
  m('dagger', 'Нож (большой кухонный), кинжал, стилет', 'Knife (large kitchen), dagger, stiletto', '+1D', 'VE', '4–12 S'),
  m('mace', 'Булава', 'Mace', '+1D+1', 'E', '18 S', true),
  m('morning-star', 'Моргенштерн', 'Morning star', '+3D', 'M', '4 G'),
  m('nunchaku', 'Нунчаки', 'Nunchaku', '+1D+2', 'E', '17 S', true),
  m('quarterstaff', 'Боевой шест', 'Quarterstaff', '+1D+2', 'VE', '12 C', true),
  m('rapier', 'Рапира', 'Rapier', '+2D', 'E', '19 S', true),
  m('sai', 'Сай', 'Sai', '+1D+1', 'E', '10 S'),
  m('sap', 'Свинчатка, молоток', 'Sap, hammer (tool)', '+1D', 'E', '3 S'),
  m('spear', 'Копьё (с металлическим наконечником)', 'Spear (metal tip)', '+2D', 'M', '3 G', true),
  m('broad-sword', 'Меч широкий или длинный', 'Sword, broad/long', '+2D+2', 'M', '3 G', true),
  m('short-sword', 'Меч короткий', 'Sword, short', '+1D+2', 'E', '15 S'),
  m('two-handed-sword', 'Меч двуручный', 'Sword, two-handed', '+3D+1', 'M', '4 G', true),
  m('tonfa', 'Тонфа', 'Tonfa', '+1D+2', 'E', '18 S'),
  m('trident', 'Трезубец', 'Trident', '+2D+2', 'M', '3 G', true),
  m('war-hammer', 'Боевой молот', 'War hammer', '+3D', 'E', '19 S', true),
];

// Метательное и стрелковое (fantasy p.117). Цена стрел, болтов и дротиков отдельно.
const t = (id: string, ru: string, en: string, cls: 'missile' | 'thrown', damage: string, r: [number | string, number | string, number | string], level: string, coins?: string, note?: [string, string]) =>
  weapon(id, ru, en, cls, damage, level, coins, { range: r, ...(note ? { note } : {}) });

const MISSILE: CatalogEntry[] = [
  t('blowgun', 'Духовая трубка с дротиком', 'Blowgun and dart', 'missile', '1D', [10, 40, 100], 'VE', '10 C', ['обычно с ядом; урон яда добавляется', 'usually poisoned; poison damage is added']),
  t('long-bow', 'Длинный лук со стрелой', 'Bow, long, and arrow', 'missile', '+2D+2', [10, 100, 250], 'M', '3 G'),
  t('short-bow', 'Короткий лук со стрелой', 'Bow, short, and arrow', 'missile', '+1D+2', [10, 100, 250], 'E', '16 S'),
  t('light-crossbow', 'Лёгкий арбалет с болтом', 'Crossbow, light, and bolt', 'missile', '4D', [10, 100, 200], 'E', '16 S'),
  t('heavy-crossbow', 'Тяжёлый арбалет с болтом', 'Crossbow, heavy, and bolt', 'missile', '4D+1', [10, 100, 300], 'M', '4 G', ['перезарядка занимает целый раунд', 'requires one full round to reload']),
  t('handheld-crossbow', 'Ручной арбалет с дротиком', 'Crossbow, handheld, and dart', 'missile', '4D', [10, 25, 50], 'M', '3 G'),
  t('sling', 'Праща с камнем', 'Sling & stone', 'missile', '+1D', [5, 10, 15], 'E', '3 S'),
  t('boomerang', 'Тяжёлый бумеранг', 'Boomerang, heavy', 'thrown', '+1D+1', [5, 40, 100], 'M', '3 G'),
  t('dart', 'Дротик', 'Dart', 'thrown', '+1', ['PHYS', 'PHYS+1', 'PHYS+2'], 'VE', '7 C'),
  t('rock', 'Камень с кулак', 'Rock, fist-sized', 'thrown', '+1', ['PHYS-2', 'PHYS-1', 'PHYS'], '—'),
  t('javelin', 'Метательное копьё', 'Javelin', 'thrown', '+2D', [5, 25, 40], 'E', '16 S'),
  t('throwing-dagger', 'Метательный кинжал', 'Throwing dagger', 'thrown', '+1D', [5, 10, 15], 'E', '5 S'),
  t('throwing-star', 'Метательная звезда', 'Throwing star', 'thrown', '+1D', [5, 10, 15], 'VE', '7 C'),
];

// Пороховое оружие (fantasy p.117). Заряд, пыж и пуля — VE (2 S) за пакет.
const GUNPOWDER: CatalogEntry[] = [
  weapon('arquebus', 'Аркебуза', 'Arquebus', 'firearm', '3D+2', 'D', '10 G', { range: [10, 20, 40], note: ['фитильная; нужна опора; заряд, пыж и пуля — VE (2 S) за пакет', 'matchlock; needs a rest; charge, wadding and shot VE (2 S) per packet'] }),
  weapon('wheellock-musket', 'Колесцовый мушкет', 'Wheellock musket', 'firearm', '4D', 'D', '12 G', { range: [10, 20, 60], note: ['нужна опора; перезарядка — 12 раундов или стрельба на 10', 'needs a rest; reload takes 12 rounds or a marksmanship roll of 10'] }),
  weapon('wheellock-pistol', 'Колесцовый пистолет', 'Wheellock pistol', 'firearm', '3D+1', 'D', '8 G', { range: [5, 10, 25], note: ['перезарядка — 12 раундов или стрельба на 10', 'reload takes 12 rounds or a marksmanship roll of 10'] }),
  weapon('black-powder-bomb', 'Пороховая бомба', 'Black powder bomb', 'explosive', '6D', 'M', undefined, { range: ['PHYS-2', 'PHYS-1', 'PHYS'] }),
];

// Транспорт (fantasy p.119). Масштаб (scale value) — размер относительно человека.
const v = (id: string, ru: string, en: string, scale: number, move: string, passengers: string, toughness: string, maneuver: string, level: string, coins: string) =>
  vehicle(id, ru, en, { move, passengers, toughness, maneuverability: maneuver, scale }, level, coins);

const VEHICLES: CatalogEntry[] = [
  v('chariot', 'Колесница, двухместная повозка', 'Chariot, two-person carriage', 3, 'animal Move ×75%', '2', '4D', '-2', 'D', '30 G'),
  v('wagon', 'Телега большая открытая', 'Wagon (large, open)', 5, 'animal Move ×50%', '8', '4D+1', '0', 'M', '9 G'),
  v('carriage', 'Пассажирская карета', 'Passenger carriage', 6, 'animal Move ×50%', '5', '4D+1', '-1D', 'VD', '75 G'),
  v('mine-cart', 'Шахтная вагонетка', 'Mine cart', 3, 'animal Move ×25%', '2', '5D+1', '-3D', 'M', '7 G'),
  v('canoe', 'Каноэ (вёсла)', 'Canoe (paddles)', 0, 'Physique/lifting roll', '4', '2D', '+1D', 'E', '17 S'),
  v('galleon', 'Галеон (паруса)', 'Galleon (sails)', 14, '7 (5 km/h)', '220 (120 crew)', '7D+2', '-2D', 'L', '95000 G'),
  v('merchant-galley', 'Галера торговая (паруса и вёсла)', 'Galley, merchant (sails and oars)', 15, '10 (7 km/h)', '50 (43 crew)', '5D+2', '+2', 'L', '110000 G'),
  v('small-galley', 'Галера малая (паруса и вёсла)', 'Galley, small (sails and oars)', 14, '12 (9 km/h)', '43 (40 crew)', '4D+2', '+1D+2', 'L', '100000 G'),
  v('war-galley', 'Галера боевая (паруса и вёсла)', 'Galley, war (sails and oars)', 21, '12 (9 km/h)', '540 (420 crew)', '7D+1', '-2D', 'L', '200000 G'),
  v('longship', 'Драккар (паруса и вёсла)', 'Longship (sails and oars)', 12, '4 (3 km/h)', '120 (30 crew)', '6D+2', '0', 'L', '38000 G'),
  v('rowboat', 'Гребная лодка (вёсла)', 'Rowboat (oars)', 2, 'Physique/lifting roll', '6', '3D+2', '0', 'E', '19 S'),
  v('small-sailboat', 'Парусная лодка малая', 'Sailboat, small (sails)', 4, 'Wind + 25% pilotry total', '2', '4D', '+2D', 'VD', '20 G'),
];

export const FANTASY_CATALOG: readonly CatalogEntry[] = [...GEAR, ...FASHION, ...FOOD, ...ARMOR, ...MELEE, ...MISSILE, ...GUNPOWDER, ...VEHICLES];
