export interface GameParameters {
  seed: number;
  width: number;
  height: number;
  initialPopulation: number;
  maxPopulation: number;
  plants: number;
  foodGrowth: number;
  mutationRate: number;
}

export const FIXED_STEP = 1 / 30;
export const MAX_FOOD = 3000;
export const MAX_SAVE_BYTES = 8 * 1024 * 1024;
export const DEFAULT_PARAMETERS: GameParameters = {
  seed: 104729,
  width: 1280,
  height: 800,
  initialPopulation: 72,
  maxPopulation: 500,
  plants: 220,
  foodGrowth: 3,
  mutationRate: 0.08,
};

export function record(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
  return value as Record<string, unknown>;
}

export function numeric(value: unknown, name: string, minimum: number, maximum: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum || (integer && !Number.isInteger(value))) {
    throw new Error(`${name} must be ${integer ? 'an integer' : 'a number'} between ${minimum} and ${maximum}.`);
  }
  return value;
}

export function validateParameters(value: unknown): GameParameters {
  const config = record(value, 'Settings');
  const maxPopulation = numeric(config.maxPopulation, 'Population limit', 1, 1500, true);
  return {
    seed: numeric(config.seed, 'Seed', 0, 4294967295, true),
    width: numeric(config.width, 'World width', 400, 4000, true),
    height: numeric(config.height, 'World height', 300, 3000, true),
    initialPopulation: numeric(config.initialPopulation, 'Initial population', 0, maxPopulation, true),
    maxPopulation,
    plants: numeric(config.plants, 'Plant capacity', 0, 2000, true),
    foodGrowth: numeric(config.foodGrowth, 'Plant growth', 0, 8),
    mutationRate: numeric(config.mutationRate, 'Mutation rate', 0, 0.5),
  };
}