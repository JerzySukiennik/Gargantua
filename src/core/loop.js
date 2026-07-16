// Fixed-timestep simulation loop with rAF rendering and hidden-tab heartbeat failsafe.
export function createLoop({ simulate, render, heartbeat, hz = 60 }) {
  const step = 1 / hz;
  let acc = 0;
  let last = performance.now();
  let running = false;
  let rafId = 0;
  let hbTimer = 0;

  function frame(now) {
    if (!running) return;
    rafId = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    let steps = 0;
    while (acc >= step && steps < 8) {
      simulate(step);
      acc -= step;
      steps++;
    }
    if (steps === 8) acc = 0;
    render(dt);
  }

  function onVisibility() {
    if (document.hidden) {
      if (heartbeat && !hbTimer) hbTimer = setInterval(heartbeat, 1000);
    } else {
      if (hbTimer) { clearInterval(hbTimer); hbTimer = 0; }
      last = performance.now();
      acc = 0;
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      document.addEventListener('visibilitychange', onVisibility);
      rafId = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
      if (hbTimer) { clearInterval(hbTimer); hbTimer = 0; }
    },
  };
}
