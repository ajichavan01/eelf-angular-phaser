# Simulation and Migration Architecture

## Scope

This migration adds two independently executable browser applications without changing the original Java sources. It preserves the conceptual World, Population, Creature, Genetics and Nourishments structure, while replacing global state and render-driven updates with explicit state and a fixed-step worker.

It is a behavioral rewrite, not an automatic Java-to-TypeScript transpilation or a guarantee of numerically identical Java runs. Java saves, if added separately, are not compatible with these JSON saves. Rendering uses new procedural anatomy; legacy Processing window placement is not reproduced.

## Package Boundaries

```text
web/
  apps/
    angular/                 Angular components + Canvas renderer
    phaser/                  Phaser scene + DOM lab panels
  packages/
    simulation/
      src/
        World.ts             Fixed-step orchestration, food, births/deaths, snapshots
        Population.ts        Creation and stable creature lookup
        GameParameters.ts    Defaults, limits, input validation
        Genetics/            Eight chromosomes and normalized alleles
        Creature/            Body, senses, decisions, steering, metabolism, reproduction
        Nourishments/        Plant/meat state and geometry
        SpatialHash.ts       Bounded nearby-object queries
        Persistence.ts       Versioned, validated save/load
        Clock.ts             Fixed-step accumulator
    browser/
      src/
        Runtime.ts           Testable command processor
        SimulationWorker.ts  Worker adapter and scheduler
        SimulationClient.ts  UI bridge, request lifecycle and visibility state
        Drawing.ts           Geometry, interpolation and charts
        CanvasRenderer.ts    Angular's renderer
        styles.css           Shared responsive lab styling
  tests/                     Playwright tests for both applications
```

The simulation has **no Angular, Phaser, DOM, or npm runtime dependencies**. Its tests run directly with Node's TypeScript type stripping. Production builds use TypeScript 5.9 and each framework's bundler. Browser packages share controls/protocol utilities, while each application's UI integration and world renderer are separate.

## Execution and Ownership

1. The application starts a module worker through a bundler-recognized `new Worker(new URL(..., import.meta.url))` entry.
2. The worker creates one World with its own seeded random-number generator. No simulation state is stored in process-wide globals.
3. A 50 ms scheduler feeds elapsed time into a 30 Hz fixed-step accumulator. Speed multipliers change the number of fixed ticks, not the equations' time step.
4. Each tick performs staggered perception, decisions, feeding, movement and metabolism; removes dead creatures; periodically considers reproduction; decays meat and regrows plants.
5. At approximately 20 Hz, the worker sends structured-cloned snapshots and the selected creature's details. The UI never mutates the worker's world.
6. Renderers interpolate snapshot positions and shortest-arc headings at display refresh rate. UI subscribers are throttled to approximately 5 Hz while running.

Single-step advances exactly one 1/30-second tick while paused. Hidden tabs suspend advancement, and resuming does not simulate the entire hidden duration. Catch-up is capped at 0.25 real seconds and at most 30 ticks per scheduler call. Under severe overload the simulation deliberately slows relative to wall time instead of accumulating an unbounded work backlog.

Selection, export and feeding commands do not reset the scheduler's elapsed-time origin. Pause, visibility, load and reset commands discard stale timing debt. Both canvas animation loops and worker/client listeners have explicit teardown paths.

## Java Mapping

