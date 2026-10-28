import type { WorldFrame } from '../../simulation/src/index.ts';
import { foodRadius } from '../../simulation/src/index.ts';
import { drawCreature, DEFAULT_RENDER_OPTIONS, SnapshotInterpolator, WORLD_COLORS } from './Drawing.ts';
import type { RenderOptions } from './Drawing.ts';
import type { SimulationClient } from './SimulationClient.ts';

export class CanvasRenderer {
  options: RenderOptions = { ...DEFAULT_RENDER_OPTIONS };
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly client: SimulationClient;
  private readonly abort = new AbortController();
  private readonly motion = new SnapshotInterpolator();
  private readonly observer: ResizeObserver;
  private readonly unsubscribe: () => void;
  private frame: WorldFrame | null = null;
  private animation = 0;
  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private width = 1;
  private height = 1;
  private pointer: { x: number; y: number; moved: boolean } | null = null;

  constructor(canvas: HTMLCanvasElement, client: SimulationClient) {
    this.canvas = canvas;
    this.client = client;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('Canvas 2D is unavailable in this browser.');
    this.context = context;
    this.unsubscribe = client.onFrame(frame => {
      if (this.frame && (frame.width !== this.frame.width || frame.height !== this.frame.height)) this.fit();
      this.motion.accept(frame);
      this.frame = frame;
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    const signal = this.abort.signal;
    canvas.addEventListener('wheel', event => { event.preventDefault(); this.adjustZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false, signal });
    canvas.addEventListener('pointerdown', event => {
      this.pointer = { x: event.clientX, y: event.clientY, moved: false };
      canvas.setPointerCapture(event.pointerId);
    }, { signal });
    canvas.addEventListener('pointermove', event => {
      if (!this.pointer) return;
      const deltaX = event.clientX - this.pointer.x;
      const deltaY = event.clientY - this.pointer.y;
      if (Math.hypot(deltaX, deltaY) > 3 || this.pointer.moved) {
        this.panX += deltaX; this.panY += deltaY; this.pointer.moved = true;
        this.pointer.x = event.clientX; this.pointer.y = event.clientY;
        this.constrainPan();
      }
    }, { signal });
    canvas.addEventListener('pointerup', event => {
      if (this.pointer && !this.pointer.moved) this.pick(event);
      this.pointer = null;
    }, { signal });
    canvas.addEventListener('pointercancel', () => { this.pointer = null; }, { signal });
    this.animate();
  }

  fit(): void { this.zoom = 1; this.panX = 0; this.panY = 0; }
  pan(dx: number, dy: number): void { this.panX += dx; this.panY += dy; this.constrainPan(); }
  adjustZoom(factor: number): void { this.zoom = Math.max(1, Math.min(4, this.zoom * factor)); this.constrainPan(); }

  private scale(): number { return this.frame ? Math.min(this.width / this.frame.width, this.height / this.frame.height) * this.zoom : 1; }

  private constrainPan(): void {
    if (!this.frame) return;
    const limitX = Math.max(0, (this.frame.width * this.scale() - this.width) / 2);
    const limitY = Math.max(0, (this.frame.height * this.scale() - this.height) / 2);
    this.panX = Math.max(-limitX, Math.min(limitX, this.panX));
    this.panY = Math.max(-limitY, Math.min(limitY, this.panY));
  }

  private resize(): void {
    this.width = Math.max(1, this.canvas.clientWidth);
    this.height = Math.max(1, this.canvas.clientHeight);
    const ratio = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(this.width * ratio);
    this.canvas.height = Math.round(this.height * ratio);
    this.constrainPan();
  }

  private pick(event: PointerEvent): void {
    if (!this.frame) return;
    const bounds = this.canvas.getBoundingClientRect();
    const scale = this.scale();
    const worldX = (event.clientX - bounds.left - this.width / 2 - this.panX) / scale + this.frame.width / 2;
    const worldY = (event.clientY - bounds.top - this.height / 2 - this.panY) / scale + this.frame.height / 2;
    let nearest = 30 / scale;
    let selected: number | null = null;
    for (const creature of this.frame.creatures) {
      const pose = this.motion.sample(creature);
      const distance = Math.hypot(pose.x - worldX, pose.y - worldY);
      if (distance < nearest) { nearest = distance; selected = creature.id; }
    }
    this.client.select(selected);
  }

  private animate = (): void => {
    this.draw();
    this.animation = requestAnimationFrame(this.animate);
  };

  private draw(): void {
    const context = this.context;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = WORLD_COLORS.backdrop;
    context.fillRect(0, 0, this.width, this.height);
    const frame = this.frame;
    if (!frame) return;
    context.save();
    context.translate(this.width / 2 + this.panX, this.height / 2 + this.panY);
    const scale = this.scale();
    context.scale(scale, scale);
    context.translate(-frame.width / 2, -frame.height / 2);
    context.beginPath(); context.rect(0, 0, frame.width, frame.height); context.clip();
    context.fillStyle = WORLD_COLORS.world;
    context.fillRect(0, 0, frame.width, frame.height);
    if (this.options.grid) {
      context.fillStyle = '#30453a';
      for (let column = 24; column < frame.width; column += 32) for (let row = 24; row < frame.height; row += 32) context.fillRect(column, row, 1.4, 1.4);
    }
    for (const food of frame.food) {
      const radius = foodRadius(food);
      const plant = food.kind === 'Plant';
      context.fillStyle = plant ? '#67b998' : '#e2947b';
      for (const [size, alpha] of [[radius + 3, 0.15], [radius * 0.55, 0.75]] as const) {
        context.globalAlpha = alpha;
        context.beginPath();
        if (plant) context.arc(food.x, food.y, size, 0, Math.PI * 2); else context.rect(food.x - size, food.y - size, 2 * size, 2 * size);
        context.fill();
      }
    }
    context.globalAlpha = 1;
    const now = performance.now();
    const selectedCreature = frame.creatures.find(creature => creature.id === this.client.state.selected?.id);
    const selected = selectedCreature ? this.motion.sample(selectedCreature, now) : undefined;
    if (selected && this.options.senses) {
      context.strokeStyle = '#e2947b55';
      context.lineWidth = 1;
      context.setLineDash([4, 5]);
      context.beginPath(); context.arc(selected.x, selected.y, selected.traits.scentRange, 0, Math.PI * 2); context.stroke();
      context.setLineDash([]);
      if (selected.traits.visionRange) {
        context.fillStyle = '#d5ed9514';
        context.beginPath(); context.moveTo(selected.x, selected.y);
        context.arc(selected.x, selected.y, selected.traits.visionRange, selected.angle - selected.traits.visionAngle / 2, selected.angle + selected.traits.visionAngle / 2);
        context.closePath(); context.fill();
      }
    }
    for (const creature of frame.creatures) drawCreature(context, this.motion.sample(creature, now), this.motion.time(now), selected?.id === creature.id, this.options.energy);
    context.restore();
  }

  dispose(): void {
    cancelAnimationFrame(this.animation);
    this.abort.abort();
    this.observer.disconnect();
    this.unsubscribe();
  }
}