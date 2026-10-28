import type { Creature, Phenotype, RenderCreature, WorldFrame } from '../../simulation/src/index.ts';

export interface RenderOptions { senses: boolean; energy: boolean; grid: boolean }
export const DEFAULT_RENDER_OPTIONS: RenderOptions = { senses: false, energy: false, grid: true };
export const WORLD_COLORS = { backdrop: '#142320', world: '#192c27' } as const;

export class SnapshotInterpolator {
  private frame: WorldFrame | null = null;
  private previous = new Map<number, RenderCreature>();
  private receivedAt = 0;
  private duration = 50;
  private previousTime = 0;

  accept(frame: WorldFrame, now = performance.now()): void {
    const old = this.frame;
    const continuous = old && frame.statistics.tick > old.statistics.tick && frame.statistics.tick - old.statistics.tick <= 30 && frame.width === old.width && frame.height === old.height;
    this.previous = new Map(continuous ? old.creatures.map(creature => [creature.id, creature]) : []);
    this.previousTime = continuous ? old.statistics.time : frame.statistics.time;
    this.duration = Math.max(16, Math.min(100, now - this.receivedAt));
    this.receivedAt = now;
    this.frame = frame;
  }

  private fraction(now: number): number { return Math.max(0, Math.min(1, (now - this.receivedAt) / this.duration)); }

  sample(creature: RenderCreature, now = performance.now()): RenderCreature {
    const old = this.previous.get(creature.id);
    if (!old) return creature;
    const fraction = this.fraction(now);
    const turn = Math.atan2(Math.sin(creature.angle - old.angle), Math.cos(creature.angle - old.angle));
    return { ...creature, x: old.x + (creature.x - old.x) * fraction, y: old.y + (creature.y - old.y) * fraction, angle: old.angle + turn * fraction };
  }

  time(now = performance.now()): number {
    return this.previousTime + ((this.frame?.statistics.time ?? 0) - this.previousTime) * this.fraction(now);
  }
}

export function hueColor(hue: number): number {
  const channel = (offset: number): number => {
    const position = (offset + hue / 30) % 12;
    return Math.round(255 * (0.63 - 0.25 * Math.max(-1, Math.min(position - 3, 9 - position, 1))));
  };
  return (channel(0) << 16) + (channel(8) << 8) + channel(4);
}

export const cssColor = (color: number): string => `#${color.toString(16).padStart(6, '0')}`;

export function segmentPose(traits: Pick<Phenotype, 'radius' | 'taper' | 'spacing' | 'width'>, index: number, time: number, id: number): { x: number; y: number; radiusX: number; radiusY: number } {
  const radius = traits.radius * Math.max(0.25, 1 - index * traits.taper);
  return {
    x: -index * traits.radius * traits.spacing,
    y: index ? Math.sin(time * 5 - index * 0.8 + id) * traits.radius * 0.1 * index : 0,
    radiusX: radius * 1.12,
    radiusY: radius * traits.width,
  };
}

