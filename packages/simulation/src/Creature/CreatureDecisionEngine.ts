import type { Creature } from './Creature.ts';
import type { Nourishment } from '../Nourishments/Nourishment.ts';
import type { GameParameters } from '../GameParameters.ts';
import { SpatialHash } from '../SpatialHash.ts';
import { distanceSquared, Random } from '../Utilities.ts';
import { canSee, canSmell } from './CreatureVision.ts';

export function decide(creature: Creature, foods: SpatialHash<Nourishment>, config: GameParameters, random: Random): void {
  let nearest: Nourishment | undefined;
  let bestScore = Infinity;
  const traits = creature.traits;
  if (traits.mouth && creature.energy < traits.maxEnergy * 0.96 && creature.stomach.plant + creature.stomach.meat < traits.stomachCapacity * 0.9) {
    for (const food of foods.nearby(creature.x, creature.y, Math.max(traits.visionRange, traits.scentRange))) {
      if (food.mass <= 0) continue;
      const distance = Math.sqrt(distanceSquared(creature, food));
      const vision = canSee(creature, food, distance) ? 0.5 + traits.visionDominance : 0;
      const scent = canSmell(creature, distance) ? 0.5 + traits.scentDominance : 0;
      if (!vision && !scent) continue;
      const efficiency = food.kind === 'Plant' ? traits.plantEfficiency : traits.meatEfficiency;
      const score = distance / (efficiency * Math.max(vision, scent));
      if (score < bestScore) { nearest = food; bestScore = score; }
    }
  }
  if (nearest) {
    creature.target = { x: nearest.x, y: nearest.y, foodId: nearest.id };
    creature.action = 'Foraging';
  } else {
    if (!creature.target || creature.target.foodId !== null || distanceSquared(creature, creature.target) < 24 ** 2) {
      creature.target = { x: random.between(25, config.width - 25), y: random.between(25, config.height - 25), foodId: null };
    }
    creature.action = 'Wandering';
  }
}