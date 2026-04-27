/* ============================================================
   IMPERIUM — game.js
   Core state machine, economy, combat, AI, UI wiring
   ============================================================ */
'use strict';

// ── CONFIG & STATE ────────────────────────────────────────────
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000' 
  : 'https://imperium-backend.onrender.com'; // Change to dynamic URL based on your Render deployment

const G = {
  playerFaction: null,
  turn: 1,
  year: -250,
  resources: { gold: 0, food: 0, wood: 0, stone: 0, iron: 0 },
  territories: {},   // id → { owner, population, buildings[], army{} }
  relations: {},     // factionId → 'peace'|'alliance'|'war'
  selectedId: null,
  marchSource: null,
  tutorialStep: 0,
  tutorialDone: false,
  events: [],
  audioCtx: null,
};

// ── BOOT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.faction-card .choose-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const card = e.target.closest('.faction-card');
      startGame(card.dataset.faction);
    });
  });
  document.querySelectorAll('.faction-card').forEach(card => {
    card.addEventListener('click', () => {
      startGame(card.dataset.faction);
    });
  });

  document.getElementById('end-turn-btn').addEventListener('click', endTurn);
  document.getElementById('btn-build').addEventListener('click', () => openModal('build'));
  document.getElementById('btn-recruit').addEventListener('click', () => openModal('recruit'));
  document.getElementById('btn-move-army').addEventListener('click', enterMarchMode);
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('game-modal').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.getElementById('battle-close').addEventListener('click', () => { document.getElementById('battle-modal').classList.add('hidden'); });
  document.getElementById('advisor-next-btn').addEventListener('click', nextTutorial);
  document.getElementById('btn-propose-alliance').addEventListener('click', () => diplomacyAction('alliance'));
  document.getElementById('btn-declare-war').addEventListener('click', () => diplomacyAction('war'));
  document.getElementById('btn-offer-trade').addEventListener('click', () => diplomacyAction('trade'));
  document.getElementById('btn-submit-score').addEventListener('click', submitEmpireScore);
});

function startGame(factionId) {
  G.playerFaction = factionId;

  // Init territories
  for (const [, r] of Object.entries(REGIONS)) {
    G.territories[r.id] = {
      owner: r.owner || null,
      population: r.basePop + Math.floor(Math.random() * 400),
      buildings: [],
      army: r.owner ? buildStarterArmy(r.owner) : {},
    };
  }

  // Player starting resources
  const f = FACTIONS[factionId];
  G.resources.gold  = f.startGold;
  G.resources.food  = f.startFood;
  G.resources.wood  = f.startWood;
  G.resources.stone = f.startStone;
  G.resources.iron  = f.startIron;

  // Relations: everyone starts at peace
  for (const fid of Object.keys(FACTIONS)) {
    if (fid !== factionId) G.relations[fid] = 'peace';
  }

  // Switch screens
  document.getElementById('faction-screen').classList.remove('active');
  const gs = document.getElementById('game-screen');
  gs.classList.add('active');

  // Empire name in top bar
  document.getElementById('empire-name-display').textContent = f.name;
  document.getElementById('empire-name-display').style.color = f.color.replace(')', ', 1)');

  updateTopBar();
  updateEmpirePanel();
  initMap(); // defined in map.js

  // Tutorial
  showAdvisor(0);

  // Audio init on first interaction
  document.body.addEventListener('click', tryInitAudio, { once: true });

  logEvent(`${f.name} rises to power. The world watches.`, 'good');
}

function buildStarterArmy(factionId) {
  // Returns an object { unitId: count }
  const base = factionId === 'romans' ? { militia: 3, spearman: 2 }
             : factionId === 'persians' ? { militia: 2, spearman: 2, cavalry: 1 }
             : factionId === 'egyptians' ? { militia: 3, spearman: 1 }
             : { militia: 2 };
  return { ...base };
}