export function drawCreature(context: CanvasRenderingContext2D, creature: RenderCreature, time: number, selected = false, energy = false): void {
  const traits = creature.traits;
  const color = cssColor(hueColor(traits.hue));
  context.save();
  context.translate(creature.x, creature.y);
  context.rotate(creature.angle);
  context.fillStyle = color;
  if (traits.tail) {
    const last = segmentPose(traits, traits.segments - 1, time, creature.id);
    context.globalAlpha = 0.65;
    context.beginPath();
    context.moveTo(last.x, last.y);
    context.lineTo(last.x - traits.radius * 2 * traits.tail, last.y - traits.radius * traits.tail);
    context.lineTo(last.x - traits.radius * 1.7 * traits.tail, last.y + traits.radius * traits.tail);
    context.closePath();
    context.fill();
  }
  for (let index = traits.segments - 1; index >= 0; index--) {
    const part = segmentPose(traits, index, time, creature.id);
    context.globalAlpha = 0.5 + 0.5 * (1 - index / traits.segments);
    context.beginPath();
    context.ellipse(part.x, part.y, part.radiusX, part.radiusY, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 0.6;
  if (traits.flippers) {
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(-traits.radius, 0);
      context.lineTo(-traits.radius * 2.8, side * traits.radius * (1 + traits.flippers));
      context.lineTo(-traits.radius * 0.1, side * traits.radius * 0.6);
      context.fill();
    }
  }
  context.globalAlpha = 1;
  if (traits.eyes) {
    for (const side of [-1, 1]) {
      context.fillStyle = '#edf5e7';
      context.beginPath();
      context.arc(traits.radius * 0.3, side * traits.radius * traits.width * 0.55, traits.eyes * 1.9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#152523';
      context.beginPath();
      context.arc(traits.radius * 0.4, side * traits.radius * traits.width * 0.55, traits.eyes * 0.8, 0, Math.PI * 2);
      context.fill();
    }
  }
  if (traits.mouth) {
    context.strokeStyle = '#192a28';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(traits.radius * 0.95, -traits.radius * traits.mouth * 0.5);
    context.lineTo(traits.radius * 0.95, traits.radius * traits.mouth * 0.5);
    context.stroke();
  }
  context.restore();
  if (selected) {
    context.strokeStyle = '#d5ed95';
    context.lineWidth = 1.3;
    context.setLineDash([3, 4]);
    context.beginPath();
    context.arc(creature.x, creature.y, traits.radius + 8, 0, Math.PI * 2);
    context.stroke();
    context.setLineDash([]);
  }
  if (energy) {
    context.fillStyle = '#30403b';
    context.fillRect(creature.x - 10, creature.y + traits.radius + 12, 20, 2);
    context.fillStyle = creature.energy > 0.3 ? '#d5ed95' : '#ee957c';
    context.fillRect(creature.x - 10, creature.y + traits.radius + 12, 20 * creature.energy, 2);
  }
}

export function drawPreview(canvas: HTMLCanvasElement, creature: Creature | null, time: number): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  if (!creature) return;
  const length = creature.traits.radius * (creature.traits.segments * creature.traits.spacing + 4);
  const scale = Math.min(3.2, width / (length + 30));
  context.save();
  context.translate(width * 0.65, height / 2);
  context.scale(scale, scale);
  drawCreature(context, { ...creature, x: 0, y: 0, angle: -0.1, energy: creature.energy / creature.traits.maxEnergy, health: creature.health / creature.traits.maxHealth }, time);
  context.restore();
}

export function drawHistory(canvas: HTMLCanvasElement, frame: WorldFrame | null): void {
  const context = canvas.getContext('2d');
  if (!context) return;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, width, height);
  context.strokeStyle = '#dce2d9';
  context.lineWidth = 1;
  for (const fraction of [0.25, 0.5, 0.75]) {
    context.beginPath(); context.moveTo(0, height * fraction); context.lineTo(width, height * fraction); context.stroke();
  }
  const points = frame?.history ?? [];
  if (points.length < 2) return;
  const maxPopulation = Math.max(10, ...points.map(point => point.population)) * 1.1;
  for (const series of ['population', 'energy'] as const) {
    context.strokeStyle = series === 'population' ? '#247d65' : '#cf7d64';
    context.lineWidth = 2;
    context.setLineDash(series === 'energy' ? [4, 3] : []);
    context.beginPath();
    points.forEach((point, index) => {
      const pointX = index / (points.length - 1) * width;
      const pointY = height - 5 - (series === 'population' ? point.population / maxPopulation : point.energy) * (height - 10);
      if (index === 0) context.moveTo(pointX, pointY); else context.lineTo(pointX, pointY);
    });
    context.stroke();
  }
  context.setLineDash([]);
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

const plural = new Intl.PluralRules('en');
export const count = (n: number, one: string, other: string): string => `${n} ${plural.select(n) === 'one' ? one : other}`;

export const geneLabel = (identifier: string): string => identifier === 'lifeSpan' ? 'Lifespan' : identifier.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, first => first.toUpperCase());