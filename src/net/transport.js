// Transport seam: NullTransport for solo, FirebaseTransport loaded lazily for co-op. Provider swap = this file.
export class NullTransport {
  constructor() {
    this.connected = true;
    this.roomCode = null;
    this.localId = 'solo';
    this.activeCount = 1;
  }
  async connect() {}
  async createRoom() { return null; }
  async joinRoom() { throw new Error('offline'); }
  publish() {}
  heartbeat() {}
  sampleRemotes(nowMs, out) { out.length = 0; return out; }
  onEvent() { return () => {}; }
  publishDiscovery() {}
  leave() {}
  listPlayers() { return []; }
}

export async function createTransport(mode) {
  if (mode === 'solo') return new NullTransport();
  const { FirebaseTransport } = await import('./firebase.js');
  return new FirebaseTransport();
}