// ── INCOME CALC ───────────────────────────────────────────────
function calcIncome() {
  let gold = 0, food = 0, wood = 0, stone = 0, iron = 0;

  for (const [id, t] of Object.entries(G.territories)) {
    if (t.owner !== G.playerFaction) continue;
    const pop = t.population;

    // Base tax
    gold += 8 + (pop / 800);
    food += 15;

    // Building output
    for (const bId of t.buildings) {
      const b = BUILDINGS[bId].output;
      if (b.gold)  gold  += b.gold;
      if (b.food)  food  += b.food;
      if (b.wood)  wood  += b.wood;
      if (b.stone) stone += b.stone;
      if (b.iron)  iron  += b.iron;
    }

    // Army upkeep
    for (const [uId, count] of Object.entries(t.army)) {
      const u = UNITS[uId].upkeep;
      gold -= u.gold * count;
      food -= u.food * count;
    }
  }

  const bonuses = FACTIONS[G.playerFaction].bonuses;
  if (bonuses.goldMult && gold > 0) gold *= bonuses.goldMult;
  if (bonuses.foodMult && food > 0) food *= bonuses.foodMult;

  return {
    gold:  Math.round(gold),
    food:  Math.round(food),
    wood:  Math.round(wood),
    stone: Math.round(stone),
    iron:  Math.round(iron),
  };
}

function updateTopBar() {
  const r = G.resources;
  document.getElementById('res-gold').textContent  = Math.floor(r.gold).toLocaleString();
  document.getElementById('res-food').textContent  = Math.floor(r.food).toLocaleString();
  document.getElementById('res-wood').textContent  = Math.floor(r.wood).toLocaleString();
  document.getElementById('res-stone').textContent = Math.floor(r.stone).toLocaleString();
  document.getElementById('res-iron').textContent  = Math.floor(r.iron).toLocaleString();

  let totalPop = 0;
  for (const [, t] of Object.entries(G.territories)) {
    if (t.owner === G.playerFaction) totalPop += t.population;
  }
  document.getElementById('res-pop').textContent = totalPop.toLocaleString();

  const inc = calcIncome();
  setIncome('inc-gold', inc.gold);
  setIncome('inc-food', inc.food);

  document.getElementById('current-turn').textContent = `Turn ${G.turn}`;
  document.getElementById('current-year').textContent =
    G.year < 0 ? `${Math.abs(G.year)} BC` : `${G.year} AD`;
}

function setIncome(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = (val >= 0 ? '+' : '') + val;
  el.className = 'res-inc ' + (val >= 0 ? 'pos' : 'neg');
}

function updateEmpirePanel() {
  let count = 0, power = 0;
  for (const [, t] of Object.entries(G.territories)) {
    if (t.owner !== G.playerFaction) continue;
    count++;
    for (const [uId, n] of Object.entries(t.army)) power += UNITS[uId].power * n;
  }
  document.getElementById('empire-provinces').textContent = `${count} Province${count !== 1 ? 's' : ''}`;
  document.getElementById('empire-power').textContent     = `Military Power: ${power}`;

  // Relations list
  const relList = document.getElementById('relations-list');
  relList.innerHTML = '';
  for (const [fid, status] of Object.entries(G.relations)) {
    const f = FACTIONS[fid];
    const cls = status === 'alliance' ? 'rel-alliance' : status === 'war' ? 'rel-war' : 'rel-peace';
    relList.innerHTML += `<div class="relation-item">
      <span style="font-weight:700;">${f.name}</span>
      <span class="rel-status ${cls}">${status.toUpperCase()}</span>
    </div>`;
  }
}

// ── TURN PROCESSING ───────────────────────────────────────────
function endTurn() {
  // Collect income
  const inc = calcIncome();
  for (const k of Object.keys(inc)) G.resources[k] = Math.max(0, G.resources[k] + inc[k]);

  // Pop growth
  for (const t of Object.values(G.territories)) {
    if (t.owner) t.population = Math.floor(t.population * 1.04);
  }

  // Random event (20% chance)
  if (Math.random() < 0.2) {
    const ev = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    logEvent(ev.text, ev.type === 'good' ? 'good' : ev.type === 'bad' ? 'bad' : '');
    if (ev.effect) {
      if (ev.effect.gold)  G.resources.gold  = Math.max(0, G.resources.gold  + ev.effect.gold);
      if (ev.effect.food)  G.resources.food  = Math.max(0, G.resources.food  + ev.effect.food);
      if (ev.effect.iron)  G.resources.iron  = Math.max(0, G.resources.iron  + ev.effect.iron);
      if (ev.effect.pop) {
        for (const t of Object.values(G.territories)) {
          if (t.owner) t.population = Math.max(100, Math.floor(t.population * (1 + ev.effect.pop)));
        }
      }
    }
    broadcastNews(ev.text);
  }

  // AI turn
  runAI();

  G.turn++;
  G.year += 2;

  updateTopBar();
  updateEmpirePanel();
  refreshCanvas();

  // Refresh selected province
  if (G.selectedId) renderSidePanel(G.selectedId);

  playSound('turn');
  if (G.tutorialStep === 2 && !G.tutorialDone) showAdvisor(3);
}

