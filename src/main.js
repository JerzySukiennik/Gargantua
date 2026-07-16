// Bootstrap and app state machine: LOBBY → GAME. Wires scene, player, suit, net, audio, UI.
import * as THREE from 'three';
import { CONFIG, SPAWN_SLOTS } from './config.js';
import { createRenderer } from './scene/renderer.js';
import { createLoop } from './core/loop.js';
import { createInput } from './core/input.js';
import { createBlackHole } from './scene/blackhole.js';
import { buildStation } from './scene/station.js';
import { createAvatars } from './scene/avatars.js';
import { createPlayer } from './game/player.js';
import { createSuit } from './game/suit.js';
import { createPois } from './game/pois.js';
import { createHUD } from './ui/hud.js';
import { createLobby } from './ui/lobby.js';
import { createAudio } from './audio/audio.js';

window.__gargantuaBooted = true;

const canvas = document.getElementById('view');
const { renderer, scene, camera } = createRenderer(canvas);
const input = createInput(canvas);
const blackHole = createBlackHole(scene);
const station = await buildStation(scene);
const avatars = await createAvatars(scene, camera);
const player = createPlayer({ camera, input, station });
const suit = createSuit({ player, station, bhDirection: blackHole.direction });
const hud = createHUD();
const audio = createAudio();
const pois = createPois({ station, hud });

let mode = 'lobby';
let elapsed = 0;
let returnHold = 0;
let publishAcc = 0;
let transport = null;
let playerName = 'ASTRONAUT';
let colorSlot = 0;

const headlamp = new THREE.SpotLight(0xfff6e0, 0, 30, Math.PI / 7, 0.45, 1.2);
camera.add(headlamp);
camera.add(headlamp.target);
headlamp.position.set(0, 0.2, 0);
headlamp.target.position.set(0, 0, -1);
scene.add(camera);

const pauseEl = document.getElementById('pause');
const pauseRoomLine = document.getElementById('pause-room-line');
const btnCopyCode = document.getElementById('btn-copy-code');
const remoteSamples = [];

const lobby = createLobby({
  onEnter(t, name) {
    transport = t;
    playerName = name;
    colorSlot = transport.spawnSlot ? transport.spawnSlot() % SPAWN_SLOTS.length : 0;
    const spawn = SPAWN_SLOTS[colorSlot];
    player.state.pos.set(spawn[0], spawn[1] + 4, spawn[2] + 6);
    player.state.vel.set(0, 0, 0);
    camera.position.copy(player.state.pos);
    camera.lookAt(0, 2, 0);

    pois.bind(transport, playerName);
    transport.onEvent('join', ({ name }) => { hud.toast((name || 'ASTRONAUT') + ' JOINED THE EVA'); audio.play('join', { vol: 0.6 }); });
    transport.onEvent('leave', ({ name }) => { hud.toast((name || 'ASTRONAUT') + ' LEFT', true); audio.play('leave', { vol: 0.6 }); });
    transport.onEvent('discovery', () => audio.play('discovery', { vol: 0.7 }));

    audio.init();
    enterGame();
  },
});

player.on('onGrab', () => audio.playGrab());
player.on('onRelease', () => {});
player.on('onPushOff', () => audio.play('servo', { pitch: 1.3, vol: 0.25 }));
player.on('onImpact', (speed) => {
  audio.playClunk(speed > 4);
  hud.toast('HULL IMPACT — SUIT ' + Math.round(suit.res.suit) + '%', true);
});
suit.on('onTowStart', () => { hud.toast('SUIT AUTOPILOT — SAR TOW ENGAGED', true); audio.play('warn', { vol: 0.8 }); audio.play('radio_blip', { vol: 0.4 }); });
suit.on('onTowEnd', () => hud.toast('O2 EMERGENCY REFILL COMPLETE'));

function enterGame() {
  mode = 'game';
  pauseEl.hidden = true;
  hud.show(true);
  hud.setSuitLog(pois.logHTML());
  hud.setRoomTag(transport && transport.roomCode ? 'ROOM <b>' + transport.roomCode + '</b>' : 'SOLO EVA');
  input.setEnabled(true);
  input.requestLock();
}

function pauseGame() {
  if (mode !== 'game') return;
  mode = 'paused';
  pauseEl.hidden = false;
  const rc = transport && transport.roomCode;
  pauseRoomLine.textContent = rc ? 'ROOM CODE: ' + rc : 'SOLO EVA';
  btnCopyCode.hidden = !rc;
}

document.getElementById('btn-resume').addEventListener('click', () => {
  if (input.requestLock()) { mode = 'game'; pauseEl.hidden = true; }
});
btnCopyCode.addEventListener('click', () => {
  if (transport && transport.roomCode) navigator.clipboard.writeText(transport.roomCode).catch(() => {});
  audio.play('ui_tick');
});
document.getElementById('vol-slider').addEventListener('input', (e) => audio.setVolume(e.target.value / 100));
document.getElementById('btn-exit').addEventListener('click', () => {
  if (transport) transport.leave();
  window.location.reload();
});
input.on('unlock', () => { if (mode === 'game') pauseGame(); });
input.on('lock', () => { if (mode === 'paused') { mode = 'game'; pauseEl.hidden = true; } });

