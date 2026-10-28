import type { Creature } from './Creature.ts';

export function canSee(creature: Creature, point: { x: number; y: number }, distance: number): boolean {
  const traits = creature.traits;
  if (!traits.eyes || distance > traits.visionRange) return false;
  const direction = Math.atan2(point.y - creature.y, point.x - creature.x) - creature.angle;
  const difference = Math.atan2(Math.sin(direction), Math.cos(direction));
  return Math.abs(difference) <= traits.visionAngle / 2;
}

export function canSmell(creature: Creature, distance: number): boolean {
  return distance <= creature.traits.scentRange;
}