| Java boundary | Web implementation | Important change |
| --- | --- | --- |
| Main, static World and utilities | Per-app bootstrap and per-worker World/Random | Multiple experiments can be isolated; no mutable global singletons |
| World.Display | World.step + frame + separate renderer | Drawing cannot change the simulation |
| Population | Population + World lifecycle | Stable numeric IDs, live population cap, removal on death |
| Genome, Chromosome, GeneDefinitions | Genetics/Genome | Eight named chromosomes; 36 normalized loci; explicit ranges/thresholds |
| CreatureBody and BodySegments | Cached phenotype + segmentPose + renderer | Segmented head/body, optional fins, tail, eyes, mouth; geometric animation |
| CreatureVision and Olfactory | CreatureVision and decision engine | Range/FOV and scent tests; no ray-line allocation or visual occlusion |
| CreatureDecisionEngine | Staggered food scoring and roaming | Plant/meat choice incorporates efficiency and sense dominance |
| CreaturePhysics | Bounded kinematic steering | Time-based speed and turn limits; enabled fins/tail affect movement |
| Vitals, Metabolism, StomachContent | Creature state + CreatureMetabolism | Bounded health/energy, explicit stomach capacity, digestion and aging |
| CreatureReproduction | Two-parent crossover and mutation | Completes the previously stubbed reproduction cycle with a simpler model |
| Plant/Meat nourishment | Nourishment union | Consumed food is removed; plants regrow; dead creatures produce decaying meat |
| Separate Processing inspector windows | Responsive lab panels | One browser window with selection, genome inspection and environment controls |

The original World proximity implementation scanned all entities and did not enforce the creature radius consistently. The spatial hash now performs actual squared-radius filtering. Creatures reference food by stable ID, not by a mutable array position, so removal cannot silently retarget a different food item.

## Genes and Phenotypes

Chromosomes are Body (11 loci), Vision (5), Physics (3), Mouth (3), Aging (2), Metabolism (7), Reproduction (3), and Olfactory (2). Alleles are finite numbers in [0, 1]. `expressGenome` maps them into simulation units once at creation/load. Color channels are consolidated to hue, and some related size genes are consolidated; the old gene-ID catalog is not retained verbatim.

Eyes, mouth, tail and flippers use the original inclusive presence threshold of 0.5. Disabled features have zero visual size and skip corresponding behavior: no eyes means no vision, no mouth means no biting, and absent fins/tails contribute no movement bonus. Founder mouths are deliberately initialized above the threshold so the initial population can feed; mutation can still disable them.

A seed determines founder genomes, positions, roaming destinations, inheritance and mutations. Saving includes the current PRNG state. Renderers never consume this generator, so rendering frequency does not alter evolution.

Food decisions evaluate nearby resources by distance, dietary conversion efficiency, and the stronger available visual/scent signal. Vision is a geometric field of view without occlusion; scent is a radius, not a diffusion field. There is no attack/predation combat. Meat comes from dead creatures.

## Energy, Life and Reproduction

Distances and times are new simulation units and seconds; Java tick-scale constants are not copied unchanged. Body mass, speed, tail and fin expression affect movement. Energy is spent through basal metabolism and actual movement; stored food is digested proportionally and converted with plant/meat efficiencies. Starvation damages health, adequate energy permits limited healing, and lifespan bounds survival.

Every 15 ticks, ready adults look for a nearby eligible partner within 90 units. Both must be mature, out of cooldown, sufficiently healthy, and above 76% energy. Each allele is selected independently from one parent, with a bounded mutation perturbation of up to 0.16 in either direction. The world mutation setting is multiplied by the parents' mutation traits. Each parent pays a genetic fraction of its maximum energy; the offspring receives at most 85% of that combined investment and is capped at its own maximum energy.

Offspring are born immediately, record two parent IDs, and increase the lineage generation. Sex differentiation, gestation, unborn-health calculations, pheromone communication, detailed organ colors, and collision/deformation physics are intentionally not implemented. These should be separate future features, not assumed parity with all named Java classes. Extinction is possible and is not silently reversed by auto-spawning founders.

## Persistence and Validation

Version 1 JSON contains the format marker, validated settings, tick, next entity ID, random state, food-growth remainder, cumulative statistics, bounded history, creature genomes/vitals/targets, and food state. Derived phenotypes are recomputed on load. Saves are interchangeable between the Angular and Phaser applications.

