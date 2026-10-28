import { DEFAULT_PARAMETERS, FIXED_STEP, MAX_FOOD, numeric, validateParameters } from './GameParameters.ts';
import type { GameParameters } from './GameParameters.ts';
import type { Creature, CreatureState } from './Creature/Creature.ts';
import type { Phenotype } from './Creature/CreatureBody.ts';
import { decide } from './Creature/CreatureDecisionEngine.ts';
import { eat, isAlive, metabolize } from './Creature/CreatureMetabolism.ts';
import { move } from './Creature/CreaturePhysics.ts';
import { readyToReproduce, reproduce } from './Creature/CreatureReproduction.ts';
import type { Nourishment } from './Nourishments/Nourishment.ts';
import { foodRadius } from './Nourishments/Nourishment.ts';
import { Population } from './Population.ts';
import { SpatialHash } from './SpatialHash.ts';
import { distanceSquared, Random } from './Utilities.ts';

export interface Statistics {
  tick: number;
  time: number;
  population: number;
  plants: number;
  meat: number;
  births: number;
  deaths: number;
  generation: number;
  averageEnergy: number;
  averageSpeed: number;
  foodConsumed: number;
}

export interface HistoryPoint { time: number; population: number; energy: number }
export type RenderTraits = Pick<Phenotype, 'segments' | 'radius' | 'width' | 'taper' | 'spacing' | 'hue' | 'flippers' | 'tail' | 'eyes' | 'mouth' | 'visionRange' | 'visionAngle' | 'scentRange'>;
export type RenderCreature = Pick<Creature, 'id' | 'x' | 'y' | 'angle' | 'generation'> & { traits: RenderTraits; energy: number; health: number };
export interface WorldFrame {
  width: number;
  height: number;
  creatures: RenderCreature[];
  food: Nourishment[];
  statistics: Statistics;
  history: HistoryPoint[];
}

export interface WorldSave {
  format: 'eelf';
  version: 1;
  config: GameParameters;
  randomState: number;
  tick: number;
  nextId: number;
  growthRemainder: number;
  births: number;
  deaths: number;
  generation: number;
  foodConsumed: number;
  creatures: CreatureState[];
  food: Nourishment[];
  history: HistoryPoint[];
}

export class World {
  readonly population = new Population();
  config: GameParameters;
  random: Random;
  food: Nourishment[] = [];
  tick = 0;
  nextId = 1;
  growthRemainder = 0;
  births = 0;
  deaths = 0;
  generation = 1;
  foodConsumed = 0;
  history: HistoryPoint[] = [];
  private readonly foodIndex = new SpatialHash<Nourishment>();
  private readonly creatureIndex = new SpatialHash<Creature>();

  constructor(config: GameParameters = DEFAULT_PARAMETERS, initialize = true) {
    this.config = validateParameters(config);
    this.random = new Random(this.config.seed);
    if (initialize) {
      this.population.initialize(this.config, this.random, () => this.nextId++);
      this.addPlants(this.config.plants);
      this.recordHistory();
    }
  }

  addPlants(count = 24): void {
    numeric(count, 'Added plants', 0, 2000, true);
    const amount = Math.min(count, MAX_FOOD - this.food.length);
    for (let index = 0; index < amount; index++) {
      this.food.push({ id: this.nextId++, kind: 'Plant', x: this.random.between(25, this.config.width - 25),
        y: this.random.between(25, this.config.height - 25), mass: this.random.between(6, 14) });
    }
  }

  step(count = 1): void {
    numeric(count, 'Step count', 0, 100000, true);
    for (let iteration = 0; iteration < count; iteration++) this.advance();
  }