// ── AI ────────────────────────────────────────────────────────
function runAI() {
  for (const [fid, fDef] of Object.entries(FACTIONS)) {
    if (fid === G.playerFaction) continue;

    const myTerrs = Object.entries(G.territories).filter(([, t]) => t.owner === fid);
    if (myTerrs.length === 0) continue;

    // Passive income for AI (simplified)
    const aiGold = myTerrs.length * 20 + Math.random() * 10;

    // Build barracks in first terr if not present
    const [, ft] = myTerrs[0];
    if (!ft.buildings.includes('barracks') && Math.random() > 0.5) {
      ft.buildings.push('barracks');
    }

    // Recruit units
    for (const [, t] of myTerrs) {
      if (t.buildings.includes('barracks') && Math.random() > 0.6) {
        t.army.spearman = (t.army.spearman || 0) + 1;
      }
    }

    // Try to expand (30% chance per turn)
    if (Math.random() > 0.7) {
      const attackable = Object.entries(G.territories).filter(
        ([, t]) => t.owner !== fid && Math.random() > 0.6
      );
      if (attackable.length > 0) {
        const [targetId, target] = attackable[Math.floor(Math.random() * attackable.length)];
        const [, attTerr] = myTerrs[Math.floor(Math.random() * myTerrs.length)];

        const atkPow = armyPower(attTerr.army);
        const defPow = armyPower(target.army) * (target.buildings.includes('wall') ? 1.5 : 1);

        if (atkPow > defPow) {
          const prevOwner = target.owner;
          target.owner = fid;
          target.army  = { spearman: 1 };
          attTerr.army = trimArmy(attTerr.army, 0.25);

          if (prevOwner === G.playerFaction) {
            logEvent(`⚠️ ${fDef.name} has conquered one of your provinces!`, 'bad');
            broadcastNews(`${fDef.name} captures a province!`);
          }
        }
      }
    }
  }
}

// ── ARMY HELPERS ──────────────────────────────────────────────
function armyPower(armyObj) {
  return Object.entries(armyObj).reduce((sum, [uId, n]) => sum + (UNITS[uId]?.power || 0) * n, 0);
}

function armySize(armyObj) {
  return Object.values(armyObj).reduce((s, n) => s + n, 0);
}

function trimArmy(armyObj, lossFraction) {
  const result = {};
  for (const [uId, count] of Object.entries(armyObj)) {
    const survivors = Math.max(0, Math.floor(count * (1 - lossFraction)));
    if (survivors > 0) result[uId] = survivors;
  }
  return result;
}

// ── TERRITORY SELECTION & SIDE PANEL ─────────────────────────
function selectTerritory(regionId) {
  G.selectedId = regionId;
  renderSidePanel(regionId);
}

