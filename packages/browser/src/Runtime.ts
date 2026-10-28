import { DEFAULT_PARAMETERS, FixedStepClock, World, parseWorld } from '../../simulation/src/index.ts';
import type { Creature, GameParameters, WorldFrame } from '../../simulation/src/index.ts';

export type Speed = 1 | 2 | 4;
export type Command =
  | { type: 'init' | 'reset'; config: GameParameters }
  | { type: 'pause'; paused: boolean }
  | { type: 'speed'; value: Speed }
  | { type: 'select'; id: number | null }
  | { type: 'visibility'; hidden: boolean }
  | { type: 'step' | 'feed' }
  | { type: 'save'; requestId: number }
  | { type: 'load'; text: string };

export interface FrameMessage {
  type: 'frame';
  frame: WorldFrame;
  selected: Creature | null;
  config: GameParameters;
  paused: boolean;
  speed: Speed;
  computeMs: number;
}

export type Response = FrameMessage
  | { type: 'saved'; requestId: number; text: string }
  | { type: 'error'; message: string; requestId?: number }
  | { type: 'notice'; message: string };

export class SimulationRuntime {
  world: World | null = null;
  paused = false;
  speed: Speed = 1;
  hidden = false;
  selectedId: number | null = null;
  private readonly clock = new FixedStepClock();

  dispatch(command: Command): Response[] {
    try {
      if (command.type === 'init' || command.type === 'reset') {
        this.world = new World(command.config);
        this.selectedId = this.world.population.creatures[0]?.id ?? null;
        this.clock.reset();
        this.paused = false;
        return [this.frame(), { type: 'notice', message: 'New experiment started.' }];
      }
      if (!this.world) throw new Error('The simulation is still starting. Try again in a moment.');
      switch (command.type) {
        case 'pause': this.paused = command.paused; this.clock.reset(); break;
        case 'speed':
          if (![1, 2, 4].includes(command.value)) throw new Error('Unsupported simulation speed.');
          this.speed = command.value;
          break;
        case 'select': this.selectedId = command.id; break;
        case 'visibility': this.hidden = command.hidden; this.clock.reset(); break;
        case 'step': if (this.paused) this.world.step(); break;
        case 'feed': this.world.addPlants(); break;
        case 'save': return [{ type: 'saved', requestId: command.requestId, text: JSON.stringify(this.world.save()) }];
        case 'load': {
          let restored: World;
          try { restored = parseWorld(command.text); }
          catch (error) {
            const detail = error instanceof SyntaxError ? 'The file is not valid JSON.' : error instanceof Error ? error.message : 'The file is not an Eelf export.';
            throw new Error(`Experiment not imported. ${detail} Choose a .json file exported from Eelf. Your current experiment is unchanged.`);
          }
          this.world = restored;
          this.paused = true;
          this.selectedId = restored.population.creatures[0]?.id ?? null;
          this.clock.reset();
          return [this.frame(), { type: 'notice', message: 'Experiment imported. Simulation paused.' }];
        }
      }
      return [this.frame()];
    } catch (error) {
      return [{ type: 'error', message: error instanceof Error ? error.message : 'That action did not complete. Try again.',
        requestId: command.type === 'save' ? command.requestId : undefined }];
    }
  }

  advance(elapsed: number): FrameMessage | null {
    if (!this.world || this.paused || this.hidden) return null;
    const started = performance.now();
    this.clock.advance(elapsed, this.speed, () => this.world!.step());
    return this.frame(performance.now() - started);
  }

  private frame(computeMs = 0): FrameMessage {
    const world = this.world!;
    return {
      type: 'frame', frame: world.frame(), selected: this.selectedId === null ? null : structuredClone(world.population.get(this.selectedId) ?? null),
      config: { ...world.config }, paused: this.paused, speed: this.speed, computeMs,
    };
  }
}

export const INITIAL_CONFIG = { ...DEFAULT_PARAMETERS };