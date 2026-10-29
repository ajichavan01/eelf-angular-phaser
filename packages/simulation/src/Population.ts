import type { Creature } from './Creature/Creature.ts';
import { createCreature } from './Creature/Creature.ts';
import type { GameParameters } from './GameParameters.ts';
import { createGenome } from './Genetics/Genome.ts';
import type { Random } from './Utilities.ts';

export class Population {
  creatures: Creature[] = [];

  initialize(config: GameParameters, random: Random, nextId: () => number): void {
    this.creatures = Array.from({ length: config.initialPopulation }, () => {
      const creature = createCreature(nextId(), createGenome(random), random.between(60, config.width - 60),
        random.between(60, config.height - 60), random.between(-Math.PI, Math.PI));
      creature.age = random.between(0.5, 1.5) * creature.traits.maturity;
      creature.energy = creature.traits.maxEnergy * random.between(0.6, 0.95);
      return creature;
    });
  }

  get(id: number): Creature | undefined {
    return this.creatures.find(creature => creature.id === id);
  }
}