// ============================================================
//  DATA — canon drawn from the Echoes of the Shattered Octave bible
// ============================================================
'use strict';

const DAYS = ['Nullday', 'Rootday', 'Hearthday', 'Massday', 'Stasisday', 'Dawnday', 'Driftday', 'Memoryday'];

const ATTRS = ['Strength', 'Intelligence', 'Willpower', 'Agility', 'Endurance', 'Personality', 'Speed', 'Luck'];

const CLASSES = [
  {
    id: 'blade', name: 'Dissonant Blade', hz: '174 Hz',
    desc: 'A former bore-engineer whose left arm set to Aether-Glass in the Fracture. The glass drinks what it breaks, and the tideline climbs for it. Hounds will not touch you. Neither, for long, will anyone else.',
    bio: 'The morning the Light let go, you were on the Dawning floor with a hand on the bulkhead wheel. You held it while the glass came through, and you were still holding it when your left arm set. The Synod gave you a medal you have never worn and a word, consecrated, that you have never used. The hounds treat you as one of their own; the town does not. You burn charcoal outside the Hedge and count the mornings the glass has climbed.',
    summary: 'Front-line fighter and living tuning fork. High Strength and Endurance, an innate glass arm that breaks the Cacophony, and a short song-list. Close the distance, keep the noise down, and let the tideline pay for every victory.',
    attrs: { Strength: 60, Intelligence: 55, Willpower: 50, Agility: 45, Endurance: 60, Personality: 35, Speed: 45, Luck: 40 },
    hp: 30, voice: 10, glass: true, weapons: ['sword', 'glass'], songs: ['murmur'], pellets: 4,
    skills: 'Long Blade, Glasswork, Engineering',
  },
  {
    id: 'cantor', name: 'Cantor', hz: '174 Hz',
    desc: 'You sing the births, fevers and burials of orchard country, always inside the Narrow. Your tending notes are older than the Church knows. You have never picked up a sword and you will not start now.',
    bio: 'The orchard cantors taught you to hold a note under your breath, where the hounds cannot hear it and the Silence cannot find it. You learned the old fourth line from a woman who died before the Synod took the bells, and you have sung it at every burial since, quietly, as a private heresy. You have never carried a blade. When people ask what you do, you say you keep the door open between the living and the rest.',
    summary: 'Singer, healer and crowd-quieter. High Willpower and Personality, the deepest song-list and the most Voice, but little health. Stay behind the blade, mend what is broken, and spend your voice where it changes the room.',
    attrs: { Strength: 35, Intelligence: 55, Willpower: 70, Agility: 45, Endurance: 45, Personality: 65, Speed: 45, Luck: 45 },
    hp: 20, voice: 40, glass: false, weapons: ['hands', 'pistol'], songs: ['murmur', 'tending', 'fifth', 'root'], pellets: 9,
    skills: 'Law-song, Mending, Etiquette',
  },
  {
    id: 'corsair', name: 'Corsair', hz: '639 Hz',
    desc: 'Rust Coast, by way of the air. You count, you judge rope and angles, and you carry glass shot that costs a sovereign a pellet. You laugh loudest when you are most afraid.',
    bio: 'You have signed on with seven crews and left six of them in ports you cannot pronounce. You count because counting is the only prayer that has ever answered you: casks, cartridges, shares, the seconds between a rope parting and a man noticing. The glass shot in your pouch is worth more than the clothes you stand in. You have never once let a stranger see you afraid, and that is the only discipline you keep.',
    summary: 'Skirmisher and gunhand. High Agility and Speed, a short sword and a pistol, and the largest pouch of glass shot of any calling. Hit first, move often, and never let anything corner you in a corridor.',
    attrs: { Strength: 50, Intelligence: 45, Willpower: 40, Agility: 65, Endurance: 50, Personality: 55, Speed: 60, Luck: 55 },
    hp: 25, voice: 12, glass: false, weapons: ['sword', 'pistol'], songs: ['murmur'], pellets: 12,
    skills: 'Short Blade, Firearms, Streetwise',
  },
  {
    id: 'archivist', name: 'Archivist of the Veil', hz: '741 Hz',
    desc: 'A conscripted scribe of the Office of the Catalogue who walked into the mist with a Ledger. You know what the glass cores are. You can read a Legionnaire\'s name off its bell. Every name you keep costs you a little of yourself.',
    bio: 'The Office took you young, gave you a clean coat and a desk with a lock, and taught you to copy a name without reading it. You read them anyway. The first was a woman of sixty-one, entered as a unit, whose hand you recognised from a letter in your mother\'s kitchen. You have been keeping a second Ledger ever since, in a hand the Office cannot read, and every entry costs you a piece of the name you were born with.',
    summary: 'Lore-keeper and debuffer. The highest Intelligence, three glass fragments at the start, and songs that name what is hunting you. Fragile in a stand-up fight, invaluable before one: read the room before it reads you.',
    attrs: { Strength: 35, Intelligence: 75, Willpower: 60, Agility: 45, Endurance: 40, Personality: 50, Speed: 45, Luck: 50 },
    hp: 18, voice: 30, glass: false, weapons: ['hands', 'pistol'], songs: ['murmur', 'tending', 'name'], pellets: 7,
    skills: 'Ledger-craft, Lore, Resonance',
  },
  {
    id: 'penitent', name: 'Flambeau Penitent', hz: '285 Hz',
    desc: 'You carried a censer for the Church until the day the light turned. You still half-believe you were right. Your faith is fire, and both are guttering.',
    bio: 'You were the one who carried the fire, not the one who decided where it went. That was the comfort, and you took it for eleven years. Then a Rite went wrong in a way the Church still denies, and you stood in the ash with a child\'s shoe in your hand and the Pure Note still ringing in your teeth. You keep the ash in a jar. You have not decided whether it is a relic or a confession, and you suspect it is both.',
    summary: 'Armoured zealot and glass-fire caster. Strong Willpower and Endurance, a bell-bronze mace that rings against the Cacophony, and Doctrine to hold a party together. Slow and loud, but hard to put down.',
    attrs: { Strength: 55, Intelligence: 50, Willpower: 65, Agility: 40, Endurance: 55, Personality: 45, Speed: 40, Luck: 35 },
    hp: 26, voice: 25, glass: false, weapons: ['sword', 'hands'], songs: ['murmur', 'fifth'], pellets: 3,
    skills: 'Blunt Weapon, Doctrine, Glass-fire',
  },
  {
    id: 'quarry', name: 'Quarry-Hand', hz: '396 Hz',
    desc: 'Night shift at the Oakhaven works. You have heard the Root breathe through the pump-house floor and you have seen what the Grafters bring up in sacks. Strong back, short list of friends.',
    bio: 'The works run three shifts, and you have worked all of them. You know the sound the pump makes when the Root is awake, the smell of a gallery that is about to settle, and which of the foremen will send you down anyway. You have carried two friends up the ladder and left one below because there was no time. The foreman wrote it down as a fall. You have not written it down at all.',
    summary: 'The tank. The highest Strength and Endurance and the biggest health pool, with a sword and a head for climbing. No pistol, few pellets and almost no songs: solve it with muscle and let the singers handle the rest.',
    attrs: { Strength: 70, Intelligence: 40, Willpower: 45, Agility: 50, Endurance: 70, Personality: 40, Speed: 50, Luck: 40 },
    hp: 36, voice: 8, glass: false, weapons: ['sword'], songs: ['murmur'], pellets: 2,
    skills: 'Axe, Climbing, Endurance',
  },
];

const BIOGRAPHY = [
  {
    q: 'Where were you on the morning the Light let go?',
    a: [
      { t: 'In the Reach, hearing the oaks ring like bronze.', mod: { Willpower: 5 }, flag: 'bio_reach' },
      { t: 'At the Dawning Spire. I was one of the forty who held the note.', mod: { Personality: -5, Intelligence: 5, Willpower: 5 }, flag: 'bio_rite' },
      { t: 'Drunk, somewhere on the Rust Coast, and I have never been so lucky.', mod: { Luck: 8, Endurance: -3 }, flag: 'bio_coast' },
    ],
  },
  {
    q: 'A voice you love calls to you from beyond the Hedge, at the dead hour. You...',
    a: [
      { t: 'Say nothing. Never answer a voice you cannot see.', mod: { Willpower: 5 }, flag: 'bio_silent' },
      { t: 'Answer. Just once. Just to hear it again.', mod: { Personality: 5, Willpower: -5 }, flag: 'bio_answered' },
      { t: 'Load the pistol.', mod: { Agility: 5 }, flag: 'bio_pistol' },
    ],
  },
  {
    q: 'What did the Synod take from you?',
    a: [
      { t: 'A brother, burned by the Flambeaux for singing off-pitch.', mod: { Strength: 5 }, flag: 'bio_brother' },
      { t: 'A name. I was pressed, and given back. I remember all of it.', mod: { Intelligence: 5, Endurance: -3 }, flag: 'bio_pressed' },
      { t: 'The bells. Every bell in the Reach went for bore-teeth.', mod: { Personality: 5 }, flag: 'bio_bells' },
    ],
  },
];


// ---- faces offered at character creation ---------------------------------
// A face is a history, not a class: any calling can wear any of them.
const CREATION_FACES = [
  { n: 1, name: "Kaelen Vance",
    sketch: "The Governor's son, and Lyra Ashgrove's shadow since you were both nine. You left the Reach at seventeen to learn how to fix a note, and came home with an arm of glass and no words about it.",
    history: "You were born in the Governor's house above the square, to a father who signs the town's bread and a name that was spoken for before you could hold a pen. Lyra taught you the Root note at nine, standing on a chair with your tongue between your teeth, and you have never once held it since without hearing hers underneath. At seventeen the Conservatory of Bores took you, and the work was honest and it paid: calibration tables, bores, a wrong note made right for anybody who could sign the bill. You were the best of your year at it. Then came the morning the sky rang, and you came home up the Greenroot road with a glass arm and a habit of silence, and the town has learned not to ask what the seven years cost.",
    detail: "You live in a hut north of the North Gate, outside the Hedge, where the hounds do not come and the glass goes quiet on the hound-bed. You keep a chalk list on a beam and pay it down a name a day, and you have never explained the list to anybody. What you carry out of the gate: a caliper, a stub of chalk, and a hand you have learned to turn palm up when someone wants to look.",
    facts: [["Years", "Thirty-four"], ["Born", "The Governor's house, above the square"], ["Trade", "Calibration. Bores and tuning tables, for the Conservatory, then the Consortium."], ["Mark", "A left arm of Light-glass to the elbow, pale cyan, and a habit of turning it palm up."], ["Ties", "Lyra Ashgrove, who taught you the Root note. A father who still signs the town's bread."], ["Wants", "To know what the glass is for, and to be owed nothing by anybody."]],
    says: "I don't build things anymore. I just know how they break. What do you want broken?" },
  { n: 2, name: "Lyra Ashgrove",
    sketch: "Cantor of Oakhaven. You cut the town's reeds fresh every dusk, keep its lamps lit, and teach every child in the parish their first note — and you have never made a promise in a voice you would not use to keep it.",
    history: "Your father was Cantor before you, and he set the long cane in your hands before you could hold your head up: you blew across it until the note stopped being a noise and became a place. You tuned the First Reed over the door standing on a chair, and you have cut reeds fresh every dusk since, because a cut reed dies in a day and a day is exactly long enough for the thing you meant to say. When the stole came to you it came with the lamps, the crossings, the names of every child in the parish and the rhyme they are taught here: too loud brings the hounds, too still brings the Hush. You have kept a house on Cooper's Row with a green door, buried your father in the Cantors' ground, and learned that a town can be held together by people humming under their breath.",
    detail: "You keep the First Reed over the door, a slate for the days the voice will not carry, and a list of every child who has ever been yours to teach. What you carry out of the gate: the slate, a fresh reed, and enough lamp-oil for the crossings where the hummers are too old or too few.",
    facts: [["Years", "Thirty-three"], ["Born", "Cooper's Row, Oakhaven. The house with the green door."], ["Trade", "Cantor. Reeds, lamps, and other people's children."], ["Mark", "A fresh-cut reed in the sleeve, and a voice that goes quiet when it is angry."], ["Ties", "Kaelen Vance, your shadow at nine. Every child in the parish, and their mothers."], ["Wants", "A fifth that holds, and a town that does not have to hum to stay alive."]],
    says: "A martyr is just a musician who gave up before the coda. I would rather not be either." },
  { n: 3, name: "Captain Vane",
    sketch: "Rust Coast corsair, master of the Drift-Kestrel. You have held a hawser in one hand and an axe in the other, and you have never once explained whose money bought your ship.",
    history: "You went to sea out of Port Cantabile with a borrowed coat and no name worth inheriting, and you had a deck under you before you had a beard. In 414 the Wave-Cutter went into a tonal trench with her tow, and forty-eight men came home because of what you did with the axe at the hawser, and one did not. You do not talk about the Wave-Cutter. You bought the Drift-Kestrel in 417 with money you would rather not discuss, from people you would rather not name, because she was the only thing for sale that did not ask what you were running from. Since then: eleven Consortium consignments under your name, twelve crates a run, and two years of being very carefully not curious about what is inside them. It is a skill.",
    detail: "You keep a cabin you rarely sleep in, a vox-bottle on a chain you have never unstopped, and a crew that would follow you into a trench. What you carry out of the gate: the bottle, a captain's whistle, and a manifest with two columns in it — the one you show the factor, and the one you keep.",
    facts: [["Years", "Forty-one"], ["Born", "A fish stair below the mast-yard, Port Cantabile"], ["Trade", "Air-crew. Master of the Drift-Kestrel, eleven Consortium consignments."], ["Mark", "A cap gone grey at the brim, and a voice that carries over wind without trying."], ["Ties", "A factor who signs your paper. A crew that counts the crates you do not ask about."], ["Wants", "One manifest with nothing left off it, and a horizon with no paperwork on it."]],
    says: "Every sailor dies, friend. The trick is to be somewhere else when it happens." },
  { n: 4, name: "Sable",
    sketch: "Archivist of the Veil. You wrote the forms the Office still files people under, and you have been reading them back, one name at a time, ever since.",
    history: "The Veil took you young and taught you the one thing it teaches: a civilisation does not need saving, it needs recording, and the recording must be exact. You copied registers for eleven years and read them for four, and you were good enough that the Office asked you to make its paperwork efficient, and you did, and the efficiency is the part you carry. The order had been the Office of the Catalogue for generations before you were born, and the Office conscripted you as it conscripted every Veil-sworn hand. In 416 you wrote down Whisper-Grove: seventy-four thousand six hundred and eleven names in eleven days. Then you took the Bound Ledger and walked into the mist, and you have stayed in the drowned city ever since, reading twenty of them aloud every night, in a hand the Office cannot read.",
    detail: "You carry the Bound Ledger, which keeps a name only for an equal weight of you, a stub of chalk, and a pen you cut yourself. You dictate your own punctuation when you are being careful; people remember a list. You do not write your own name down anywhere. What you carry: the Ledger, the pen, and no name you would spend on a stranger.",
    facts: [["Years", "Forty-one, by your own count"], ["Born", "Nowhere you will name. The Veil took you young."], ["Trade", "Registry. Eleven years of forms copied, four of them read."], ["Mark", "A Veil pen at the throat, ink on the second finger, and a voice that punctuates itself."], ["Ties", "Registrar-General Quist, who poured the second cup. The Office, which still files your forms."], ["Wants", "Every name the Office entered to be read back aloud, once."]],
    says: "I am a list, not a cure. Say what you came to say." },
  { n: 5, name: "Anselm Rooke",
    sketch: "Surgeon-Grafter. The Synod sends the saws and you hold them, and you stop the moment the patient asks you to — which is the whole of your quarrel with the Church.",
    history: "You learned the cutting in the Organum, where the Grafters train to work in the Narrow, and you learned early that a saw is only as good as the hand that stops: you were steady, you did not flinch, and you wrote down what you had done. Four years ago they sent you to the Reach, and in those four years you have cut more limbs off more people than any butcher in the Reach has cut off pigs — sap-limbs, glass burns, and the mornings you went down a lane at dawn and chalked the doors that would not open again. The Synod sends its saws to your surgery because you are the best in the Reach; you hold them because somebody has to who will stop when the patient asks. The Inquisitor has asked twice for your list of sap-marks. You have been slow to find it.",
    detail: "You keep a surgery off the tanners' lane, a needle in the lapel, and a record of every door you have ever chalked, because somebody should. What you carry out of the gate: the needle, a roll of clean linen, and a bottle of Bettany's — hers are for healing and yours are for cutting, and you do not mix them.",
    facts: [["Years", "Fifty, or near it"], ["Born", "The Organum. The Grafters sent you to the Reach four years ago."], ["Trade", "Grafting and cutting. Saws for the Synod, hands for the town."], ["Mark", "A sap-mark on the wrist, chalk dust in the cuffs, a needle in the lapel."], ["Ties", "Orla Hale, whose floor you cannot cross. An Inquisitor waiting for a list."], ["Wants", "To keep the list in your own hands and the saws out of the Inquisitor's."]],
    says: "I have cut more limbs than any butcher in the Reach and done every one with care. Sit. I will not chalk your door today." },
  { n: 6, name: "Mags Tennant",
    sketch: "Bosun of the Drift-Kestrel. You keep the ship's numbers in your head and the crew's pay in your hands, and you have never needed a voice to be heard in a headwind.",
    history: "You were raised in a boat-shed below the mast-yard at Port Cantabile, the youngest of a stevedore's family, and you learned the dock-crews' hand-speech before you learned to read, because a rope does not wait for a sentence. Twelve years on the quay after that: cargo counted on, counted off, and a tally in your head that never once agreed with the manifest the Consortium brought down. Vane took you on as boatswain because you were the only hand he had met who would tell him a hold was heavy before the lift did. Two years now of running crates with your name on the paper and no questions in it, and you have been keeping the count anyway, in a book the captain does not look at.",
    detail: "You sign when the wind is up and speak when it drops, and you read a man's lips across a deck. What you carry out of the gate: a marlinspike, a tally-book with two columns in it, and a collarbone that aches before weather.",
    facts: [["Years", "About forty"], ["Born", "A boat-shed below the mast-yard, Port Cantabile"], ["Trade", "Dock-crew, then air-crew. Bosun of the Drift-Kestrel."], ["Mark", "Hands that sign before they speak, and a manifest you can read upside down."], ["Ties", "Captain Vane, who signs your pay. The dock-crews, who taught you the hand-speech."], ["Wants", "A crew that counts its own crates, and a captain who asks."]],
    says: "Slower. I read lips, not minds." },
];

// ---- the world, for a traveller new to the Reach ------------------------
const CREATION_LORE = [
  { title: 'The Reach', text: 'Orchard country in the west of Aethelgard: iron-bark oaks, the green river called the Chlorophyll Flume, and Oakhaven, the market town inside the Hedge. Autumn, 419 SR. The Synod\'s Regency governs in the name of a queen dead a hundred and forty years. Since 417 the Consortium has been milking the Growth Anchor\'s root from the Oakhaven quarry, and the law has been going soft.' },
  { title: 'The Fracture', text: 'On the last morning of 412 SR the Iron Synod drove its bores into the Spire of Dawning and the Light let go. The glass flood took the Spire floor, the lower city, and everyone who could not reach a bulkhead. What survived is a Regency, a Church that calls the disaster a harvest, and a generation that measures its age from the morning the sky rang.' },
  { title: 'The Octave', text: 'Eight Spires pin the world, each singing one law: Growth, Light, Heat, Mass, Time, Velocity, Memory and Decay. Together they are the Octave, and their eight roots meet under the Organum, the Synod\'s capital. The Reach is Growth, 174 Hz; its oaks ring like bronze and its glass runs green-gold. When a Spire is siphoned, its law slips, and the land around it begins to forget itself.' },
  { title: 'The Narrow', text: 'Mortals live in the band between two hungers. Too loud, and the Cacophony hears; too still, and the Hush notices. So people murmur, keep reed-whistles in every room, and pay night-hummers to sit at crossings until dawn. The rule is taught to children as a skipping rhyme: too loud brings the hounds, too still brings the Hush.' },
  { title: 'Aether-Glass', text: 'Crystallized song, bled out of a Spire and set. The Synod burns it, builds with it, and fires it from pistols as shot. A limb that takes it in calcifies and begins to ring; the glass drinks what it breaks, and the tideline climbs toward the heart. Glass remembers what is pressed into it, which is why the Office stores stolen names in it.' },
  { title: 'The Iron Synod', text: 'The Choir-Church of the Pure Note preaches unison as holiness and calls every second note sin. Its Inquisition, the Flambeaux, burns the off-pitch. Its Consortium factors run the bores and the air-freight. Its Office of the Catalogue keeps the registers. And its Glass Court signs the decrees: nine dead monarchs, revived with glass hearts, who do as they are told.' },
  { title: 'The Office of the Catalogue', text: 'Once the Silent Veil, an independent order of archivists, now the Synod\'s registry of everything that can be owned. Registrar-General Pellam Quist runs the harvest-houses, where people are Unnamed and their voices pressed into glass. The Office\'s clerks believe every name is a unit. Some of them are right, and some of them are sorry.' },
  { title: 'The Free Captains', text: 'Air-crews of the Rust Coast, bound by shares and no flag. They run glass, grain, letters and people between the ports, and they do not ask what a crate is worth to the Synod. Captain Vane\'s Drift-Kestrel is one of theirs, though the Catalogue holds the paper on her. A captain\'s word is good until the weather turns; after that, it is a story.' },
];

