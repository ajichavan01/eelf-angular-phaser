# Phaser Evolution Lab

A standalone TypeScript game client using Phaser 3.90 and Vite 7. This is the recommended starting point for a larger **2D browser game** built from Eelf. It uses Phaser scenes, cameras, input and reusable sprites, with the simulation kept independent of Phaser.

## Run

Prerequisites: Node 22.12+ on the 22.x line or Node 24+, npm 10+, and approved package-registry access.

From the repository root:

```bash
cd web
npm install
npm run dev:phaser
```

Open `http://127.0.0.1:5173`. The Angular server is not required. To choose another port, run `npm run dev --workspace @eelf/phaser -- --port 5175` from `web`. Vite fails when a requested port is occupied instead of silently attaching to another application.

From this project directory after the root installation, `npm run dev`, `npm run build`, and `npm run preview` also work. The application depends on the sibling shared packages through npm workspaces.

## Build and Deploy

From `web`:

```bash
npm run build --workspace @eelf/phaser
npm run preview --workspace @eelf/phaser
```

The preview URL is `http://127.0.0.1:5174`. Deploy `apps/phaser/dist/` to any static HTTP(S) host. There is no backend requirement. For a subdirectory deployment, append `--base=/eelf/` to the build command or configure Vite's `base`. Opening the output with `file://` is unsupported because the application uses module workers.

## Technical Design

| File | Responsibility |
| --- | --- |
| [src/main.ts](src/main.ts) | Worker, UI and game startup; HMR/page cleanup |
| [src/WorldScene.ts](src/WorldScene.ts) | Phaser scene, procedural textures, sprite reuse, camera and pointer input |
| [src/LabUI.ts](src/LabUI.ts) | Accessible DOM panels, controls, save/import, settings and population inspection |
| [src/lab.html](src/lab.html) | Responsive lab markup, separate from the game scene |
| [src/simulation.worker.ts](src/simulation.worker.ts) | Module-worker entry consumed by Vite |
| [vite.config.ts](vite.config.ts) | Local server, worker output, ES2022 target, separate Phaser vendor chunk |
| [../../packages/browser/src/Drawing.ts](../../packages/browser/src/Drawing.ts) | Shared anatomy geometry, colors, snapshot interpolation and inspector charts |

Phaser selects WebGL when available and falls back to Canvas. Four small textures are generated locally at scene creation: body, fin, eye, and nourishment imagery, with the fin reused for tails. No remote image assets are needed. Each creature has a reusable container of segment/feature sprites; food uses reusable images. Deaths release objects into pools, births reuse them, and unchanged creatures retain their objects. Within a run, pool sizes are bounded by the peak live population and food limits.

The scene renders snapshots, not mutable simulation objects. Rendering never drives aging, energy use, reproduction, or random-number consumption. The worker uses a 30 Hz fixed step; snapshots arrive at approximately 20 Hz and positions/headings are interpolated in the renderer. DOM statistics update at approximately 5 Hz rather than once per animation frame.

Cameras provide zoom and panning. Spatial hit testing maps a pointer to the displayed creature position, then sends its stable ID to the worker. Genome/vitals panels are normal DOM elements for readable text, forms, keyboard interaction and responsive layout. This avoids drawing an entire application UI into a game canvas.

## Controls

The lab exposes the same simulation controls, environment form, chromosome inspector, history chart, population list, and interoperable JSON saves as the [Angular project](../angular/README.md#controls-and-state).

Use Run/Pause, single-step, speed controls, or restart from a seed. Select a creature in the world or through the Population panel. Zoom using buttons or the wheel, drag to pan, and use Fit world to restore framing. Changes to the environment form apply only when starting a new run. Importing a save is atomic and pauses the restored world.

## Growth Path

- Add new Phaser scenes for menus, campaigns, and scenario editors without moving simulation logic into a scene.
- Replace the procedural textures with an atlas or add authored animation, audio, effects and tilemaps through Phaser's asset pipeline.
- Use the existing simulation package headlessly for experiments or a future authoritative server; clients must not be trusted as multiplayer authorities.
- Add collision-heavy mechanics using an appropriate engine such as Phaser's Matter integration. Current movement is kinematic steering, not a rigid-body solver.
- Profile both snapshot copying and WebGL draw work before raising entity limits. Object pooling does not make a large DOM or a dense sensing workload free.

## Tests and Limitations

From `web`, run `npm test`, `npm run check`, and `npm run test:ui -- --project=phaser-desktop --project=phaser-mobile` after installing dependencies and Playwright Chromium.

**Current environment:** core tests and offline source checks passed, but package access was blocked. The Phaser/Vite build, checks against installed Phaser declarations, WebGL/Canvas fallback, browser interactions, screenshots, and production output remain unverified. See [workspace verification status](../../README.md#current-verification-status).

This is not a 3D engine, a multiplayer implementation, or a feature-for-feature emulation of Processing. See [shared architecture and migration decisions](../../docs/ARCHITECTURE.md) for intentional behavioral changes and deferred features.