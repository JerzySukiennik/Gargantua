// FirebaseTransport: room-code co-op over RTDB. Firebase SDK dynamic-imported here only.
import { FIREBASE_CONFIG } from '../config.js';
import { STALE_MS, MAX_PLAYERS, makeRoomCode, normalizeCode, encodePlayer, decodePlayer } from './protocol.js';
import { RemoteBuffer, makeRemoteSample } from './interp.js';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.1';

export class FirebaseTransport {
  constructor() {
    this.connected = false;
    this.roomCode = null;
    this.localId = 'p' + Math.random().toString(36).slice(2, 10);
    this.activeCount = 1;
    this.joinedAt = 0;

    this._db = null;
    this._api = null;
    this._roomRef = null;
    this._playersRef = null;
    this._selfRef = null;
    this._buffers = new Map();
    this._samples = new Map();
    this._serverOffset = 0;
    this._unsub = [];
    this._listeners = { join: [], leave: [], discovery: [] };
  }

  async connect() {
    if (this._db) return;
    const [{ initializeApp }, db] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-database.js`),
    ]);
    this._api = db;
    const app = initializeApp(FIREBASE_CONFIG);
    this._db = db.getDatabase(app);
    this._unsub.push(db.onValue(db.ref(this._db, '.info/serverTimeOffset'),
      (s) => { this._serverOffset = s.val() || 0; }));
    this.connected = true;
  }

  _serverNow() { return Date.now() + this._serverOffset; }

  async createRoom() {
    await this.connect();
    const db = this._api;
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = makeRoomCode();
      const metaRef = db.ref(this._db, `rooms/${code}/meta`);
      const snap = await db.get(metaRef);
      const v = snap.val();
      if (v && this._serverNow() - (v.lastActive || v.createdAt || 0) < 7200000) continue;
      await db.set(metaRef, {
        createdAt: db.serverTimestamp(),
        lastActive: db.serverTimestamp(),
        hostId: this.localId,
      });
      await this._enterRoom(code);
      return code;
    }
    throw new Error('could not allocate room code');
  }

  async joinRoom(rawCode) {
    await this.connect();
    const code = normalizeCode(rawCode);
    if (!code) throw new Error('bad code');
    const db = this._api;
    const snap = await db.get(db.ref(this._db, `rooms/${code}`));
    const room = snap.val();
    if (!room || !room.meta) throw new Error('room not found');
    const now = this._serverNow();
    let active = 0;
    for (const [pid, node] of Object.entries(room.players || {})) {
      if (pid === this.localId) continue;
      const n = decodePlayer(node);
      if (n && (!n.lastSeen || now - n.lastSeen < STALE_MS)) active++;
    }
    if (active >= MAX_PLAYERS) throw new Error('room full');
    await this._enterRoom(code);
    return code;
  }

  async _enterRoom(code) {
    const db = this._api;
    this.roomCode = code;
    this.joinedAt = this._serverNow();
    this._roomRef = db.ref(this._db, `rooms/${code}`);
    this._playersRef = db.child(this._roomRef, 'players');
    this._selfRef = db.child(this._playersRef, this.localId);
    db.onDisconnect(this._selfRef).remove();

    this._unsub.push(db.onChildAdded(this._playersRef, (c) => this._onChild(c)));
    this._unsub.push(db.onChildChanged(this._playersRef, (c) => this._onChild(c)));
    this._unsub.push(db.onChildRemoved(this._playersRef, (c) => this._onLeave(c.key)));
    this._unsub.push(db.onChildAdded(db.child(this._roomRef, 'world/discovered'), (c) => {
      this._emit('discovery', { poiId: c.key, ...(c.val() || {}) });
    }));
  }

  publish(state) {
    if (!this._selfRef) return;
    const node = encodePlayer({ ...state, joinedAt: this.joinedAt });
    node.lastSeen = this._api.serverTimestamp();
    this._api.set(this._selfRef, node);
  }

  heartbeat() {
    if (!this._selfRef) return;
    this._api.update(this._selfRef, { lastSeen: this._api.serverTimestamp() });
  }

  publishDiscovery(poiId, name, by) {
    if (!this._roomRef) return;
    const db = this._api;
    db.set(db.child(this._roomRef, `world/discovered/${poiId}`), {
      by, name, at: db.serverTimestamp(),
    });
  }

  _onChild(c) {
    const id = c.key;
    if (id === this.localId) return;
    const n = decodePlayer(c.val());
    if (!n) return;
    if (n.lastSeen && this._serverNow() - n.lastSeen > STALE_MS) {
      this._api.remove(this._api.child(this._playersRef, id));
      return;
    }
    let buf = this._buffers.get(id);
    const fresh = !buf;
    if (!buf) {
      buf = new RemoteBuffer();
      this._buffers.set(id, buf);
      this._samples.set(id, makeRemoteSample());
    }
    buf.push(Date.now(), n);
    if (fresh) this._emit('join', { id, name: n.name });
  }

  _onLeave(id) {
    if (!this._buffers.has(id)) return;
    const name = this._buffers.get(id).name;
    this._buffers.delete(id);
    this._samples.delete(id);
    this._emit('leave', { id, name });
  }

  sampleRemotes(nowMs, out) {
    out.length = 0;
    for (const [id, buf] of this._buffers) {
      const last = buf.snaps.length ? buf.snaps[buf.snaps.length - 1].t : 0;
      if (nowMs - last > STALE_MS) continue;
      const smp = this._samples.get(id);
      if (buf.sample(nowMs, smp)) { smp.id = id; out.push(smp); }
    }
    this.activeCount = out.length + 1;
    return out;
  }

  listPlayers() {
    const arr = [];
    for (const buf of this._buffers.values()) {
      arr.push({ name: buf.name, color: buf.color, joinedAt: buf.joinedAt });
    }
    return arr;
  }

  spawnSlot() {
    let earlier = 0;
    for (const buf of this._buffers.values()) {
      if (buf.joinedAt && buf.joinedAt < this.joinedAt) earlier++;
    }
    return earlier;
  }

  onEvent(name, fn) {
    this._listeners[name].push(fn);
    return () => {
      const i = this._listeners[name].indexOf(fn);
      if (i >= 0) this._listeners[name].splice(i, 1);
    };
  }

  _emit(name, arg) { for (const f of this._listeners[name]) f(arg); }

  leave() {
    for (const u of this._unsub) { try { u(); } catch (e) { /* off */ } }
    this._unsub.length = 0;
    if (this._selfRef) { try { this._api.remove(this._selfRef); } catch (e) { /* gone */ } }
    this._buffers.clear();
    this._samples.clear();
    this._roomRef = null;
    this._selfRef = null;
    this.roomCode = null;
  }
}