// ---- weapons & songs ---------------------------------------------------
const WEAPONS = {
  sword: { name: 'Short Sword', img: 'fp_sword', dmg: [4, 10], reach: 1.4, noise: 1.6, speed: 0.42, type: 'iron', value: 20,
    desc: 'Synod iron, plain and honest. Iron bites the Quiet; it only annoys a hound.' },
  glass: { name: 'Glass Arm', img: 'fp_glass', dmg: [7, 16], reach: 1.3, noise: 1.2, speed: 0.55, type: 'glass', innate: true,
    desc: 'Your own arm, glassed past the elbow. It breaks the Cacophony, and it climbs.' },
  pistol: { name: 'Glass-Shot Pistol', img: 'fp_pistol', dmg: [9, 18], reach: 9, noise: 4.5, speed: 0.9, type: 'shot', ranged: true, ammo: 'pellets', value: 45,
    desc: 'Fires Aether-Glass pellets. Breaks hounds at a distance. Loud as a door slammed in church.' },
  hands: { name: 'Bare Hands', img: 'fp_hands', dmg: [1, 3], reach: 1.1, noise: 1.0, speed: 0.4, type: 'iron', innate: true, desc: 'Fists.' },
  knife: { name: 'Carder\'s Knife', img: 'fp_knife', dmg: [2, 7], reach: 1.1, noise: 0.7, speed: 0.28, type: 'iron', value: 8,
    desc: 'A wool-carder\'s blade. Quick and nearly silent. It will not trouble a golem.' },
  longsword: { name: 'Synod Longsword', img: 'fp_longsword', dmg: [6, 13], reach: 1.65, noise: 1.9, speed: 0.55, type: 'iron', value: 48,
    desc: 'Arsenal steel from the Fortis Synod. Long reach, good edge.' },
  axe: { name: 'Boarding Axe', img: 'fp_axe', dmg: [7, 15], reach: 1.35, noise: 2.1, speed: 0.62, type: 'iron', value: 34,
    desc: 'Rust Coast corsair work: a bearded head and a spike for hatches. Bites through bell-plate.', cleave: true },
  mace: { name: 'Bell-Bronze Mace', img: 'fp_mace', dmg: [5, 12], reach: 1.3, noise: 2.8, speed: 0.55, type: 'bronze', blunt: true, value: 40,
    desc: 'Cast by the Flambeaux from a cracked chapel bell. It rings when it lands, so it hurts the Cacophony like glass does, and calls them like a bell.' },
  spear: { name: 'Tuning-Fork Spear', img: 'fp_spear', dmg: [5, 11], reach: 2.1, noise: 1.8, speed: 0.6, type: 'bronze', twoHanded: true, value: 42,
    desc: 'A bronze fork on an ash shaft, tuned to the Pure Note. Long reach; it rings against the Cacophony. Two hands, so no shield.' },
  maul: { name: 'Cinderhold Steam-Maul', img: 'fp_maul', dmg: [12, 24], reach: 1.5, noise: 3.4, speed: 1.0, type: 'iron', blunt: true, twoHanded: true, value: 100,
    desc: 'A foundry hammer with a pressure gauge. Cracks golems open. Slow, heavy, loud. Two hands, so no shield.' },
  crossbow: { name: 'Rust Coast Crossbow', img: 'fp_crossbow', dmg: [8, 16], reach: 10, noise: 1.4, speed: 1.1, type: 'bolt', ranged: true, ammo: 'bolts', twoHanded: true, value: 55, center: true,
    desc: 'Iron bolts, quiet as a cough. Iron works inside a Quiet where glass shot can\'t; a hound barely feels it. Two hands, so no shield.' },
};

// ---- armour -----------------------------------------------------------------
// ar: armour rating (each point turns aside some blows and blunts the rest); noise: added to your sound while you move.
const ARMOR_SLOTS = [['head', 'Head'], ['body', 'Body'], ['hands', 'Hands'], ['feet', 'Feet'], ['shield', 'Shield']];
const ARMOR = {
  a_cap: { name: 'Leather Cap', slot: 'head', ar: 1, noise: 0, value: 5, desc: 'Boiled leather. Keeps the rain off and the worst of a cudgel.' },
  a_hood: { name: 'Hush-Cloth Hood', slot: 'head', ar: 1, noise: -0.2, value: 16, desc: 'Packed-wool hood from the Hedge-weavers. Your own breathing goes soft inside it.' },
  a_kettle: { name: 'Iron Kettle Helm', slot: 'head', ar: 3, noise: 0.3, value: 20, desc: 'A broad-brimmed infantry helm. It rings when struck. Everything does, lately.' },
  a_bellhelm: { name: 'Carillon Bell-Helm', slot: 'head', ar: 5, noise: 0.6, value: 45, desc: 'A Legion helm, hollowed out. It still hums a name you don\'t know.' },
  a_synodrobe: { name: 'Synod Clerk Robes', slot: 'body', ar: 1, noise: 0, value: 32, desc: 'Grey oilcloth and a silver registry stole. Wear to pass distant Proctors and Legionnaires; close inspection and witnessed suspicious acts expose you for this area. Y opens cover status. Not a pass through story seals or the town watch.' },
  a_gambeson: { name: 'Quilted Gambeson', slot: 'body', ar: 3, noise: 0, value: 14, desc: 'Layers of linen and wool. Quiet, warm, and better than nothing.' },
  a_jerkin: { name: 'Tanner\'s Leather Jerkin', slot: 'body', ar: 5, noise: 0.1, value: 24, desc: 'Abner Fenning\'s work. Oiled so it doesn\'t creak.' },
  a_hushcoat: { name: 'Hush-Cloth Coat', slot: 'body', ar: 3, noise: -0.6, value: 42, desc: 'A long coat of the Hedge\'s own wool. You move inside it like a held breath. Too quiet in siphoned country.' },
  a_brig: { name: 'Consortium Brigandine', slot: 'body', ar: 8, noise: 0.5, value: 58, desc: 'Riveted plates under company canvas, stamped with a Consortium serial.' },
  a_chain: { name: 'Synod Chainmail', slot: 'body', ar: 10, noise: 1.0, value: 75, desc: 'Arsenal mail. It shushes and chinks with every step.' },
  a_plate: { name: 'Carillon Bell-Plate', slot: 'body', ar: 13, noise: 1.5, value: 120, desc: 'A Legionnaire\'s cuirass, bell-cast. The best protection in the Reach, and the loudest.' },
  a_gloves: { name: 'Leather Gloves', slot: 'hands', ar: 1, noise: 0, value: 5, desc: 'Work gloves. Thorn-proof, mostly.' },
  a_gauntlets: { name: 'Mail Gauntlets', slot: 'hands', ar: 3, noise: 0.4, value: 24, desc: 'Mail backs on leather palms.' },
  a_softboots: { name: 'Soft Boots', slot: 'feet', ar: 1, noise: -0.2, value: 9, desc: 'Felt-soled. The cobbles hardly hear you.' },
  a_hobnails: { name: 'Hobnail Boots', slot: 'feet', ar: 2, noise: 0.3, value: 10, desc: 'Sturdy, studded, and they announce you.' },
  a_greaves: { name: 'Iron Greaves', slot: 'feet', ar: 3, noise: 0.5, value: 26, desc: 'Shin-plates over riding boots.' },
  a_buckler: { name: 'Corsair Buckler', slot: 'shield', ar: 2, noise: 0.2, value: 14, desc: 'A fist-sized shield for close work on a deck.' },
  a_kite: { name: 'Synod Kite Shield', slot: 'shield', ar: 4, noise: 0.5, value: 32, desc: 'Long, heavy, painted with the Synod\'s dead queen.' },
};
// valuables: worth carrying to a merchant
const VALUABLES = {
  v_scrap: { name: 'Bell-Bronze Scrap', value: 6, desc: 'A shard of a Legion bell. The Flambeaux pay for it.' },
  v_mesh: { name: 'Silver Proctor-Mesh', value: 14, desc: 'Fine silver mesh from a Catalogue Proctor\'s mask.' },
  v_gear: { name: 'Brass Governor-Gear', value: 18, desc: 'From a Steam Golem\'s works. Still warm.' },
  v_signet: { name: 'Synod Signet', value: 26, desc: 'An officer\'s ring. Whoever wore it isn\'t coming back for it.' },
  v_fork: { name: 'Silver Tuning Fork', value: 32, desc: 'Tuned to 528. A Cantor would weep to hold it.' },
};

const SONGS = {
  murmur: { name: 'Murmur', hz: '—', cost: 0, noise: 0.9, desc: 'Keep the Hush off. Raises your sound a little without waking the hounds.' },
  tending: { name: 'Tending Note', hz: '174', cost: 8, noise: 1.8, desc: 'A Cantor\'s mending note. Heals 14. Sung low, inside the Narrow.' },
  fifth: { name: 'Falling Fifth', hz: '174→116', cost: 12, noise: 3.6, desc: 'The calling-song\'s turn. Every Cacophony within hearing stops for a breath. Loud. A trick works on a mimic once.' },
  root: { name: 'Root Note', hz: '174', cost: 10, noise: 2.6, desc: 'The note the Root is trying to remember. Hounds will not come to you for a time.' },
  name: { name: 'Read the Name', hz: '741', cost: 6, noise: 1.2, desc: 'Recite a Legionnaire or proctor its own surrendered name. It stops. Costs you a little of yourself.' },
};

// ---- enemies -----------------------------------------------------------
const ENEMIES = {
  hound: { name: 'Cacophony Hound', sprite: 'hound', hp: 18, dmg: [3, 7], speed: 2.3, reach: 1.0, cacophony: true, noiseLure: true, scale: 0.8, xp: 12,
    desc: 'Static with appetite. Up close you can hear screaming inside it.' },
  legionnaire: { name: 'Carillon Legionnaire', sprite: 'legionnaire', hp: 34, dmg: [4, 9], speed: 1.1, reach: 1.2, core: true, scale: 1.0, xp: 25,
    desc: 'A bell-shaped helm. Stand close and you can hear someone murmuring inside.' },
  golem: { name: 'Steam Golem', sprite: 'golem', hp: 52, dmg: [8, 16], speed: 0.9, reach: 1.4, scale: 1.15, xp: 60, armored: true,
    desc: 'A boiler on legs. It vents when it is about to swing.' },
  proctor: { name: 'Catalogue Proctor', sprite: 'proctor', hp: 22, dmg: [3, 6], speed: 1.5, reach: 1.1, press: true, core: true, scale: 1.0, xp: 20,
    desc: 'Grey oilcloth, silver mesh, a hand-press tuned to 741.' },
  mites: { name: 'Cacophony Swarm', sprite: 'mites', hp: 10, dmg: [1, 3], speed: 1.8, reach: 0.9, cacophony: true, scale: 0.55, yOff: -0.2, xp: 8,
    desc: 'Mites and leeches. They strip a room of sound.' },
  wearer: { name: 'The Wearer', sprite: 'wearer', hp: 90, dmg: [6, 14], speed: 1.6, reach: 1.3, cacophony: true, boss: true, scale: 1.1, xp: 150,
    desc: 'It wears Tobin Ashgrove. It has been practising your voice.' },
  quiet: { name: 'A Quiet', sprite: 'quiet', hp: 40, dmg: [4, 9], speed: 1.0, reach: 1.1, quiet: true, scale: 1.0, xp: 40,
    desc: 'A hole in the world. Glass shot cannot ring inside it. Iron can.' },
};

// the dying names: invented people only. Nobody canon puts elsewhere (in a crate, a cloister tape, a story) can speak from a core (R2).
const NAMES_POOL = ['Gethin Coote', 'Osric Dacre', 'Linus Harte', 'Bryn Pryor', 'Elspet Rowe',
  'Dunstan Pell', 'Ivo Marrick', 'Sefa Lund', 'Ottilie Crane', 'Benet Owler', 'Maud Tanner', 'Ro Fenwick', 'Caddoc Vey', 'Elin Thorsby', 'Perrin Lusk'];

// ---- items -------------------------------------------------------------
const ITEMS = {
  pellets: { name: 'Glass Shot (×3)', sprite: 'loot', desc: 'Pellets of Aether-Glass for an ordinary pistol. A sovereign each. They break the Cacophony.', use: 'ammo', n: 3 },
  tonic: { name: 'Bettany\'s Tonic', sprite: 'loot', desc: 'Honey, raw egg and willow-bark. Restores 12 health.', use: 'heal', n: 12 },
  honey: { name: 'Oiled Honey', sprite: 'loot', desc: 'For the throat. Restores 15 voice.', use: 'voice', n: 15 },
  sovereigns: { name: 'Sovereigns', sprite: 'loot', desc: 'Synod coin stamped with a dead queen.', use: 'gold' },
  coil: { name: 'Reverse-Phase Coil', sprite: 'coil', desc: 'A brass and copper coil wound around a green-gold Growth crystal. Seated in the bore\'s lock it will throw the bit a quarter-tone wrong and snap it.', key: true },
  charts: { name: 'Tobiah\'s Charts', sprite: 'loot', desc: 'The night-shift charts of the Oakhaven works, and the only copy of the Vance Sequence, Revision Seven, with the margin on it: on failure of the hold, slippage is to be absorbed by the source.', key: true },
  pass: { name: 'Consortium Pass', sprite: 'loot', desc: 'Factor Vosk\'s seal. It opens the quarry gate and the shaft to the Root-vault.', key: true },
  boots: { name: 'Davin\'s Boots', sprite: 'loot', desc: 'A dead boy\'s boots. Rooke asked that they go to his mother, Orla Hale.', key: true },
  core: { name: 'Cracked Lilac Core', sprite: 'coil', desc: 'A Legionnaire\'s glass core, cracked. It said a name three times before it stopped.', key: true },
  bottle: { name: 'Vox-Bottle', sprite: 'loot', desc: 'The last words of someone, stoppered. Opening it brings hounds. Do not.', key: false, use: 'bottle' },
  whistle: { name: 'Hush-Whistle', sprite: 'loot', desc: 'A reed-whistle from a hush-lamp. Blown, it keeps the Hush off for a little while without calling the hounds.', use: 'whistle', value: 6 },
  bolts: { name: 'Crossbow Bolts (×6)', sprite: 'loot', desc: 'Iron bolts for a crossbow.', use: 'ammo', ammo: 'bolts', n: 6, value: 5 },
  cache: { name: 'A strongbox', sprite: 'chest', desc: 'Someone hid this.', use: 'cache' },
};
ITEMS.pellets.value = 3; ITEMS.tonic.value = 4; ITEMS.honey.value = 5; ITEMS.bottle.value = 6;
for (const id in ARMOR) ITEMS[id] = Object.assign({ sprite: 'gear', armor: true }, ARMOR[id]);
for (const id in VALUABLES) ITEMS[id] = Object.assign({ sprite: 'gear', valuable: true }, VALUABLES[id]);
for (const id in WEAPONS) if (!WEAPONS[id].innate) ITEMS['w_' + id] = { name: WEAPONS[id].name, sprite: 'gear', weapon: id, value: WEAPONS[id].value, desc: WEAPONS[id].desc };
// what falls out of things (weights)
const LOOT = {
  legionnaire: { chance: 0.6, table: [['sovereigns', 26], ['v_scrap', 24], ['a_kettle', 8], ['a_gauntlets', 7], ['a_greaves', 7], ['a_bellhelm', 4], ['a_chain', 4], ['a_plate', 2], ['w_longsword', 6], ['a_kite', 5], ['v_signet', 5], ['bolts', 4]] },
  proctor: { chance: 0.55, table: [['v_mesh', 40], ['sovereigns', 25], ['tonic', 15], ['w_knife', 8], ['a_hood', 6], ['honey', 6]] },
  golem: { chance: 0.75, table: [['v_gear', 50], ['pellets', 25], ['w_maul', 10], ['a_greaves', 8], ['bolts', 7]] },
  hound: { chance: 0.12, table: [['sovereigns', 70], ['v_scrap', 30]] },
  quiet: { chance: 0.5, table: [['v_fork', 40], ['v_signet', 30], ['a_hushcoat', 15], ['sovereigns', 15]] },
};
// strongbox tables by tier
const CACHE = {
  1: { gold: [6, 16], table: [['a_cap', 8], ['a_gloves', 8], ['a_softboots', 7], ['a_gambeson', 7], ['w_knife', 6], ['tonic', 14], ['pellets', 10], ['bolts', 8], ['v_scrap', 12], ['honey', 10], ['a_buckler', 6]] },
  2: { gold: [12, 28], table: [['a_jerkin', 8], ['a_kettle', 8], ['a_gauntlets', 7], ['a_hobnails', 6], ['w_axe', 5], ['w_longsword', 5], ['w_mace', 4], ['w_crossbow', 4], ['a_brig', 4], ['a_kite', 5], ['v_mesh', 10], ['v_signet', 7], ['tonic', 10], ['bolts', 7]] },
  3: { gold: [20, 45], table: [['a_chain', 7], ['a_plate', 4], ['a_bellhelm', 6], ['a_greaves', 6], ['w_maul', 5], ['w_spear', 5], ['w_crossbow', 5], ['a_hushcoat', 5], ['v_fork', 10], ['v_gear', 10], ['v_signet', 8], ['tonic', 10], ['honey', 8]] },
};

