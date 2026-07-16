// Wire protocol: paths, room codes, player node encode/decode, quantization.
import { CONFIG } from '../config.js';

export const STALE_MS = CONFIG.net.staleMs;
export const MAX_PLAYERS = CONFIG.net.maxPlayers;
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export const FLAG_THRUST = 1;
export const FLAG_LAMP = 2;
export const FLAG_LOW_O2 = 4;
export const FLAG_GRAB = 8;

export function makeRoomCode() {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return s;
}

export function normalizeCode(raw) {
  const s = (raw || '').toUpperCase().replace(/[^A-Z2-9]/g, '');
  return s.length === CODE_LENGTH ? s : null;
}

const q2 = (v) => Math.round(v * 100) / 100;
const q3 = (v) => Math.round(v * 1000) / 1000;

export function encodePlayer(st) {
  const node = {
    n: st.name,
    c: st.color | 0,
    j: st.joinedAt,
    p: [q2(st.x), q2(st.y), q2(st.z)],
    q: [q3(st.qx), q3(st.qy), q3(st.qz), q3(st.qw)],
    f: st.flags | 0,
  };
  if (st.grab) node.g = [q2(st.grab.x), q2(st.grab.y), q2(st.grab.z)];
  return node;
}

export function decodePlayer(v) {
  if (!v || !Array.isArray(v.p) || !Array.isArray(v.q)) return null;
  return {
    name: typeof v.n === 'string' ? v.n.slice(0, 12) : 'ASTRONAUT',
    color: v.c | 0,
    joinedAt: +v.j || 0,
    x: +v.p[0] || 0, y: +v.p[1] || 0, z: +v.p[2] || 0,
    qx: +v.q[0] || 0, qy: +v.q[1] || 0, qz: +v.q[2] || 0, qw: +v.q[3] || 1,
    gx: v.g ? +v.g[0] : 0, gy: v.g ? +v.g[1] : 0, gz: v.g ? +v.g[2] : 0,
    flags: v.f | 0,
    lastSeen: +v.lastSeen || 0,
  };
}
