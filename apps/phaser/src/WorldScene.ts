import Phaser from 'phaser';
import { DEFAULT_RENDER_OPTIONS, hueColor, segmentPose, SnapshotInterpolator, WORLD_COLORS } from '@eelf/browser/Drawing.ts';
import type { RenderOptions } from '@eelf/browser/Drawing.ts';
import type { SimulationClient } from '@eelf/browser/SimulationClient.ts';
import { foodRadius } from '@eelf/simulation';
import type { RenderCreature, WorldFrame } from '@eelf/simulation';

interface CreatureSprite {
  container: Phaser.GameObjects.Container;
  segments: Phaser.GameObjects.Image[];
  fins: Phaser.GameObjects.Image[];
  tail: Phaser.GameObjects.Image;
  eyes: Phaser.GameObjects.Image[];
  mouth: Phaser.GameObjects.Rectangle;
}

export class WorldScene extends Phaser.Scene {
  options: RenderOptions = { ...DEFAULT_RENDER_OPTIONS };
  private readonly client: SimulationClient;
  private readonly motion = new SnapshotInterpolator();
  private frame: WorldFrame | null = null;
  private ready = false;
  private grid!: Phaser.GameObjects.Graphics;
  private overlays!: Phaser.GameObjects.Graphics;
  private readonly creatures = new Map<number, CreatureSprite>();
  private readonly unusedCreatures: CreatureSprite[] = [];
  private readonly foods = new Map<number, Phaser.GameObjects.Image>();
  private readonly unusedFoods: Phaser.GameObjects.Image[] = [];
  private zoomFactor = 1;
  private drag: { x: number; y: number; scrollX: number; scrollY: number; moved: boolean } | null = null;

  constructor(client: SimulationClient) {
    super({ key: 'World' });
    this.client = client;
  }