// ---- lore topics (Tell me about ...) -------------------------------------
// Each topic: generic answers by knowledge tier; NPC-specific overrides live in NPCS.
const TOPICS = {
  'Oakhaven': { low: 'Orchard town. Used to be. Now it\'s a town inside a hedge that eats its own noise.', high: 'Capital of the Resonant Reach, under the seal of a queen who has been dead a hundred and forty years. Since 417 the Consortium has milked the Growth Anchor\'s root from the quarry, and the law is going soft. Saplings split cobbles overnight.' },
  'The Hedge': { low: 'Three men deep of thorn and packed wool. It swallows our sounds so the hounds don\'t hear. Don\'t go near it after dark.', high: 'Planted in 417 after the first hounds came. It keeps the Narrow for us. But at the dead hour it has started to speak, in the voices of our dead. Never answer it. Answering tells it you are there.' },
  'The Narrow': { low: 'Too loud brings the hounds, too still brings the Hush. Every child knows the rhyme.', high: 'Mortals live in the band between two predators. Speak in a murmur. Keep a hush-lamp lit so no room ever goes silent. In siphoned country a person who falls truly silent begins to unwrite: warmth first, then name, then outline.' },
  'The Cacophony': { low: 'Static with teeth. They come to music. Hounds, mostly, round here.', high: 'What song becomes when the Hush bites it. They hunt voices because every voice is a small song, and they wear what they eat. Aether-Glass breaks them; glass shot from an ordinary pistol will do. They will not cross the glassed.' },
  'The Hush': { low: 'What\'s outside. The quiet. We don\'t talk about it, which I suppose is the point.', high: 'It is not empty. It is a silence that is alive, patient, and hungry, and it does not kill what it takes. It digests. Where a law thins, the Hush leans in. The Tongueless worship it as the Merciful Quiet. They are right that it is quiet.' },
  'The Root': { low: 'What\'s under the quarry. The Consortium drills it. Pays the town\'s bread, the Governor says.', high: 'The Root of the Growth Anchor, 174 Hz. The Spire is the tower you can see; the Anchor is what is inside it, and the Root is where it drinks. There is something singing down there, a lullaby, and it keeps losing the tune.' },
  'The Iron Synod': { low: 'One Note, One Law, One Hand. They took our bells for bore-teeth.', high: 'Five organs that need each other and hate each other: the Glass Court of dead kings, the Choir-Church, the Arbiterium, the Consortium of Bores and the Office of the Catalogue. And the Carillon Legions, every one of them running on a stolen name.' },
  'The Flume': { low: 'The green river. Aqueduct, really, from the Anchor country. You can drink it if you boil it twice. Old Tam sits at the crossing of a night and listens to it.', high: 'The Chlorophyll Flume carries Growth-water down from the Anchor\'s country to the orchards. It has been running sweeter and faster since 417, which is not good news. What it carries, it also carries voices in.' },
  'The Church': { low: 'The Choir-Church. They took the bells in 417, for the bore\'s teeth. They are coming back up the road to sing over us, and that is supposed to be a blessing.', high: 'The Choir-Church of the Pure Note holds that the Light let go because one voice shouted at the Dawning Spire. Its Flambeau burn what sings off-key. Ignatius Crane leads the column coming to Oakhaven; his left hand was bleached white at the Dawning.' },
  'The Rite': { low: 'The Church is coming to hold the Pure Note over the town. On Hearthday. They say it is a blessing.', high: 'A four-hour unison hold at 174 Hz, sung at the casing with a collar and a wire. The Vance Sequence, Revision Seven, Stage Nine. Source: Cantor, local. They did the same thing at the Dawning Spire in 412 and the Light let go.' },
  'Kaelen Vance': { low: 'The Governor\'s son. Lives outside the Hedge in a charcoal-burner\'s hut. The hounds won\'t touch him. People say that tells you something.', high: 'Chief Resonant Engineer of the Consortium by twenty-seven. He calibrated the bore at the Dawning Spire. His left arm is Light-glass, Stage Three and spreading; anyone who knows glass can read his past off his skin.' },
  'Lyra Ashgrove': { low: 'Our Cantor. Sings the births and the burials. Her father was taken in 417.', high: 'Tobin Ashgrove raised his voice above the Narrow to call a fevered child back from the Hush. The child lived. Something wears his voice now, and it has been courting her at the Hedge.' },
  'Governor Vance': { low: 'He keeps us fed. That is what he says. He has not aired his room in two years.', high: 'He sold the Root during the Cascade famine to keep Oakhaven fed, and he has been bleeding the town slowly to save it ever since. There are roots under his sleeves.' },
  'Aether-Glass': { low: 'Fuel. Lamps, engines, the Legions. It comes out of the ground green here.', high: 'Crystallized song: a Chorister\'s voice bled out and set. Every tanker of fuel is part god. Glass remembers whatever is pressed into it, which is how the Catalogue stores stolen names. Raw glass crystallizes flesh in four stages: ringing, frost, set, heartglass.' },
  'The Catalogue': { low: 'The Office. They take names. Every name is a unit, they say.', high: 'Formerly the Silent Veil. Registrar-General Quist runs the harvest-houses where people are Unnamed: a hand-press tuned to 741, eight seconds of contact. What remains is a Hollow, repeating the last thing it did.' },
  'The Grafters': { low: 'Synod surgeons. They come for the burl-sick with saws.', high: 'Surgeon-Grafter Rooke does the cutting here. He has done every one with care. The sap-mark he chalks on a door means past cutting, and now it also means the Inquisitor\'s list.' },
  'The Flambeaux': { low: 'The Church\'s burners. They carry glass-fire the hounds will not cross.', high: 'Ignatius Crane is their brightest flame. He swung the censer through three hundred sunrises of the Rite of Pure Unison and ordered the choir burned when the light turned. He has spent seven years praying over the one voice that shouted.' },
  'The Drift-Kestrel': { low: 'A skyship at the mooring mast. Smuggler, by the look of her captain.', high: 'Captain Vane, late of the Wave-Cutter. Rust Coast. Twelve crates in his hold for the quarry garrison, and at the dead hour the crates say names.' },
  'The Quarry': { low: 'North of the Hedge. Headframe over a green-lit shaft. Hollows work the pumps.', high: 'At the bottom is a chamber grown out of the Root itself, veined with glass and breathing. Depot Three holds the engineers\' stores. The shaft to the Root-vault is sealed to anyone without a Consortium pass.' },
  'Hush-lamps': { low: 'The reed on the lantern. It whistles so the house never goes quiet.', high: 'A room that falls silent is a door left open. Every house keeps one burning. Night-hummers sit at the crossings till dawn. Tam does the Flume crossing, or did.' },
  'The scribe in the mist': { low: 'There\'s a woman out past Kaelen\'s hut, east, in the trees. Pale. Writing in a book by a hush-lamp, at night, outside the Hedge. Grey men have been asking after her at the gate.', high: 'A Veil scribe, by the cut of her coat, which should not be possible; the Veil was folded into the Catalogue years ago. The proctors at the North Gate are asking for a woman carrying a ledger. Whatever she has, the Office wants it back badly.' },
  'Vox-bottles': { low: 'Last words of the dead, stoppered. The Free Captains sell them. Don\'t open one indoors.', high: 'The grieving buy them. Opening one brings hounds, and worse: sailors say a quiet comes aboard through a bottle left too long unstoppered.' },
};
const TOPIC_KEYS = Object.keys(TOPICS);

const PLACES = {
  'The Boar & Dulcimer': 'tavern', 'Lyra\'s house': 'lyra_house', 'The Greenhall': 'greenhall', 'Rooke\'s surgery': 'surgery', 'The North Gate': 'gate', 'The mooring mast': 'mast', 'Orla Hale\'s house': 'orla_house',
  'The market': 'market', 'The Carders\' mill': 'mill', 'The Chapel of the Carillon': 'chapel', 'The Flume crossing': 'flume', 'Tannery Row': 'tannery', 'The tannery culvert': 'culvert',
};

// ---- rumours -----------------------------------------------------------
const RUMOURS = [
  'The grey men at the gate are proctors from the Catalogue. They are looking for a woman with a book. She is outside the Hedge, east of Kaelen\'s hut. Do not tell them I said so.',
  'There\'s a scribe in the mist reading names off the dead Legion. They say she can give a Hollow its name back. They say it costs her something.',
  'Abner Fenning on Tannery Row oils his leather so it never creaks. Worth it, if you mean to walk anywhere at night.',
  'Captain Vane will sell you anything off the Kestrel that isn\'t nailed down. Crossbows. Axes. Opinions.',
  'The Factor keeps Consortium brigandine and a steam-maul in Greenhall. At Consortium prices, naturally.',
  'Orrin Pale the sexton sells what the old watch left in the crypt. Ask him quietly; he is used to quiet.',
  'Old Tam has a coat of the Hedge\'s own wool. You walk in it like a held breath. He doesn\'t sell it to just anyone.',
  'Pim Carder put out roots on Rootday. Bettany hummed him through it. The Grafters have not been told. Do not tell them.',
  'Old Harrow swears the Hedge whistled the falling fifth last night. Exactly right. Nobody taught it that.',
  'The baker says her bread rose until the oven split. Burl-sickness in the dough, she says, as if dough could sicken.',
  'A skyship came in off the Rust Coast with twelve crates for the garrison. The crew drink at the Boar and do not talk about the cargo.',
  'They say the Church is coming up the Greenroot road under glass-fire, singing. Hymns bring hounds. The Church does not care.',
  'My fingernails grew a quarter-inch between dusk and dawn. Nobody\'s remarked on it. Nobody remarks on anything.',
  'Davin Hale sang his mother\'s harvest song at the Boar. The hounds sang it back. That was the last anyone saw of Davin.',
  'The Governor took the Consortium\'s purse. Again. We eat, and the Root is bled, and the oaks ring like bronze when the wind moves.',
  'Keep your voice in your chest. Keep your lamp lit. Do not go to the Hedge at the dead hour, whatever it says, whoever it sounds like.',
  'Tam the night-hummer listens to his dead wife at the Flume crossing. We all know. None of us has the heart to tell him what she is.',
  'Bettany at the market stall takes coin for tonic but she would rather take eggs. Nobody has eggs. The hens went quiet first.',
  'The Fenning twins went down the culvert after their dog on Driftday last. Abner Fenning still sets a lamp in their window. He keeps the culvert key on a nail.',
  'The Cantor sang the Tanner boys into the ground side by side, after the bore head went on the platform. Marten and Old Coyle with them. She has not been the same since.',
  'Nell Carder has not let the boy out of the mill since the Grafters posted the inspection. She says he has a cough. It is not a cough.',
  'Red was redder when I was a girl. Summers were warmer. Everyone over thirty says so. The young ones think we are mad.',
  'The dead are buried with bound jaws and a stone on the tongue so they cannot ring. We have not rung a bell in this town since the Synod took them.',
];

