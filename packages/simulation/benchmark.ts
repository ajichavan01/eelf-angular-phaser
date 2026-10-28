import { DEFAULT_PARAMETERS, World } from './src/index.ts';

const results = [];
for (const initialPopulation of [72, 250, 1000]) {
  const world = new World({ ...DEFAULT_PARAMETERS, initialPopulation, maxPopulation: Math.max(500, initialPopulation), plants: Math.min(2000, initialPopulation * 3) });
  world.step(30);
  const samples = [];
  for (let tick = 0; tick < 300; tick++) {
    const started = performance.now();
    world.step();
    samples.push(performance.now() - started);
  }
  const started = performance.now();
  for (let iteration = 0; iteration < 50; iteration++) structuredClone(world.frame());
  const snapshotMs = (performance.now() - started) / 50;
  samples.sort((left, right) => left - right);
  results.push({
    initialPopulation,
    finalPopulation: world.population.creatures.length,
    food: world.food.length,
    meanStepMs: Number((samples.reduce((total, sample) => total + sample, 0) / samples.length).toFixed(3)),
    p95StepMs: Number(samples[Math.floor(samples.length * 0.95)].toFixed(3)),
    frameAndCloneMs: Number(snapshotMs.toFixed(3)),
    snapshotKiB: Number((new TextEncoder().encode(JSON.stringify(world.frame())).length / 1024).toFixed(1)),
  });
}
console.log(`Eelf headless benchmark / Node ${process.version} / ${process.platform} ${process.arch}`);
console.table(results);
console.log('30 fixed ticks/s; 300 measured ticks after 30 warm-up ticks. Browser rendering and real worker transport are not measured.');