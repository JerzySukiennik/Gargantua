// Suit resources: O2/POWER/SUIT/TEMP drains, station refills, soft consequences, SAR tow.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const S = CONFIG.suit;

const STATION_TYPES = {
  'o2-west': 'o2', 'o2-midwest': 'o2', 'o2-mideast': 'o2', 'o2-east': 'o2',
  'power': 'power', 'repair': 'suit',
};

const LABELS = { o2: 'REFILL O2', power: 'RECHARGE POWER', suit: 'REPAIR SUIT' };

export function createSuit({ player, station, bhDirection }) {
  const res = { o2: 100, power: 100, suit: 100, temp: 21 };
  const state = { res, refilling: null, o2ZeroT: 0, towing: false, nearStation: null };
  const events = { onToast: [], onTowStart: [], onTowEnd: [], onRefill: [] };
  const on = (n, f) => events[n].push(f);
  const emit = (n, a) => events[n].forEach((f) => f(a));

  const refillPoints = [];
  for (const [poi, type] of Object.entries(STATION_TYPES)) {
    if (station.poiAnchors[poi]) refillPoints.push({ type, pos: station.poiAnchors[poi], poi });
  }

  player.on('onImpact', (speed) => {
    res.suit = Math.max(S.suitFloor, res.suit - S.suitImpactDamage * Math.min(3, speed / 3));
  });

  const tmp = new THREE.Vector3();

  function nearestRefill(pos) {
    let best = null, bd = S.interactRange;
    for (const r of refillPoints) {
      const d = pos.distanceTo(r.pos);
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  }

  function update(dt, interactHeld) {
    const p = player.state;

    let o2Rate = S.o2DrainPerSec;
    if (p.thrusting) o2Rate *= S.o2ThrustFactor;
    if (res.suit < S.suitLowThreshold) o2Rate *= S.o2LowSuitFactor;
    res.o2 = Math.max(0, res.o2 - o2Rate * dt);

    if (p.thrusting && res.power > 0) res.power = Math.max(0, res.power - S.powerRcsPerSec * dt);
    if (p.headlamp && res.power > 0) res.power = Math.max(0, res.power - S.powerLampPerSec * dt);

    tmp.copy(p.pos).sub(station.center).normalize();
    const exposure = 0.5 + 0.5 * tmp.dot(bhDirection);
    const targetTemp = S.tempMin + (S.tempMax - S.tempMin) * exposure;
    res.temp += (targetTemp - res.temp) * 0.02 * dt * 10;
    if ((res.temp > 70 || res.temp < -40) && res.power > 0) {
      res.power = Math.max(0, res.power - 0.15 * dt);
    }

    const solar = tmp.dot(bhDirection) > 0.2 ? S.powerSolarPerSec : 0;
    if (!p.thrusting) res.power = Math.min(100, res.power + solar * dt);

    state.nearStation = nearestRefill(p.pos);
    state.refilling = null;
    if (state.nearStation && interactHeld) {
      const r = state.nearStation;
      state.refilling = r.type;
      if (r.type === 'o2') res.o2 = Math.min(100, res.o2 + S.o2RefillPerSec * dt);
      if (r.type === 'power') res.power = Math.min(100, res.power + S.powerRefillPerSec * dt);
      if (r.type === 'suit') res.suit = Math.min(100, res.suit + S.suitRepairPerSec * dt);
    }

    if (res.o2 <= 0 && !state.towing) {
      state.o2ZeroT += dt;
      if (state.o2ZeroT > S.o2TowDelaySec) {
        state.towing = true;
        player.startAutoReturn();
        emit('onTowStart');
      }
    } else if (res.o2 > 0) {
      state.o2ZeroT = 0;
    }

    if (state.towing && !player.state.returning) {
      state.towing = false;
      res.o2 = Math.max(res.o2, S.o2TowRefillTo);
      emit('onTowEnd');
    }
  }

  function promptFor() {
    if (!state.nearStation) return null;
    return '[F] ' + LABELS[state.nearStation.type];
  }

  return { res, state, update, on, promptFor };
}