// ---- NPC dialogue --------------------------------------------------------
// Each NPC: name, sprite, portrait, greet (by tone), knowledge tier, topic overrides, quest hooks.
const NPCS = {
  harrow: {
    name: 'Old Harrow, gate-warden', sprite: 'harrow', portrait: 'harrow', tier: 'low', scale: 0.93,
    greet: { polite: 'Keep your voice down, friend, and welcome to what\'s left of Oakhaven.', normal: 'Gate\'s shut after dusk. Keep it low.', blunt: 'You shout like that again and I\'ll put you out through the thorn myself.' },
    topics: { 'The Hedge': 'I\'ve stood this gate eleven years. Last night it whistled a tune only the Cantor and the Carder boy know. Whistled it exactly right.' },
    quest: (g) => {
      if (g.flags.need_gate && !g.flags.gate_open) { g.flags.gate_open = true; g.flags.met_harrow = true; return { text: 'Lyra\'s word, is it. Then it is on her head. Go on, through the gate, and go quick and quiet. His hut is north, past the hound-bed. You\'ll smell the charcoal before you see it. Do not sing out there.', journal: ['main', 'Harrow has unbarred the North Gate for me. Kaelen Vance\'s hut lies north of the Hedge, past the hound-bed.'] }; }
      if (!g.flags.met_harrow) { g.flags.met_harrow = true; return { text: 'You\'re the one the Cantor sent for? Then go and see her. Cooper\'s Row, the house with the green door, south side of the square. And friend, we keep the gate shut at night because of what is on the other side of it. Not to keep you in.', journal: ['main', 'Old Harrow at the North Gate says the Cantor, Lyra Ashgrove, is expecting me. Her house is on Cooper\'s Row, south of the square.'] }; }
      return null;
    },
  },
  lyra: {
    name: 'Lyra Ashgrove, Cantor of Oakhaven', sprite: 'lyra', portrait: 'lyra', tier: 'high',
    greet: { polite: 'You came. Sit, keep your voice in your chest. I\'ve a thing to ask that I should not ask anyone.', normal: 'Come in, close the door. The lamp\'s lit; we can talk.', blunt: 'Lower. Please. There are things in this town that learn from every sound.' },
    topics: {
      'Kaelen Vance': 'He was my shadow when we were children. He left at seventeen for the Conservatory of Bores and came back with an arm of glass and no words. He lives outside the Hedge because the hounds will not touch him, and because he has decided he does not deserve the inside.',
      'The Rite': 'Stage Nine: a four-hour unison hold at the casing. Source: Cantor, local. That is me. They will put a collar on my throat and a wire through my voice and I will sing the Root to sleep for them, and then they will drink it. Unless we break the bore first.',
      'Lyra Ashgrove': 'A martyr is just a musician who gave up before the coda. I would rather not be either.',
    },
    quest: (g) => {
      if (!g.flags.lyra_met) {
        g.flags.lyra_met = true; g.flags.need_gate = true;
        g.give('pellets'); g.give('tonic');
        return { text: 'The Consortium has set a Rite for Hearthday. Nine days. Stage Nine of a method called the Vance Sequence, and it needs a Cantor to hold the note at the casing. Kaelen wrote that method. I need him to tell me how to break it. Go north through the gate and find his hut. Harrow will open it on my word. Take these — glass shot, and a tonic of Bettany\'s. Do not sing beyond the Hedge, whatever you hear.', journal: ['main', 'Lyra asked me to carry word to Kaelen Vance, who lives outside the Hedge. The Church\'s Rite falls on Hearthday, nine days out. I must go north through the gate; Harrow will open it on her word.'] };
      }
      if (g.flags.kaelen_met && !g.flags.coil_done && !g.flags.lyra_coil_told) {
        g.flags.lyra_coil_told = true;
        return { text: 'A coil in the lock. Of course. He always did break things from the inside. Go carefully in the quarry. The Hollows at the pumps will not hurt you; the bells will. If you hear a voice you know down there, you do not know it.', journal: null };
      }
      if (g.flags.coil_done && !g.flags.rite_started) {
        return { text: 'Then it\'s Hearthday. They will walk me down in white and the town will hum the Root note under the Pure Note, too quietly to punish. When the lock throws, I will sing the falling fifth against the bore. You will need to be at the casing with him. Take the shaft from the quarry. Go now — I can hear the censers from here.', journal: null };
      }
      return null;
    },
  },
  kaelen: {
    name: 'Kaelen Vance, the Dissonant Blade', sprite: 'kaelen', portrait: 'kaelen', tier: 'high',
    greet: { polite: 'Mind the bed, twenty paces off the door. No sound carries over it for a day. Say what you came to say.', normal: 'The hounds let you past. That means you came quietly. Good.', blunt: 'I don\'t build things anymore. I just know how they break. What do you want broken?' },
    topics: {
      'The Rite': 'Revision Seven. My method, improved in an Arbiterium hand. Stage Nine is a four-hour hold at 174 with a collar and a wire. They did it at the Dawning Spire with forty singers for three hundred days. On the last morning the Light heard its own note held for it, and it asked a question, and it let go. I was there. I failed to stabilize it. That is the lie I tell.',
      'Aether-Glass': 'It drinks what it breaks. Every Legionnaire I put down, the ring gets fuller and the tideline climbs. Three fingers from the shoulder, this morning. When it reaches the heart they call it Heartglass, and you become a humming statue, alive and aware.',
      'Kaelen Vance': 'If I carry all of it, no one else has to. I know what that sounds like. I\'m an engineer; I know a bad load path when I draw one.',
      'The Root': 'I laid my hand on it once. The humming stopped and something turned toward me. It is tired. It has been holding a lullaby for ten thousand years and it keeps losing the tune.',
    },
    quest: (g) => {
      if (!g.flags.kaelen_met) {
        g.flags.kaelen_met = true;
        return { text: 'She sent you. Then listen, once. The bore has a lock at the casing. Seat a reverse-phase coil in it and the bit goes a quarter-tone wrong and snaps itself. There is a coil in Depot Three at the quarry, in the engineers\' stores, behind a Legionnaire that walked me across town last week. Bring it to me. And bring Tobiah Marsh\'s charts if you find them; a boy on the night shift keeps the only honest copy of my method. Go in at the headframe. Do not sing. Do not answer anything that sounds like me.', journal: ['main', 'Kaelen says a reverse-phase coil seated in the bore\'s lock will snap the bit. The coil is in Depot Three of the Quarry, guarded by a Carillon Legionnaire. He also wants Tobiah Marsh\'s charts. The quarry headframe is north of his hut.'] };
      }
      if (g.has('coil') && !g.flags.coil_done) {
        g.flags.coil_done = true; g.flags.rite_ready = true; g.give('pass');
        let t = 'You got it out past the bell. Good. Keep the coil; it goes down in your bag, not mine. Nobody searches the supervising engineer\'s toolbag, they say, but the Factor watched me at Depot Three, and I would rather she had nothing to find. Here: the Consortium\'s pass. It opens the shaft gate from the quarry to the Root-vault. On Hearthday, when the Church is holding its note, go down and seat it in the lock while they are all looking at Lyra. I will be the hand at the wire.';
        if (g.has('charts')) t += ' And the charts. Revision Seven, with the margin. On failure of the hold, slippage is to be absorbed by the source. You understand what that means? She is not the steadying hand. She is the fuse.';
        return { text: t, journal: ['main', 'Kaelen gave me the Consortium pass. On Hearthday I must take the shaft from the Quarry to the Root-vault and seat the coil in the bore\'s lock during the Rite. Lyra will sing against the bore; Kaelen will be the hand at the wire.'] };
      }
      if (g.flags.coil_done) return { text: 'Hearthday. Go down by the shaft; the pass opens it. I will be at the casing with the needle, and my hands will be shaking, and that is all right. Seat the coil. Then run.', journal: null };
      return null;
    },
  },
  hetty: {
    name: 'Hetty Bram of the Boar & Dulcimer', sprite: 'hetty', portrait: 'hetty', tier: 'low', scale: 0.95,
    greet: { polite: 'Sit anywhere that isn\'t broken. Small beer or smaller. We do not sing in here, not since Davin.', normal: 'Beer\'s a copper. Rooms are a sovereign. Singing is free and it will get you killed.', blunt: 'I\'ve put bigger men than you out of here for raising their voice. Sit.' },
    topics: { 'The Drift-Kestrel': 'Her captain drinks in the corner and laughs too loud at nothing. His crates for the garrison are in his ship\'s hold, at the mast. I send his supper up the mast-ladder of an evening, and last night, with the hatch open, I swear to you one of them said a name.' },
    quest: (g) => {
      if (!g.flags.hetty_crates) { g.flags.hetty_crates = true; return { text: 'You look like you\'ve a steady head. Go up the mast-ladder to the corsair\'s ship and listen at the crates in her hold. Tell me I am an old woman hearing things. Please tell me that.', journal: ['side', 'Hetty Bram thinks the crates in the skyship captain\'s hold are talking. She asked me to go up the mast-ladder at the mooring mast and listen at them.'] }; }
      if (g.flags.crates_heard && !g.flags.hetty_paid) { g.flags.hetty_paid = true; g.gold(20); return { text: 'Names. Children\'s names. Gods. — Here. Twenty sovereigns, and it isn\'t for the listening, it\'s for the forgetting. Go and talk to the corsair. Make him hear them too.', journal: ['side', 'The crates in the Kestrel\'s hold are full of glass cores, and they say names. She paid me twenty sovereigns and wants the corsair to hear them.'] }; }
      return null;
    },
  },
  vane: {
    name: 'Captain Vane of the Drift-Kestrel', sprite: 'vane', portrait: 'vane', tier: 'high',
    greet: { polite: 'Every sailor dies, friend. The trick is to be somewhere else when it happens. Sit; I\'m buying, because I\'m frightened.', normal: 'Corsair, Rust Coast, retired from the sea on account of the sea. What\'ll you have?', blunt: 'Ha! You have the look of somebody about to tell me something I already know and have been drinking not to hear.' },
    topics: {
      'The Drift-Kestrel': 'Bought with money I\'d rather not discuss, from people I\'d rather not name. She holds eighteen if nobody\'s fat and she lifts with three tanks.',
      'Vox-bottles': 'I carry one. Labelled with a name I won\'t say. Almost certainly a fake. I have never unstopped it, and I think about it every night.',
      'The Catalogue': 'Twelve crates of replacement cores for the quarry garrison. I don\'t ask what\'s in them. I have been very carefully not asking for two years. It is a skill.',
    },
    quest: (g) => {
      if (g.flags.crates_heard && !g.flags.vane_told) { g.flags.vane_told = true; return { text: '...Annet Sowerby. Six years old. She asked the Carder boy his name through the side of a crate. — I know. I\'ve known since the first run. One thousand three hundred and forty-two, if anyone\'s counting, and someone is. Right. Right. We are not delivering. If this town comes apart on Hearthday — and towns do, I have seen it — the Kestrel is at the mooring mast, and she takes children first, four to a line. Tell the Cantor.', journal: ['side', 'Captain Vane admitted he has carried stolen glass cores for the Catalogue for two years. He will not deliver these. If Oakhaven falls on Hearthday the Drift-Kestrel will lift from the mooring mast, children first.'] }; }
      if (g.flags.vane_told) return { text: 'Children first, four to a line. I\'ll be at the mast. Go and do your clever thing in the ground, and when it goes wrong — it will go wrong — run toward the ship, not away from the trees.', journal: null };
      return null;
    },
  },
  rooke: {
    name: 'Surgeon-Grafter Anselm Rooke', sprite: 'rooke', portrait: 'rooke', tier: 'high',
    greet: { polite: 'I have cut more limbs than any butcher in the Reach and done every one with care. Sit. I will not chalk your door today.', normal: 'The sap-mark means past cutting. Now it also means the Inquisitor\'s list. Keep that to yourself.', blunt: 'Lower your voice in my surgery or I will lower it for you with a needle.' },
    topics: { 'The Grafters': 'The Synod sends the saws. I hold them. Somebody has to hold them who will stop when the patient asks. The Inquisitor has asked for my list of sap-marks. I have been slow to find it.' },
    quest: (g) => {
      if (!g.flags.rooke_boots) { g.flags.rooke_boots = true; g.give('boots'); return { text: 'A favour, and a quiet one. These were Davin Hale\'s boots. His mother is rooted into her chair on the lane behind the tannery and cannot come for them. Take them to her. Do not sing. She may ask you to. Do not.', journal: ['side', 'Surgeon-Grafter Rooke gave me Davin Hale\'s boots to carry to his mother Orla, who is rooted into her chair in the house behind the tannery.'] }; }
      if (g.flags.boots_delivered && !g.flags.rooke_thanks) { g.flags.rooke_thanks = true; g.give('tonic'); g.give('tonic'); return { text: 'She has them. Good. I could not cross her floor; I have tried. Take these; Bettany\'s, not mine. Mine are for cutting.', journal: null }; }
      return null;
    },
  },
  orla: {
    name: 'Orla Hale', sprite: 'orla', portrait: 'orla', tier: 'low', scale: 0.8,
    greet: { polite: 'Come closer, I cannot turn. Are you here about Davin?', normal: 'Mind the roots on the floor. They are mine.', blunt: 'I am a tree with a tongue; shout at me if you like, I cannot leave.' },
    topics: { 'Oakhaven': 'I heard my son sing my harvest song at the Boar. And then I heard it sung back by something with nobody inside it. All the lines. Even the fourth.' },
    quest: (g) => {
      if (g.has('boots') && !g.flags.boots_delivered) { g.flags.boots_delivered = true; g.take('boots'); return { text: 'His boots. He had big feet for a boy. — Will you sing it? The harvest song. Just the first line. I would like to hear it from a mouth that has somebody in it. ...No. No, you are right. Lyra promised she would sing me down proper, before the fire. That is enough. Thank you for the boots.', journal: ['side', 'I gave Davin\'s boots to Orla Hale. She asked me to sing, and I did not.'] }; }
      return null;
    },
  },
  pim: {
    name: 'Pim Carder', sprite: 'pim', portrait: 'pim', tier: 'low', scale: 0.75,
    greet: { polite: 'Shh. Mam says I\'m not to talk to anybody about my hands.', normal: 'I\'m not supposed to be out. Don\'t tell.', blunt: '...' },
    topics: { 'The Hedge': 'Something whistled my whistle from the culvert. Only me and Lyra know my whistle. I didn\'t go. I nearly went.' },
    quest: (g) => null,
  },
  vosk: {
    name: 'Factor Adela Vosk, Consortium of Bores', sprite: 'vosk', portrait: 'vosk', tier: 'high', scale: 1.03,
    greet: { polite: 'Pitch has a colour, through these lenses. Yours is an unremarkable brown. State your business.', normal: 'The Consortium pays this town\'s bread. Remember that before you speak.', blunt: 'I have Legionnaires. You have a voice. One of those is replaceable.' },
    topics: { 'The Rite': 'Stage Nine. Source: Cantor, local, one. Collar: standard. Wire: standard. It is a procedure, not a sacrifice. The Church likes the robes; we like the yield.', 'The Root': 'A resource. It will yield without limit if correctly relieved. That is the Arbiterium\'s phrasing, not mine, and I confess I do not entirely follow it.' },
    quest: (g) => null,
  },
  aldric: {
    name: 'Governor Aldric Vance', sprite: 'aldric', portrait: 'aldric', tier: 'high', scale: 1.06,
    greet: { polite: 'The seal of Queen Maelis bids you welcome. Her signature on the decrees is famously steady for a woman dead a hundred and forty years.', normal: 'Yes? Be brief. I have the Factor at one shoulder and the Church at the other.', blunt: 'You sold them, my son says. I fed them, I say. Which of us do you think is lying?' },
    topics: { 'Governor Vance': 'In the Cascade famine I had a town and no bread. The Consortium had bread and wanted a hole. I made the arithmetic. I have been making it ever since.', 'Kaelen Vance': 'My son thinks penance is a thing you do alone, in a hut, in the smoke. It is not. It is a thing you do in a room full of people who need feeding.' },
    quest: (g) => null,
  },
  tobiah: {
    name: 'Junior Engineer Tobiah Marsh', sprite: 'tobiah', portrait: 'tobiah', tier: 'high', scale: 0.94,
    greet: { polite: 'Night shift. Keep it under the pumps and the bells won\'t turn. Are you — are you with him? With Engineer Vance?', normal: 'Nobody comes down here who isn\'t on the roster. Which you aren\'t.', blunt: 'Quiet! The Legionnaire in Depot Three walks when it hears boots.' },
    topics: { 'The Quarry': 'I learned the Vance Sequence at fourteen. I asked its author to sign my copy. He did. Then he looked at it for a long time and told me to keep the charts somewhere the Factor would not look.' },
    quest: (g) => {
      if (!g.flags.tobiah_met) { g.flags.tobiah_met = true; g.give('charts'); return { text: 'Take them. The charts, and my copy, Revision Seven, with the margin he wrote in. If he wants them he can have them; I signed on to drill, not to — not to whatever Stage Nine is. The coil he wants is in Depot Three, past the pump-hall. The Legionnaire there murmurs about a blue jug. Don\'t listen to it long.', journal: ['main', 'Tobiah Marsh gave me his charts and the margin copy of Revision Seven. Depot Three lies past the pump-hall.'] }; }
      return null;
    },
  },
  bettany: {
    name: 'Bettany, midwife and tonic-maker', sprite: 'bettany', portrait: 'bettany', tier: 'low', scale: 0.92,
    greet: { polite: 'Softly, love. What ails? I have tonic, I have honey for the throat, and I have shot, which I do not approve of and sell anyway.', normal: 'Tonic\'s five. Honey\'s four. Shot\'s three the three. Keep your voice down while you count.', blunt: 'I hummed half this town into the world. I will not be barked at in my own stall.' },
    topics: { 'Oakhaven': 'I have hummed forty-one births through a clay jar so the hounds would not hear the mother. Forty-one. I keep the count on the stall-post, under the cloth.', 'The Rite': 'They walked her past my stall this morning in white. I put a jar of honey in her hand. The proctor took it off her before the corner.' },
    shop: [{ item: 'tonic', price: 5 }, { item: 'honey', price: 4 }, { item: 'pellets', price: 3 }],
    quest: () => null,
  },
  tam: {
    name: 'Old Tam, the night-hummer', sprite: 'tam', portrait: 'tam', tier: 'low', scale: 0.9,
    greet: { polite: 'Sit if you like. She comes on the water about this time. You will hear her if you keep still.', normal: 'Hm. You are standing where I listen.', blunt: 'Lower your voice. She will not come if you shout.' },
    topics: { 'The Flume': 'My Essa. Forty years dead, near enough; the pox took her the year the old king went into the glass. She used to call me Tammy. Nobody else ever did, before or since. And now something out past the thorn calls me Tammy, three or four nights in the eight, and three nights ago it came up the Flume in her voice, singing The Miller\'s Daughter, which is ours. Mine and hers.', 'The Hedge': 'Everyone says never answer it. I know what they say. I say she gets the second verse right, and the Hedge could not know the second verse.' },
    quest: (g) => {
      if (g.flags.tam_told || g.flags.tam_left) return null;
      { const first = !g.flags.tam_met; g.flags.tam_met = true; return { text: first ? 'You have a listening face. Good. Then listen, and tell me honest: when she sings up the Flume of a night, is it her? Rooke says it is not. Lyra will not say. You are a stranger; you have no reason to be kind to me. Is it her?' : 'He has not moved from the stone. "Well? You heard her too. Is it her?"', journal: ['side', 'Old Tam listens to his dead wife\'s voice on the Flume at the crossing. He asked me, a stranger, to tell him honestly whether it is her.'],
        choices: [
          { t: 'It is not her. It is something wearing her voice.', f: (g) => { g.flags.tam_told = true; return 'He is quiet for a long time. "The second verse," he says at last. "It learned the second verse off me. I sang it to the water the first night, to see." He stands up, old knees, and does not look at the Flume. "Thank you. I will not come down here again. If something has to go singing into the meadow some night, to pull the hounds, it had better be a man who knows the whole song."'; } },
          { t: 'If she gets the second verse right, who am I to say.', f: (g) => { g.flags.tam_left = true; return '"That is what I think," he says, and he settles back onto the stone, and turns his good ear to the water, and you leave him there. Behind you, very faintly, something on the Flume begins the second verse.'; } },
          { t: 'Say nothing, and sit with him a while.', f: (g) => { g.flags.tam_sat = true; g.flags.tam_told = true; return 'You sit. The water comes green and quick under the bridge. After a while a woman\'s voice comes with it, sweet and exactly right, and you feel the old man beside you go still, and then you feel him understand, because you have not moved, and a stranger who had heard his wife would have moved. "Ah," he says. "Ah. Well." He gets up and goes home.'; } },
        ] }; }
    },
  },
  hob: {
    name: 'Abner Fenning, tanner', sprite: 'hob', portrait: 'hob', tier: 'low', scale: 1.08,
    greet: { polite: 'Evening. Mind the vats; the lime does not care who you are.', normal: 'Tannery\'s shut. Nobody wants leather off a town that is turning to wood.', blunt: 'I have buried two apprentices this year. Try me.' },
    topics: { 'The Hedge': 'The twins went down the culvert after their dog. Driftday last. I set a lamp in their window of a night. The key to the grate is on the nail inside; I have not had the stomach to turn it.', 'Oakhaven': 'A tannery is the one trade that gets quieter the harder you work it. Should have been safe. Should have been.' },
    quest: (g) => {
      if (g.flags.twins_found && !g.flags.hob_told) { g.flags.hob_told = true; g.gold(10); return { text: 'You went down. You — their coats. Folded. They folded their coats.' + (g.flags.twins_named ? ' And you wrote them in your book, Ned and Wyn, so they are somewhere. Here. It is all I have on me. Take it, and do not argue with a tanner.' : ' Take this. Take it. I cannot go down there, and now I do not have to.'), journal: ['side', 'I told Abner Fenning what I found under the culvert. He paid me, which I did not ask for, and put out the lamp in the twins\' window.'] }; }
      return null;
    },
  },
  nell: {
    name: 'Nell Carder', sprite: 'nell', portrait: 'nell', tier: 'low',
    greet: { polite: 'He is not to be looked at. Whoever you are. He has a cough.', normal: 'The mill is shut. Say what you want through the door next time.', blunt: 'Get out of my mill.' },
    topics: { 'Oakhaven': 'The Grafters posted the inspection on the Greenhall door. Every child under twelve, hands and feet, Rootday week. Rooke chalks the mark. After the mark they come for you with the saw, and they are kind about it.', 'The Rite': 'Lyra hummed him through the night it started. Spent her whole voice on his hands. She had nothing left for Orla Hale in the morning, and Orla put out roots in her chair while Lyra sat there with her mouth open and nothing coming out.' },
    quest: (g) => {
      if (g.flags.pim_safe) return null;
      if (!g.flags.nell_met) { g.flags.nell_met = true; return { text: 'You have seen his hands, then. Yes. Roots. Rootday. The inspection is the day after tomorrow and Lyra has no voice left to hum him through it a second time, and Bettany is out of honey for the throat. Oiled honey, a jar of it, and Lyra could do it. Or a Cantor could. You are not a Cantor.', journal: ['side', 'Pim Carder has put out roots in his hands. Nell needs oiled honey so Lyra can hum him through the Grafters\' inspection. Bettany\'s stall in the market may have some.'] }; }
      const choices = [];
      if (g.has('honey')) choices.push({ t: 'Give her the oiled honey.', f: (g) => { g.take('honey'); g.flags.pim_safe = true; g.gold(8); return '"Oh," she says, and sits down on the meal-sack. "Oh." She holds the jar in both hands like a warm egg. "Lyra will come tonight. He will pass. He will pass and we will be on the corsair\'s ship before the Rite and nobody will ever chalk his hands." She presses coin on you and will not hear no.'; } });
      if (g.player.songs.includes('tending') && g.player.voice >= 8) choices.push({ t: 'Hum the tending note over his hands yourself.', f: (g) => { g.player.voice -= 8; g.flags.pim_safe = true; g.flags.pim_tended = true; return 'You kneel and hum it low, inside the Narrow, the way the orchard-cantors did it, and the roots in the boy\'s palms draw back under the skin like worms from light. He watches your mouth the whole time. "You do it different from Lyra," he says. Nell does not say anything. She has her apron over her face.'; } });
      if (!choices.length) return { text: 'Honey. Oiled honey, a jar. Bettany at the market. Please.' };
      return { text: 'Well?', choices };
    },
  },
  ignatius: {
    name: 'Ignatius Crane, Flambeau of the Pure Note', sprite: 'flambeau', portrait: 'flambeau', tier: 'high',
    greet: { polite: 'The Note is held. You may speak under it. Quietly, and in tune.', normal: 'This chapel had bells once. The Synod took them for bore-teeth, and it was right to. A bell is a voice with nobody inside it.', blunt: 'I have burned men for less than that tone. I am tired, and the Note is long, and you will not try me again.' },
    topics: { 'The Church': 'Seven years I have held that it let go because one voice shouted. Vance\'s voice. The engineer says it let go because we held. I have thought about his answer every night since he gave it. I do not know yet which of us I would rather be right.', 'The Rite': 'The warrant is read. The Pure Note is held over Oakhaven day and night until the casing. The Hollow behind the tannery is to be burned at the hour of the Rite. The Cantor is in the Church\'s protection, which is a phrase I chose myself, and I meant it, and it is a cell.', 'Kaelen Vance': 'He has a glass arm that sings with the Note whether he wills it or not. I envied him that, for a moment, before I remembered what it is doing to him.' },
    quest: (g) => {
      if (g.flags.ignatius_met && !g.flags.ignatius_gave) { g.flags.ignatius_gave = true; g.give('pellets'); return { text: 'He puts three pellets of glass shot in your hand without looking at them. "The Church does not keep a shop. It gives, once. Do not come back for more."' }; }
      if (!g.flags.ignatius_met) { g.flags.ignatius_met = true; return { text: 'You are the one who goes in and out of the quarry with the engineer\'s charts in your shirt. Do not look at your shirt. I do not want the charts. I want you to know that I know, and that I have chosen, for reasons I will give to my god and not to you, to hold the Note and look at the ceiling.', journal: ['side', 'The Flambeau, Ignatius Crane, knows about the charts and has chosen not to act. The Church holds the Pure Note over the town until the Rite.'] }; }
      return null;
    },
  },
  townsman: {
    name: 'Oakhaven orchardman', sprite: 'townsman', portrait: 'townsman', tier: 'low',
    greet: { polite: 'Evening. Keep it low.', normal: 'Hm?', blunt: 'Lower your voice before something hears you.' },
    topics: {}, quest: () => null, rumour: true,
  },
  townswoman: {
    name: 'Oakhaven goodwife', sprite: 'townswoman', portrait: 'townswoman', tier: 'low',
    greet: { polite: 'Blessings of the Narrow on you. Softly, now.', normal: 'Yes? Quietly.', blunt: 'Hush! The children.' },
    topics: {}, quest: () => null, rumour: true,
  },
  // Umber [PROPOSED]: the Veil runaway in the mist outside the Hedge. Book One keeps Sable in Whisper-Grove until the Kestrel comes.
  umber: {
    name: 'Umber, a runaway of the Veil', sprite: 'sable', portrait: 'townswoman', tier: 'high',
    greet: { polite: "Entry: a stranger, polite, at the wrong end of the continent. Sit. Not there. That is where the proctors will come from.", normal: "I am a day-book, not a cure. Say what you came to say.", blunt: "Precision, please. I was trained to record everything, including the tone." },
    topics: {
      'The Catalogue': "I copied the harvest schedule fair, fourteen times, in a straight hand. Sable designed it. I only made it legible. That is what I was good at.",
      'The Hush': "Entry: the Hush does not take names. It takes the people and leaves the names lying about, like coats. The Catalogue only learned to pick them up.",
      'Kaelen Vance': "I have seen his calibration records; Sable kept them. Two percent survival at Stage Nine, in a very steady hand. He lives outside a hedge now, and I am told the hounds will not touch him.",
      'The Drift-Kestrel': "Eleven consignments to Whisper-Grove. The archivist there holds the manifests and knows the total. I copied the totals and did not add them up. One day she will read it to him, one name at a time.",
      'The Rite': "Stage Nine of the Vance Sequence. Sable filed it. I ruled the lines on the form. 'In white' is in her hand, so that the Cantor would not be mistaken for staff.",
      'The scribe in the mist': "Umber is a Veil designation, as Sable is. She is the last archivist of the Silent Veil, and she is in Whisper-Grove, reading names to the drowned, twenty a night. I was her junior. I could not stay and read with her, and I could not leave either, so I am here, which is neither.",
      'Aether-Glass': "Crystallized song. A voice, bled out and set. I can read the name off a core the way you would read a label off a jar. That is what the Veil trained me for.",
    },
    quest: (g) => {
      const f = g.flags, n = g.ledger.length;
      if (!f.sable_met) {
        f.sable_met = true;
        const tuned = g.player.cls.id === 'archivist' ? " Seven forty-one. You are Veil-tuned. Then you know what these pages cost, and I will not have to explain it twice." : '';
        return { text: "Entry: a stranger, standing in the mist outside the Hedge, at night, which is the one thing every child in Oakhaven is told not to do. I am Umber. These are the Loose Leaves: the Veil's day-pages, which I carried out of the scriptorium under my coat when the Office came for the Bound Ledger and found that Sable had it already. The two grey men in the trees behind you are the Office of the Catalogue, come to take them back." + tuned + " Listen. Every Carillon Legionnaire dies saying a name. That name is a person, folded into a bell. If nobody writes it down, it is gone. Bring me names. Three, to begin with. Kill the Legion if you must; read the crates if you can. Then come back, and I will show you what the leaves can do, and what they charge.", journal: ['side', "Umber, a runaway of the Silent Veil, is hiding in the mist outside the Hedge with the Veil's Loose Leaves. Two Catalogue Proctors are hunting her. She asked me to bring her names — three to begin with. Legionnaires speak them when they die; the crates in the Kestrel's hold murmur them."] };
      }
      if (f.sable_done) return null;
      if (n < 3) return { text: n === 0 ? "Entry: the stranger returns with no names. That is all right. It is not a test you can fail by being slow, only by stopping. The Legion walk the quarry. The crates in the corsair's hold talk, if you put your ear to them." : `Entry: the stranger returns with ${n} name${n === 1 ? '' : 's'}. ${g.ledger.map(l => l.name).join(', ')}. Written. Three, I said. Bring me ${3 - n} more.` };
      const first = g.ledger.slice(0, 3).map(l => l.name).join(', ');
      return { text: `Read them to me. ...${first}${n > 3 ? `, and ${n - 3} more` : ''}. Written, and witnessed. Now the other half. There is a Hollow at the pumps in the quarry, saying something about Mags and Dawnday. I copied his page at the Depot Two intake in the spring of 416; it is leaf nine thousand and six. I can read it back to him, and he will be a man again, for as long as he lasts. But the Veil's leaves keep names only at a price, the same as the Ledger does. For every name I give back, I give up an equal weight of myself. I have three things left: the taste of the Veil's bread, the scriptorium bell at matins, and my own name. Tell me what to do. I would rather it were not me who decided.`,
        choices: [
          { t: 'Give him his name back. Whatever it costs.', f: (g) => sableReturn(g, false) },
          { t: 'You copied the harvest fair. You owe him more than a page.', f: (g) => sableReturn(g, true) },
          { t: 'Keep what is left of you. The names will keep.', f: (g) => { g.flags.sable_done = true; g.flags.sable_kept = true; questXp(40); journal('side', "I told Umber to keep her three fragments. She closed the Veil's leaves on the names I brought her. The Hollow at the pumps is still counting."); return "\"Entry,\" she says. \"The stranger asked me to keep myself. I am recording that you asked.\" She closes the leaves on your names, all of them, carefully, the way you would close a door on a sleeping room. \"I do not know if that was kindness. I will think about it for a long time. Thank you. Go softly.\""; } },
        ] };
    },
  },
};

