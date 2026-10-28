import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_PARAMETERS, FIXED_STEP, GENE_DEFINITIONS, World, expressGenome, loadWorld, parseWorld, FixedStepClock } from '../src/index.ts';
import { SpatialHash } from '../src/SpatialHash.ts';
import { eat } from '../src/Creature/CreatureMetabolism.ts';
import { canSee } from '../src/Creature/CreatureVision.ts';

test('world progression is deterministic and independent of frame frequency', () => {
  const first = new World();
  const second = new World();
  for (let tick = 0; tick < 180; tick++) {
    first.step();
    first.frame();
  }
  second.step(180);
  assert.deepEqual(first.save(), second.save());
});

test('fixed-step clock is frame-rate independent and caps suspension catch-up', () => {
  const clock = new FixedStepClock();
  let ticks = 0;
  for (let frame = 0; frame < 120; frame++) clock.advance(1 / 60, 1, () => ticks++);
  assert.equal(ticks, 60);
  assert.equal(clock.advance(100, 4, () => ticks++), 30);
  assert.equal(clock.advance(Number.NaN, 1, () => ticks++), 0);
  clock.reset();
  assert.equal(clock.advance(FIXED_STEP, 1, () => ticks++), 1);
});

test('spatial queries enforce radius and discard old memberships', () => {
  const spatial = new SpatialHash<{ id: number; x: number; y: number }>();
  spatial.rebuild([{ id: 1, x: 20, y: 20 }, { id: 2, x: 80, y: 80 }, { id: 3, x: 500, y: 500 }]);
  assert.deepEqual(Array.from(spatial.nearby(20, 20, 10)).map(item => item.id), [1]);
  spatial.rebuild([{ id: 4, x: 22, y: 22 }]);
  assert.deepEqual(Array.from(spatial.nearby(20, 20, 10)).map(item => item.id), [4]);
});

test('disabled body parts disable their related behavior', () => {
  const world = new World();
  const creature = world.population.creatures[0];
  creature.genome.Vision[GENE_DEFINITIONS.Vision.indexOf('eyesPresent')] = 0;
  creature.genome.Mouth[GENE_DEFINITIONS.Mouth.indexOf('mouthPresent')] = 0;
  creature.genome.Body[GENE_DEFINITIONS.Body.indexOf('tailPresent')] = 0;
  creature.genome.Body[GENE_DEFINITIONS.Body.indexOf('flippersPresent')] = 0;
  creature.traits = expressGenome(creature.genome);
  assert.equal(creature.traits.visionRange, 0);
  assert.equal(creature.traits.tail, 0);
  assert.equal(creature.traits.flippers, 0);
  assert.equal(canSee(creature, creature, 0), false);
  const food = world.food[0];
  const mass = food.mass;
  assert.equal(eat(creature, food, 1), 0);
  assert.equal(food.mass, mass);
  world.step(60);
  assert.ok(Number.isFinite(creature.x));
});

test('feeding respects stomach capacity and preserves nonnegative food mass', () => {
  const world = new World();
  const creature = world.population.creatures[0];
  const food = world.food[0];
  creature.stomach.plant = creature.traits.stomachCapacity - 0.01;
  eat(creature, food, 100);
  assert.ok(food.mass >= 0);
  assert.ok(creature.stomach.plant <= creature.traits.stomachCapacity + 1e-10);
});

test('two nearby mature parents reproduce with crossover, energy costs and cooldowns', () => {
  const world = new World({ ...DEFAULT_PARAMETERS, initialPopulation: 2, maxPopulation: 3 });
  for (const creature of world.population.creatures) {
    creature.x = 400;
    creature.y = 400;
    creature.age = 60;
    creature.energy = creature.traits.maxEnergy;
  }
  world.step(15);
  assert.equal(world.births, 1);
  assert.equal(world.population.creatures.length, 3);
  const child = world.population.creatures[2];
  assert.equal(child.generation, 2);
  assert.deepEqual(child.parents, [1, 2]);
  assert.notEqual(child.genome, world.population.creatures[0].genome);
  assert.ok(world.population.creatures[0].cooldown > 0);
  world.step(30);
  assert.equal(world.population.creatures.length, 3);
});

test('dead creatures stop moving and become meat exactly once', () => {
  const world = new World({ ...DEFAULT_PARAMETERS, initialPopulation: 1 });
  const creature = world.population.creatures[0];
  creature.health = 0;
  const position = { x: creature.x, y: creature.y };
  world.step(2);
  assert.equal(world.population.creatures.length, 0);
  assert.equal(world.deaths, 1);
  const meat = world.food.find(food => food.kind === 'Meat')!;
  assert.deepEqual({ x: meat.x, y: meat.y }, position);
});

test('save/load resumes exactly, including PRNG state and decision targets', () => {
  const original = new World();
  original.step(230);
  const restored = parseWorld(JSON.stringify(original.save()));
  assert.deepEqual(restored.save(), original.save());
  original.step(600);
  restored.step(600);
  assert.deepEqual(restored.save(), original.save());
});

test('frames and saves cannot mutate simulation state', () => {
  const world = new World();
  const before = world.save();
  const frame = world.frame();
  frame.creatures[0].traits.radius = 0;
  frame.food[0].mass = 0;
  const saved = world.save();
  saved.creatures[0].genome.Body[0] = -1;
  assert.deepEqual(world.save(), before);
});

test('render snapshots omit genomes and nonvisual phenotype data', () => {
  const frame = new World().frame();
  assert.equal('genome' in frame.creatures[0], false);
  assert.equal('maxEnergy' in frame.creatures[0].traits, false);
  assert.equal('birthCost' in frame.creatures[0].traits, false);
  assert.ok(frame.creatures[0].traits.radius > 0);
});

test('save validation rejects corrupt versions, IDs, coordinates, genes and counts', () => {
  const original = new World().save();
  assert.throws(() => loadWorld({ ...original, version: 99 }));
  assert.throws(() => loadWorld({ ...original, randomState: NaN }));
  assert.throws(() => loadWorld({ ...original, config: { ...original.config, maxPopulation: 100000 } }));
  const duplicate = structuredClone(original);
  duplicate.food[0].id = duplicate.creatures[0].id;
  assert.throws(() => loadWorld(duplicate), /Duplicate/);
  const invalid = structuredClone(original);
  invalid.creatures[0].x = Infinity;
  assert.throws(() => loadWorld(invalid));
  const genes = structuredClone(original);
  genes.creatures[0].genome.Body = [];
  assert.throws(() => loadWorld(genes), /chromosome length/);
  assert.throws(() => parseWorld('{broken json'));
});

test('empty worlds and long runs remain bounded and serializable', () => {
  const empty = new World({ ...DEFAULT_PARAMETERS, initialPopulation: 0, plants: 0, foodGrowth: 0 });
  empty.step(100);
  assert.equal(empty.statistics().averageEnergy, 0);
  const world = new World();
  world.step(3600);
  assert.ok(world.population.creatures.length <= world.config.maxPopulation);
  assert.ok(world.food.length <= 3000);
  for (const creature of world.population.creatures) {
    assert.ok(creature.x >= 0 && creature.x <= world.config.width);
    assert.ok(creature.y >= 0 && creature.y <= world.config.height);
    assert.ok(creature.energy >= 0 && creature.energy <= creature.traits.maxEnergy);
  }
  assert.deepEqual(loadWorld(world.save()).save(), world.save());
});