function renderSidePanel(regionId) {
  const r    = REGION_BY_ID[regionId];
  const t    = G.territories[regionId];
  const mine = t.owner === G.playerFaction;
  const other = t.owner && t.owner !== G.playerFaction;

  document.getElementById('territory-panel').classList.remove('hidden');
  document.getElementById('terr-name').textContent = r.name;
  document.getElementById('terr-type').textContent = r.type;
  document.getElementById('terr-pop').textContent  = t.population.toLocaleString();

  // Owner badge
  const badge = document.getElementById('terr-faction-badge');
  if (t.owner && FACTIONS[t.owner]) {
    const f = FACTIONS[t.owner];
    badge.textContent = f.adjective;
    badge.style.background = f.color;
    badge.style.display = 'inline-block';
    document.getElementById('terr-owner-name').textContent = f.name;
    document.getElementById('terr-owner-name').style.color = f.color;
  } else {
    badge.style.display = 'none';
    document.getElementById('terr-owner-name').textContent = 'Unclaimed';
    document.getElementById('terr-owner-name').style.color = '#666';
  }

  // Buildings
  const bl = document.getElementById('terr-buildings');
  bl.innerHTML = t.buildings.length === 0
    ? '<div class="empty-note">No structures built.</div>'
    : t.buildings.map(bId => `<div class="building-entry">${BUILDINGS[bId].emoji} ${BUILDINGS[bId].name}</div>`).join('');

  // Army
  const gl = document.getElementById('terr-garrison');
  const sz = armySize(t.army);
  if (sz === 0) {
    gl.innerHTML = '<div class="empty-note">No garrison.</div>';
  } else {
    let html = '';
    for (const [uId, count] of Object.entries(t.army)) {
      if (count > 0) html += `<div class="garrison-entry">${UNITS[uId].emoji} ${count}× ${UNITS[uId].name}</div>`;
    }
    html += `<div class="garrison-entry" style="border-top:1px solid var(--parchment-dark); margin-top:4px;">
              ⚡ Total Power: <strong>${armyPower(t.army)}</strong>
             </div>`;
    gl.innerHTML = html;
  }

  // Show / hide action buttons
  show('btn-build',      mine);
  show('btn-recruit',    mine);
  show('btn-move-army',  mine && sz > 0);

  // Diplomacy section
  const dipSec = document.getElementById('diplomacy-section');
  if (other) {
    dipSec.classList.remove('hidden');
    const relStatus = G.relations[t.owner] || 'peace';
    document.getElementById('diplomacy-status').textContent =
      `Current status: ${relStatus.toUpperCase()} with ${FACTIONS[t.owner].name}`;
    show('btn-propose-alliance', relStatus === 'peace');
    show('btn-declare-war',      relStatus !== 'war');
    show('btn-offer-trade',      true);
    // Store which faction we're looking at
    dipSec.dataset.faction = t.owner;
  } else {
    dipSec.classList.add('hidden');
  }

  if (!G.tutorialDone && G.tutorialStep === 0 && mine) showAdvisor(1);
}

function show(id, condition) {
  const el = document.getElementById(id);
  if (!el) return;
  if (condition) el.classList.remove('hidden');
  else el.classList.add('hidden');
}

// ── MARCH MODE ────────────────────────────────────────────────
function enterMarchMode() {
  G.marchSource = G.selectedId;
  document.getElementById('map-container').classList.add('march-mode');
  // Show hint banner
  let hint = document.getElementById('march-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'march-hint';
    hint.className = 'march-hint';
    hint.textContent = '🗡️ Select a target province to march your army — or press [Escape] to cancel';
    document.getElementById('game-screen').appendChild(hint);
  }
  hint.style.display = 'block';

  window._marchEscHandler = e => {
    if (e.key === 'Escape') cancelMarch();
  };
  document.addEventListener('keydown', window._marchEscHandler);
}

function cancelMarch() {
  G.marchSource = null;
  document.getElementById('map-container').classList.remove('march-mode');
  const hint = document.getElementById('march-hint');
  if (hint) hint.style.display = 'none';
  document.removeEventListener('keydown', window._marchEscHandler);
}

function marchTo(targetId) {
  const srcId = G.marchSource;
  cancelMarch();

  if (!srcId || srcId === targetId) return;

  const src = G.territories[srcId];
  const tgt = G.territories[targetId];

  if (tgt.owner === G.playerFaction) {
    // Reinforce friendly territory
    for (const [uId, count] of Object.entries(src.army)) {
      tgt.army[uId] = (tgt.army[uId] || 0) + count;
    }
    src.army = {};
    logEvent(`Army reinforced neighboring province.`, 'good');
    refreshCanvas();
    renderSidePanel(targetId);
    return;
  }

  // BATTLE
  resolveBattle(srcId, targetId);
  if (!G.tutorialDone && G.tutorialStep === 4) { G.tutorialDone = true; document.getElementById('advisor-panel').style.display = 'none'; }
}