// ---- intro & ending texts --------------------------------------------------
const INTRO = [
  'It is autumn, in the four hundred and nineteenth year of the Synod Reckoning. Seven years ago the Light let go.',
  'You have come up the Greenroot road to Oakhaven, capital of the Resonant Reach, a town that lives inside a hedge three men deep of thorn and packed wool, planted to swallow its own sounds.',
  'Too loud brings the hounds. Too still brings the Hush. Every child here can skip to the rhyme.',
  'The Church is coming up the road behind you, singing under glass-fire. In nine days it will hold its Pure Note over this town, and a Cantor will be walked down a shaft in white to sing a god to sleep.',
  'Nobody has rung a bell in Oakhaven since the Synod took them all for bore-teeth. Tonight is Nullday, the old rest-day, the day people fear.',
  'Keep your voice in your chest.',
];

const HELP_TEXT = `MOVE  W A S D (any keyboard layout) · Shift runs · Caps Lock toggles always-run
LOOK  click the view to capture the mouse, then just move it (Esc gives it back) · or move it over the view and rest it at a side edge to keep turning · or hold the right button and drag · Q and arrow keys turn · Z levels your gaze · Alt+Enter full screen
ATTACK  left-click to thrust · hold the button and move the mouse to slash or chop · wheel or 1-4 changes weapon · Tab opens song-book
USE / TALK  E or Space · or click when the name under the crosshair is bright (dim means step closer)
PICKPOCKET  Oakhaven adults: face them within arm’s reach and press P to inspect · approach from behind, quietly · Enter attempts theft, Escape leaves · touch Purse / controller Y inspects, A attempts, B leaves · caught or witnessed theft adds bounty
DISGUISE  Buy Synod Clerk Robes from Abner and Wear in Inventory · Y / touch Cover / controller Back opens status and wear/remove · distant Proctors/Legionnaires accept robes; close inspection fills suspicion in 3s; move away before exposure · noise 4+ speeds inspection; witnessed hostile acts break cover per area, saved · combat, monsters, bosses, alarms and bounty arrests still apply
BODIES  Face settled physical remains: G / touch Body / controller left-stick click · Enter/A drags or drops, H/X conceals at a shrouded recess, Escape/B leaves · dragging slows you; visible remains raise one patrol alarm; witnessed dragging adds a watch bounty · remains last for this area visit, not through saves
DISTRACTIONS  O / touch Throw / controller right-stick click opens throws · 1 or A stone, 2 or X empty bottle, Escape or B cancels · aim first; walls stop throws; active combat and bosses cannot be lured
SONGS  F1-F5 cast the song in that slot · N to murmur (keeps the Hush off)
PANELS  I inventory · C character · L logbook · M map · T world map and travel · R rest · K ledger · Esc closes
GEAR  I inventory: Wear / Off armour · AR blunts blows, but heavy armour is loud · 1–9 ready weapons · bronze rings the Cacophony, bolts bite the Quiet
TRADE  talk to merchants (Abner, Vane, Vosk, Tam, Ignatius) and choose Buy… or Sell… · strongboxes and the fallen carry loot
SAVE  Esc (or the SAVE button) opens Options: save to a session slot, copy a save code, or change Controls
SOUND  V sound on/off · B music on/off
TOUCH  left thumb is a stick, right thumb drags to look, tap to use or strike · swipe across STRIKE to slash
COMPANIONS  Part Four: ask Kaelen or Lyra at the camp fire to come with you · G gives orders (follow, wait, keep quiet) · X uses their ability · talk to them for more
THE NARROW  the amber bar — keep it between the two marks. Above: hounds. Below: the Hush. A companion adds a little noise unless told to keep quiet.`;

// ---- merchants ----------------------------------------------------------------
// shop entries: { item, price? } — price defaults to the item's value with the merchant's markup, haggled by Personality.
NPCS.bettany.shopTalk = { hello: 'Tonic, honey, and shot I don\'t approve of. I\'ll take your bits and bobs too, if they\'re clean.', broke: 'Not for what you have in your purse, love.', thanks: ['There. Keep it wrapped.', 'Softly with the coin; it rings.', 'Blessings of the Narrow.'], buys: ['valuable', 'consumable'] };
Object.assign(NPCS.hob, {
  shop: [{ item: 'a_synodrobe' }, { item: 'a_jerkin' }, { item: 'a_gambeson' }, { item: 'a_cap' }, { item: 'a_gloves' }, { item: 'a_softboots' }, { item: 'a_hobnails' }, { item: 'w_knife' }],
  markup: 1.0,
  shopTalk: { hello: 'Leather, then. Oiled so it never creaks; a creak is a word, out there. I\'ll buy hides and gear if it\'s sound.', broke: 'Come back with the coin. The leather will wait. It is good at waiting.', thanks: ['Wear it in slowly.', 'Keep it oiled. Neatsfoot, not lard.', 'It fits. They always fit, in the end.'], buys: ['armor', 'weapon', 'valuable'] },
});
Object.assign(NPCS.vane, {
  shop: [{ item: 'w_axe' }, { item: 'w_crossbow' }, { item: 'bolts', price: 5 }, { item: 'pellets', price: 3 }, { item: 'w_sword' }, { item: 'a_buckler' }, { item: 'a_hobnails' }, { item: 'bottle', price: 8 }],
  markup: 1.1,
  shopTalk: { hello: 'Everything off the Kestrel that isn\'t nailed down, and two things that were. Coin first, friend, I\'m superstitious.', broke: 'That\'s not enough coin for that much sea.', thanks: ['A fine choice. A worse one would have killed you.', 'Drink to it.', 'Mind the spike on that; it\'s for hatches.'], buys: ['armor', 'weapon', 'valuable', 'consumable'] },
});
Object.assign(NPCS.vosk, {
  shop: [{ item: 'a_brig' }, { item: 'a_chain' }, { item: 'a_kettle' }, { item: 'a_gauntlets' }, { item: 'a_greaves' }, { item: 'a_kite' }, { item: 'w_longsword' }, { item: 'w_maul' }, { item: 'w_pistol' }, { item: 'pellets', price: 4 }],
  markup: 1.3,
  shopTalk: { hello: 'The company store. Consortium plate and Synod surplus, at Consortium prices. I will buy salvage at Consortium prices too.', broke: 'Your credit is not extended. It was never extended.', thanks: ['Signed for. Stage Nine thanks you.', 'Serial noted.', 'Do try to return it intact.'], buys: ['armor', 'weapon', 'valuable'] },
});
Object.assign(NPCS.tam, {
  shop: [{ item: 'a_hushcoat' }, { item: 'a_hood' }, { item: 'a_softboots' }, { item: 'whistle', price: 6 }],
  markup: 1.0,
  shopTalk: { hello: 'Essa\'s mother wove for the Hedge. I kept her coats. You can have one if you can keep still in it.', broke: 'Not enough. It is all right. Sit and listen a while instead.', thanks: ['Walk soft in it.', 'She would have liked that you had it.', 'Hm.'], buys: ['valuable'] },
});
// The Church does not keep a shop, and no bell in the Reach escaped the Synod (Book One ch. 1): the chapel's stock is
// the sexton's (R2). Canon has an Oakhaven sexton (ch. 4, ch. 15) but no name; Orrin Pale is the library's [PROPOSED].
// js/chapel27.js stands him in the chapel; Ignatius gives once instead (his quest, above).
NPCS.orrin = {
  name: 'Orrin Pale, sexton', sprite: 'townsman', portrait: 'townsman', tier: 'low',
  greet: { polite: 'Evening. If it is about a burial, I keep the book. If it is about anything else, I keep my voice down.', normal: 'Salt for the paths, a spade for the rest. What do you need?', blunt: 'He looks you up and down the way a sexton measures.' },
  topics: {}, quest: () => null,
  shop: [{ item: 'w_mace' }, { item: 'w_spear' }, { item: 'a_bellhelm' }, { item: 'tonic', price: 5 }],
  markup: 1.1,
  shopTalk: { hello: 'What the old watch left in the crypt, and what the dead have no more use for. The Synod took the bells. It did not think to take the rest.', broke: 'Not enough. The dead can wait; I am afraid I cannot.', thanks: ['Mind the salt on the paths.', 'Use it quietly.', 'I will write it in the book.'], buys: ['weapon', 'valuable'] },
};

// =============================================================================
//  PART THREE — THE FORGETTING: Whisper-Grove, the Cloister of the Lost Choir, the Malting
// =============================================================================
Object.assign(ITEMS, {
  oil: { name: 'Flask of Lamp-Oil', sprite: 'loot', desc: 'Colza oil from the Cloister vestry, still good. Somebody in Whisper-Grove has been lighting dry lamps for three years.', key: true },
  press741: { name: 'Office Hand-Press, 741', sprite: 'loot', desc: 'Forty pounds of iron and brass, a felted die, a dial that reads in Hertz. Ninety seconds, three questions, eight seconds of 741. Kaelen wants to know how it works so that he can learn how to stop one.', key: true },
  returns: { name: 'Calibration Returns', sprite: 'loot', desc: 'Engineer K. Vance, Iron Synod, the Dawning. His own initials against line ninety-four. The Office keeps everything, including other people\'s files.', key: true },
  folder: { name: 'The Grey Arbiterium Folder', sprite: 'loot', desc: 'Dated eight months before the Fracture. "The object of Stage 9 is not extraction. An Anchor will yield without limit if it believes it has been relieved." And: Engineer V. is not to be told.', key: true },
  redcloak: { name: 'The Red Cloak', sprite: 'loot', desc: 'A child\'s choir cloak, red, from the eleventh peg. There is no name-tape in the collar.', key: true },
});

ENEMIES.aegis = { name: 'The Aegis Sentinel', sprite: 'aegis', hp: 120, dmg: [6, 12], speed: 1.0, reach: 1.45, armored: true, chord: true, scale: 1.35, xp: 120,
  desc: 'Nine feet of Catalogue bronze, DEFEND THE SINGERS stencilled across the chest. It stands between you and the risers. The hymn board is behind it.' };

TOPICS['Whisper-Grove'] = {
  low: 'The marble city in the Spectral Woods. The Memory Anchor went silent in four-sixteen and seventy-four thousand people forgot themselves in one night. They say the Hollows still walk the plazas, doing the last thing they did.',
  high: 'The capital of the Spectral Woods, sunk a foot under its own lit water. Seven forty-one is the Memory note. When its Anchor was silenced the Catalogue did not have to harvest Whisper-Grove at all: it only had to walk through and pick the names up off the ground.',
};
TOPIC_KEYS.push('Whisper-Grove');

const PLACES_WG = {
  'The Kestrel\'s mast-ladder': [24.5, 45.0], 'The Sunken Court': [24.5, 22.5], 'The Cloister of the Lost Choir': [19.5, 8.5],
  'The Malting (the Office\'s harvest-house)': [31.0, 5.5], 'Halder Wick\'s table': [32.5, 22.5],
};

// The Cloister's name-tapes, as Lyra reads them in Book One ch. 20: M. ORRY, BEN DRAY, A. SOWERBY, Halloran, two Veskes,
// a Marchant, a Tipp, and a ninth; the tenth collar has only the holes where its tape was. The book does not name the
// ninth; C. Linley and the Veskes' initials are [PROPOSED]. Nobody on the pegs is Halder Wick's (canon pass, 28 Oct).
const CLOISTER_NAMES = ['M. Orry', 'Ben Dray', 'A. Sowerby', 'Halloran', 'E. Veske', 'R. Veske', 'Marchant', 'Tipp', 'C. Linley'];

// how many of her three fragments Sable still holds
// Sable's three fragments (Book One ch. 14, 22): she spends one in the Malting, for Bettis Renn. Umber, in the Reach, has her own.
function sableFragments(g) { const f = g.flags; return 3 - (f.bettis_awake ? 1 : 0); }
function umberFragments(g) { const f = g.flags; return 3 - (f.sable_returned ? 1 : 0); }
// Sable's topics as the archivist of the Veil (Whisper-Grove)
const SABLE_TOPICS = {
  'The Catalogue': "I did not merely sign the catalogue. I designed the harvest schedule. I made it efficient. That is what I was good at.",
  'The Hush': "Entry: the Hush does not take names. It takes the people and leaves the names lying about, like coats. The Catalogue only learned to pick them up.",
  'Kaelen Vance': "I have read his calibration records. Two percent survival at Stage Nine. He wrote that number himself, in a very steady hand, and then he went and lived outside a hedge.",
  'The Drift-Kestrel': "I hold the manifests for every core that captain has carried. Eleven consignments. I know the total. He does not want to. One day I will read it to him, one name at a time.",
  'The Rite': "Stage Nine of the Vance Sequence. I filed it. The Cantor goes down in white because I wrote 'in white' on the form, so that she would not be mistaken for staff.",
  'The scribe in the mist': "Entry: the subject asks the subject about the subject. Sable is a Veil designation. My own name is one of the three things I have left, and I do not spend it on strangers.",
  'Aether-Glass': "Crystallized song. A voice, bled out and set. I can read the name off a core the way you would read a label off a jar. That is what the Veil trained me for.",
};

const SLATES = ['ARE THE HOLLOWS HUNGRY?', 'DO THEY KNOW THEY ARE WALKING?', 'THE CAT IS NOT A HOLLOW. I ASKED IT.', 'THE WATER IS WARM. WHY IS THE WATER WARM.', 'I CAN HEAR THE HYMN. I CANNOT SING IT.'];

