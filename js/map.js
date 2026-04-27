/* ============================================================
   IMPERIUM — map.js
   Leaflet map engine + GeoJSON rendering
   ============================================================ */
'use strict';

let leafMap;
let geoLayer;

// We fetch GeoJSON from the server — the countries.geojson must exist in root
async function initMap() {
  leafMap = L.map('map-container', {
    zoomControl: false,
    minZoom: 3,
    maxZoom: 7,
    maxBounds: [[-90, -200], [90, 200]],
    maxBoundsViscosity: 0.6,
    attributionControl: false,
  }).setView([38, 25], 5);  // Centre on Mediterranean / Aegean

  // Beautiful CartoDB Voyager tiles (earthy, historical feel)
  L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
    subdomains: 'abcd',
    maxZoom: 19,
  }).addTo(leafMap);

  // Custom zoom controls positioned to not overlap panels
  L.control.zoom({ position: 'bottomright' }).addTo(leafMap);

  // Load GeoJSON
  try {
    const res = await fetch('/countries.geojson');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();

    // Filter to only our game countries + simplify
    const filtered = {
      type: 'FeatureCollection',
      features: raw.features.filter(f => REGIONS[f.properties.name] !== undefined),
    };

    geoLayer = L.geoJSON(filtered, {
      style:         styleFeature,
      onEachFeature: onEachFeature,
    }).addTo(leafMap);

    // Fit to Mediterranean-ish bounds (wider view)
    leafMap.fitBounds([[20, -15], [55, 65]], { padding: [30, 30] });

  } catch (err) {
    console.error('GeoJSON load failed:', err);
    // Fallback: show a note in the news ticker
    broadcastNews('⚠️ Map data failed to load. Please ensure countries.geojson is in the game folder.');
  }
}

// ── TERRITORY STYLE ───────────────────────────────────────────
function styleFeature(feature) {
  const mapping = REGIONS[feature.properties.name];
  if (!mapping) return {};
  const t = G.territories[mapping.id];
  if (!t) return {};

  const isSelected = G.selectedId === mapping.id;
  const isMarchSrc = G.marchSource === mapping.id;

  if (t.owner && FACTIONS[t.owner]) {
    const f = FACTIONS[t.owner];
    return {
      fillColor:   f.color,
      fillOpacity: isSelected ? 0.75 : f.fillOpacity,
      color:       isMarchSrc ? '#ffffff' : (isSelected ? '#ffffff' : f.border),
      weight:      isSelected || isMarchSrc ? 3.5 : 1.5,
      dashArray:   isSelected ? '8, 4' : null,
    };
  } else {
    return {
      fillColor:   '#b8a878',
      fillOpacity: isSelected ? 0.55 : 0.3,
      color:       isSelected ? '#fff' : '#6e5a30',
      weight:      isSelected ? 3 : 1,
      dashArray:   isSelected ? '8, 4' : null,
    };
  }
}

// ── CANVAS REFRESH ────────────────────────────────────────────
// Called from game.js after any state change
function refreshCanvas() {
  if (!geoLayer) return;
  geoLayer.eachLayer(layer => layer.setStyle(styleFeature(layer.feature)));
}

// ── FEATURE CALLBACKS ─────────────────────────────────────────
function onEachFeature(feature, layer) {
  const mapping = REGIONS[feature.properties.name];
  if (!mapping) return;

  // Tooltip
  layer.bindTooltip(() => buildTooltipHTML(mapping), {
    sticky: true,
    opacity: 1,
    className: '',
    direction: 'top',
  });

  layer.on({
    mouseover(e) {
      if (G.selectedId !== mapping.id) {
        e.target.setStyle({ fillOpacity: 0.85, weight: 2.5 });
        e.target.bringToFront();
      }
    },
    mouseout(e) {
      geoLayer.resetStyle(e.target);
      refreshCanvas();
    },
    click() {
      handleTerritoryClick(mapping.id);
    },
  });
}

function buildTooltipHTML(mapping) {
  const t = G.territories[mapping.id];
  if (!t) return mapping.name;
  const ownerName = t.owner && FACTIONS[t.owner] ? FACTIONS[t.owner].name : 'Unclaimed';
  const pop = t.population.toLocaleString();
  const power = armyPower(t.army);
  return `<div class="terr-tooltip">
    <strong>${mapping.name}</strong>
    <div class="terr-tooltip-owner">${ownerName} · Pop ${pop} · Power ${power}</div>
  </div>`;
}

// ── CLICK HANDLING ────────────────────────────────────────────
function handleTerritoryClick(regionId) {
  // If in march mode, execute the march to this territory
  if (G.marchSource) {
    marchTo(regionId);
    refreshCanvas();
    return;
  }

  // Normal select
  selectTerritory(regionId);
  refreshCanvas();
}
