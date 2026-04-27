/* ============================================================
   IMPERIUM — data.js
   All game definitions: factions, regions, buildings, units
   ============================================================ */
'use strict';

// ── FACTIONS ──────────────────────────────────────────────────
const FACTIONS = {
  romans: {
    id: 'romans', name: 'Roman Empire', adjective: 'Roman',
    color: '#8b1a1a', fillOpacity: 0.55, border: '#3a0505',
    bonuses: { goldMult: 1.2 }, isPlayable: true,
    startGold: 800, startFood: 1000, startWood: 300, startStone: 150, startIron: 80,
    homeTerritories: ['italy']
  },
  persians: {
    id: 'persians', name: 'Persian Empire', adjective: 'Persian',
    color: '#c9940a', fillOpacity: 0.55, border: '#5a3a00',
    bonuses: { armySpeed: 1.2 }, isPlayable: true,
    startGold: 1000, startFood: 800, startWood: 200, startStone: 200, startIron: 100,
    homeTerritories: ['iran']
  },
  egyptians: {
    id: 'egyptians', name: 'Egyptian Kingdom', adjective: 'Egyptian',
    color: '#2e8b57', fillOpacity: 0.55, border: '#0a3a1a',
    bonuses: { foodMult: 1.3 }, isPlayable: true,
    startGold: 600, startFood: 1500, startWood: 100, startStone: 300, startIron: 40,
    homeTerritories: ['egypt']
  },
  celts: {
    id: 'celts', name: 'Celtic Confederation', adjective: 'Celtic',
    color: '#3a7030', fillOpacity: 0.5, border: '#1a3a10',
    bonuses: { foodMult: 1.1 }, isPlayable: false,
    startGold: 300, startFood: 800, startWood: 500, startStone: 50, startIron: 60,
    homeTerritories: ['france', 'united kingdom']
  },
  carthage: {
    id: 'carthage', name: 'Carthaginian Republic', adjective: 'Carthaginian',
    color: '#483d8b', fillOpacity: 0.5, border: '#1a1440',
    bonuses: { goldMult: 1.1 }, isPlayable: false,
    startGold: 700, startFood: 600, startWood: 200, startStone: 200, startIron: 80,
    homeTerritories: ['tunisia', 'libya']
  },
  greeks: {
    id: 'greeks', name: 'Greek States', adjective: 'Greek',
    color: '#1a5a8b', fillOpacity: 0.5, border: '#0a2a5a',
    bonuses: { goldMult: 1.05, foodMult: 1.05 }, isPlayable: false,
    startGold: 500, startFood: 700, startWood: 150, startStone: 200, startIron: 100,
    homeTerritories: ['greece']
  }
};

// ── REGIONS ───────────────────────────────────────────────────
// GeoJSON country names as keys → { gameId, displayName, owner, type, basePop }
const REGIONS = {
  'Italy':          { id: 'italy',   name: 'Italia',      owner: 'romans',    type: 'Plains',    basePop: 5200, isCapital: true  },
  'France':         { id: 'france',  name: 'Gaul',        owner: 'celts',     type: 'Forest',    basePop: 3100 },
  'Spain':          { id: 'spain',   name: 'Hispania',    owner: null,        type: 'Mountains', basePop: 2600 },
  'Portugal':       { id: 'portugal',name: 'Lusitania',   owner: null,        type: 'Mountains', basePop: 1200 },
  'Greece':         { id: 'greece',  name: 'Hellas',      owner: 'greeks',    type: 'Mountains', basePop: 3800, isCapital: true  },
  'Turkey':         { id: 'turkey',  name: 'Anatolia',    owner: 'persians',  type: 'Plains',    basePop: 3600 },
  'Iraq':           { id: 'iraq',    name: 'Mesopotamia', owner: 'persians',  type: 'Plains',    basePop: 5500 },
  'Iran':           { id: 'iran',    name: 'Persia',      owner: 'persians',  type: 'Plains',    basePop: 6000, isCapital: true  },
  'Egypt':          { id: 'egypt',   name: 'Aegyptus',    owner: 'egyptians', type: 'Desert',    basePop: 6200, isCapital: true  },
  'Libya':          { id: 'libya',   name: 'Tripolitania',owner: 'carthage',  type: 'Desert',    basePop: 1100 },
  'Tunisia':        { id: 'tunisia', name: 'Carthage',    owner: 'carthage',  type: 'Coast',     basePop: 2800, isCapital: true  },
  'Algeria':        { id: 'algeria', name: 'Numidia',     owner: null,        type: 'Desert',    basePop: 1900 },
  'Morocco':        { id: 'morocco', name: 'Mauretania',  owner: null,        type: 'Coast',     basePop: 1400 },
  'United Kingdom': { id: 'united kingdom', name: 'Britannia', owner: 'celts', type: 'Forest',  basePop: 2100 },
  'Germany':        { id: 'germany', name: 'Germania',    owner: null,        type: 'Forest',    basePop: 2400 },
  'Austria':        { id: 'austria', name: 'Noricum',     owner: null,        type: 'Mountains', basePop: 800  },
  'Romania':        { id: 'romania', name: 'Dacia',       owner: null,        type: 'Mountains', basePop: 1300 },
  'Bulgaria':       { id: 'bulgaria',name: 'Thracia',     owner: 'greeks',    type: 'Plains',    basePop: 1500 },
  'Serbia':         { id: 'serbia',  name: 'Illyria',     owner: null,        type: 'Mountains', basePop: 1000 },
  'Syria':          { id: 'syria',   name: 'Syria',       owner: 'persians',  type: 'Plains',    basePop: 2800 },
  'Israel':         { id: 'israel',  name: 'Judaea',      owner: 'persians',  type: 'Coast',     basePop: 1800 },
  'Lebanon':        { id: 'lebanon', name: 'Phoenicia',   owner: 'carthage',  type: 'Coast',     basePop: 2200 },
  'Jordan':         { id: 'jordan',  name: 'Arabia Petraea', owner: null,     type: 'Desert',    basePop: 900  },
  'Saudi Arabia':   { id: 'saudi arabia', name: 'Arabia',owner: null,        type: 'Desert',    basePop: 700  },
};

