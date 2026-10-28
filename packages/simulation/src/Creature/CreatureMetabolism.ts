import type { Creature } from './Creature.ts';
import type { Nourishment } from '../Nourishments/Nourishment.ts';
import { clamp } from '../Utilities.ts';

export function eat(creature: Creature, food: Nourishment, delta: number): number {
  if (!creature.traits.mouth) return 0;
  const room = creature.traits.stomachCapacity - creature.stomach.plant - creature.stomach.meat;
  const amount = Math.max(0, Math.min(food.mass, room, creature.traits.bite * delta));
  food.mass = Math.max(0, food.mass - amount);
  creature.stomach[food.kind === 'Plant' ? 'plant' : 'meat'] += amount;
  creature.action = 'Grazing';
  return amount;
}

export function metabolize(creature: Creature, speed: number, delta: number): void {
  const traits = creature.traits;
  const total = creature.stomach.plant + creature.stomach.meat;
  if (total > 0) {
    const digested = Math.min(total, traits.digestion * delta);
    const plants = digested * creature.stomach.plant / total;
    const meat = digested - plants;
    creature.stomach.plant = Math.max(0, creature.stomach.plant - plants);
    creature.stomach.meat = Math.max(0, creature.stomach.meat - meat);
    creature.energy += (plants * traits.plantEfficiency + meat * traits.meatEfficiency) * 12;
  }
  creature.energy = clamp(creature.energy - (0.65 + speed * 0.018 + traits.mass * 0.005) * delta, 0, traits.maxEnergy);
  if (creature.energy === 0) creature.health -= 2.5 * delta;
  else if (creature.energy > traits.maxEnergy * 0.5) creature.health += traits.healing * delta;
  creature.health = clamp(creature.health, 0, traits.maxHealth);
  creature.age += delta;
  creature.cooldown = Math.max(0, creature.cooldown - delta);
}

export const isAlive = (creature: Creature): boolean => creature.health > 0 && creature.age < creature.traits.lifespan;