// Lobby flow: callsign entry, create/join room over the live scene, player list, ENTER EVA.
import { createTransport } from '../net/transport.js';
import { PLAYER_COLORS } from '../config.js';

const NAME_KEY = 'gargantua-callsign';

export function createLobby({ onEnter }) {
  const el = {
    lobby: document.getElementById('lobby'),
    main: document.getElementById('lobby-main'),
    room: document.getElementById('lobby-room'),
    name: document.getElementById('lobby-name'),
    code: document.getElementById('lobby-code'),
    error: document.getElementById('lobby-error'),
    roomCode: document.getElementById('lobby-room-code'),
    players: document.getElementById('lobby-players'),
    btnCreate: document.getElementById('btn-create'),
    btnJoin: document.getElementById('btn-join'),
    btnSolo: document.getElementById('btn-solo'),
    btnEnter: document.getElementById('btn-enter'),
    btnLeave: document.getElementById('btn-leave'),
  };

  let transport = null;
  let pollTimer = 0;

  el.name.value = localStorage.getItem(NAME_KEY) || '';

  function getName() {
    const n = (el.name.value || 'ASTRONAUT').trim().toUpperCase().slice(0, 12) || 'ASTRONAUT';
    localStorage.setItem(NAME_KEY, n);
    return n;
  }

  function setError(msg) { el.error.textContent = msg || ''; }
  function busy(b) {
    for (const k of ['btnCreate', 'btnJoin', 'btnSolo']) el[k].disabled = b;
  }

  function renderPlayers() {
    if (!transport) return;
    const list = [{ name: getName() + ' (YOU)', color: transport.spawnSlot ? transport.spawnSlot() : 0 }];
    for (const p of transport.listPlayers()) list.push(p);
    el.players.innerHTML = list.map((p) =>
      `<div class="player-row"><div class="player-dot" style="background:#${PLAYER_COLORS[(p.color || 0) % PLAYER_COLORS.length].toString(16).padStart(6, '0')}"></div>${escapeHtml(p.name || 'ASTRONAUT')}</div>`
    ).join('');
  }

  function showRoom(code) {
    el.main.hidden = true;
    el.room.hidden = false;
    el.roomCode.textContent = code;
    renderPlayers();
    pollTimer = setInterval(renderPlayers, 1500);
  }

  function backToMain() {
    clearInterval(pollTimer);
    el.main.hidden = false;
    el.room.hidden = true;
    setError('');
  }

  el.btnCreate.addEventListener('click', async () => {
    setError('');
    busy(true);
    try {
      transport = await createTransport('online');
      const code = await transport.createRoom();
      showRoom(code);
    } catch (e) {
      setError('COULD NOT CREATE ROOM — ' + (e.message || 'OFFLINE'));
      transport = null;
    }
    busy(false);
  });

  el.btnJoin.addEventListener('click', async () => {
    setError('');
    busy(true);
    try {
      transport = await createTransport('online');
      const code = await transport.joinRoom(el.code.value);
      showRoom(code);
    } catch (e) {
      const msg = { 'bad code': 'CODE MUST BE 4 CHARACTERS', 'room not found': 'ROOM NOT FOUND', 'room full': 'ROOM IS FULL' }[e.message];
      setError(msg || 'COULD NOT JOIN — OFFLINE?');
      transport = null;
    }
    busy(false);
  });

  el.btnSolo.addEventListener('click', async () => {
    transport = await createTransport('solo');
    start();
  });

  el.btnEnter.addEventListener('click', start);

  el.btnLeave.addEventListener('click', () => {
    if (transport) transport.leave();
    transport = null;
    backToMain();
  });

  function start() {
    clearInterval(pollTimer);
    el.lobby.hidden = true;
    onEnter(transport, getName());
  }

  return {
    show() {
      el.lobby.hidden = false;
      backToMain();
      transport = null;
    },
  };
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
