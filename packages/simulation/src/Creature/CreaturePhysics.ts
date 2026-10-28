import type { Creature } from './Creature.ts';
import type { GameParameters } from '../GameParameters.ts';
import { clamp } from '../Utilities.ts';

export function move(creature: Creature, config: GameParameters, delta: number): number {
  if (!creature.target || creature.action === 'Grazing') return 0;
  const desired = Math.atan2(creature.target.y - creature.y, creature.target.x - creature.x);
  const difference = Math.atan2(Math.sin(desired - creature.angle), Math.cos(desired - creature.angle));
  creature.angle += clamp(difference, -creature.traits.turnRate * delta, creature.traits.turnRate * delta);
  creature.angle = Math.atan2(Math.sin(creature.angle), Math.cos(creature.angle));
  const speed = creature.traits.speed * (0.5 + 0.5 * creature.energy / creature.traits.maxEnergy);
  const oldX = creature.x;
  const oldY = creature.y;
  creature.x = clamp(creature.x + Math.cos(creature.angle) * speed * delta, 20, config.width - 20);
  creature.y = clamp(creature.y + Math.sin(creature.angle) * speed * delta, 20, config.height - 20);
  return Math.hypot(creature.x - oldX, creature.y - oldY) / delta;
}