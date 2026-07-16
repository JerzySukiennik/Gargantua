// Pointer lock + keyboard/mouse input with per-tick edge queues and re-lock cooldown.
export function createInput(canvas) {
  const down = new Set();
  let pressed = new Set();
  let released = new Set();
  let dx = 0, dy = 0;
  let lmb = false;
  let lmbPressed = false, lmbReleased = false;
  let locked = false;
  let lastUnlock = 0;
  let enabled = false;
  const listeners = { lock: [], unlock: [] };

  document.addEventListener('keydown', (e) => {
    if (!enabled || e.repeat) return;
    down.add(e.code);
    pressed.add(e.code);
    if (['Space', 'Tab', 'KeyF', 'KeyR'].includes(e.code)) e.preventDefault();
  });
  document.addEventListener('keyup', (e) => {
    down.delete(e.code);
    released.add(e.code);
  });
  window.addEventListener('blur', () => { down.clear(); lmb = false; });

  canvas.addEventListener('mousedown', (e) => {
    if (!enabled || !locked || e.button !== 0) return;
    lmb = true; lmbPressed = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button !== 0) return;
    if (lmb) lmbReleased = true;
    lmb = false;
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    dx += e.movementX;
    dy += e.movementY;
  });

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (locked) listeners.lock.forEach((f) => f());
    else { lastUnlock = performance.now(); listeners.unlock.forEach((f) => f()); }
    dx = 0; dy = 0;
  });

  return {
    get locked() { return locked; },
    setEnabled(v) { enabled = v; if (!v) { down.clear(); lmb = false; } },
    requestLock() {
      if (locked) return true;
      if (performance.now() - lastUnlock < 1300) return false;
      canvas.requestPointerLock();
      return true;
    },
    exitLock() { if (locked) document.exitPointerLock(); },
    on(evt, fn) { listeners[evt].push(fn); },
    isDown(code) { return down.has(code); },
    tick() {
      const out = { pressed, released, lmb, lmbPressed, lmbReleased };
      pressed = new Set();
      released = new Set();
      lmbPressed = false;
      lmbReleased = false;
      return out;
    },
    consumeLook() {
      const out = { dx, dy };
      dx = 0; dy = 0;
      return out;
    },
  };
}