Object.assign(NPCS, {
  vane_wg: {
    name: 'Captain Vane of the Drift-Kestrel', sprite: 'vane', portrait: 'vane', tier: 'high',
    greet: { polite: 'Mind the ladder; the third rung is a liar. She\'ll hold at the mast-height as long as the tanks do, and the tanks are not what they were.', normal: 'OK-114, under two coats of paint. She\'s initialled it eleven times, your scribe. I can tell by the way she looks at my hull.', blunt: 'Say it quick. I don\'t like a city that doesn\'t fall down.' },
    topics: {
      'The Drift-Kestrel': 'Twenty-one souls, a hold that murmurs, and a lift-tank with a weep in the seam. She\'ll get us off this water. Further than that I won\'t promise anybody.',
      'The Catalogue': 'One thousand three hundred and forty-two. I know the number now. I didn\'t want to; somebody made me hear it. The Office has me in a file under "reliable, does not ask questions." I am asking questions now. Loudly.',
      'Whisper-Grove': 'I\'ve flown over it twice with cargo. Never put down. You don\'t, here. The Hollows walk out across the water toward the ladder like they\'ve been waiting for a ship, and then they walk back.',
    },
    quest: (g) => {
      const f = g.flags;
      if (f.press_taken) return { text: 'That is a press. That is an Office press, on my ladder, with my registry on the Office\'s books three days behind it. — Good. Get it aboard. When you\'re ready, so am I, and I\'ve been ready since Oakhaven.' };
      if (!f.vane_wg_met) { f.vane_wg_met = true; return { text: 'Whisper-Grove, as ordered. I\'ve put her over the dry marble at the south landing. The scribe will be where the names are thickest: the Sunken Court, north up the causeway. Everyone in the Reach says she can give a Hollow its name back. Everyone in the Reach says a lot of things. Go and find out, and come back up the ladder before the Office does.' }; }
      return null;
    },
  },
  lyra_wg: {
    name: 'Lyra Ashgrove, Cantor of Oakhaven', sprite: 'lyra', portrait: 'lyra', tier: 'high',
    greet: { polite: 'She has no voice at all. She writes on a slate, and turns it to you.', normal: 'She has no voice at all. She writes on a slate, and turns it to you.', blunt: 'She looks at you for a long moment, and does not write anything.' },
    topics: { 'Whisper-Grove': 'She writes: SEVENTY-FOUR THOUSAND. She underlines it. Then she rubs it out with her sleeve, because it is not a thing you can leave written down.', 'Kaelen Vance': 'She writes: HE KEEPS A LIST ON A DECK-BEAM NOW. Then, smaller: SO DID THEY.' },
    quest: (g) => {
      const f = g.flags; let s;
      if (!f.lyra_wg_met) { f.lyra_wg_met = true; s = 'YOU SAID DO IT.'; }
      else if (f.halder_dead && !f.lyra_halder) { f.lyra_halder = true; s = 'HE WAS SETTING A TABLE.'; }
      else if (f.aegis_calmed && !f.lyra_aegis) { f.lyra_aegis = true; s = 'IT KNOWS THE ALTO LINE. WHO TAUGHT IT THE ALTO LINE.'; }
      else if (f.porch_survived && !f.lyra_porch) {
        f.lyra_porch = true;
        return { text: 'She has her chalk in her fist and the slate is already written: <b>IT FOLLOWED US. I HEARD IT FROM HERE. DAD\'S VOICE.</b> She rubs it out with her sleeve. <b>WHAT DID IT SAY TO YOU?</b>', choices: [
          { t: '"Kaelen\'s confession. All of it, in his voice. Ask him."', f: (g) => { f.porch_told_lyra = true; questXp(30); journal('main', 'I told Lyra what the thing at the porch said: Kaelen\'s confession, in his voice. She wrote ASK HIM and then rubbed it out, and did not go and ask him.'); return 'She writes <b>ASK HIM</b> and looks at it for a long time, and then rubs it out, because the moment it exists in chalk it will exist. She does not go and ask him. Not yet.'; } },
          { t: '"Nothing I understood. It\'s gone now."', f: () => { f.porch_lied = true; return 'She watches your mouth while you say it, and then she writes <b>IT\'S GONE NOW</b> on the slate, as if that were what you had said, and keeps it there.'; } },
        ] };
      }
      else s = SLATES[rndi(0, SLATES.length - 1)];
      return { text: `She writes on her slate with a stub of chalk and turns it to you: <b>${s}</b>` };
    },
  },
  kaelen_wg: {
    name: 'Kaelen Vance, the Dissonant Blade', sprite: 'kaelen', portrait: 'kaelen', tier: 'high',
    greet: { polite: 'Listen. Under the water. Seven forty-one, very faint. The presses.', normal: 'This is a dead city that never fell down. That is a statistical anomaly. I do not like anomalies.', blunt: 'My arm locks when that note is struck near it. Keep me away from the grey men, or keep them away from me.' },
    topics: {
      'Whisper-Grove': 'The Memory Anchor. I calibrated its sister in the Dawning. Two percent survival at Stage Nine; I wrote the number down myself. I did not write down Whisper-Grove. I did not have to. It was in the next column.',
      'The Catalogue': 'Every press in the Office is tuned to a note I specified. I would like to see one. I would like to know how it works, so that I can learn how to stop one, and so that I stop dreaming about how it works.',
    },
    quest: (g) => {
      const f = g.flags;
      if (g.has('folder') && !f.folder_decided) {
        return { text: 'You have something in your shirt. You are holding it the way I held Tobiah\'s charts. — Grey. Arbiterium. Show me.', choices: [
          { t: 'Give him the grey folder.', f: (g) => { f.folder_decided = true; f.folder_given = true; g.take('folder'); questXp(40); journal('side', 'I gave Kaelen the grey Arbiterium folder. He read it standing up in a foot of water, twice, and then he folded it into his shirt and said nothing at all.'); return 'He reads it standing in the water. "Engineer V. is not to be told," he reads, aloud, in a perfectly even voice, "because his ear is more accurate when his conscience is not engaged." He reads it again. Then he folds it very small and puts it in his shirt, over the glass. "My first feeling," he says, "was relief. I am recording that I am not entitled to it."'; } },
          { t: 'Keep it. Not yet.', f: (g) => { f.folder_decided = true; f.folder_kept = true; return '"Not yet," he says. "That is fair. That is more than fair. I kept something from Lyra for seven years." He does not ask again.'; } },
        ] };
      }
      if (f.press_taken && !f.kaelen_press) { f.kaelen_press = true; questXp(20); return { text: 'Ninety seconds. Three questions. Eight seconds of seven forty-one. I designed the note; I never once saw the instrument. — It\'s simple. That is the worst thing about it. A child could stop one with a nail through the felt. Nobody ever put a nail through the felt.' }; }
      return null;
    },
  },
  sable_wg: {
    name: 'Sable, Archivist of the Veil', sprite: 'sable', portrait: 'sable', tier: 'high',
    greet: { polite: 'Entry: the stranger is polite in a drowned city. Noted.', normal: 'I am a list, not a cure.', blunt: 'Precision, please. I record everything, including the tone.' },
    topics: Object.assign({}, SABLE_TOPICS, {
      'Whisper-Grove': 'Two hundred and six Hollows in the Sunken Court. I read twenty names a night. Ten years and two hundred and twenty days to finish, and then you start again, because by then the first ones have stopped answering to them.',
    }),
    quest: (g) => {
      const f = g.flags, fr = sableFragments(g);
      if (f.sable_joined) {
        if (!f.aegis_done) return { text: 'The Cloister first. North, past the willows, up the dry steps. I stood in that doorway and counted the children in while they sang Hymn 9. I never counted them out. Something in there still guards the risers. When it stands up, do not run. Look at the board.' };
        if (!f.press_taken) return { text: `The Malting, on the Cloister road, north-east, past the Cloister. I wrote the intake pamphlet. Benches, a water butt, a man who takes your coat at the door so you will not hesitate at the threshold. The presses are at the back. I have ${fr} fragment${fr === 1 ? '' : 's'} left. I am telling you so that you will know what I can spend.` };
        return { text: 'Up the ladder. Entry: the stranger took a press out of an Office harvest-house with an archivist and a choir automaton. I am recording that we were not quick enough to be proud of.' };
      }
      if (f.wg_ambush && !f.wg_ambush_over) return { text: 'Not now. Behind you. Grey oilcloth, silver mesh. Listen for the felt.' };
      if (!f.wg_ambush_over) {
        if (!f.sable_wg_met) { f.sable_wg_met = true; journal('main', 'A Veil scribe called Sable sits at the fountain in the Sunken Court, reading names out of a floating book to the Hollows. She says she is a list, not a cure.'); }
        const tuned = g.player.cls.id === 'archivist' ? ' Seven forty-one. You are Veil-tuned. Then you know what the book costs.' : '';
        return { text: 'Entry: a stranger, wading, at dusk, from a ship whose registry is painted over twice. I read twenty names a night. The Bound Ledger floats at my elbow and pays for what it keeps, weight for weight. I have three fragments left and I recite them nightly, so that I know which one goes.' + tuned + ' You want something. Everyone who wades out to this fountain wants something. I am a list, not a cure. — And the Office is three days behind me. Less, I think. Listen.' };
      }
      const ch = [];
      if (f.crates_heard) ch.push({ t: 'Annet Sowerby. Six years old. She is in a crate in that ship\'s hold, and she asked the Carder boy his name.', f: (g) => joinSable(g, 'annet') });
      ch.push({ t: 'That ship is OK-114. Its hold murmurs. One thousand three hundred and forty-two.', f: (g) => joinSable(g, 'hold') });
      ch.push({ t: 'Then stay with your list.', f: () => '"I will," she says, and opens the Ledger to tonight\'s page.' });
      return { text: 'Entry: three proctors, in the Sunken Court, at dusk. One of them stopped when I read him his own surrendered name. It cost me nothing; it was never mine. — A fourth got away north before you came, with your ship\'s registry. That changes nothing. I still refuse. I am a list, not a cure.', choices: ch };
    },
  },
  halder: {
    name: 'Halder Wick', sprite: 'halder', portrait: 'halder', tier: 'low',
    greet: { polite: '...four plates. The blue one goes there...', normal: '...they will be in directly...', blunt: '...sit, sit, there\'s four...' },
    topics: {},
    quest: (g) => {
      const f = g.flags;
      if (f.halder_done) return { text: f.halder_sat ? 'He sets the blue plate in front of you, again, very carefully, and pats it once, as though you are someone he has been expecting.' : f.halder_told ? 'He sets four plates. When he comes to the blue one he stops, the way he stopped when you told him, and holds it a moment before he puts it down. "...they will be in directly..."' : '...four plates... the blue one goes there... they will be in directly...' };
      return { text: 'A thin old man in a waistcoat, wet to the knee, is setting a table that stands in a foot of lit water. Four plates. He sets them, and lifts them, and sets them again. "...the blue one goes there... they will be in directly... sit, sit, there\'s four..." He has been doing this for three years.', choices: [
        { t: 'Sit down in the fourth chair.', f: (g) => { f.halder_done = true; f.halder_sat = true; questXp(25); journal('side', 'I sat at Halder Wick\'s table in the Sunken Court, in the fourth chair. He set the blue plate in front of me. I did not know what else to do.'); return 'You sit. The water is warm. He sets the blue plate in front of you, very carefully, and pats it once, and for the length of a breath his face is the face of a man whose family has come home. Then he lifts the plate and sets it again.'; } },
        { t: '"They are not coming, Halder."', f: (g) => { f.halder_done = true; f.halder_told = true; questXp(10); return 'He stops with the blue plate in his hands. He looks at you, or at the place where your voice came from. "...they will be in directly," he says, kindly, as if you are the one who has forgotten, and sets it down.'; } },
        { t: 'Leave him to his table.', f: () => 'You leave him setting it. Behind you, plate by plate, he begins again.' },
      ] };
    },
  },
  quist: {
    name: 'Registrar-General Quist', sprite: 'quist', portrait: 'quist', tier: 'high',
    greet: { polite: 'Hot water? There is always hot water. Sit; the chair is clean. People hesitate less when the chair is clean.', normal: 'You are not on my list, which means you are on someone else\'s. Sit down.', blunt: 'Lower your voice. There are people being registered in the next room, and it upsets them.' },
    topics: {
      'The Catalogue': 'We do not harvest, whatever the pamphlets in the Reach say. We relieve. A man walks out of the Greening with his whole life on his back and nowhere to put it down. We take it from him. Most of them look relieved at six seconds.',
      'Whisper-Grove': 'Seventy-four thousand, and not one of them filed. The Hush did that, not us. We are the only people who ever came back to write them down.',
      'The scribe in the mist': 'Sable. I taught her to rule a page. Ruler, nib, blotter; she had the straightest hand I ever saw. She designed the harvest schedule herself, you know. I only signed it.',
    },
    quest: (g) => {
      const f = g.flags, ch = [];
      if (f.press_taken && !f.quist_press) { f.quist_press = true; return { text: 'Take it, then. There are forty more in the store, and the form will say it was requisitioned, and it will be true, because I will sign it. — Tell her I asked after her. Tell her I kept her desk.' }; }
      if (!f.quist_shown) ch.push({ t: 'Show me a pressing.', f: (g) => { f.quist_shown = true; return 'He takes off his spectacles to polish them. "Ninety seconds. Form 9: three questions and no more. Name. Age. Trade. Further speech is not recorded, as it lengthens the queue. Then eight seconds of seven forty-one, under the felt. Most of them look relieved at six. I have never once seen one look frightened afterward. That is not nothing, whatever she has told you."'; } });
      if (!f.quist_alt) ch.push({ t: 'Did you ever once write down an alternative?', f: (g) => { f.quist_alt = true; questXp(15); return 'He considers the question, which is the worst thing he could do with it. "We wrote down everything," he says. "Every name, every coat, every shoe left on every floor. Nobody wrote down an alternative." He puts his spectacles back on. "Nobody was ever asked for one."'; } });
      if (f.sable_joined && !f.quist_sable) ch.push({ t: 'Sable sends her regards.', f: (g) => { f.quist_sable = true; return '"Does she." For the first time he looks old. "She stood in the Cloister door and counted them in. Eleven. She did not count them out; that was not on the form." He pours hot water into a second cup, and sets it at the empty place across the desk, and leaves it there.'; } });
      if (!ch.length) return null;
      return { text: 'Hot water? Sit. You came in by the front door, past the benches and the water butt, and nobody stopped you, because nobody stops anyone at the front door. That was her idea, too.', choices: ch };
    },
  },
  aegis_wg: {
    name: 'The Aegis Sentinel', sprite: 'aegis', portrait: 'aegis', tier: 'low', scale: 1.2,
    greet: { polite: 'DEFEND THE SINGERS.', normal: 'DEFEND THE SINGERS.', blunt: 'Its torso-plates shiver. Then, very softly, it chimes the alto line.' },
    topics: {},
    quest: (g) => {
      const f = g.flags;
      if (!f.aegis_spoke) { f.aegis_spoke = true; return { text: 'It kneels by the empty risers with its great bronze hand over the eleventh peg, where the red cloak hangs. When you come close its torso-plates part a finger\'s width and something inside chimes, very softly, the alto line of Hymn 9. Then: "DEFEND. THE. SINGERS." It looks at you. It is waiting for you to tell it where they are.' + (f.sable_joined ? ' Behind you Sable has gone very still. "WG-forty-one thousand and five," she says, reading its core. "I made his surname illegible. My hand shook." She says nothing else.' : '') }; }
      if (!f.aegis_follow) return { text: 'It is still waiting to be told where the singers are.', choices: [
        { t: '"The singers are on the ship. Come and defend them."', f: (g) => { f.aegis_follow = true; questXp(30); journal('side', 'The Aegis Sentinel of the Cloister will follow us to the Kestrel, carrying the red cloak. It thinks the singers are aboard. In a way, they are.'); return 'It stands. It takes the red cloak off the eleventh peg, gently, the way you would lift a sleeping child, and it chimes once, and it waits for you to lead.'; } },
        { t: 'Leave it with its risers.', f: () => 'It kneels again, its hand over the empty peg. Behind you, as you go, it chimes the alto line to nobody.' },
      ] };
      return { text: 'It holds the red cloak against its chest-plate and chimes, softly, the alto line.' };
    },
  },
  cat: { name: 'A cat', sprite: 'cat', portrait: 'townsman', tier: 'low', scale: 0.38, greet: { polite: 'The cat does not care.', normal: 'The cat does not care.', blunt: 'The cat does not care.' }, topics: {}, quest: () => null },
  lamplighter: { name: 'The lamplighter', sprite: 'hollow', portrait: 'townsman', tier: 'low', greet: { polite: '...the lamps are late tonight...', normal: '...the lamps are late tonight...', blunt: '...the lamps are late tonight...' }, topics: {}, quest: () => null },
  bettis: { get name() { return G.flags.bettis_awake ? 'Bettis Renn' : 'A Hollow with a basket'; }, sprite: 'hollow', portrait: 'townswoman', tier: 'low', greet: { polite: '...I will go second...', normal: '...I will go second...', blunt: '...I will go second...' }, topics: {}, quest: () => null },
});
Object.assign(NPCS.vane_wg, { shop: NPCS.vane.shop, markup: NPCS.vane.markup || 1.1, shopTalk: { hello: 'Same stock, higher prices. We are a long way from anywhere that sells bolts.', broke: 'Credit\'s the Office\'s game. Not mine.', thanks: ['Keep it dry. Everything here is wet.', 'Done. Don\'t tell the scribe what I charged.', 'There. Now get off my ladder.'], buys: ['armor', 'weapon', 'valuable'] } });

function joinSable(g, how) {
  const f = g.flags; f.sable_joined = true; f.wg_plan = true; questXp(60);
  journal('main', 'Sable will come. She says she joins for arithmetic, not hope: the Kestrel can reach the Office\'s harvest-house, the Malting, on the Cloister road, where the presses are. The Cloister of the Lost Choir first, north of the Sunken Court; something in it guards the risers.');
  if (how === 'annet') return 'She closes the Ledger. "Annet Sowerby," she says. "Six. Third crate from the bulkhead. She would not let go of a boy\'s hand at intake, so they put them in together." She stands, and wrings the lit water out of her hem. "Entry: the archivist joins the ship. For arithmetic, not hope. Remember that I said so." Then, quieter: "She is not lost. She is filed. I will tell her that myself."';
  return 'She is quiet for a moment. "OK-114. I initialled that registry eleven times." She stands, and the Ledger rises with her. "Entry: the archivist joins the ship. For arithmetic, not hope. The Kestrel can reach the harvest-house on the Cloister road, where the presses are. Cloister first. Something in it guards the risers, and I left it there."';
}

// ---------------------------------------------------------------- Whisper-Grove, second pass: the Catacombs, the Round, the Wick house
Object.assign(ENEMIES, {
  weaverling: { name: 'Weaverling', sprite: 'weaverling', hp: 14, dmg: [2, 5], speed: 2.1, reach: 0.9, cacophony: true, noiseLure: true, web: true, scale: 0.55, yOff: 0.18, xp: 12,
    desc: 'A spider of static and lilac thread with a cluster of little mouths. Its threads stick, and slow you.' },
  drowned: { name: 'Drowned Hollow', sprite: 'drowned', hp: 26, dmg: [3, 8], speed: 1.4, reach: 1.0, cacophony: true, shriek: true, scale: 1.0, yOff: 0.12, xp: 22,
    desc: 'A Hollow with a Cacophony in it. When it sees you it screams in seventy voices, and everything in the mist hears.' },
  pressman: { name: 'Pressman Mallow', sprite: 'pressman', hp: 80, dmg: [6, 12], speed: 1.2, reach: 1.25, press: true, forget: true, armored: true, scale: 1.2, xp: 90,
    desc: 'Office of the Catalogue, Second Pressings. A hand-press on his back and a round-book on a chain. He does the ones who wander off the register.' },
  weaver: { name: 'The Phantom Weaver', sprite: 'weaver', hp: 150, dmg: [7, 14], speed: 1.3, reach: 1.5, cacophony: true, fearless: true, mimic: true, summon: 'weaverling', web: true, scale: 1.45, xp: 220,
    desc: 'A named horror of the Cacophony. It weaves the voices Whisper-Grove forgot into a shroud, and it speaks in all of them.' },
});
Object.assign(ITEMS, {
  roundbook: { name: 'Mallow\'s Round-Book', sprite: 'loot', desc: 'An Office round-book on a broken chain. SECOND PRESSINGS — WEST QUARTER. Eight names, each with a date, a time, and a tick. Three ticks are still blank.', key: true },
  thread: { name: 'The Weaver\'s Last Thread', sprite: 'loot', desc: 'One lilac thread from the shroud, wound on a finger-bone. It hums in a voice you nearly know. (+10 maximum voice. Hounds hear you a little further.)', key: true },
  adaletter: { name: 'Bryony Wick\'s Letter', sprite: 'loot', desc: 'To the Precentor of the Cloister, from Bryony Wick: Tom and Wat are to sing on Thursday; she has let out their cloaks; please mind Wat on the risers, he leans.', key: true },
});
const FREED_NAMES = ['Corra Bell', 'Simeon Rusk', 'Pip Lawler', 'Agnes Moy', 'Harl Teague'];
const ROUND_NAMES = ['Edda Thorne', 'Baz Kettle', 'Lise Marrow', 'Old Peg Hollis', 'Tobias Venn', 'Mary Quarrie', 'Fen Abbot', 'Isolde Crake'];
Object.assign(PLACES_WG, { 'The Sunken Stair (the Catacombs)': [8.5, 20.5], 'The Wick house': [37.5, 15.5] });

// new hooks wrap the first-pass quest functions, so earlier saves keep working
(() => {
  const sq = NPCS.sable_wg.quest;
  NPCS.sable_wg.quest = (g) => {
    const f = g.flags;
    if (f.sable_joined && f.weaver_dead && f.count_given && !f.count_done) {
      f.count_done = true; FREED_NAMES.forEach(n => g.ledger.push({ name: n, where: 'the Whisper Catacombs', day: g.day })); questXp(80);
      journal('side', 'The Missing Count: I told Sable what was at the bottom of the Sunken Stair. She read the five cut-free Hollows into the Ledger by name, and her count came out right for the first time in a month.');
      return { text: `Entry: the count is right. ${f.cocoons || 0} of the missing walked back up the Sunken Stair this evening, wet to the waist and looking at nothing, and stood in the court where they used to stand. — ${f.shroud_cut ? 'You cut the shroud. I heard it from here; for half a breath the whole city spoke at once. I wrote down as much as I could.' : 'You kept a thread. I can hear it in your pack. It is somebody. I will not ask whom.'} I have put their names in the Ledger: ${FREED_NAMES.join(', ')}. Weight for weight. It was worth it.` };
    }
    if (f.sable_joined && !f.count_given) {
      f.count_given = true;
      journal('side', 'The Missing Count: Sable says her count in the west quarter is short — nineteen names a week read to empty water. Hollows who wander near the Sunken Stair are not coming back. Something below the city is taking them. The stair is in the west quarter, in the drowned house on the far side of the court.');
      return { text: 'Before you go. My count is wrong. In the west quarter I read nineteen names this week to empty water. Hollows do not stop walking their loops; that is what a Hollow is. Unless something takes them. They go missing near the Sunken Stair, in the drowned house west of the court. There are catacombs under Whisper-Grove older than the marble, and something down there has started to sing in borrowed voices. I am a list, not a cure. You, apparently, are something else.' };
    }
    if (g.has('roundbook') && !f.round_done) {
      return { text: 'You have an Office round-book. I can smell the binding glue from here; I helped choose it.', choices: [
        { t: 'Give Sable the round-book.', f: (g) => { g.take('roundbook'); f.round_done = true; f.round_sable = true; ROUND_NAMES.forEach(n => g.ledger.push({ name: n, where: 'Mallow\'s round-book', day: g.day })); questXp(70); journal('side', 'The Pressman\'s Round: I gave Mallow\'s round-book to Sable. Eight names from the west quarter are in the Ledger now, not on the Office\'s second-pressing list.'); return `She reads it standing up, all eight lines, and her face does not change. "${ROUND_NAMES[3]}," she says. "She used to sell eels by the ferry stair. Three ticks still blank." She copies all eight into the Ledger and tears the round-book in half, along the spine, the way you are taught not to.`; } },
        { t: 'Keep it for now.', f: () => '"Keep it dry," she says. "It is the only copy."' },
      ] };
    }
    return sq(g);
  };
  const lq = NPCS.lyra_wg.quest;
  NPCS.lyra_wg.quest = (g) => {
    const f = g.flags;
    if (f.lyra_wg_met && !f.round_hook) {
      f.round_hook = true;
      journal('side', 'The Pressman\'s Round: Lyra saw a huge proctor with a press on his back take a Hollow off the steps in the west quarter. "Second pressings," Sable would call it. He keeps a round-book.');
      return { text: 'She writes fast, and turns the slate: <b>THE BIG ONE WITH THE PRESS ON HIS BACK TOOK A MAN OFF THE STEPS. WEST. THE MAN WAS STILL SAYING HIS NAME.</b> She rubs out NAME and writes it again, bigger.' };
    }
    if (f.mallow_dead && !f.lyra_mallow) { f.lyra_mallow = true; return { text: 'She writes: <b>GOOD.</b> Then she rubs it out, slowly, because she was raised a Cantor, and writes: <b>I AM NOT SORRY.</b>' }; }
    return lq(g);
  };
  const kq = NPCS.kaelen_wg.quest;
  NPCS.kaelen_wg.quest = (g) => {
    const f = g.flags;
    if (f.count_given && !f.weaver_dead && !f.kaelen_weaver) { f.kaelen_weaver = true; return { text: 'Under the west quarter there is something singing in a great many voices at once, very badly, the way a child sings a song it heard through a wall. The Cacophony does not compose. It collects. — Take glass shot, or bronze. And if it sings to you in a voice you know, it is lying. That is all they ever do.' }; }
    return kq(g);
  };
  const qq = NPCS.quist.quest;
  NPCS.quist.quest = (g) => {
    const f = g.flags;
    if (g.has('roundbook') && !f.round_done) {
      return { text: 'That is Inspector Mallow\'s round-book. Mallow is not one of mine; he is on loan from the Arbiterium, and he does second pressings on the ones who wander off the register. I have filed four complaints. They were all relieved.', choices: [
        { t: 'Strike his round off the register. Sign it.', f: (g) => { g.take('roundbook'); f.round_done = true; f.round_struck = true; questXp(70); journal('side', 'The Pressman\'s Round: Registrar-General Quist struck Mallow\'s second-pressing round off the register and signed it. Eight Hollows in the west quarter are on no list at all now.'); return 'He takes out a ruler, and a nib, and draws one straight line through each of the eight names, and signs at the foot in a hand like a fence. "Struck," he says. "They are on no list now, which is the only freedom the Office has ever offered anyone." He blots it. "It is not nothing. Tell her I said it was not nothing."'; } },
        { t: 'Keep it.', f: () => '"As you like. It is evidence of something. Most things are."' },
      ] };
    }
    return qq(g);
  };
})();