// ── BATTLE RESOLUTION ─────────────────────────────────────────
function resolveBattle(srcId, targetId) {
  const src = G.territories[srcId];
  const tgt = G.territories[targetId];
  const tgtRegion = REGION_BY_ID[targetId];

  const atkPow = armyPower(src.army);
  let   defPow = armyPower(tgt.army);
  if (tgt.buildings.includes('wall')) defPow = Math.floor(defPow * 1.5);

  // Dice variance ± 15%
  const atkRoll = atkPow * (0.85 + Math.random() * 0.3);
  const defRoll = defPow * (0.85 + Math.random() * 0.3);

  const win = atkRoll >= defRoll;
  const atkLoss = win ? 0.25 : 0.7;
  const defLoss = win ? 0.8 : 0.2;

  const prevOwner = tgt.owner;
  const prevOwnerName = prevOwner ? FACTIONS[prevOwner]?.name : 'Uncontrolled';

  if (win) {
    tgt.army  = trimArmy(tgt.army, defLoss);
    tgt.owner = G.playerFaction;
    // Move survivors into captured province
    tgt.army  = trimArmy(src.army, atkLoss);
    src.army  = {};
    playSound('victory');
    logEvent(`Victory! ${tgtRegion.name} conquered from ${prevOwnerName}.`, 'good');
    if (prevOwner) broadcastNews(`${FACTIONS[G.playerFaction].name} conquers ${tgtRegion.name}!`);
  } else {
    src.army = trimArmy(src.army, atkLoss);
    tgt.army = trimArmy(tgt.army, defLoss);
    playSound('defeat');
    logEvent(`Defeat! Our attack on ${tgtRegion.name} failed.`, 'bad');
  }

  showBattleReport(tgtRegion.name, atkPow, defPow, atkRoll, defRoll, win, prevOwnerName);
  updateTopBar();
  updateEmpirePanel();
  refreshCanvas();
  renderSidePanel(targetId);
}

function showBattleReport(name, atkPow, defPow, atkRoll, defRoll, win, defenderName) {
  const fac = FACTIONS[G.playerFaction];
  document.getElementById('battle-title').textContent = win ? '⚔️ Victory!' : '🛡️ Defeat';
  document.getElementById('battle-content').innerHTML = `
    <div class="battle-vs">
      <div style="color:${fac.color};">
        <div>${fac.adjective}</div>
        <div class="battle-power">${Math.round(atkRoll)}</div>
      </div>
      <span>⚔️</span>
      <div>
        <div>${defenderName}</div>
        <div class="battle-power">${Math.round(defRoll)}</div>
      </div>
    </div>
    <div class="battle-result ${win ? 'victory' : 'defeat'}">
      ${win ? `✅ ${name} is now under your control!` : `❌ Our forces were repelled from ${name}.`}
    </div>
    <div class="battle-detail">
      Base strength — Attacker: ${atkPow} | Defender: ${defPow}<br>
      ${win ? 'Our armies suffered heavy casualties but prevailed.' : 'Our army retreated with significant losses.'}
    </div>
  `;
  document.getElementById('battle-modal').classList.remove('hidden');
}

// ── MODALS ────────────────────────────────────────────────────
function openModal(type) {
  if (!G.selectedId) return;
  const t = G.territories[G.selectedId];
  const modal   = document.getElementById('game-modal');
  const content = document.getElementById('modal-content');
  content.innerHTML = '';

  if (type === 'build') {
    document.getElementById('modal-title').textContent = '🏗️ Construct Building';
    for (const [bId, b] of Object.entries(BUILDINGS)) {
      const built = t.buildings.includes(bId);
      const afford = canAfford(b.cost);
      const costStr = Object.entries(b.cost).map(([k,v]) => `${resEmoji(k)}${v}`).join('  ');
      content.innerHTML += `
        <div class="modal-item">
          <div class="modal-item-info">
            <h3>${b.emoji} ${b.name} ${built ? '<span style="color:#1a501a;">(Built)</span>' : ''}</h3>
            <p>${b.desc}</p>
            <p class="modal-cost">Cost: ${costStr}</p>
          </div>
          ${!built ? `<button class="modal-btn" ${!afford ? 'disabled' : ''} onclick="doBuild('${bId}')">Build</button>` : ''}
        </div>`;
    }

  } else if (type === 'recruit') {
    document.getElementById('modal-title').textContent = '⚔️ Recruit Units';
    if (!t.buildings.includes('barracks')) {
      content.innerHTML = '<div class="modal-note">⚠️ A Barracks must be built in this province before you can recruit troops.</div>';
    } else {
      for (const [uId, u] of Object.entries(UNITS)) {
        const afford = canAfford(u.cost);
        const costStr = Object.entries(u.cost).map(([k,v]) => `${resEmoji(k)}${v}`).join('  ');
        const upkeepStr = Object.entries(u.upkeep).map(([k,v]) => `${resEmoji(k)}${v}`).join('  ');
        content.innerHTML += `
          <div class="modal-item">
            <div class="modal-item-info">
              <h3>${u.emoji} ${u.name} &nbsp;<small style="color:#888;">(Power ${u.power})</small></h3>
              <p class="modal-cost">Cost: ${costStr} &nbsp;|&nbsp; Upkeep: ${upkeepStr}/turn</p>
            </div>
            <button class="modal-btn" ${!afford ? 'disabled' : ''} onclick="doRecruit('${uId}')">Recruit</button>
          </div>`;
      }
    }
  }

  modal.classList.remove('hidden');
}

