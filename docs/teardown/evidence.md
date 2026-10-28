# Evidence: Eelf web architecture teardown

A concept drawing: the subject has no physical form, so each layer of the web architecture is one plate. Use: an explainer figure for the README or onboarding, viewed on screen. Output size: landscape A3 sheet (420 × 297 mm), with PNG, SVG and PDF downloads from the viewer.

Layer order and roles come from `docs/ARCHITECTURE.md` and `packages/browser/src`. Plate sizes, thicknesses and spacing are invented.

| Feature group | Evidence | Source and treatment |
| --- | --- | --- |
| Simulation core plate, spatial-hash grid etching | Concept with no physical form | `packages/simulation/src` (World, Population, Genetics, Nourishments, SpatialHash). The grid suggests the hash; its cell count is illustrative |
| Fixed-step clock disc, 30 ticks | Concept with no physical form | `Clock.ts`, a 30 Hz fixed-step accumulator. One tick per step in one second |
| Worker runtime plate | Concept with no physical form | `Runtime.ts` and `SimulationWorker.ts`, which own the World and the 50 ms scheduler |
| Snapshot stream (up arrow), command stream (down arrow) | Concept with no physical form | `postMessage`: frames go out to the UI at about 20 Hz and commands come back. Arrow direction carries the meaning |
| Simulation client plate | Concept with no physical form | `SimulationClient.ts` and the `SnapshotInterpolator` in `Drawing.ts` |
| Canvas 2D renderer / Phaser WebGL scene | Concept with no physical form | `CanvasRenderer.ts` (Angular app) and `apps/phaser/src/WorldScene.ts` |
| Angular controls / Phaser DOM panels, button outlines | Concept with no physical form | `apps/angular/src/app.component.*` and `apps/phaser/src/LabUI.ts`, `lab.html`. Button count is illustrative |
| Colors | Concept | Teal (hue 163, the lab's accent) for shared layers, red for Angular, violet for Phaser, blue and amber for the two streams |

Left out: the shared stylesheet (`packages/browser/src/styles.css`), persistence and the Java app. They are not in the runtime data path.

## Rebuild and proof

From `docs/teardown/`:

```sh
npm install
node tools/teardown/scripts/proof.cjs drawing.json proof/ --quick   # while iterating
node tools/teardown/scripts/proof.cjs drawing.json proof/           # every spacing + occlusion check
node tools/teardown/scripts/build-viewer.cjs drawing.json eelf-architecture.html
node tools/teardown/scripts/check-viewer.cjs eelf-architecture.html check/
```

On Windows the copied `scripts/commands.cjs` also looks for Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`, Edge, or a path in `CHROME_PATH`. `proof.cjs` and `check-viewer.cjs` build `file://` URLs with `pathToFileURL`.