// ================================================================ PART FOUR — CODA: the Deep Woods and the Mausoleum of Chords
Object.assign(ENEMIES, {
  horn: { name: 'Office Listening-Horn', sprite: 'horn', hp: 34, dmg: [0, 0], speed: 0, reach: 0.01, horn: true, noiseLure: true, armored: true, scale: 1.0, xp: 30,
    desc: 'A brass ear-trumpet on an iron tripod, with a dial in Hertz. It hunts by sound, and when it hears you it tells everybody.' },
  marine: { name: 'Cutter-Man', sprite: 'marine', hp: 30, dmg: [3, 7], speed: 1.5, reach: 1.1, core: true, grapnel: true, scale: 1.0, xp: 26,
    desc: 'Office boarding crew, grey oilcloth and a grapnel line. They do not chase you. They reel you in.' },
  bosun: { name: 'Bosun Teller', sprite: 'marine', hp: 64, dmg: [5, 10], speed: 1.4, reach: 1.2, core: true, grapnel: true, armored: true, scale: 1.18, xp: 70,
    desc: 'The cutter\'s bosun. He has the hold key on a lanyard round his neck, and he keeps the count.' },
  dirge: { name: 'Dirge', sprite: 'dirge', hp: 24, dmg: [2, 6], speed: 1.0, reach: 1.0, cacophony: true, dirge: true, scale: 0.95, yOff: -0.22, xp: 24,
    desc: 'A Cacophony made of three hundred years of eaten funeral songs. Near it your own voice runs out of you, into the mourning.' },
  warden: { name: 'Chord-Warden', sprite: 'warden', hp: 62, dmg: [6, 12], speed: 0.8, reach: 1.3, armored: true, toll: true, scale: 1.25, xp: 60,
    desc: 'A marble choirmaster who has stood at the Mausoleum\'s graves so long it has started to keep them. Its mouth is open, and something in there sings.' },
  requiem: { name: 'The Requiem', sprite: 'requiem', hp: 170, dmg: [7, 15], speed: 1.25, reach: 1.5, cacophony: true, fearless: true, coda: true, mimic: true, scale: 1.5, xp: 260,
    desc: 'A named horror of the Cacophony that has eaten every funeral office ever sung in the Mausoleum of Chords, and sings them back.' },
  wearer_coda: { name: 'The Wearer', sprite: 'wearer', hp: 140, dmg: [7, 15], speed: 1.5, reach: 1.4, cacophony: true, fearless: true, coda: true, mimic: true, scale: 1.2, xp: 260,
    desc: 'It wears Tobin Ashgrove. It has followed you a hundred miles through the mist, and it has practised everyone.' },
});
WEAPONS.tollhammer = { name: 'Sexton\'s Toll-Hammer', img: 'fp_mace', dmg: [7, 15], reach: 1.35, noise: 3.0, speed: 0.6, type: 'bronze', blunt: true, value: 70,
  desc: 'A bell-ringer\'s hammer of bell-bronze, from the Mausoleum\'s tower. It rings the Cacophony, and breaks marble.' };
Object.assign(ITEMS, {
  w_tollhammer: { name: WEAPONS.tollhammer.name, sprite: 'gear', weapon: 'tollhammer', value: 70, desc: WEAPONS.tollhammer.desc },
  liftsilk: { name: 'Lift-Silk (bolt)', sprite: 'loot', desc: 'A bolt of weaverling silk, light as breath and close as skin. It holds lift-gas better than anything in a chandler\'s.', key: true },
  valve: { name: 'Brass Relief Valve', sprite: 'gear', desc: 'An Office-pattern relief valve off the cutter\'s lift-tank, stamped OK-CATALOGUE. Tobiah will want it.', key: true },
  holdkey: { name: 'The Cutter\'s Hold Key', sprite: 'loot', desc: 'An iron key on a bosun\'s lanyard. TELLER — HOLD, and on the back, scratched with a pin: 432.', key: true },
  register: { name: 'The Mausoleum Register', sprite: 'loot', desc: 'The sexton\'s register of interments, in a careful hand that gets less careful toward the end. The last entry is dated the night the Anchor went quiet.', key: true },
});
TOPICS['The Mausoleum of Chords'] = { low: 'The Synod\'s maps call it a mausoleum. The scribes who lived there called it the House: the old house of the Silent Veil, out in the Woods. They say its tombs still ring if you knock.', high: 'The Mausoleum of Chords is the Synod\'s survey name for the House of the Silent Veil, where the Veil\'s scribes kept the names of the dead for eleven hundred years. Over the door: What is written is not lost. Its own scribes are buried under it, each in stone tuned to the note they kept.' };
TOPICS['The Office cutter'] = { low: 'The grey ship that hunted us by sound. It came down east of here with a tree through its bow.', high: 'An Office courier-cutter, too light to carry anything but paper and proctors, with a listening-horn on the bow. It hunted the murmur of the four hundred and thirty-two in our own hold. Vane put the willow-crown through her. She came down in the woods to the east.' };
TOPIC_KEYS.push('The Mausoleum of Chords', 'The Office cutter');
const PLACES_DW = { 'The Kestrel (the crash)': [27.5, 42.5], 'The Mausoleum of Chords': [27.5, 10.5], 'The Office cutter': [45.5, 24.5], 'The weaver nests': [9.5, 40.5], 'The sexton\'s yard': [10.5, 16.5], 'The hush-lamp shrine': [45.5, 45.5] };
// the House's own dead: Veil scribes, by the designations they held (the library's [PROPOSED] ink and pigment names)
const TOMB_NOTES = [['Scribe Verdigris', 639], ['Scribe Lampblack', 852], ['Scribe Vermilion', 528], ['Scribe Sepia', 741]];
const CODA_VOICES_WEARER = [
  () => '"Lark," it says, in Tobin Ashgrove\'s voice. "Lark, come in now, the house is warm."',
  () => '"Line ninety-four," it says, in Kaelen\'s voice, very tired. "I initialled it. I was sure for three seconds."',
  () => 'It sings the funeral office of Tobin Ashgrove, in Tobin Ashgrove\'s voice, beautifully, a third above her.',
  () => '"I can\'t read, lark," it says, gently. "I only know what was said out loud."',
];
const CODA_VOICES_REQUIEM = [
  () => 'It sings a funeral office for a woman called Marta Hale, in a hundred voices, all of them mourners.',
  () => '"Earth to earth, note to note," it sings, in the voice of a Cantor three hundred years dead.',
  () => 'It sings the calling-song in Lyra\'s own voice, the one she had at twelve, and gets it right.',
  () => '"...he was a good man, he was a good man, he was a good man..." in every voice that ever said it here.',
];

const CAMP = {
  vane_dw: {
    name: 'Captain Vane of the Drift-Kestrel', sprite: 'vane', portrait: 'vane', tier: 'high',
    greet: { polite: 'Ten heartbeats. I counted. This time I didn\'t cut.', normal: 'She\'s on her side in the willows with a hole in her number-three tank you could post a sheep through. We are not leaving by air today.', blunt: 'Don\'t. I know. I put a tree through an Office cutter. It seemed like the thing to do.' },
    topics: {
      'The Drift-Kestrel': 'She\'ll fly. Forty-mile hops, if Tobiah can close the tank and stop the seam weeping. Further than that, she needs a whole new lift-tank, and there\'s only one coast that sells them without asking whose ship it is.',
      'The Office cutter': 'She went down east of here with the willow-crown in her bow. Her listening-horn will still be working; those things outlive their crews. It was our hold she was listening to. Four hundred and thirty-two, murmuring. We\'re a bell. I\'ve been ringing it for two years.',
      'The Mausoleum of Chords': 'North. Big marble thing in a ring of graves. The Cantor wants to go there. I\'m not going to be the man who tells the Cantor no.',
    },
    quest: (g) => {
      const f = g.flags;
      if (!f.dw_vane_met) { f.dw_vane_met = true; journal('main', 'The Lift-Tank: the Kestrel is down in the Deep Woods with her number-three lift-tank holed. Tobiah can patch her for forty-mile hops with three bolts of lift-silk from the weaverling nests in the south-west, and a brass relief valve off the Office cutter that came down in the east.'); return { text: 'Here is the arithmetic. Number-three tank is holed. Tobiah can patch her for hops, if he has silk that holds gas, and the Spectral Woods are full of things that spin exactly that; there are nests in the south-west. He also needs a relief valve, and the nearest one is on the Office cutter I put a tree through, east of here. That will have a horn on it. Mind the horn.' }; }
      if (f.tank_patched && !f.coda_done) return { text: 'Tank\'s closed. She\'ll lift. — The Cantor isn\'t back. I don\'t lift without the Cantor. I\'ve done that sum before.' };
      if (f.tank_patched && f.coda_done) return { text: 'She\'ll lift when you say. Somebody\'s coming up the south road on foot, alone, in white. In my experience that is never good news and always paperwork.' };
      return null;
    },
  },
  tobiah_dw: {
    name: 'Tobiah Marsh, second engineer', sprite: 'tobiah', portrait: 'tobiah', tier: 'high', scale: 0.94,
    greet: { polite: 'Don\'t touch that. Or that. That one you can touch, it\'s already broken.', normal: 'Number-three tank. Look at it. I could weep. I nearly have.', blunt: 'I\'m an engine man in a forest. Say something useful or hold this.' },
    topics: { 'The Drift-Kestrel': 'Three bolts of silk to close the hole and a relief valve to stop her bursting the patch the first time Vane gets clever. Then hops. Forty miles, down, cool the tank, forty miles. It\'ll be like crossing a river on stepping-stones, if the stones were on fire.' },
    quest: (g) => {
      const f = g.flags;
      if (f.tank_patched) return { text: 'She\'s holding. I keep putting my ear to the seam and she keeps holding. I don\'t trust it. I love her.' };
      const silk = g.count('liftsilk'), valve = g.has('valve');
      if (silk >= 3 && valve) return { text: 'Three bolts and an Office valve. Give them here.', choices: [
        { t: 'Hand him the silk and the valve.', f: (g) => { for (let i = 0; i < 3; i++) g.take('liftsilk'); g.take('valve'); f.tank_patched = true; questXp(120); journal('main', 'The Lift-Tank: Tobiah closed the Kestrel\'s number-three tank with weaverling silk and fitted the Office relief valve. She will lift, in forty-mile hops.' + (f.coda_done ? '' : ' Vane will not lift without Lyra. She went north, to the Mausoleum of Chords.')); codaCheckHerald(); return 'He works for an hour without speaking, the silk going on in long careful laps like a bandage, then the valve, then a long low hiss that makes him close his eyes. "There," he says. "There. She\'ll lift. Don\'t tell her I said so; she gets ideas."'; } },
      ] };
      return { text: `I need three bolts of lift-silk — I've got ${silk} — and a relief valve ${valve ? '(and you have the valve, bless you)' : 'off that Office cutter'}. The weaverling nests are south-west. Cut the silk off the webs. Don't let the weaverlings cut anything off you.` };
    },
  },
  mags_dw: {
    name: 'Mags Tennant, bosun', sprite: 'mags', portrait: 'mags', tier: 'high',
    greet: { polite: 'She watches your mouth, not your eyes, and nods once.', normal: 'She watches your mouth. "Slower," she says. "I read lips, not minds."', blunt: 'She looks at you for a long moment and goes back to splicing one-handed.' },
    topics: {
      'The Office cutter': '"It hunts by sound. That horn on the bow hears a man breathe at a hundred yards. I don\'t make any." She grins. "Go quiet, or go fast, and kill the horn first. When it hears you, everybody hears you."',
      'The Drift-Kestrel': '"My collarbone and her number-three tank. One of us will be flying in a week."',
    },
    quest: (g) => {
      const f = g.flags;
      if (!f.mags_met) { f.mags_met = true; return { text: 'One arm in a sling, splicing a line with the other and her teeth. "The machine that broke my collarbone carried me down the ladder after," she says. "So we\'re square." She jerks her head east. "The cutter\'s men grapnel. They don\'t run at you; they throw a hook and reel you in. Keep a tree between you and the line."' }; }
      if (f.bosun_dead && !f.mags_bosun) { f.mags_bosun = true; return { text: '"Teller." She spits. "He counted the crates on and off at Oakhaven every month for two years. He was very polite about it."' }; }
      return null;
    },
  },
  lyra_dw: {
    name: 'Lyra Ashgrove, Cantor of Oakhaven', sprite: 'lyra', portrait: 'lyra', tier: 'high',
    greet: { polite: 'She is sitting on a crate with her slate on her knees, listening to the trees.', normal: 'She is listening north, toward the Mausoleum, with her whole body.', blunt: 'She does not look up.' },
    topics: { 'The Mausoleum of Chords': 'She writes: MY FATHER\'S OFFICE IS IN THE BOOK THERE. THEY BURIED THE TUNE WITH THE CANTORS.' },
    quest: (g) => {
      const f = g.flags, voice = f.lyra_voice;
      if (f.coda_done) {
        if (f.requiem_done) return { text: voice ? '"The House is quiet," she says, in her own ruined voice. "It\'s only a building now. I didn\'t think there was that much of it left in me."' : 'She writes: <b>THE HOUSE IS QUIET. THANK YOU.</b> And underneath, smaller: <b>I WILL GET IT BACK.</b>' };
        if (!f.lyra_requiem) { f.lyra_requiem = true; journal('side', 'The Requiem: Lyra says something older than the Wearer is singing her father\'s office in the choir of the Mausoleum of Chords, in a hundred voices: every office ever sung there. The two-voice coda ends it. Kaelen says the tombs in the hall open the choir, rung high to low.'); return { text: voice ? '"There\'s still something in the Mausoleum singing his office," she says. "Not the Wearer. Something older. It has every office ever sung there, and it has his now." She looks north. "The coda ends them too. It is two voices. When you\'re ready."' : 'She writes fast: <b>SOMETHING IN THE MAUSOLEUM IS STILL SINGING MY FATHER\'S OFFICE.</b> She rubs it out. <b>NOT THE WEARER. SOMETHING OLDER. IT HAS EVERY OFFICE EVER SUNG THERE.</b> Then: <b>THE CODA ENDS THEM. IT IS TWO VOICES. I WILL NEED YOU TO HOLD IT OFF ME.</b>' }; }
        return { text: voice ? '"North," she says. "When you\'re ready. It\'s only a building."' : 'She writes: <b>NORTH. WHEN YOU ARE READY. HOLD IT OFF ME.</b>' };
      }
      if (!f.lyra_dw_met) {
        f.lyra_dw_met = true;
        journal('main', 'Coda: Lyra says the Wearer followed us out of Whisper-Grove. It is out there in the woods, singing her father\'s funeral office in his voice, and she means to kill it tonight: a ring of lamps at the edge of the clearing, and the office sung at full voice, alone, so that it comes. ' + (voice ? 'Talk to her when you are ready.' : 'She has no voice to sing it with. Kaelen knows why.'));
        return { text: 'She writes, and her hand is shaking: <b>IT FOLLOWED US.</b> She points north, into the trees. <b>I CAN HEAR IT. IT IS SINGING DAD\'S OFFICE OUT THERE IN DAD\'S VOICE.</b> She rubs it out. <b>IT WON\'T COME WHERE PEOPLE ARE. IT WANTS ME ALONE. SO I AM GOING TO BE ALONE, AT THE EDGE OF THE TREES, INSIDE A RING OF LAMPS, AND SING IT THE WHOLE OFFICE. AND YOU GET ONE STRIKE.</b>' + (voice ? '' : ' Then, smaller: <b>I NEED MY VOICE.</b>') };
      }
      if (f.ring_set) return { text: voice && !f.coda_by_you ? '"The lamps are set. I\'ll be past the last one, between the willows. Come when you\'re standing inside the ring, and not before. And stay inside it, whatever it says in whose voice."' : f.coda_by_you ? 'She writes: <b>THE LAMPS ARE SET. STAND PAST THE LAST ONE, BETWEEN THE WILLOWS, AND SING. DO NOT STOP. DO NOT STEP OFF IT.</b>' : 'She writes: <b>THE LAMPS ARE SET. STAND INSIDE THEM. I WILL BE PAST THE LAST ONE.</b>' };
      if (!voice) return { text: 'She writes: <b>I HAVE NO VOICE. I KNOW.</b> She looks at Kaelen across the fire, and then back at you. <b>SOMETHING IS SITTING ON IT.</b> Then: <b>IT IS TWO VOICES. YOU KNOW THE TUNE. I TAUGHT THE WHOLE REACH THE TUNE.</b>', choices: [
        { t: 'Sing it yourself: stand past the last lamp tonight. (Your voice drains while you hold it)', f: (g) => { f.coda_by_you = true; return ringPlan(g); } },
        { t: 'Not yet. Her voice first.', f: () => 'She nods, once, and looks at Kaelen across the fire, and does not write anything.' },
      ] };
      return { text: '"And I\'m going to kill it tonight," she says, in her own ruined voice. "A ring of lamps at the edge of the trees. I\'ll be outside the last one. You\'ll be inside them, and so will Kaelen, and you get one strike, when it\'s inside the lamps and not before."', choices: [
        { t: 'Set the ring of lamps tonight.', f: (g) => { f.coda_by_you = false; return ringPlan(g); } },
        { t: 'Not tonight.', f: () => '"Tonight," she says. "Or next week, when I\'m asleep. I know which I\'d rather."' },
      ] };
    },
  },
  kaelen_dw: {
    name: 'Kaelen Vance, the Dissonant Blade', sprite: 'kaelen', portrait: 'kaelen', tier: 'high',
    greet: { polite: 'He is sitting with his back to the wreck, his glass arm across his knees, not looking at Lyra.', normal: 'Seven forty-one is gone. I can hear the woods instead. They are very loud.', blunt: 'Not now.' },
    topics: { 'The Mausoleum of Chords': 'Tuned stone. Every Cantor of the Memory Anchor, each in a tomb that rings the note they kept. Ring them in the order you would sing them home, high to low, and the choir opens. I know because I read the specification. I read all the specifications.' },
    quest: (g) => {
      const f = g.flags;
      if (f.lyra_voice || f.kaelen_dw_done) return { text: f.kaelen_told_now ? 'I told her everything. Out loud. She said she would have forgiven me on Rootday, and cannot now. It is the kindest thing anyone has said to me in two years, because it is true.' : f.porch_told_lyra ? 'She knows. She has known since the Cloister porch. I am the last person to find out what I am.' : 'She does not know. Nobody has told her, and the one thing that could have cannot read.' };
      return { text: 'She needs her voice for the coda, and she has not got it, and I know why. It is sitting on something I have not said.' + (g.has('folder') ? ' And you have the grey folder.' : ''), choices: [
        { t: '"Tell her. Everything. Out loud."', f: (g) => { f.kaelen_dw_done = true; f.kaelen_told_now = true; f.lyra_voice = true; questXp(80); journal('side', 'Coda: Kaelen told Lyra everything at the fire, out loud — the calibration, line ninety-four, the grey folder, and that his first feeling on reading it was relief. Her voice came back at the worst possible moment, and the first thing she did with it was tell him she would have forgiven him on Rootday, and cannot now.'); return 'He goes across the fire and sits down in front of her, and tells her: the calibration, line ninety-four, the girl bleeding into her collar on the ninth morning, the three seconds he spent being sure' + (g.has('folder') || f.folder_given ? ', the grey folder he was going to burn, and that his first feeling on reading it was relief' : '') + '. It takes a long time. When he stops, Lyra opens her mouth, and her voice comes back at the worst possible moment. "I would have forgiven you on Rootday," she says. It is a ruin of a voice, and it is hers. "I can\'t now. You let me pick you up without saying how heavy you were." Then she takes the glass hand, not the easy one.'; } },
        { t: '"Not yet."', f: () => '"No," he says. "Not yet. That is what I always say."' },
      ] };
    },
  },
  sable_dw: {
    name: 'Sable, Archivist of the Veil', sprite: 'sable', portrait: 'sable', tier: 'high',
    greet: { polite: 'Entry: the Deep Woods. One wreck, twenty-six souls, a press, and me.', normal: 'Two things left in the inventory, and the third does not feel like a gap. It feels like a shelf.', blunt: 'I am counting. Wait.' },
    topics: { 'The Office cutter': 'A courier-cutter cannot carry anything heavier than paper and proctors. She was not carrying; she was listening, to four hundred and thirty-two cores murmuring in our hold. If there is anything under her hatch it is evidence: the Office seizes vox-bottles off the Rust Coast boats. If you open that hold, do not unstopper them in the dark. Quiets come through an open bottle like water through a sluice.' },
    quest: (g) => {
      const f = g.flags;
      if (f.bottles_done && !f.sable_bottles) { f.sable_bottles = true; return { text: f.bottles_kept ? 'Twelve seized vox-bottles in the hold of a ship that cannot lift a cat, beside four hundred and thirty-two cores. Tobiah has stopped speaking to you. I have started a list. I will need a larger book.' : 'You unstoppered them. I heard it from here: twelve people saying one sentence each, and then the woods were very quiet, and then something else was. I have written down the ones I heard.' }; }
      if (!f.sable_dw_met) { f.sable_dw_met = true; return { text: 'The Office cutter was a courier: four hard little tanks and nothing in her hold but forms. She found us by the murmur of our own crates. If there is anything under her hatch, it will be seized goods held for the Hall of Carriage; I filled in those forms for six years. The bosun keeps the hold key round his neck. It is in the regulations, and I wrote the regulations.' }; }
      return null;
    },
  },
  aegis_dw: {
    name: 'The Aegis Sentinel', sprite: 'aegis', portrait: 'aegis', tier: 'low', scale: 1.2,
    greet: { polite: 'DEFEND THE SINGERS.', normal: 'DEFEND THE SINGERS.', blunt: 'Its torso-plates shiver. Then, very softly, it chimes the alto line.' },
    topics: {},
    quest: (g) => {
      const f = g.flags;
      if (f.cloak_given) return { text: 'It stands at the edge of the firelight between the camp and the dark, facing out. DEFEND THE SINGERS. It is.' };
      // Without Sable at the fire nobody can tell it what the cloak was; the thread still ends (R1: it used to dead-end)
      if (!f.sable_with) {
        if (f.cloak_kept) return { text: 'It stands at the edge of the firelight with the red cloak against its chest, facing out. DEFEND THE SINGERS.' };
        return { text: 'It holds the red cloak against its chest and faces the dark, between the fire and the trees. Whoever could have told it what the cloak was is not at this fire.', choices: [
          { t: 'Sit with it a while.', f: (g) => { f.cloak_kept = true; questXp(30); journal('side', 'The Red Cloak: there is nobody at the fire who can tell the Aegis whose cloak it holds. I sat with it a while, and it chimed the alto line, and went on facing the dark. That will have to do.'); return 'You sit at its feet a while. After a long time it chimes the alto line, very softly, and goes on facing the dark.'; } },
          { t: 'Leave it to the dark.', f: () => 'It faces the dark.' },
        ] };
      }
      return { text: 'It stands by the wreck holding the red cloak, facing out. Sable is watching it from the other side of the fire. ' + (f.aegis_how === 'sable' ? 'She has not spoken to it since she sang it Hymn 9 in the Cloister.' : 'She has not spoken to it since the Cloister.'), choices: [
        { t: 'Ask Sable to tell it what she knows.', f: (g) => { f.cloak_given = true; questXp(60); journal('side', 'The Red Cloak: Sable told the Aegis what she knows and cannot read — that it was a boy of the Cloister choir, WG-41,005, and that her own hand made his surname illegible — and promised to find his name in the Organum. It gave her the red cloak.'); return 'Sable comes round the fire and stands in front of nine feet of bronze and tells it, in her form-reading voice, what she knows and cannot read: an intake number, WG-41,005; a boy of the Cloister choir; a surname her own shaking hand made illegible, eleven days in a doorway; a girl in a red cloak who would not let go of him. "I will find your name in the Organum," she says. "Third floor, the Hall of Carriage. I know where it is filed." The Aegis looks at her for a long time. Then it kneels, and holds out the red cloak, and she takes it.'; } },
        { t: 'Leave them be.', f: () => 'It faces the dark. Sable faces the fire. Neither of them moves.' },
      ] };
    },
  },
  sexton: {
    name: 'A Hollow sexton', sprite: 'sexton', portrait: 'townsman', tier: 'low',
    greet: { polite: '"...one more before the light goes... one more..."', normal: '"...deep enough... not deep enough... one more..."', blunt: 'He does not stop digging.' },
    topics: {},
    quest: (g) => {
      const f = g.flags;
      if (f.sexton_rest) return { text: 'Amos Fell sits on the edge of the filled grave with his spade across his knees and his cap in his hands, beside the headstone that says NAN. He is not digging. Every so often he pats the earth, the way you would pat a hand.' };
      if (!g.has('register')) { if (!f.sexton_met) { f.sexton_met = true; journal('side', 'The Sexton\'s Grave: an old Hollow in the graveyard west of the Mausoleum is digging a grave that has been dug and filled and dug again for three years. The headstone over it has no name yet. The Mausoleum keeps a register of interments.'); } return { text: 'A Hollow in a gravedigger\'s smock is digging a grave that has been dug and filled and dug again until the spoil-heap is taller than he is. "...one more before the light goes..." The headstone over it is new marble, with a bell carved on it, and no name.' }; }
      return { text: 'You have the Mausoleum register. The last entry, in a hand that gets less careful toward the end, reads: <i>Nan Fell, wife of the sexton, interred the 3rd of Memoryday 416, by A. Fell. Headstone to follow.</i> Under it, in the same hand, smaller, nothing else at all.', choices: [
        { t: 'Read him the last entry, out loud.', f: (g) => { f.sexton_rest = true; g.take('register'); questXp(70); if (!G.player.weapons.includes('tollhammer')) G.player.weapons.push('tollhammer'); G.ledger.push({ name: 'Amos Fell, sexton', where: 'the Mausoleum of Chords', day: G.day }); journal('side', 'The Sexton\'s Grave: I read the Hollow sexton the last entry in his own register: his wife, Nan Fell, interred the day the Anchor went quiet, by A. Fell. He had buried her that morning and forgotten by the evening, and he had been digging her grave ever since. He stopped. He gave me the toll-hammer from the bell-tower.'); return 'You read it to him, slowly. "Nan Fell, wife of the sexton, interred the third of Memoryday, by A. Fell." The spade stops. He looks at the headstone for a long time. "...I did that," he says. "...I did that in the morning." He climbs out of the grave, and fills it, carefully, the last time, and sits down on the edge with his cap in his hands. After a while he reaches into his smock and gives you a bell-ringer\'s hammer of old bronze, as if it is the next thing on a list. "...for the tower," he says. "...nobody rings it now." (You ready the Sexton\'s Toll-Hammer.)'; } },
        { t: 'Leave him to his digging.', f: () => '"...one more before the light goes..."' },
      ] };
    },
  },
  herald: {
    name: 'A Synod herald', sprite: 'herald', portrait: 'herald', tier: 'high',
    greet: { polite: 'He has walked nine miles alone, and he is going to read it aloud, because the form requires it.', normal: 'He unrolls the writ. His hands shake the entire time, and he does not let it get into his reading.', blunt: 'He waits for you to finish, and then he unrolls the writ.' },
    topics: {},
    quest: () => { codaHerald(); return { text: 'He clears his throat, and begins.' }; },
  },
};
Object.assign(NPCS, CAMP);

