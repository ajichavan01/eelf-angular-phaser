import type { Genome } from '../Genetics/Genome.ts';
import type { Phenotype } from './CreatureBody.ts';
import { expressGenome } from './CreatureBody.ts';

export type Action = 'Wandering' | 'Foraging' | 'Grazing';
export interface Target { x: number; y: number; foodId: number | null }

export interface CreatureState {
  id: number;
  genome: Genome;
  x: number;
  y: number;
  angle: number;
  age: number;
  energy: number;
  health: number;
  stomach: { plant: number; meat: number };
  cooldown: number;
  generation: number;
  parents: number[];
  action: Action;
  target: Target | null;
}

export interface Creature extends CreatureState { traits: Phenotype }

export function createCreature(id: number, genome: Genome, startX: number, startY: number, angle: number, generation = 1, parents: number[] = []): Creature {
  const traits = expressGenome(genome);
  return {
    id, genome, x: startX, y: startY, angle, generation, parents, traits,
    age: 0,
    energy: traits.maxEnergy * 0.72,
    health: traits.maxHealth,
    stomach: { plant: 0, meat: 0 },
    cooldown: 0,
    action: 'Wandering',
    target: null,
  };
}