  private advance(): void {
    this.tick++;
    this.foodIndex.rebuild(this.food);
    const foodById = new Map(this.food.map(food => [food.id, food]));
    for (const creature of this.population.creatures) {
      if (!isAlive(creature)) continue;
      if (creature.target?.foodId && !foodById.has(creature.target.foodId)) creature.target = null;
      if (this.tick % 6 === creature.id % 6 || !creature.target) decide(creature, this.foodIndex, this.config, this.random);
      const targetFood = creature.target?.foodId ? foodById.get(creature.target.foodId) : undefined;
      if (targetFood && targetFood.mass > 0 && distanceSquared(creature, targetFood) <= (creature.traits.radius + foodRadius(targetFood) + 3) ** 2) {
        this.foodConsumed += eat(creature, targetFood, FIXED_STEP);
      } else if (creature.action === 'Grazing') creature.action = 'Foraging';
      const speed = move(creature, this.config, FIXED_STEP);
      metabolize(creature, speed, FIXED_STEP);
    }
    const alive: Creature[] = [];
    for (const creature of this.population.creatures) {
      if (isAlive(creature)) alive.push(creature);
      else {
        this.deaths++;
        if (this.food.length < MAX_FOOD) this.food.push({ id: this.nextId++, kind: 'Meat', x: creature.x, y: creature.y, mass: creature.traits.mass * 0.5 });
      }
    }
    this.population.creatures = alive;
    if (this.tick % 15 === 0 && alive.length < this.config.maxPopulation) {
      this.creatureIndex.rebuild(alive);
      const newborns: Creature[] = [];
      for (const parent of alive) {
        if (alive.length + newborns.length >= this.config.maxPopulation) break;
        if (!readyToReproduce(parent)) continue;
        const partner = Array.from(this.creatureIndex.nearby(parent.x, parent.y, 90))
          .find(candidate => candidate.id !== parent.id && readyToReproduce(candidate));
        if (!partner) continue;
        const child = reproduce(parent, partner, this.nextId++, this.random, this.config);
        newborns.push(child);
        this.births++;
        this.generation = Math.max(this.generation, child.generation);
      }
      alive.push(...newborns);
    }
    for (const food of this.food) if (food.kind === 'Meat') food.mass = Math.max(0, food.mass - FIXED_STEP * 0.04);
    this.food = this.food.filter(food => food.mass > 0.01);
    const plants = this.food.reduce((total, food) => total + Number(food.kind === 'Plant'), 0);
    if (plants < this.config.plants && this.food.length < MAX_FOOD) {
      this.growthRemainder += this.config.foodGrowth * FIXED_STEP;
      const growth = Math.min(Math.floor(this.growthRemainder), this.config.plants - plants);
      if (growth > 0) { this.addPlants(growth); this.growthRemainder -= growth; }
    } else this.growthRemainder = 0;
    if (this.tick % 30 === 0) this.recordHistory();
  }

  statistics(): Statistics {
    const creatures = this.population.creatures;
    return {
      tick: this.tick,
      time: this.tick * FIXED_STEP,
      population: creatures.length,
      plants: this.food.filter(food => food.kind === 'Plant').length,
      meat: this.food.filter(food => food.kind === 'Meat').length,
      births: this.births,
      deaths: this.deaths,
      generation: this.generation,
      averageEnergy: creatures.length ? creatures.reduce((total, creature) => total + creature.energy / creature.traits.maxEnergy, 0) / creatures.length : 0,
      averageSpeed: creatures.length ? creatures.reduce((total, creature) => total + creature.traits.speed, 0) / creatures.length : 0,
      foodConsumed: this.foodConsumed,
    };
  }

  private recordHistory(): void {
    const stats = this.statistics();
    this.history.push({ time: stats.time, population: stats.population, energy: stats.averageEnergy });
    if (this.history.length > 180) this.history.shift();
  }

  frame(): WorldFrame {
    return {
      width: this.config.width, height: this.config.height,
      creatures: this.population.creatures.map(creature => ({
        id: creature.id, x: creature.x, y: creature.y, angle: creature.angle, generation: creature.generation,
        traits: {
          segments: creature.traits.segments, radius: creature.traits.radius, width: creature.traits.width,
          taper: creature.traits.taper, spacing: creature.traits.spacing, hue: creature.traits.hue,
          flippers: creature.traits.flippers, tail: creature.traits.tail, eyes: creature.traits.eyes, mouth: creature.traits.mouth,
          visionRange: creature.traits.visionRange, visionAngle: creature.traits.visionAngle, scentRange: creature.traits.scentRange,
        },
        energy: creature.energy / creature.traits.maxEnergy, health: creature.health / creature.traits.maxHealth,
      })),
      food: this.food.map(food => ({ ...food })), statistics: this.statistics(), history: this.history.map(point => ({ ...point })),
    };
  }

  save(): WorldSave {
    return structuredClone({
      format: 'eelf', version: 1, config: this.config, randomState: this.random.state, tick: this.tick, nextId: this.nextId,
      growthRemainder: this.growthRemainder, births: this.births, deaths: this.deaths, generation: this.generation, foodConsumed: this.foodConsumed,
      creatures: this.population.creatures.map(({ traits: _traits, ...state }) => state), food: this.food, history: this.history,
    });
  }
}