function publishState() {
  if (!transport || !transport.roomCode) return;
  const p = player.state;
  let flags = 0;
  if (p.thrusting) flags |= 1;
  if (p.headlamp) flags |= 2;
  if (suit.res.o2 < 15) flags |= 4;
  if (p.mode === 'grab') flags |= 8;
  transport.publish({
    name: playerName,
    color: colorSlot,
    x: p.pos.x, y: p.pos.y, z: p.pos.z,
    qx: camera.quaternion.x, qy: camera.quaternion.y, qz: camera.quaternion.z, qw: camera.quaternion.w,
    grab: p.mode === 'grab' && p.grab ? p.grab.anchor : null,
    flags,
  });
}

function simulate(dt) {
  const tick = input.tick();
  if (mode !== 'game') return;

  player.update(dt, tick);
  suit.update(dt, input.isDown('KeyF'));
  pois.update(dt, player.state.pos);

  if (tick.pressed.has('Tab')) {
    hud.setSuitLog(pois.logHTML());
    hud.toggleSuitLog();
  }
  if (tick.pressed.has('KeyL')) player.state.headlamp = !player.state.headlamp;

  if (player.state.distToStation > CONFIG.player.returnDistance && input.isDown('KeyR')) {
    returnHold += dt;
    if (returnHold > CONFIG.player.returnHoldSec) player.startAutoReturn();
  } else {
    returnHold = 0;
  }

  headlamp.intensity = player.state.headlamp && suit.res.power > 0 ? 60 : 0;
  audio.setThruster(player.state.thrusting && suit.res.power > 0);
  audio.setBreathStress(suit.res.o2 <= 0 ? 1 : suit.res.o2 < 25 ? (25 - suit.res.o2) / 25 * 0.8 : 0);

  publishAcc += dt;
  if (publishAcc >= 1 / CONFIG.net.publishHz) {
    publishAcc = 0;
    publishState();
  }
}

function render(dt) {
  elapsed += dt;
  blackHole.update(elapsed);

  if (mode === 'game' || mode === 'paused') {
    const { dx, dy } = input.consumeLook();
    if (mode === 'game') {
      const s = CONFIG.player.lookSensitivity;
      rotateCamera(dx * s, dy * s, dt);
      player.applyComfortRoll(dt);
    }
    if (transport) {
      transport.sampleRemotes(Date.now(), remoteSamples);
      avatars.update(remoteSamples);
      avatars.updatePlates();
    }
    updateHud();
  } else {
    camera.position.lerp(LOBBY_CAM_POS, 0.0015);
    camera.quaternion.slerp(LOBBY_CAM_QUAT, 0.0015);
  }

  renderer.render(scene, camera);
}

const LOBBY_CAM_POS = new THREE.Vector3(58, 16, 44);
const LOBBY_CAM_QUAT = new THREE.Quaternion();
{
  const m = new THREE.Matrix4().lookAt(LOBBY_CAM_POS, new THREE.Vector3(-40, 22, -60), new THREE.Vector3(0, 1, 0));
  LOBBY_CAM_QUAT.setFromRotationMatrix(m);
  camera.position.copy(LOBBY_CAM_POS);
  camera.quaternion.copy(LOBBY_CAM_QUAT);
}

const qPitch = new THREE.Quaternion();
const qYaw = new THREE.Quaternion();
const qRoll = new THREE.Quaternion();
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

function rotateCamera(yaw, pitch, dt) {
  qYaw.setFromAxisAngle(Y_AXIS, -yaw);
  qPitch.setFromAxisAngle(X_AXIS, -pitch);
  camera.quaternion.multiply(qYaw).multiply(qPitch);
  let roll = 0;
  if (input.isDown('KeyQ')) roll += 1;
  if (input.isDown('KeyE')) roll -= 1;
  if (roll) {
    qRoll.setFromAxisAngle(Z_AXIS, roll * CONFIG.player.rollSpeed * dt);
    camera.quaternion.multiply(qRoll);
  }
}

function updateHud() {
  hud.setBars(suit.res);

  const p = player.state;
  if (p.mode === 'grab') hud.setHand('fist');
  else if (p.aim) hud.setHand('open');
  else hud.setHand('none');

  hud.setPrompt(suit.promptFor());

  if (p.returning) hud.setWarn('SUIT AUTOPILOT\nRETURNING TO STATION');
  else if (p.distToStation > CONFIG.player.returnDistance) hud.setWarn('ADRIFT — HOLD R FOR AUTO-RETURN');
  else if (p.distToStation > CONFIG.player.warnDistance) hud.setWarn('DRIFTING FROM STATION');
  else if (suit.res.o2 <= 0) hud.setWarn('OXYGEN DEPLETED');
  else hud.setWarn(null);

  hud.setVignette(suit.res.o2 <= 0 ? 0.85 : suit.res.o2 < 15 ? (15 - suit.res.o2) / 15 * 0.5 : 0);
}

const loop = createLoop({
  simulate,
  render,
  heartbeat: () => { if (transport) transport.heartbeat(); },
  hz: CONFIG.simHz,
});
loop.start();

window.__game = { renderer, scene, camera, blackHole, station, player, suit, hud, pois, audio, lobby, avatars, get transport() { return transport; } };
