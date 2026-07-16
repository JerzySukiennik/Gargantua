// Remote snapshot interpolation buffer: samples ~150ms in the past. Pure JS, no THREE, no Firebase.
import { CONFIG } from '../config.js';

export const INTERP_DELAY_MS = CONFIG.net.interpDelayMs;
const MAX_SNAPS = 8;
const EASE_LAMBDA = 12;

const lerp = (a, b, t) => a + (b - a) * t;

export class RemoteBuffer {
  constructor() {
    this.snaps = [];
    this.name = '';
    this.color = 0;
    this.joinedAt = 0;
    this._prevMs = 0;
    this._primed = false;
  }

  push(recvMs, fields) {
    this.name = fields.name || this.name;
    this.color = fields.color;
    this.joinedAt = fields.joinedAt || this.joinedAt;
    const snaps = this.snaps;
    if (snaps.length && recvMs <= snaps[snaps.length - 1].t) return;
    snaps.push({ t: recvMs, s: fields });
    while (snaps.length > MAX_SNAPS) snaps.shift();
  }

  sample(renderMs, out) {
    const snaps = this.snaps;
    if (!snaps.length) return null;
    const target = renderMs - INTERP_DELAY_MS;
    const dt = this._prevMs ? Math.min(Math.max((renderMs - this._prevMs) / 1000, 0), 0.1) : 0;
    const wasPrimed = this._primed;
    this._prevMs = renderMs;
    this._primed = true;

    if (snaps.length === 1 || target <= snaps[0].t) return copyFields(snaps[0].s, out, this);

    const last = snaps[snaps.length - 1];
    if (target >= last.t) {
      if (!wasPrimed || target - last.t <= 2) return copyFields(last.s, out, this);
      return easeFields(out, last.s, dt, this);
    }

    let a = snaps[0], b = last;
    for (let i = 0; i < snaps.length - 1; i++) {
      if (snaps[i].t <= target && snaps[i + 1].t >= target) { a = snaps[i]; b = snaps[i + 1]; break; }
    }
    const span = b.t - a.t;
    const u = span > 1e-6 ? (target - a.t) / span : 0;
    const near = u < 0.5 ? a.s : b.s;
    out.x = lerp(a.s.x, b.s.x, u);
    out.y = lerp(a.s.y, b.s.y, u);
    out.z = lerp(a.s.z, b.s.z, u);
    quatNlerp(a.s, b.s, u, out);
    out.gx = near.gx; out.gy = near.gy; out.gz = near.gz;
    out.flags = near.flags;
    out.name = this.name;
    out.color = this.color;
    return out;
  }
}

function quatNlerp(a, b, u, out) {
  let bx = b.qx, by = b.qy, bz = b.qz, bw = b.qw;
  const dot = a.qx * bx + a.qy * by + a.qz * bz + a.qw * bw;
  if (dot < 0) { bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let qx = lerp(a.qx, bx, u), qy = lerp(a.qy, by, u), qz = lerp(a.qz, bz, u), qw = lerp(a.qw, bw, u);
  const len = Math.hypot(qx, qy, qz, qw) || 1;
  out.qx = qx / len; out.qy = qy / len; out.qz = qz / len; out.qw = qw / len;
}

function copyFields(s, out, buf) {
  out.x = s.x; out.y = s.y; out.z = s.z;
  out.qx = s.qx; out.qy = s.qy; out.qz = s.qz; out.qw = s.qw;
  out.gx = s.gx; out.gy = s.gy; out.gz = s.gz;
  out.flags = s.flags;
  out.name = buf.name;
  out.color = buf.color;
  return out;
}

function easeFields(out, s, dt, buf) {
  const k = Math.exp(-EASE_LAMBDA * dt);
  out.x = s.x + (out.x - s.x) * k;
  out.y = s.y + (out.y - s.y) * k;
  out.z = s.z + (out.z - s.z) * k;
  quatNlerp(out, s, 1 - k, out);
  out.gx = s.gx; out.gy = s.gy; out.gz = s.gz;
  out.flags = s.flags;
  out.name = buf.name;
  out.color = buf.color;
  return out;
}

export function makeRemoteSample() {
  return { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1, gx: 0, gy: 0, gz: 0, flags: 0, name: '', color: 0, id: '' };
}
