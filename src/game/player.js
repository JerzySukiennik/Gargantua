// Zero-G player: FLOAT/GRAB state machine, tether crawl, push-off, RCS, sphere-vs-AABB collision.
import * as THREE from 'three';
import { CONFIG } from '../config.js';

const P = CONFIG.player;

export function createPlayer({ camera, input, station }) {
  const pos = new THREE.Vector3(0, 14, 26);
  const vel = new THREE.Vector3();
  const prevPos = new THREE.Vector3().copy(pos);

  const raycaster = new THREE.Raycaster();
  raycaster.far = P.grabRange;

  const state = {
    pos, vel,
    mode: 'float',
    aim: null,
    grab: null,
    thrusting: false,
    headlamp: false,
    distToStation: 0,
    returning: false,
    inputLocked: false,
  };

  const events = { onGrab: [], onRelease: [], onImpact: [], onPushOff: [] };
  function emit(name, arg) { for (const f of events[name]) f(arg); }
  function on(name, f) { events[name].push(f); }

  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const closest = new THREE.Vector3();
  const ndc = new THREE.Vector2(0, 0);

  let grabEaseT = 0;
  let returnT = 0;
  let aimTick = 0;

  function updateAim() {
    raycaster.setFromCamera(ndc, camera);
    const meshes = station.nearbyMeshes(pos, P.grabRange + 6);
    const hits = raycaster.intersectObjects(meshes, false);
    state.aim = hits.length ? { point: hits[0].point.clone(), normal: worldNormal(hits[0]), mesh: hits[0].object } : null;
  }

  function worldNormal(hit) {
    const n = hit.face.normal.clone();
    n.transformDirection(hit.object.matrixWorld);
    return n;
  }

  function startGrab() {
    if (!state.aim) return;
    state.mode = 'grab';
    state.grab = {
      anchor: state.aim.point.clone(),
      normal: state.aim.normal.clone(),
      dist: Math.min(Math.max(pos.distanceTo(state.aim.point), P.tetherMin), P.tetherMax),
    };
    grabEaseT = 0;
    emit('onGrab', state.grab);
  }

  function release(impulse) {
    if (state.mode !== 'grab') return;
    const n = state.grab ? state.grab.normal : null;
    state.mode = 'float';
    state.grab = null;
    if (impulse) {
      camera.getWorldDirection(tmp);
      if (n) {
        const into = tmp.dot(n);
        if (into < 0.1) tmp.addScaledVector(n, 0.25 - into).normalize();
      }
      vel.addScaledVector(tmp, P.pushOffSpeed);
      emit('onPushOff');
    }
    emit('onRelease');
  }

  function collide(dt) {
    const idxs = station.query(pos, P.radius + 0.5);
    for (const i of idxs) {
      const c = station.colliders[i];
      closest.set(
        Math.max(c.min.x, Math.min(pos.x, c.max.x)),
        Math.max(c.min.y, Math.min(pos.y, c.max.y)),
        Math.max(c.min.z, Math.min(pos.z, c.max.z)),
      );
      tmp.subVectors(pos, closest);
      let d = tmp.length();
      if (d === 0) {
        tmp.subVectors(pos, tmp2.addVectors(c.min, c.max).multiplyScalar(0.5));
        d = tmp.length() || 1;
      }
      if (d < P.radius) {
        tmp.normalize();
        const vn = vel.dot(tmp);
        if (vn < 0) {
          if (-vn > P.hardImpactSpeed) emit('onImpact', -vn);
          vel.addScaledVector(tmp, -vn * (1 + P.restitution));
        }
        pos.addScaledVector(tmp, P.radius - d);
      }
    }
  }

  function update(dt, tick) {
    prevPos.copy(pos);

    aimTick++;
    if (aimTick % 3 === 0 || state.aim === null) updateAim();

    if (!state.inputLocked) {
      if (tick.lmbPressed && state.mode === 'float' && state.aim) startGrab();
      if (state.mode === 'grab') {
        if (tick.pressed.has('Space')) release(true);
        else if (!tick.lmb) release(false);
      }
    }

    if (state.mode === 'grab' && state.grab) {
      const g = state.grab;
      if (tick.lmbPressed && state.aim && state.aim.point.distanceToSquared(g.anchor) > 0.04) {
        g.anchor.copy(state.aim.point);
        g.normal.copy(state.aim.normal);
        g.dist = Math.min(Math.max(pos.distanceTo(g.anchor), P.tetherMin), P.tetherMax);
        grabEaseT = 0;
        emit('onGrab', g);
      }

      if (!state.inputLocked) {
        if (input.isDown('KeyW')) g.dist = Math.max(P.tetherMin, g.dist - P.reelSpeed * dt);
        if (input.isDown('KeyS')) g.dist = Math.min(P.tetherMax, g.dist + P.reelSpeed * dt);
      }

      tmp.subVectors(pos, g.anchor);
      if (tmp.lengthSq() < 1e-6) tmp.copy(g.normal);
      tmp.normalize();

      if (!state.inputLocked && (input.isDown('KeyA') || input.isDown('KeyD'))) {
        camera.getWorldDirection(fwd);
        right.crossVectors(fwd, camera.up).normalize();
        const dir = input.isDown('KeyD') ? 1 : -1;
        tmp2.copy(right).multiplyScalar(dir);
        tmp2.addScaledVector(tmp, -tmp2.dot(tmp));
        if (tmp2.lengthSq() > 1e-6) {
          tmp2.normalize();
          pos.addScaledVector(tmp2, P.swingSpeed * dt);
          tmp.subVectors(pos, g.anchor).normalize();
        }
      }

      tmp2.copy(g.anchor).addScaledVector(tmp, g.dist);
      grabEaseT = Math.min(1, grabEaseT + dt / P.grabEase);
      const ease = 1 - Math.pow(1 - grabEaseT, 3);
      pos.lerp(tmp2, Math.min(1, ease * 0.5 + 12 * dt));
      vel.subVectors(pos, prevPos).divideScalar(dt);
      if (vel.length() > P.maxSpeed) vel.setLength(P.maxSpeed);
    } else {
      state.thrusting = false;
      if (!state.inputLocked && input.isDown('ShiftLeft')) {
        tmp2.set(0, 0, 0);
        if (input.isDown('KeyW')) tmp2.z -= 1;
        if (input.isDown('KeyS')) tmp2.z += 1;
        if (input.isDown('KeyA')) tmp2.x -= 1;
        if (input.isDown('KeyD')) tmp2.x += 1;
        if (input.isDown('Space')) tmp2.y += 1;
        if (input.isDown('ControlLeft') || input.isDown('KeyC')) tmp2.y -= 1;
        if (tmp2.lengthSq() > 0) {
          state.thrusting = true;
          tmp2.normalize().applyQuaternion(camera.quaternion);
          vel.addScaledVector(tmp2, P.rcsAccel * dt);
          if (vel.length() > P.maxSpeed) vel.setLength(P.maxSpeed);
        }
      }
      pos.addScaledVector(vel, dt);
    }

    collide(dt);

    tmp.copy(pos).clamp(station.bounds.min, station.bounds.max);
    state.distToStation = pos.distanceTo(tmp);

    if (state.returning) {
      returnT += dt;
      tmp.subVectors(station.center, pos).normalize();
      vel.lerp(tmp2.copy(tmp).multiplyScalar(3.0), 0.03);
      if (state.distToStation < 10) {
        state.returning = false;
        state.inputLocked = false;
      }
    }

    camera.position.copy(pos);
  }

  function startAutoReturn() {
    if (state.returning) return;
    state.returning = true;
    state.inputLocked = true;
    returnT = 0;
    if (state.mode === 'grab') release(false);
  }

  function applyComfortRoll(dt) {
    if (!P.comfortAssist || state.mode !== 'grab' || !state.grab) return;
    camera.getWorldDirection(fwd);
    up.copy(state.grab.normal);
    up.addScaledVector(fwd, -up.dot(fwd));
    if (up.lengthSq() < 0.05) return;
    up.normalize();
    right.setFromMatrixColumn(camera.matrix, 0);
    tmp.crossVectors(fwd, up).normalize();
    const cur = right;
    const angle = Math.atan2(tmp2.crossVectors(cur, tmp).dot(fwd), cur.dot(tmp));
    const step = THREE.MathUtils.clamp(-angle, -P.comfortRate * dt, P.comfortRate * dt);
    const q = new THREE.Quaternion().setFromAxisAngle(fwd, step * 0.5);
    camera.quaternion.premultiply(q);
  }

  return { state, update, on, startAutoReturn, applyComfortRoll, release };
}
