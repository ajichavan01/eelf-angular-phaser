import type { Creature } from './Creature.ts';
import { createCreature } from './Creature.ts';
import type { GameParameters } from '../GameParameters.ts';
import { inheritGenome } from '../Genetics/Genome.ts';
import { clamp, Random } from '../Utilities.ts';

export const readyToReproduce = (creature: Creature): boolean =>
  creature.age >= creature.traits.maturity && creature.cooldown === 0 &&
  creature.energy > creature.traits.maxEnergy * 0.76 && creature.health > creature.traits.maxHealth * 0.6;

export function reproduce(parent: Creature, partner: Creature, id: number, random: Random, config: GameParameters): Creature {
  const mutation = clamp(config.mutationRate * (parent.traits.mutation + partner.traits.mutation) / 2, 0, 1);
  const genome = inheritGenome(parent.genome, partner.genome, random, mutation);
  const child = createCreature(id, genome,
    clamp((parent.x + partner.x) / 2 + random.between(-12, 12), 20, config.width - 20),
    clamp((parent.y + partner.y) / 2 + random.between(-12, 12), 20, config.height - 20),
    random.between(-Math.PI, Math.PI), Math.max(parent.generation, partner.generation) + 1, [parent.id, partner.id]);
  let invested = 0;
  for (const creature of [parent, partner]) {
    const cost = creature.traits.maxEnergy * creature.traits.birthCost;
    creature.energy -= cost;
    creature.cooldown = creature.traits.birthRecovery;
    invested += cost;
  }
  child.energy = Math.min(child.traits.maxEnergy, invested * 0.85);
  return child;
}