Import is atomic: construct and validate a new World first, then replace the current one. Validation covers versions, integer/finite bounds, entity counts, unique IDs, chromosome lengths, allele ranges, coordinates, stomach capacity, energy/health and bounded history. File size is limited to 8 MB before parsing. Invalid imports report an error without changing the running world. Import pauses the restored world. Unknown save versions are rejected; there is no implicit migration of incompatible gene layouts.

Only the selected creature's full genome is sent with normal UI snapshots. No user input is inserted into HTML; Phaser's generated genetic labels are static identifiers and dynamic values are set using textContent. Save data is not code, and no import is evaluated. No credentials, telemetry, remote persistence or network game authority are included.

## Performance Decisions

- Nearby queries use 96-unit spatial-hash cells and enforce true radius checks. Cells are reused; food and creature sensing no longer require unconditional global pairwise scans.
- Perception is staggered across creatures every six ticks; mating is evaluated every fifteen ticks.
- Fixed stepping separates simulation correctness from display frequency and prevents frame-dependent metabolism.
- Phenotypes are cached at birth/load. Genes are not repeatedly decoded during rendering or every decision.
- The Phaser renderer reuses creature containers and food sprites rather than rebuilding its scene graph every frame.
- Pixel ratio is capped at 2. History holds at most 180 samples, population lists show 40 rows per page, and settings cap populations at 1,500 and food at 3,000 objects.
- Snapshots contain only rendering/sensing traits, not every creature's metabolic/reproductive phenotype or genome. Full details are included only for the selected creature. Snapshots use structured cloning, not shared memory; copying and allocation still cost time and are measured separately in the benchmark.

These caps are guardrails, not a guarantee of 60 FPS at the maximum settings. Dense spatial cells can still produce near-quadratic work. The Canvas renderer and Phaser renderer also have different GPU/CPU costs. Benchmark headless computation and profile both real browsers before raising limits.

### Measured Sample

On the development machine (2026-10-16, Windows x64, Node 22.23.3), 300 ticks after a 30-tick warm-up produced:

| Initial / final population | Mean tick | p95 tick | Frame + structured clone | JSON snapshot |
| --- | --- | --- | --- | --- |
| 72 / 96 | 0.145 ms | 0.386 ms | 0.705 ms | 54.6 KiB |
| 250 / 349 | 0.346 ms | 0.653 ms | 1.744 ms | 177.2 KiB |
| 1,000 / 1,000 | 0.951 ms | 2.540 ms | 4.326 ms | 489.1 KiB |

At 1,000 creatures, removing nonvisual phenotype fields reduced serialized snapshot size from 1,032.1 KiB to 489.1 KiB, approximately 53%. These are single-machine headless measurements, not statistically controlled performance guarantees. They exclude browser drawing, actual worker transport, and UI updates; `structuredClone` cost is measured in-process. Use `npm run benchmark` to repeat the measurements on a target machine.

For substantially higher counts, consider packed typed-array snapshots with transferable buffers, finer-grained sensing budgets, lower snapshot rates, render culling, and eventually a profiled Rust/WASM numerical subsystem. Do not adopt shared memory, ECS, or a new language merely because they are available; preserve a testable ownership boundary first.

## Testing and Extension

The native tests cover deterministic genetics, optional features, mutation invariants, fixed-step behavior, spatial queries, feeding, reproduction, death, save continuation, corrupt imports, bounded long runs, command processing, actual worker-thread transport, interpolation, and procedural geometry. The Playwright suite is provided for both frameworks and viewport classes, but was not executed because dependencies were blocked in the development environment.

When adding a gene, update its chromosome definition, phenotype expression, UI/render behavior where relevant, and regression tests. A chromosome-layout change requires a new save version and an explicit migration or clear rejection. When adding a new sense or behavior, keep its decision logic in the simulation package. When adding assets or game scenes, keep them in the renderer/application so headless execution remains possible.

For multiplayer, run the simulation on an authoritative server and validate commands there. The current worker is a local responsiveness boundary, not a security boundary against the person controlling the browser.