function doBuild(bId) {
  const t = G.territories[G.selectedId];
  if (t.buildings.includes(bId)) return;
  if (!canAfford(BUILDINGS[bId].cost)) return;
  spendResources(BUILDINGS[bId].cost);
  t.buildings.push(bId);
  playSound('build');
  logEvent(`Built ${BUILDINGS[bId].name} in ${REGION_BY_ID[G.selectedId].name}.`, 'good');
  closeModal();
  updateTopBar();
  renderSidePanel(G.selectedId);
  if (!G.tutorialDone && G.tutorialStep === 1) showAdvisor(2);
  if (!G.tutorialDone && G.tutorialStep === 3 && bId === 'barracks') showAdvisor(4);
}

function doRecruit(uId) {
  const t = G.territories[G.selectedId];
  if (!canAfford(UNITS[uId].cost)) return;
  spendResources(UNITS[uId].cost);
  t.army[uId] = (t.army[uId] || 0) + 1;
  playSound('recruit');
  logEvent(`Recruited a ${UNITS[uId].name} in ${REGION_BY_ID[G.selectedId].name}.`);
  closeModal();
  updateTopBar();
  renderSidePanel(G.selectedId);
}

function closeModal() { document.getElementById('game-modal').classList.add('hidden'); }

// ── DIPLOMACY ─────────────────────────────────────────────────
function diplomacyAction(action) {
  const targetFaction = document.getElementById('diplomacy-section').dataset.faction;
  if (!targetFaction) return;
  const fName = FACTIONS[targetFaction].name;

  if (action === 'alliance') {
    if (G.resources.gold < 200) { logEvent('Not enough gold to propose an alliance (200 Gold).', 'bad'); return; }
    G.resources.gold -= 200;
    G.relations[targetFaction] = 'alliance';
    logEvent(`Alliance forged with ${fName}.`, 'good');
    broadcastNews(`${FACTIONS[G.playerFaction].name} allies with ${fName}!`);
  } else if (action === 'war') {
    G.relations[targetFaction] = 'war';
    logEvent(`War declared on ${fName}!`, 'bad');
    broadcastNews(`WAR: ${FACTIONS[G.playerFaction].name} vs ${fName}!`);
  } else if (action === 'trade') {
    if (G.resources.gold < 100) { logEvent('Not enough gold for a trade deal (100 Gold).', 'bad'); return; }
    G.resources.gold -= 100;
    G.resources.food  = Math.max(0, G.resources.food + 150);
    G.resources.wood  = Math.max(0, G.resources.wood + 100);
    logEvent(`Trade route established with ${fName}. +150 Food, +100 Wood.`, 'good');
  }

  updateTopBar();
  updateEmpirePanel();
  renderSidePanel(G.selectedId);
}

// ── RESOURCE HELPERS ──────────────────────────────────────────
function canAfford(cost) {
  for (const [k, v] of Object.entries(cost)) {
    if ((G.resources[k] || 0) < v) return false;
  }
  return true;
}
function spendResources(cost) {
  for (const [k, v] of Object.entries(cost)) G.resources[k] = Math.max(0, G.resources[k] - v);
}
function resEmoji(k) {
  return { gold:'🪙', food:'🌾', wood:'🪵', stone:'🪨', iron:'⛏️' }[k] || '';
}

