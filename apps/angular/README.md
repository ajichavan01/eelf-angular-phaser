# Angular Evolution Lab

A standalone, zoneless Angular 21 application with a Canvas 2D ecosystem and an isolated simulation worker. It is intended for an application-heavy future: experiment configuration, specimen inspection, data analysis, and eventually larger dashboards.

## Run

Prerequisites: Node 22.12+ on the 22.x line or Node 24+, npm 10+, and approved package-registry access.

From the repository root:

```bash
npm install
npm run dev:angular
```

Open `http://127.0.0.1:4200`. The Phaser server is not required. To choose another port, run `npm run dev --workspace @eelf/angular -- --port 4201` from `web`.

From this project directory after the root installation, `npm run dev` and `npm run build` also work. Keep the shared packages alongside the application; it is an npm workspace, not a single-folder distribution.

## Build and Deploy

From `web`:

```bash
npm run build --workspace @eelf/angular
```

Deploy the contents of `apps/angular/dist/angular/browser/` to a static HTTP(S) host. No Java server or Angular SSR server is needed. Do not open the generated HTML using `file://`: module workers and asset URLs require HTTP(S).

For a subdirectory deployment, pass `--base-href /eelf/` to the Angular build command and serve the resulting directory at that path. Serve JavaScript and worker chunks with JavaScript MIME types. A restrictive content-security policy must allow same-origin scripts, workers, fonts, and the application's generated styles.

## Technical Design

| File | Responsibility |
| --- | --- |
| [src/main.ts](src/main.ts) | Standalone bootstrap and zoneless change detection |
| [src/app.component.ts](src/app.component.ts) | Signals, UI state, controls, selection, lifecycle cleanup |
| [src/app.component.html](src/app.component.html) | Accessible responsive lab, environment form, population and chromosome panels |
| [src/icon.component.ts](src/icon.component.ts) | Small Angular adapter for Lucide SVG icons |
| [src/simulation.worker.ts](src/simulation.worker.ts) | Bundler-recognized module-worker entry |
| [angular.json](angular.json) | Separate development/production targets and worker compilation |
| [../../packages/browser/src/CanvasRenderer.ts](../../packages/browser/src/CanvasRenderer.ts) | Canvas lifecycle, camera, pointer selection, overlays and rendering |
| [../../packages/browser/src/SimulationClient.ts](../../packages/browser/src/SimulationClient.ts) | Typed worker messages, throttled UI updates, save requests, error handling |

The worker owns every authoritative entity. It advances a 30 Hz fixed-step simulation, emits snapshots at approximately 20 Hz, and suspends advancement while the document is hidden. UI subscribers are notified at most approximately 5 Hz during a run. Canvas renders independently through requestAnimationFrame and interpolates between snapshots; Angular does not detect changes once per creature per rendered frame.

The component uses `OnPush` and signals rather than Zone.js. Canvas and worker listeners are explicitly removed during component destruction. Device-pixel ratio is capped at 2, population lists are paginated, and the chart history is bounded. Fonts are bundled from Fontsource; the live creature anatomy is procedurally rendered, without external image-service requests.

## Controls and State

- Run/pause, one fixed tick while paused, and 1x/2x/4x simulation speed.
- Restart uses the environment form's seed/settings. Environment changes take effect only when starting a new run.
- Add nourishment inserts up to 24 plants, subject to the global food cap.
- Export downloads a versioned JSON snapshot. Import validates the entire snapshot before replacing the world and leaves the restored simulation paused.
- Select a creature on the canvas or through the searchable, sortable population list. The inspector shows anatomy, energy, health, age, lineage, optional body parts, and all 36 alleles across eight chromosomes.
- Drag the world to pan when zoomed; use the mouse wheel or zoom buttons. Fit world resets the camera. Senses shows the selected creature's field of view and scent radius; Energy shows per-creature energy bars.
- The panel tabs support Left/Right, Home, and End keys. Population buttons provide a keyboard-accessible alternative to canvas selection. Mobile stacks the inspector beneath the world.

## Tests and Limitations

From `web`, run `npm test`, `npm run check`, and `npm run test:ui -- --project=angular-desktop --project=angular-mobile` after installing dependencies and the Playwright Chromium browser.

**Current environment:** core tests and offline source checks passed, but package access was blocked. The Angular build, strict template compilation, browser interactions, screenshots, and production output remain unverified. See [workspace verification status](../../README.md#current-verification-status).

Canvas 2D is deliberately the simpler renderer. It is suitable for the current bounded simulation, but large populations, many effects, or complex animated assets should be profiled. For a richer game client, reuse this Angular UI around a Phaser renderer or adopt the [separate Phaser project](../phaser/README.md); keep the simulation outside Angular in either case.

See [shared architecture](../../docs/ARCHITECTURE.md) for numerical behavior, Java-to-TypeScript changes, persistence, performance limits, and extension points.
