// Station layout data: "spine and pods" on a 4m grid. c = grid coords, r = quarter-turns Y, s = scale override.
export function buildLayout() {
  const L = [];
  const add = (m, c, r = 0, opts = {}) => L.push({ m, c, r, ...opts });

  for (let x = -12; x <= 12; x++) {
    if (x === -8 || x === 0 || x === 8) { add('corridor_cross', [x, 0, 0]); continue; }
    const alt = ((x % 3) + 3) % 3;
    add(alt === 0 ? 'corridor_window' : alt === 1 ? 'corridor' : 'corridor_windowClosed', [x, 0, 0], 1);
  }
  add('corridor_end', [13, 0, 0], 3);
  add('corridor_end', [-13, 0, 0], 1);
  add('structure_detailed', [13.9, 0, 0]);
  add('structure', [-13.9, 0, 0]);

  for (let z = 1; z <= 5; z++) add(z === 3 ? 'corridor_window' : 'corridor', [0, 0, z]);
  add('hangar_roundGlass', [0, 0, 7.2]);
  add('machine_generator', [1.6, 0, 7.2]);
  add('craft_miner', [3.2, 0.9, 6.4], 2, { float: true });

  for (let z = -1; z >= -3; z--) add('corridor_windowClosed', [0, 0, z]);
  add('corridor_end', [0, 0, -3.8], 2);
  add('structure_detailed', [0, 0, -4.6], 0, { poi: 'cupola' });

  for (let z = 1; z <= 2; z++) add('corridor', [-8, 0, z]);
  add('hangar_roundB', [-8, 0, 4.2], 2);
  add('alien', [-9.8, 0, 4.9], 1, { s: 2, poi: 'sleeper-alien' });
  add('barrels', [-7.2, 0, 5.3]);

  for (let z = -1; z >= -2; z--) add('corridor_window', [-8, 0, z], 0);
  add('platform_large', [-8, -0.1, -4.5]);
  add('rocket_baseA', [-8, -0.1, -4.5], 0, { stack: 'rocket' });
  add('rocket_fuelA', [-8, 1.5, -4.5], 0, { stack: 'rocket' });
  add('rocket_sidesA', [-8, 2.0, -4.5], 0, { stack: 'rocket' });
  add('rocket_topA', [-8, 3.0, -4.5], 0, { stack: 'rocket' });
  add('machine_barrelLarge', [-6.6, -0.1, -4.0], 0, { poi: 'repair' });
  add('barrel', [-6.6, -0.1, -5.0]);
  add('rover', [-9.4, -0.1, -3.6], 3);

  for (let z = 1; z <= 2; z++) add('corridor', [8, 0, z]);
  add('platform_large', [8, -0.1, 3.5]);
  add('machine_wirelessCable', [8, -0.1, 3.2]);
  add('machine_wireless', [7.0, -0.1, 4.2], 1);
  for (let y = 0; y <= 2; y++) add('pipe_supportHigh', [9.0, y, 4.2]);
  add('pipe_ringHigh', [9.0, 3, 4.2]);
  add('satelliteDish_large', [9.0, 4.3, 4.2], 2, { poi: 'antenna-garden' });
  add('satelliteDish', [7.8, 0.9, 4.9], 2);
  add('satelliteDish_detailed', [9.9, 0.9, 3.4], 1);

  for (let z = -1; z >= -2; z--) add('corridor_windowClosed', [8, 0, z], 0);
  add('platform_large', [8, -0.1, -4.5]);
  add('machine_generatorLarge', [8, -0.1, -4.5], 1, { poi: 'power' });
  add('machine_barrel', [9.2, -0.1, -3.8], 2);
  add('barrels', [6.9, -0.1, -5.1], 1);
  add('desk_computer', [7.2, -0.1, -3.9], 1);

  add('machine_barrel', [-10, 0, 0.85], 0, { poi: 'o2-west' });
  add('machine_barrel', [-4, 0, -0.85], 2, { poi: 'o2-midwest' });
  add('machine_barrel', [4, 0, 0.85], 0, { poi: 'o2-mideast' });
  add('machine_barrel', [10, 0, -0.85], 2, { poi: 'o2-east' });

  for (let x = -9; x <= 9; x++) add('monorail_trackStraight', [x, 1.8, -7], 1, { float: true });
  add('monorail_trainFront', [2, 1.95, -7], 1, { float: true, poi: 'monorail' });
  add('monorail_trainBox', [3.1, 1.95, -7], 1, { float: true });

  add('pipe_straight', [-4, 0.2, 1.5], 0);
  add('pipe_straight', [-4, 0.2, 2.5], 0);
  add('pipe_straight', [4, 0.2, -1.5], 0);
  add('pipe_straight', [4, 0.2, -2.5], 0);
  add('pipe_ring', [-4, 0.2, 2.0], 0);
  add('pipe_ring', [4, 0.2, -2.0], 0);

  add('astronautB', [14.5, 2.2, -9], 1, { s: 1.2, float: true, tilt: true, poi: 'old-suit' });

  add('supports_low', [-2, -0.5, 0], 0, { flip: true });
  add('supports_low', [2, -0.5, 0], 0, { flip: true });

  L.push({ type: 'solar', pos: [-6, 1.5, 10], w: 30, h: 11 });
  L.push({ type: 'solar', pos: [-6, 1.5, -10], w: 30, h: 11 });
  L.push({ type: 'solar', pos: [6, 1.5, 10], w: 30, h: 11 });
  L.push({ type: 'solar', pos: [6, 1.5, -10], w: 30, h: 11 });
  L.push({ type: 'boom', from: [-6, 1.5, 0.5], to: [-6, 1.5, 8.6] });
  L.push({ type: 'boom', from: [-6, 1.5, -0.5], to: [-6, 1.5, -8.6] });
  L.push({ type: 'boom', from: [6, 1.5, 0.5], to: [6, 1.5, 8.6] });
  L.push({ type: 'boom', from: [6, 1.5, -0.5], to: [6, 1.5, -8.6] });
  L.push({ type: 'boom', from: [-6, 0.5, 0], to: [-6, 1.45, 0], up: true });
  L.push({ type: 'boom', from: [6, 0.5, 0], to: [6, 1.45, 0], up: true });

  return L;
}
