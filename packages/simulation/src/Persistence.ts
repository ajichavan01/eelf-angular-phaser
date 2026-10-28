import { CHROMOSOMES, GENE_DEFINITIONS } from './Genetics/Genome.ts';
import type { Genome } from './Genetics/Genome.ts';
import { MAX_FOOD, MAX_SAVE_BYTES, numeric, record, validateParameters } from './GameParameters.ts';
import { expressGenome } from './Creature/CreatureBody.ts';
import type { Action, Creature } from './Creature/Creature.ts';
import { World } from './World.ts';

function boundedArray(value: unknown, name: string, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) throw new Error(`${name} must be an array with at most ${maximum} entries.`);
  return value;
}

function readGenome(value: unknown): Genome {
  const genome = record(value, 'Genome');
  return Object.fromEntries(CHROMOSOMES.map(chromosome => {
    const alleles = boundedArray(genome[chromosome], chromosome, GENE_DEFINITIONS[chromosome].length);
    if (alleles.length !== GENE_DEFINITIONS[chromosome].length) throw new Error(`Invalid ${chromosome} chromosome length.`);
    return [chromosome, alleles.map(allele => numeric(allele, 'Allele', 0, 1))];
  })) as Genome;
}

export function loadWorld(value: unknown): World {
  const save = record(value, 'Save');
  if (save.format !== 'eelf' || save.version !== 1) throw new Error('Unsupported save format or version. Expected Eelf version 1.');
  const config = validateParameters(save.config);
  const world = new World(config, false);
  world.random.state = numeric(save.randomState, 'Random state', 0, 4294967295, true);
  world.tick = numeric(save.tick, 'Tick', 0, 2147483647, true);
  world.nextId = numeric(save.nextId, 'Next ID', 1, Number.MAX_SAFE_INTEGER, true);
  world.growthRemainder = numeric(save.growthRemainder, 'Growth remainder', 0, 1);
  world.births = numeric(save.births, 'Births', 0, Number.MAX_SAFE_INTEGER, true);
  world.deaths = numeric(save.deaths, 'Deaths', 0, Number.MAX_SAFE_INTEGER, true);
  world.generation = numeric(save.generation, 'Generation', 1, 1000000, true);
  world.foodConsumed = numeric(save.foodConsumed, 'Food consumed', 0, Number.MAX_SAFE_INTEGER);
  const ids = new Set<number>();
  const takeId = (value: unknown): number => {
    const id = numeric(value, 'Entity ID', 1, world.nextId - 1, true);
    if (ids.has(id)) throw new Error('Duplicate entity ID in save.');
    ids.add(id);
    return id;
  };
  world.population.creatures = boundedArray(save.creatures, 'Creatures', config.maxPopulation).map(value => {
    const state = record(value, 'Creature');
    const genome = readGenome(state.genome);
    const traits = expressGenome(genome);
    const stomach = record(state.stomach, 'Stomach');
    const plant = numeric(stomach.plant, 'Plant stomach content', 0, traits.stomachCapacity);
    const meat = numeric(stomach.meat, 'Meat stomach content', 0, traits.stomachCapacity);
    if (plant + meat > traits.stomachCapacity + 0.000001) throw new Error('Stomach capacity exceeded.');
    if (!['Wandering', 'Foraging', 'Grazing'].includes(String(state.action))) throw new Error('Invalid creature action.');
    const target = state.target === null ? null : record(state.target, 'Target');
    return {
      id: takeId(state.id), genome, traits,
      x: numeric(state.x, 'Creature X', 0, config.width), y: numeric(state.y, 'Creature Y', 0, config.height),
      angle: numeric(state.angle, 'Angle', -Math.PI, Math.PI), age: numeric(state.age, 'Age', 0, traits.lifespan),
      energy: numeric(state.energy, 'Energy', 0, traits.maxEnergy), health: numeric(state.health, 'Health', Number.MIN_VALUE, traits.maxHealth),
      stomach: { plant, meat }, cooldown: numeric(state.cooldown, 'Cooldown', 0, traits.birthRecovery),
      generation: numeric(state.generation, 'Creature generation', 1, world.generation, true),
      parents: boundedArray(state.parents, 'Parents', 2).map(parent => numeric(parent, 'Parent ID', 1, world.nextId - 1, true)),
      action: state.action as Action,
      target: target ? {
        x: numeric(target.x, 'Target X', 0, config.width), y: numeric(target.y, 'Target Y', 0, config.height),
        foodId: target.foodId === null ? null : numeric(target.foodId, 'Target ID', 1, world.nextId - 1, true),
      } : null,
    } satisfies Creature;
  });
  world.food = boundedArray(save.food, 'Food', MAX_FOOD).map(value => {
    const food = record(value, 'Food');
    if (food.kind !== 'Plant' && food.kind !== 'Meat') throw new Error('Unknown nourishment type.');
    return {
      id: takeId(food.id), kind: food.kind,
      x: numeric(food.x, 'Food X', 0, config.width), y: numeric(food.y, 'Food Y', 0, config.height),
      mass: numeric(food.mass, 'Food mass', Number.MIN_VALUE, 100),
    };
  });
  world.history = boundedArray(save.history, 'History', 180).map(value => {
    const point = record(value, 'History point');
    return { time: numeric(point.time, 'History time', 0, world.tick / 30), population: numeric(point.population, 'History population', 0, config.maxPopulation, true), energy: numeric(point.energy, 'History energy', 0, 1) };
  });
  return world;
}

export function parseWorld(text: string): World {
  if (new TextEncoder().encode(text).length > MAX_SAVE_BYTES) throw new Error('Save files must be smaller than 8 MB.');
  return loadWorld(JSON.parse(text));
}