// ── TUTORIAL ──────────────────────────────────────────────────
function showAdvisor(step) {
  G.tutorialStep = step;
  if (step >= TUTORIAL.length) { G.tutorialDone = true; document.getElementById('advisor-panel').style.display = 'none'; return; }
  const panel = document.getElementById('advisor-panel');
  panel.style.display = 'flex';
  const textEl = document.getElementById('advisor-text');
  textEl.textContent = '';
  const text = TUTORIAL[step].text;
  let i = 0;
  const tick = setInterval(() => {
    textEl.textContent += text[i];
    i++;
    if (i >= text.length) clearInterval(tick);
  }, 22);

  const btn = document.getElementById('advisor-next-btn');
  // show Next button for steps that don't wait for player action
  if ([1, 4].includes(step)) btn.classList.remove('hidden');
  else btn.classList.add('hidden');
}
function nextTutorial() { showAdvisor(G.tutorialStep + 1); }

// ── EVENTS / NEWS ─────────────────────────────────────────────
function logEvent(text, type = '') {
  const log = document.getElementById('event-log');
  const div = document.createElement('div');
  div.className = 'event-entry' + (type ? ' ' + type : '');
  const yr = G.year < 0 ? `${Math.abs(G.year)} BC` : `${G.year} AD`;
  div.textContent = `${yr}: ${text}`;
  log.prepend(div);
  // keep max 20 items
  while (log.children.length > 20) log.removeChild(log.lastChild);
}

function broadcastNews(text) {
  const nc = document.getElementById('news-content');
  nc.textContent = text;
  // reset animation
  nc.style.animation = 'none';
  nc.offsetHeight; // reflow
  nc.style.animation = '';
}

// ── AUDIO ─────────────────────────────────────────────────────
function tryInitAudio() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (AC && !G.audioCtx) G.audioCtx = new AC();
}

function playSound(type) {
  if (!G.audioCtx) return;
  const ctx = G.audioCtx;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);

  const presets = {
    turn:    { type: 'sine',    freq: [500, 680], dur: 0.25, vol: 0.04 },
    build:   { type: 'square',  freq: [120, 80],  dur: 0.2,  vol: 0.06 },
    recruit: { type: 'sawtooth',freq: [260, 180],  dur: 0.3,  vol: 0.05 },
    victory: { type: 'sine',    freq: [400, 600, 800], dur: 0.5, vol: 0.08 },
    defeat:  { type: 'sawtooth',freq: [200, 80],   dur: 0.5,  vol: 0.06 },
  };
  const p = presets[type] || presets.turn;
  osc.type = p.type;
  osc.frequency.setValueAtTime(p.freq[0], t);
  if (p.freq[1]) osc.frequency.linearRampToValueAtTime(p.freq[1], t + p.dur * 0.5);
  if (p.freq[2]) osc.frequency.linearRampToValueAtTime(p.freq[2], t + p.dur);
  gain.gain.setValueAtTime(p.vol, t);
  gain.gain.linearRampToValueAtTime(0, t + p.dur);
  osc.start(t); osc.stop(t + p.dur + 0.05);
}

// ── BACKEND INTEGRATION ───────────────────────────────────────
async function submitEmpireScore() {
  const fac = FACTIONS[G.playerFaction];
  let provincesCount = 0;
  let militaryPower = 0;
  
  for (const [, t] of Object.entries(G.territories)) {
    if (t.owner === G.playerFaction) {
      provincesCount++;
      militaryPower += armyPower(t.army);
    }
  }
  
  const finalScore = Math.floor((provincesCount * 100) + militaryPower + (G.resources.gold / 10));

  logEvent(`Transmitting ${fac.name} power to the Gods (Backend)...`, 'neutral');

  try {
    const res = await fetch(`${API_URL}/submit-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fac.name, score: finalScore })
    });
    
    if (res.ok) {
      const data = await res.json();
      logEvent(`Score submitted successfully! Global Rank: #${data.rank}`, 'good');
    } else {
      throw new Error('Server rejected score submission');
    }
  } catch (err) {
    console.error('Submit error:', err);
    logEvent('Failed to contact backend. The Gods are silent.', 'bad');
  }
}