  create(): void {
    this.makeTextures();
    this.grid = this.add.graphics().setDepth(0);
    this.overlays = this.add.graphics().setDepth(4);
    this.ready = true;
    const unsubscribe = this.client.onFrame(frame => this.synchronize(frame));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.scale.on(Phaser.Scale.Events.RESIZE, () => this.fit());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const camera = this.cameras.main;
      this.drag = { x: pointer.x, y: pointer.y, scrollX: camera.scrollX, scrollY: camera.scrollY, moved: false };
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.drag || !pointer.isDown) return;
      const deltaX = pointer.x - this.drag.x;
      const deltaY = pointer.y - this.drag.y;
      if (Math.hypot(deltaX, deltaY) > 4) this.drag.moved = true;
      if (this.drag.moved) {
        this.cameras.main.scrollX = this.drag.scrollX - deltaX / this.cameras.main.zoom;
        this.cameras.main.scrollY = this.drag.scrollY - deltaY / this.cameras.main.zoom;
      }
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (this.drag && !this.drag.moved) this.pick(pointer);
      this.drag = null;
    });
    this.input.on('pointerupoutside', () => { this.drag = null; });
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => this.adjustZoom(deltaY < 0 ? 1.12 : 1 / 1.12));
  }

  private makeTextures(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0xffffff).fillCircle(32, 32, 29);
    graphics.generateTexture('body', 64, 64);
    graphics.clear().fillStyle(0xffffff).fillTriangle(60, 32, 4, 4, 4, 60);
    graphics.generateTexture('fin', 64, 64);
    graphics.clear().fillStyle(0xedf5e7).fillCircle(16, 16, 14);
    graphics.fillStyle(0x152523).fillCircle(20, 16, 6);
    graphics.generateTexture('eye', 32, 32);
    graphics.clear().fillStyle(0xffffff, 0.15).fillCircle(32, 32, 30);
    graphics.fillStyle(0xffffff, 0.8).fillCircle(32, 32, 15);
    graphics.generateTexture('food', 64, 64);
    graphics.clear().fillStyle(0xffffff, 0.15).fillRect(2, 2, 60, 60);
    graphics.fillStyle(0xffffff, 0.8).fillRect(17, 17, 30, 30);
    graphics.generateTexture('meat', 64, 64);
    graphics.destroy();
  }

  private createCreatureSprite(): CreatureSprite {
    const container = this.add.container(0, 0).setDepth(3);
    const tail = this.add.image(0, 0, 'fin');
    const segments = Array.from({ length: 8 }, () => this.add.image(0, 0, 'body'));
    const fins = [this.add.image(0, 0, 'fin'), this.add.image(0, 0, 'fin')];
    const eyes = [this.add.image(0, 0, 'eye'), this.add.image(0, 0, 'eye')];
    const mouth = this.add.rectangle(0, 0, 1.5, 5, 0x192a28);
    container.add([tail, ...[...segments].reverse(), ...fins, ...eyes, mouth]);
    return { container, tail, segments, fins, eyes, mouth };
  }

  private synchronize(frame: WorldFrame): void {
    const changedSize = !this.frame || frame.width !== this.frame.width || frame.height !== this.frame.height;
    this.motion.accept(frame);
    this.frame = frame;
    if (changedSize) {
      this.grid.clear().fillStyle(0x30453a);
      for (let column = 24; column < frame.width; column += 32) {
        for (let row = 24; row < frame.height; row += 32) this.grid.fillRect(column, row, 1.4, 1.4);
      }
      this.cameras.main.setBounds(0, 0, frame.width, frame.height);
      this.fit();
    }
    const creatureIds = new Set(frame.creatures.map(creature => creature.id));
    for (const [id, sprite] of this.creatures) {
      if (!creatureIds.has(id)) { sprite.container.setVisible(false); this.unusedCreatures.push(sprite); this.creatures.delete(id); }
    }
    for (const creature of frame.creatures) {
      if (!this.creatures.has(creature.id)) {
        const sprite = this.unusedCreatures.pop() ?? this.createCreatureSprite();
        sprite.container.setVisible(true);
        this.creatures.set(creature.id, sprite);
      }
    }
    const foodIds = new Set(frame.food.map(food => food.id));
    for (const [id, sprite] of this.foods) {
      if (!foodIds.has(id)) { sprite.setVisible(false); this.unusedFoods.push(sprite); this.foods.delete(id); }
    }
    for (const food of frame.food) {
      let sprite = this.foods.get(food.id);
      if (!sprite) {
        sprite = this.unusedFoods.pop() ?? this.add.image(0, 0, 'food').setDepth(1);
        this.foods.set(food.id, sprite);
      }
      const diameter = (foodRadius(food) + 3) * 2;
      sprite.setVisible(true).setTexture(food.kind === 'Plant' ? 'food' : 'meat').setPosition(food.x, food.y).setTint(food.kind === 'Plant' ? 0x67b998 : 0xe2947b).setDisplaySize(diameter, diameter);
    }
  }

  fit(): void {
    if (!this.ready || !this.frame) return;
    this.zoomFactor = 1;
    this.applyZoom();
    this.cameras.main.centerOn(this.frame.width / 2, this.frame.height / 2);
  }

  pan(dx: number, dy: number): void {
    const camera = this.cameras.main;
    camera.scrollX -= dx / camera.zoom;
    camera.scrollY -= dy / camera.zoom;
  }

  adjustZoom(factor: number): void {
    this.zoomFactor = Phaser.Math.Clamp(this.zoomFactor * factor, 1, 4);
    this.applyZoom();
  }

  private applyZoom(): void {
    if (!this.ready || !this.frame) return;
    this.cameras.main.setZoom(Math.min(this.scale.width / this.frame.width, this.scale.height / this.frame.height) * this.zoomFactor);
  }

  private pick(pointer: Phaser.Input.Pointer): void {
    if (!this.frame) return;
    const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    let nearest = 30 / this.cameras.main.zoom;
    let selected: number | null = null;
    for (const creature of this.frame.creatures) {
      const pose = this.motion.sample(creature);
      const distance = Math.hypot(pose.x - point.x, pose.y - point.y);
      if (distance < nearest) { selected = creature.id; nearest = distance; }
    }
    this.client.select(selected);
  }

  update(): void {
    const frame = this.frame;
    if (!frame) return;
    this.grid.setVisible(this.options.grid);
    this.overlays.clear();
    const now = performance.now();
    for (const current of frame.creatures) {
      const creature = this.motion.sample(current, now);
      const sprite = this.creatures.get(creature.id)!;
      this.drawCreature(sprite, creature, this.motion.time(now));
      if (this.options.energy) {
        this.overlays.fillStyle(0x30403b).fillRect(creature.x - 10, creature.y + creature.traits.radius + 12, 20, 2);
        this.overlays.fillStyle(creature.energy > 0.3 ? 0xd5ed95 : 0xee957c).fillRect(creature.x - 10, creature.y + creature.traits.radius + 12, 20 * creature.energy, 2);
      }
      if (creature.id === this.client.state.selected?.id) this.drawSelection(creature);
    }
  }

  private drawCreature(sprite: CreatureSprite, creature: RenderCreature, time: number): void {
    const traits = creature.traits;
    const color = hueColor(traits.hue);
    sprite.container.setPosition(creature.x, creature.y).setRotation(creature.angle);
    sprite.segments.forEach((segment, index) => {
      segment.setVisible(index < traits.segments);
      if (index >= traits.segments) return;
      const pose = segmentPose(traits, index, time, creature.id);
      segment.setPosition(pose.x, pose.y).setDisplaySize(pose.radiusX * 2.2, pose.radiusY * 2.2).setTint(color).setAlpha(1 - index / traits.segments * 0.5);
    });
    const last = segmentPose(traits, traits.segments - 1, time, creature.id);
    sprite.tail.setVisible(traits.tail > 0).setTint(color).setAlpha(0.65)
      .setPosition(last.x - traits.radius * traits.tail, last.y).setDisplaySize(traits.radius * 2.5 * traits.tail, traits.radius * 2 * traits.tail);
    sprite.fins.forEach((fin, index) => {
      const side = index ? 1 : -1;
      fin.setVisible(traits.flippers > 0).setTint(color).setAlpha(0.65)
        .setPosition(-traits.radius * 1.4, side * traits.radius * 0.6).setRotation(side * 0.65)
        .setDisplaySize(traits.radius * 2.5, traits.radius * (0.7 + traits.flippers));
    });
    sprite.eyes.forEach((eye, index) => eye.setVisible(traits.eyes > 0)
      .setPosition(traits.radius * 0.3, (index ? 1 : -1) * traits.radius * traits.width * 0.55).setDisplaySize(traits.eyes * 4.4, traits.eyes * 4.4));
    sprite.mouth.setVisible(traits.mouth > 0).setPosition(traits.radius * 0.95, 0).setDisplaySize(1.5, traits.radius * traits.mouth);
  }

  private drawSelection(creature: RenderCreature): void {
    const traits = creature.traits;
    this.overlays.lineStyle(1.2, 0xd5ed95, 0.9).strokeCircle(creature.x, creature.y, traits.radius + 8);
    if (!this.options.senses) return;
    this.overlays.lineStyle(1, 0xe2947b, 0.35).strokeCircle(creature.x, creature.y, traits.scentRange);
    if (!traits.visionRange) return;
    this.overlays.fillStyle(0xd5ed95, 0.08).beginPath().moveTo(creature.x, creature.y);
    const startAngle = creature.angle - traits.visionAngle / 2;
    this.overlays.lineTo(creature.x + Math.cos(startAngle) * traits.visionRange, creature.y + Math.sin(startAngle) * traits.visionRange);
    this.overlays.arc(creature.x, creature.y, traits.visionRange, startAngle, creature.angle + traits.visionAngle / 2, false);
    this.overlays.closePath().fillPath();
  }
}

