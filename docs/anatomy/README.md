# Eelf evolution lab (Anatomy figure)

An interactive isometric figure of this project, made with the [Anatomy](https://github.com/wheresryan22/anatomy) skill. Open `eelf-lab.html` (light) or `eelf-lab-dark.html` in a browser. Each page is self-contained and runs this repository's own `SimulationRuntime` and `SnapshotInterpolator`, bundled from `packages/browser/src`.

| Part of the bench | Part of the project |
| --- | --- |
| Raised deck | One app's Web Worker |
| Tray, floor grid, eels and food | `World` on its 96-unit spatial hash |
| Escape wheel, one tooth per tick | `FixedStepClock`, 1/30 s steps, 50 ms scheduler |
| Speed dial and brake shoe | Speed 1×/2×/4× and pause |
| Seed hopper | Add nourishment |
| Camera and its lamp | A frame posted after each scheduler call that runs |
| Cable and dock | `postMessage`: snapshots out, commands back |
| Two viewers on a carriage | The Angular and Phaser apps; a swap exports and imports the save |

Controls: Space runs or pauses, the right arrow steps one tick while paused, 1, 2 or 4 sets the speed, F adds plants, R restarts, S swaps apps.

## Rebuilding

The build needs the Anatomy kit. Clone it, copy `source/` into `examples/eelf-lab/`, and run from there:

```bash
git clone --depth 1 https://github.com/wheresryan22/anatomy.git
cp -r docs/anatomy/source anatomy/examples/eelf-lab
cd anatomy/examples/eelf-lab
node build.mjs --light --root=/path/to/this/repo --audit   # eelf-lab-light.html, ends "audit passed"
node build.mjs --root=/path/to/this/repo                   # eelf-lab.html (dark)
```

Node 22.13 or later is needed for `module.stripTypeScriptTypes`.
