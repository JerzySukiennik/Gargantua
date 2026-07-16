// Points of interest: data-driven discoveries, shared via transport, persisted to localStorage.
import * as THREE from 'three';

const STORAGE_KEY = 'gargantua-discoveries';

export const POI_DEFS = [
  { id: 'o2-west', name: 'O2 STATION WEST', kind: 'station', radius: 6 },
  { id: 'o2-midwest', name: 'O2 STATION MID-WEST', kind: 'station', radius: 6 },
  { id: 'o2-mideast', name: 'O2 STATION MID-EAST', kind: 'station', radius: 6 },
  { id: 'o2-east', name: 'O2 STATION EAST', kind: 'station', radius: 6 },
  { id: 'power', name: 'POWER PLANT', kind: 'station', radius: 7 },
  { id: 'repair', name: 'SUIT WORKSHOP', kind: 'station', radius: 7 },
  { id: 'cupola', name: 'THE CUPOLA', kind: 'lore', radius: 7, text: 'Observation post aimed straight at the event horizon.' },
  { id: 'antenna-garden', name: 'ANTENNA GARDEN', kind: 'lore', radius: 9, text: 'Deep-space comms array. Last uplink: 34 years ago.' },
  { id: 'monorail', name: 'THE LAST TRAIN', kind: 'lore', radius: 8, text: 'Cargo monorail, parked mid-run. Nobody came back for it.' },
  { id: 'shipyard', name: 'THE SHIPYARD', kind: 'lore', radius: 10, text: 'A rocket fueled and ready. It never launched.' },
  { id: 'sleeper-alien', name: 'THE SLEEPER', kind: 'secret', radius: 5, text: 'Something rests behind hangar B. It is not from the crew.' },
  { id: 'old-suit', name: 'THE OLD SUIT', kind: 'secret', radius: 6, text: 'An empty EVA suit adrift. Its last log: "i can\'t make it this time..."' },
];

export function createPois({ station, hud }) {
  const pois = [];
  for (const def of POI_DEFS) {
    let pos = station.poiAnchors[def.id];
    if (!pos && def.id === 'shipyard') pos = station.poiAnchors['repair'];
    if (!pos) continue;
    pois.push({ ...def, pos: pos.clone() });
  }

  const discovered = new Map();
  try {
    for (const [id, by] of Object.entries(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'))) {
      discovered.set(id, by);
    }
  } catch (e) { /* fresh start */ }

  let transport = null;
  let localName = 'ASTRONAUT';
  const tmp = new THREE.Vector3();
  let checkT = 0;

  function persist() {
    const obj = {};
    for (const [id, by] of discovered) obj[id] = by;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch (e) { /* full */ }
  }

  function markDiscovered(id, by, silent) {
    if (discovered.has(id)) return;
    discovered.set(id, by);
    persist();
    const def = POI_DEFS.find((d) => d.id === id);
    if (!silent && def) {
      hud.toast((by === localName ? 'DISCOVERED: ' : by + ' DISCOVERED: ') + def.name);
    }
  }

  function bind(t, name) {
    transport = t;
    localName = name;
    if (t && t.onEvent) {
      t.onEvent('discovery', ({ poiId, by }) => {
        if (!discovered.has(poiId)) markDiscovered(poiId, by || 'CREW', false);
      });
    }
  }

  function update(dt, playerPos) {
    checkT += dt;
    if (checkT < 0.5) return;
    checkT = 0;
    for (const p of pois) {
      if (discovered.has(p.id)) continue;
      tmp.subVectors(playerPos, p.pos);
      if (tmp.lengthSq() < p.radius * p.radius) {
        markDiscovered(p.id, localName, false);
        if (transport) transport.publishDiscovery(p.id, p.name, localName);
      }
    }
  }

  function logHTML() {
    const total = POI_DEFS.length;
    const items = POI_DEFS.map((d) => {
      const by = discovered.get(d.id);
      return by
        ? `<li>${d.name}<span class="who">${d.kind.toUpperCase()}${d.text ? ' — ' + d.text : ''}</span></li>`
        : `<li class="undiscovered">UNKNOWN ${d.kind === 'secret' ? 'ANOMALY' : 'SITE'}</li>`;
    }).join('');
    return `<h2>SUIT LOG</h2><div class="count">${discovered.size}/${total} DISCOVERED</div><ul>${items}</ul>
      <div class="controls">
        <div><span>LMB</span> GRAB / CRAWL</div>
        <div><span>W/S</span> REEL TETHER</div>
        <div><span>A/D</span> HAND-SWING</div>
        <div><span>SPACE</span> PUSH-OFF</div>
        <div><span>SHIFT+WASD</span> RCS THRUST</div>
        <div><span>Q/E</span> ROLL</div>
        <div><span>F</span> USE STATION</div>
        <div><span>L</span> HEADLAMP</div>
        <div><span>R</span> HOLD: AUTO-RETURN</div>
        <div><span>TAB</span> THIS LOG</div>
      </div>`;
  }

  return { update, bind, logHTML, discovered };
}