export class PhaserRenderer {
  readonly scene: WorldScene;
  private readonly game: Phaser.Game;
  private readonly observer: ResizeObserver;
  private readonly abort = new AbortController();

  constructor(host: HTMLElement, client: SimulationClient) {
    this.scene = new WorldScene(client);
    this.game = new Phaser.Game({
      type: Phaser.AUTO, parent: host, width: host.clientWidth || 640, height: host.clientHeight || 480,
      backgroundColor: WORLD_COLORS.world, banner: false, scene: [this.scene],
      resolution: Math.min(devicePixelRatio || 1, 2), audio: { noAudio: true },
      scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER },
      render: { antialias: true, roundPixels: false },
      callbacks: { postBoot: game => { game.canvas.dataset.testid = 'world-canvas'; game.canvas.setAttribute('aria-label', 'Live ecosystem. Creature selection is also available in the Population panel.'); } },
    });
    this.observer = new ResizeObserver(() => this.game.scale.resize(Math.max(1, host.clientWidth), Math.max(1, host.clientHeight)));
    this.observer.observe(host);
    host.addEventListener('wheel', event => event.preventDefault(), { passive: false, signal: this.abort.signal });
  }

  dispose(): void { this.observer.disconnect(); this.abort.abort(); this.game.destroy(true); }
}