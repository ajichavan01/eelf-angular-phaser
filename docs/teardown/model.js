// Eelf web architecture as an exploded stack of plates, bottom to top:
// simulation core, fixed-step clock, worker runtime, postMessage streams,
// simulation client, then one column per app (renderer, controls).
self.DrawingModels ??= {};
self.DrawingModels.architecture = (parameters, options) => {
  const G = TechnicalGeometry;
  const W = 160, D = 70, HALF_W = W / 2, HALF_D = D / 2;
  const GAP = 0.6;      // about a tenth of a plate, so stacked faces never share a plane
  const PLATE = 6, THIN = 5;
  const SPLIT = 4;      // gap between the Angular and Phaser columns
  const APP_SPREAD = 14; // extra sideways travel when the app columns separate

  const parts = [];
  const add = (id, name, explosion) => {
    const p = G.part(id, name);
    p.explosion = explosion;
    parts.push(p);
    return p;
  };
  const rect = (p, x0, y0, x1, y1, z, role = 'detail') =>
    G.polyline(p, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], {closed: true, role});

  // Simulation core: World, Population, Genome, Nourishment. Top face etched with the spatial hash grid.
  let z = 0;
  const core = add('core', 'Simulation core', [0, 0, 0]);
  G.box(core, [-HALF_W, -HALF_D, z], [HALF_W, HALF_D, z + PLATE], {radius: 3});
  const coreTop = z + PLATE + 0.05;
  for (let x = -HALF_W + 20; x < HALF_W; x += 20) G.line(core, [x, -HALF_D + 4, coreTop], [x, HALF_D - 4, coreTop], 'texture');
  for (let y = -HALF_D + 17.5; y < HALF_D; y += 17.5) G.line(core, [-HALF_W + 4, y, coreTop], [HALF_W - 4, y, coreTop], 'texture');
  z += PLATE + GAP;

  // Fixed-step clock: a disc with one tick per step of the 30 Hz accumulator.
  const clock = add('clock', 'Fixed-step clock', [0, 0, 16]);
  const CLOCK_R = 16, CLOCK_H = 3, CLOCK_X = 46;
  const disc = Array.from({length: 96}, (_, i) => [CLOCK_X + CLOCK_R * Math.cos(i * Math.PI / 48), CLOCK_R * Math.sin(i * Math.PI / 48)]);
  G.merge(clock, G.transform(G.extrude(G.piece(), disc, {depth: CLOCK_H}), {origin: [0, 0, z]}));
  const clockTop = z + CLOCK_H + 0.05;
  for (let i = 0; i < 30; i++) {
    const a = i * Math.PI / 15, r0 = i % 5 === 0 ? 10 : 12.5;
    G.line(clock, [CLOCK_X + r0 * Math.cos(a), r0 * Math.sin(a), clockTop], [CLOCK_X + 14.5 * Math.cos(a), 14.5 * Math.sin(a), clockTop], 'detail');
  }
  z += CLOCK_H + GAP;

  // Worker runtime: the module worker that owns the World and the scheduler.
  const worker = add('worker', 'Worker runtime', [0, 0, 58]);
  G.box(worker, [-HALF_W, -HALF_D, z], [HALF_W, HALF_D, z + THIN], {radius: 3});
  rect(worker, -HALF_W + 6, -HALF_D + 6, HALF_W - 6, HALF_D - 6, z + THIN + 0.05);
  z += THIN + GAP;

  // postMessage streams: snapshots rise to the UI, commands descend to the worker.
  const ARROW_H = 24, ARROW_T = 4;
  const arrowUp = [[-3, 0], [3, 0], [3, 15], [8, 15], [0, ARROW_H], [-8, 15], [-3, 15]];
  const arrowDown = arrowUp.map(([x, y]) => [x, ARROW_H - y]);
  const snapshots = add('snapshots', 'Snapshot stream', [0, 0, 88]);
  G.merge(snapshots, G.transform(G.extrude(G.piece(), arrowUp, {depth: ARROW_T}), {...G.plane('xz'), origin: [-30, -12 + ARROW_T / 2, z]}));
  const commands = add('commands', 'Command stream', [0, 0, 88]);
  G.merge(commands, G.transform(G.extrude(G.piece(), arrowDown, {depth: ARROW_T}), {...G.plane('xz'), origin: [30, 12 + ARROW_T / 2, z]}));
  z += ARROW_H + GAP;

  // Simulation client: request lifecycle, visibility state and snapshot interpolation.
  const client = add('client', 'Simulation client', [0, 0, 118]);
  G.box(client, [-HALF_W, -HALF_D, z], [HALF_W, HALF_D, z + THIN], {radius: 3});
  rect(client, -HALF_W + 6, -HALF_D + 6, HALF_W - 6, HALF_D - 6, z + THIN + 0.05);
  z += THIN + GAP;

  // Per-app columns. Left: Angular. Right: Phaser.
  const column = (side, zBase, id, name, lift, detail) => {
    const x0 = side < 0 ? -HALF_W : SPLIT / 2, x1 = side < 0 ? -SPLIT / 2 : HALF_W;
    const p = add(id, name, [side * APP_SPREAD, 0, lift]);
    G.box(p, [x0, -HALF_D, zBase], [x1, HALF_D, zBase + THIN], {radius: 3});
    detail(p, x0, x1, zBase + THIN + 0.05);
    return p;
  };
  const canvasFrame = (p, x0, x1, top) => rect(p, x0 + 6, -HALF_D + 6, x1 - 6, HALF_D - 6, top);
  const buttons = (p, x0, x1, top) => {
    const n = 4, w = (x1 - x0 - 12 - (n - 1) * 4) / n;
    for (let i = 0; i < n; i++) {
      const bx = x0 + 6 + i * (w + 4);
      rect(p, bx, HALF_D - 18, bx + w, HALF_D - 8, top);
    }
    rect(p, x0 + 6, -HALF_D + 8, x1 - 6, HALF_D - 26, top);
  };
  column(-1, z, 'angularRenderer', 'Canvas 2D renderer', 158, canvasFrame);
  column(1, z, 'phaserScene', 'Phaser WebGL scene', 158, canvasFrame);
  z += THIN + GAP;
  column(-1, z, 'angularControls', 'Angular controls', 198, buttons);
  column(1, z, 'phaserPanels', 'Phaser DOM panels', 198, buttons);

  const camera = {azimuth: -118, elevation: 24, roll: 0};
  const trails = [
    {a: [-30, -12, 15.8], b: [-30, -12, 15.8], from: 'worker', to: 'snapshots'},
    {a: [30, 12, 15.8 + ARROW_H], b: [30, 12, 15.8 + ARROW_H], from: 'commands', to: 'client'},
  ];
  return TechnicalProjection.render(parts, {...options, camera, trails});
};
