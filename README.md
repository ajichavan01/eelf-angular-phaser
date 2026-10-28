# Eelf Web

Two separately served and separately deployable applications, one shared artificial-life simulation. The Java application in the repository root remains available and unchanged.

| Project | Stack | Default URL | Documentation |
| --- | --- | --- | --- |
| Angular Evolution Lab | Angular 21, TypeScript, Canvas 2D | http://127.0.0.1:4200 | [Angular](apps/angular/README.md) |
| Phaser Evolution Lab | Phaser 3.90, TypeScript, Vite 7 | http://127.0.0.1:5173 | [Phaser](apps/phaser/README.md) |

## Recommendation

**Choose TypeScript + Phaser for the game-first, browser-first version of Eelf.** It provides a scene lifecycle, GPU sprite rendering, cameras, input, asset loading, animation, audio, and an established game ecosystem. Those capabilities are a better growth path for this 2D simulation than using Angular alone as a game engine.

Angular is feasible and appropriate when application UI dominates: complex settings, analysis tools, accounts, dashboards, and administration. Its components must not own thousands of per-frame DOM elements. Here, Angular renders the controls; Canvas draws the ecosystem; a worker owns the simulation.

Neither choice guarantees unlimited scale. Web Workers keep the UI responsive but do not make simulation computation inherently faster. For a future native-first or substantial 3D game, evaluate Godot, Unity, or Unreal against the target platforms instead of forcing this 2D web architecture into that role. Rust/WebAssembly is a possible later optimization for measured numerical bottlenecks, not a requirement for this migration.

## Requirements

- Node 22.12+ on the 22.x line, or Node 24+, with npm 10+.
- A modern browser with module workers, Canvas 2D, ResizeObserver, and structuredClone. Phaser uses WebGL when available and falls back to Canvas.
- Access to an approved npm registry for framework/tool dependencies. No Java runtime or backend service is required by either web app.

On the development machine, a checksum-verified portable Node 22.23.3 runtime was placed under `%LOCALAPPDATA%\EelfTools\node-v22.23.3-win-x64`. It was added only to the working terminal's PATH, not to system settings. To use that existing installation in another PowerShell terminal:

```powershell
$env:PATH = "$env:LOCALAPPDATA\EelfTools\node-v22.23.3-win-x64;$env:PATH"
node --version
```

## Install and Run

From the repository root:

```bash
npm install
npm test
npm run dev
```

This starts both applications in parallel: Angular at `http://127.0.0.1:4200` and Phaser at `http://127.0.0.1:5173`. To run only one application:

```bash
npm run dev:angular
# or
npm run dev:phaser
```

The npm workspaces link the shared packages. Run installation from the repository root, not from a copied application folder. Each application has its own entry point, worker bundle, build configuration, and output directory; neither application needs the other server running.

If a port is occupied, use another port rather than terminating an unrelated process:

```bash
npm run dev --workspace @eelf/angular -- --port 4201
npm run dev --workspace @eelf/phaser -- --port 5175
```

On PowerShell systems that block npm's script shim, use `npm.cmd` in place of `npm`.

## Verification

The simulation, worker protocol, real worker-thread adapter, rendering mathematics, and save validation have dependency-free tests:

```bash
node --experimental-strip-types --test packages/simulation/test/*.test.ts
```

Once dependencies are installed:

```bash
npm run check
npx playwright install chromium
npm run test:ui
npm run benchmark
```

`check` runs core tests, shared-package typechecking, and both production builds. The Playwright suite starts both dev servers and covers desktop and mobile viewports, nonblank canvas pixels, motion, pause/single-step, settings, selection, keyboard tabs, save/import, invalid-save handling, screenshots, and horizontal overflow. Screenshots and reports go into ignored test-output directories. Set `EELF_ANGULAR_PORT` and `EELF_PHASER_PORT` to free ports before running the suite if the defaults are occupied.

`benchmark` reports headless tick time, frame construction plus structured-clone time, and serialized snapshot size at three population sizes. These are diagnostic measurements, not browser FPS guarantees. It can also run without installation: `node --experimental-strip-types packages/simulation/benchmark.ts`.

### Current Verification Status

All 22 dependency-free tests passed using Node 22.23.3, including the real worker-thread adapter. The simulation and non-icon browser logic passed typechecking with VS Code's bundled TypeScript 6.0.3 compiler; 39 TypeScript files passed syntax checks, 12 JSON configurations parsed, and 26 local documentation links resolved. The projects themselves pin TypeScript 5.9.3. These offline checks are not a substitute for the pinned-toolchain build, Angular template compilation, or checking against installed Phaser types.

Dependency installation was blocked by the organization's web filter. At the user's direction, source implementation continued without installing packages. Consequently, full framework builds, Playwright tests, screenshots, and live dev servers were **not** verified. No lockfile was fabricated. After an approved installation, run the verification commands above and commit the generated `package-lock.json`; use `npm ci` for subsequent reproducible installs.

Use the organization's approved registry/certificate setup. Do not disable TLS verification or bypass the web filter. Node's system-certificate support can resolve a corporate CA trust issue, but it cannot grant access to a blocked registry.

## Architecture

- [Shared simulation and migration notes](docs/ARCHITECTURE.md)
- [Angular technical documentation](apps/angular/README.md)
- [Phaser technical documentation](apps/phaser/README.md)

The applications are local experiments, not networked multiplayer games. Exported JSON saves are interchangeable between them. There is no automatic cloud save, authentication, analytics, or server-side authority.