// ---------------------------------------------------------------- Part Four, second pass
Object.assign(ENEMIES, {
  broodmother: { name: 'The Brood-Mother', sprite: 'broodmother', hp: 96, dmg: [5, 11], speed: 1.1, reach: 1.3, cacophony: true, fearless: true, web: true, summon: 'weaverling', scale: 1.25, yOff: 0.1, xp: 120,
    desc: 'The queen of the nests. Her egg-sac is full of small faces, and every few breaths one of them gets legs.' },
});
NPCS.mourner = {
  name: 'A Hollow mourner', sprite: 'mourner', portrait: 'townswoman', tier: 'low',
  greet: { polite: '"...lilies for the Cantor... lilies..."', normal: '"...we\'re late... the bell hasn\'t gone..."', blunt: 'She walks past you with her lilies.' }, topics: {},
  quest: (g) => ({ text: g.flags.bell_rung ? 'She is kneeling at a grave with her lilies laid out on it in a careful row, and she is not walking any more. "...there," she says, to no one. "...there now."' : 'A Hollow in a black veil, carrying a bunch of pale lilies that glow faintly. She walks from the yard to the Mausoleum door and back, and back, waiting for something. "...the bell hasn\'t gone..." she says. "...we can\'t start till the bell..."' }),
};
TOPICS['Vesper'] = { low: 'Never heard the name.', high: 'The first mate of the Wave-Cutter, in 414. She went into a tonal trench with the tow. Captain Vane held the axe for ten heartbeats before he cut the hawser. Forty-eight men lived.' };
TOPIC_KEYS.push('Vesper');
Object.assign(ITEMS, {
  cutterlog: { name: 'The Cutter\'s Log', sprite: 'loot', desc: 'OC-742\'s log, in an Office hand. TASKED: follow DK by sound from Oakhaven. REPORT TO: the Arbiter\'s column, Tramway, ninth day. CARGO: none; held, 12 seized vox-bottles. The bosun\'s count of DK\'s hold: 432. The last line is not finished.', key: true },
});
PLACES_DW['The bell-tower (in the Mausoleum)'] = [27.5, 10.5];
(() => {
  const vq = NPCS.vane_dw.quest;
  NPCS.vane_dw.quest = (g) => {
    const f = g.flags;
    if (f.dw_vane_met && !f.vane_vesper && (f.tank_patched || f.coda_done || f.bottles_done)) {
      return { text: 'He is sitting on an upturned crate with the boarding axe across his knees, cleaning a blade that is already clean. "You know what I was counting, on the cutter," he says. "Ten. It was ten last time too. Her name was Vesper."', choices: [
        { t: '"Tell me about her."', f: (g) => { f.vane_vesper = true; questXp(40); journal('side', 'Vesper: at the fire Vane told me about the Wave-Cutter, in 414. A tonal trench opened under the tow and he held the axe for ten heartbeats, looking at his first mate, Vesper, through the spray. Then he cut the hawser. Forty-eight men lived. This time, with the cutter\'s grapnel in our rail, he did not cut.'); return '"First mate of the Wave-Cutter. Better sailor than me; worse liar. A trench opened under the tow and the hawser went bar-taut, and I had the axe, and I looked at her through the spray for ten heartbeats, and she nodded. So I cut it. Forty-eight men lived. She went down with the tow." He turns the axe over. "I have been telling myself for five years that nothing matters enough to die for. It is a very comfortable thing to believe. It nearly worked."'; } },
        { t: '"You didn\'t cut it this time."', f: (g) => { f.vane_vesper = true; f.vane_stays = true; questXp(50); journal('side', 'Vesper: I told Vane he did not cut the line this time. He said he has been looking for a ship that can sail past the edge of the world for five years, and it turns out what he needed was a reason to stay.'); return 'He looks at you for a long time. "No," he says. "I didn\'t." He puts the axe down on the moss, beside the crate, not across his knees. "Five years I have been looking for a ship that would go past the edge of the world, so I would never have to choose again. Turns out you just stay. That\'s the whole trick. You stay, and you don\'t cut." He gets up. "Don\'t tell Mags I said anything sensible. She reads lips."'; } },
      ] };
    }
    return vq(g);
  };
  const kq = NPCS.kaelen_dw.quest;
  NPCS.kaelen_dw.quest = (g) => {
    const f = g.flags;
    if (f.log_read && !f.kaelen_log) { f.kaelen_log = true; return { text: '"Follow DK by sound from Oakhaven." He says it twice. "They had a horn on us the whole way. Every word anybody said aboard that ship since the Reach, they heard. Every name Sable read." He looks at his glass hand. "The Arbiter\'s column is on the Tramway. Nine days. Aurelian Vaelen does not hurry, because he does not need to."' }; }
    return kq(g);
  };
  const sq = NPCS.sable_dw.quest;
  NPCS.sable_dw.quest = (g) => {
    const f = g.flags;
    if (f.log_read && !f.sable_log) { f.sable_log = true; return { text: 'Entry: the Office knew where we were for a hundred miles, and did not take us, because it wanted to know where we were going. That is not a hunt. That is a census. — The last line of the log is not finished. It says <i>DK making for</i>. Nobody knew. That is the only reason we are alive.' }; }
    return sq(g);
  };
})();
(() => {
  const xq = NPCS.sexton.quest;
  NPCS.sexton.quest = (g) => {
    const f = g.flags;
    if (f.sexton_rest && !f.bell_rung && !f.sexton_bell) {
      f.sexton_bell = true;
      journal('side', 'The Tower Bell: Amos Fell says nobody has rung the great bell in the Mausoleum\'s tower since Nan was buried. The rope is cut; you ring it with the hammer. The stair is in the east wing, under the tower.');
      return { text: 'He turns his cap over in his hands. "...nobody rang her down," he says. "...the bell. In the tower. I cut the rope myself, after, so nobody would ring it for anybody else and I\'d have to hear it." He looks at the toll-hammer on your belt. "...that\'s what that\'s for. You don\'t pull that bell. You strike it. Three times for a death. The stair is in the east wing, under the tower... the mourners have been waiting three years for it to go."' };
    }
    return xq(g);
  };
})();

// ---------------------------------------------------------------- Part Four, third pass: the Quiet Faith, the search party
Object.assign(ENEMIES, {
  tongueless: { name: 'Tongueless of the Quiet Faith', sprite: 'tongueless', hp: 30, dmg: [4, 9], speed: 1.5, reach: 1.1, scale: 1.0, xp: 26,
    desc: 'A brother of the Quiet Faith. He cut out his own tongue to be already quiet. He makes no sound at all when he runs.' },
  deacon: { name: 'The Deacon of the Unrung Bell', sprite: 'deacon', hp: 110, dmg: [6, 12], speed: 1.2, reach: 1.2, scale: 1.15, xp: 140, wilds: true, deaconAura: true, wildsBoss: true,
    desc: 'He carries a bell with no clapper. When he lifts it, nothing rings, and nothing near him can.' },
  outrider: { name: 'Office Outrider', sprite: 'outrider', hp: 30, dmg: [3, 7], speed: 1.4, reach: 1.1, core: true, scale: 1.0, xp: 30, wilds: true, crossbow: true,
    desc: 'A crossbowman of the Arbiter\'s column, in a grey oilskin. He would rather shoot you from forty feet than meet you at four.' },
  hushwarden: { name: 'Office Hushwarden', sprite: 'hushwarden', hp: 48, dmg: [5, 10], speed: 1.0, reach: 1.3, core: true, armored: true, scale: 1.1, xp: 40, mute: true,
    desc: 'A felted iron bell on a staff. When it comes down on you, the sound goes out of your mouth for a while, and you cannot sing.' },
  hushmoth: { name: 'Hush-Moths', sprite: 'hushmoth', hp: 12, dmg: [1, 3], speed: 1.9, reach: 0.9, hushkin: true, moth: true, scale: 0.8, yOff: -0.15, xp: 10,
    desc: 'Pale moths of the Hush, drawn to light. They eat the light first and then the sound. Glass shot cannot ring in them.' },
  captain: { name: 'Outrider-Captain Hal Brennick', sprite: 'captain', hp: 130, dmg: [6, 13], speed: 1.3, reach: 1.25, core: true, scale: 1.1, xp: 160, wilds: true, rally: true, wildsBoss: true,
    desc: 'The officer the Arbiter\'s column sent to find out why OC-742 stopped reporting. He carries a lit hush-lantern and a sabre, and he is not in a hurry.' },
});
Object.assign(LOOT, {
  tongueless: { chance: 0.4, table: [['whistle', 40], ['honey', 30], ['sovereigns', 30]] },
  outrider: { chance: 0.6, table: [['bolts', 40], ['sovereigns', 30], ['tonic', 15], ['a_hood', 8], ['w_crossbow', 7]] },
  hushwarden: { chance: 0.6, table: [['a_hushcoat', 25], ['sovereigns', 35], ['a_kettle', 15], ['w_mace', 10], ['tonic', 15]] },
  hushmoth: { chance: 0.15, table: [['v_fork', 60], ['honey', 40]] },
});
Object.assign(ITEMS, {
  unrungbell: { name: 'The Unrung Bell', sprite: 'loot', desc: 'A Quiet Faith handbell with no clapper. The Deacon of the Unrung Bell carried it. It has never made a sound.', key: true },
  hornwax: { name: 'The Horn\'s Wax Cylinder', sprite: 'coil', desc: 'The listening-horn\'s recording cylinder, from the wrecked cutter. Wound and set going, it plays back everything the horn heard: your voices, the whole way from Oakhaven.', key: true },
  dispatch: { name: 'The Arbiter\'s Dispatch', sprite: 'loot', desc: 'From the column of the Dread Arbiter, on the Tramway: find the DK and keep listening. The Cantor is not to be harmed. Signed A.V.', key: true },
});
NPCS.wren = {
  name: 'A child, singing', sprite: 'wren', portrait: 'wren', tier: 'low', scale: 0.72,
  greet: { polite: 'She does not stop singing.', normal: 'She does not stop singing.', blunt: 'She does not stop singing.' }, topics: {},
  quest: () => ({ text: 'She does not stop singing.' }),
};
NPCS.wren_dw = {
  name: 'Linnet', sprite: 'wren', portrait: 'wren', tier: 'low', scale: 0.72,
  greet: { polite: '"Hello," she says, very loudly, and then, remembering, much more quietly: "hello."', normal: '"Hello," she says, very loudly, and then, remembering, much more quietly: "hello."', blunt: 'She looks at you, and at your weapon, and decides you are all right.' },
  topics: {
    'The Quiet Faith': '"They don\'t talk. Mam said that\'s holy. Mam said if I sang nice the Quiet would come and be kind to me." She thinks about it. "It wasn\'t going to be kind, was it."',
    'Lyra Ashgrove': '"She\'s teaching me the skipping one. Too loud brings the hounds, too still brings the Hush." She hops, twice, very softly. "You have to be in the middle. That\'s called the Narrow."',
  },
  quest: (g) => ({ text: g.flags.coda_done ? 'Linnet is sitting by the fire, humming the skipping-rhyme under her breath, exactly in the middle of the Narrow. "Lyra says I can be a Cantor," she says. "If there are any Cantors left."' : 'Linnet is sitting by the fire, as close to Lyra as she can get without being in her lap. "She says I sing too loud," she whispers. "She says that\'s a good problem."' }),
};
TOPICS['The Quiet Faith'] = { low: 'Them in the woods who cut their tongues out. Don\'t look at them.', high: 'A rural cult in siphoned country that worships the Hush as the Merciful Quiet. Its faithful cut out their own tongues to be "already quiet", and they leave children who sing in the woods as hush-gifts. They are right that the Hush is quiet. They are wrong about everything else.' };
TOPIC_KEYS.push('The Quiet Faith');
PLACES_DW['The singing child (north-west, past the pools)'] = [6.0, 5.0];
PLACES_DW['The north-east cart-track'] = [47.0, 8.0];
(() => {
  const mq = NPCS.mags_dw.quest;
  NPCS.mags_dw.quest = (g) => {
    const f = g.flags;
    if (f.gift_heard && !f.mags_cant && f.mags_met) {
      return { text: '"The singing in the north-west." She has been watching your mouth. "That\'s the Quiet Faith. Tongueless. They don\'t talk, they sign. Hand-cant. Same as the dock-crews of the Free Captains, near enough. I learned it when I stopped hearing." She puts the splice down. "Want it? Three signs and one sentence. Might keep you from having to kill a man with no tongue, which is a bad business all round."', choices: [
        { t: '"Teach me."', f: () => { setTimeout(() => { closeModal(); wildsCantQuiz(0); }, 0); return 'She holds up her good hand.'; } },
        { t: '"Later."', f: () => '"Later\'s fine. They\'re not going anywhere. That\'s rather their point."' },
      ] };
    }
    return mq(g);
  };
  const vq = NPCS.vane_dw.quest;
  NPCS.vane_dw.quest = (g) => {
    const f = g.flags;
    if (f.log_read && f.dw_vane_met && !f.party_come) {
      const ch = [
        { t: '"Then we meet them on the track."', f: () => { wildsPartyCome(false); return '"Good." He stands up and hefts the boarding axe. "North-east, where the cart-track comes out of the mist. The Captain will carry the lantern. Kill the lantern and you kill the column\'s eyes. Mind the ones with the felted bells. They take your voice, and a Cantor\'s crew with no voice is a crew of corpses."'; } },
      ];
      if (f.horn_dead) ch.push({ t: '"The horn heard everything we said. Let them follow it."', f: () => { G.give('hornwax'); wildsPartyCome(true); return 'He stares at you, and then he laughs, once, quietly. "The cylinder. It\'s still in the horn." He goes and gets it himself and puts it in your hand: brass and wax, wound tight. "Every word since Oakhaven. Set it going in the thickest of the webs, south-west, where the weaverlings nest, and let the Office follow its own ears. They have been very proud of those ears."'; } });
      return { text: 'Vane is on his feet, looking north-east through the willows with the glass. "Lanterns," he says, and hands it to you. Through it: a line of hooded lights on the cart-track, coming out of the mist, slow. "The cutter didn\'t report. The Arbiter has sent somebody to find out why. A captain, by the lantern, and a file of outriders." He takes the glass back. "They will find the wreck by morning and us by noon."', choices: ch };
    }
    return vq(g);
  };
})();