// Reverse lookup: gameId → GeoJSON name
const REGION_BY_ID = {};
for (const [geoName, r] of Object.entries(REGIONS)) {
  REGION_BY_ID[r.id] = { ...r, geoName };
}

// ── BUILDINGS ─────────────────────────────────────────────────
const BUILDINGS = {
  farm:     { id: 'farm',     name: 'Farm',        emoji: '🌾', cost: { wood: 60, gold: 30 },             output: { food: 25 },         desc: '+25 Food/turn' },
  market:   { id: 'market',   name: 'Market',      emoji: '💰', cost: { wood: 80, stone: 40, gold: 20 }, output: { gold: 35 },         desc: '+35 Gold/turn' },
  mine:     { id: 'mine',     name: 'Mine',        emoji: '⛏️', cost: { wood: 100, gold: 50 },           output: { iron: 12, stone: 8 },desc: '+12 Iron, +8 Stone/turn' },
  lumber:   { id: 'lumber',   name: 'Lumber Mill', emoji: '🪵', cost: { gold: 60 },                      output: { wood: 20 },         desc: '+20 Wood/turn' },
  barracks: { id: 'barracks', name: 'Barracks',    emoji: '⚔️', cost: { wood: 150, stone: 100, gold: 100 }, output: {},                desc: 'Allows recruiting units', military: true },
  wall:     { id: 'wall',     name: 'City Wall',   emoji: '🏯', cost: { stone: 250, gold: 150 },          output: {},                   desc: '+50% Defence bonus', military: true },
  harbor:   { id: 'harbor',   name: 'Harbor',      emoji: '⛵', cost: { wood: 120, stone: 80, gold: 80 }, output: { gold: 20, food: 10 }, desc: '+20 Gold, +10 Food/turn' },
};

// ── UNITS ─────────────────────────────────────────────────────
const UNITS = {
  militia:   { id: 'militia',   name: 'Militia',    emoji: '🗡️', cost: { gold: 15, food: 8 },          power: 3,  hp: 10, upkeep: { gold: 1, food: 3 } },
  spearman:  { id: 'spearman',  name: 'Spearman',   emoji: '🔱', cost: { gold: 25, iron: 5, food: 10 }, power: 5,  hp: 15, upkeep: { gold: 2, food: 5 } },
  swordsman: { id: 'swordsman', name: 'Swordsman',  emoji: '⚔️', cost: { gold: 35, iron: 10, food: 12}, power: 7,  hp: 20, upkeep: { gold: 3, food: 6 } },
  archer:    { id: 'archer',    name: 'Archer',     emoji: '🏹', cost: { gold: 30, wood: 10, food: 10}, power: 6,  hp: 14, upkeep: { gold: 2, food: 4 } },
  cavalry:   { id: 'cavalry',   name: 'Cavalry',    emoji: '🐎', cost: { gold: 60, iron: 12, food: 20}, power: 11, hp: 28, upkeep: { gold: 5, food: 8 } },
  elephant:  { id: 'elephant',  name: 'War Elephant',emoji:'🐘', cost: { gold: 120, food: 40, iron: 15}, power: 20, hp: 50, upkeep: { gold: 10, food: 20 } },
};

// ── TUTORIAL ──────────────────────────────────────────────────
const TUTORIAL = [
  { text: "Salve, Imperator! I am Marcus, your Royal Advisor. Click on your home territory on the map to begin surveying your lands." },
  { text: "Excellent. Every province generates Tax gold based on population. Construct a Farm to boost food output, then a Market for more gold." },
  { text: "Good. Resources flow each turn. Press 'End Turn' to advance time, collect income, and let the world react to your decisions." },
  { text: "Your rivals are expanding. Build a Barracks in a province to unlock unit recruitment. Armies are the foundation of conquest." },
  { text: "To invade enemy lands: first click one of your provinces with an army, hit 'Move / Attack', then click the target province. The stronger force wins. May Fortune favour you, Imperator!" },
];

// ── EVENTS ────────────────────────────────────────────────────
const RANDOM_EVENTS = [
  { text: "A rare comet crosses the sky — omens are debated in every court.", type: 'neutral' },
  { text: "Bountiful harvests! Granaries overflow across the known world.", type: 'good', effect: { food: 100 } },
  { text: "A plague spreads through several provinces, reducing populations.", type: 'bad', effect: { pop: -0.03 } },
  { text: "Merchants bring exotic goods from distant trade routes. Commerce booms.", type: 'good', effect: { gold: 80 } },
  { text: "Barbarian raiders are spotted on the northern borders!", type: 'bad' },
  { text: "A great philosopher publishes his works, inspiring the people.", type: 'good', effect: { pop: 0.02 } },
  { text: "Drought strikes. Food reserves are strained across the region.", type: 'bad', effect: { food: -80 } },
  { text: "A mine collapses in the eastern territories.", type: 'bad', effect: { iron: -30 } },
];
