import { DEFAULT_PARAMETERS, MAX_SAVE_BYTES, validateParameters } from '../../simulation/src/index.ts';
import type { Creature, GameParameters, WorldFrame } from '../../simulation/src/index.ts';
import type { Command, Response, Speed } from './Runtime.ts';

export interface LabState {
  frame: WorldFrame | null;
  selected: Creature | null;
  config: GameParameters;
  paused: boolean;
  speed: Speed;
  computeMs: number;
  loading: boolean;
  error: string;
  notice: string;
}

export class SimulationClient {
  state: LabState = {
    frame: null, selected: null, config: { ...DEFAULT_PARAMETERS }, paused: false, speed: 1,
    computeMs: 0, loading: true, error: '', notice: '',
  };
  private readonly worker: Worker;
  private readonly listeners = new Set<(state: LabState) => void>();
  private readonly frameListeners = new Set<(frame: WorldFrame) => void>();
  private lastNotification = 0;
  private sequence = 0;
  private disposed = false;
  private noticeTimer?: ReturnType<typeof setTimeout>;
  private readonly reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly pending = new Map<number, { resolve: (text: string) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private readonly visibility = (): void => this.send({ type: 'visibility', hidden: document.hidden });

  constructor(worker: Worker) {
    this.worker = worker;
    worker.onmessage = (event: MessageEvent<Response>) => this.receive(event.data);
    worker.onerror = () => this.fail('Simulation stopped. Reload the page to restart it.');
    worker.onmessageerror = () => this.fail('Simulation update could not be read. Reload the page to restart it.');
    document.addEventListener('visibilitychange', this.visibility);
    this.send({ type: 'init', config: this.state.config });
    this.holdForReducedMotion();
    this.visibility();
  }

  subscribe(listener: (state: LabState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  onFrame(listener: (frame: WorldFrame) => void): () => void {
    this.frameListeners.add(listener);
    if (this.state.frame) listener(this.state.frame);
    return () => this.frameListeners.delete(listener);
  }

  private notify(): void {
    this.lastNotification = performance.now();
    for (const listener of this.listeners) listener(this.state);
  }

  private receive(message: Response): void {
    if (this.disposed) return;
    if (message.type === 'frame') {
      const force = this.state.loading || message.paused || this.state.selected?.id !== message.selected?.id;
      this.state = { ...this.state, ...message, loading: false };
      for (const listener of this.frameListeners) listener(message.frame);
      if (force || performance.now() - this.lastNotification >= 200) this.notify();
    } else if (message.type === 'saved') {
      const request = this.pending.get(message.requestId);
      if (request) { clearTimeout(request.timer); request.resolve(message.text); this.pending.delete(message.requestId); }
    } else if (message.type === 'error') {
      if (message.requestId !== undefined) {
        const request = this.pending.get(message.requestId);
        if (request) { clearTimeout(request.timer); request.reject(new Error(message.message)); this.pending.delete(message.requestId); }
      }
      this.reportError(message.message);
    } else {
      // Clear first so a repeated identical notice still changes the live region and is announced.
      clearTimeout(this.noticeTimer);
      this.state = { ...this.state, notice: '', error: '' };
      this.notify();
      this.noticeTimer = setTimeout(() => {
        if (this.disposed) return;
        this.state = { ...this.state, notice: message.message };
        this.notify();
      }, 50);
    }
  }

  /** Under prefers-reduced-motion the simulation starts paused; the Run button is the opt-in. */
  private holdForReducedMotion(): void {
    if (!this.reduceMotion) return;
    this.state = { ...this.state, paused: true };
    this.send({ type: 'pause', paused: true });
  }

  private send(command: Command): void {
    if (!this.disposed) this.worker.postMessage(command);
  }

  togglePause(): void {
    this.state = { ...this.state, paused: !this.state.paused };
    this.send({ type: 'pause', paused: this.state.paused });
    this.notify();
  }

  setSpeed(value: Speed): void {
    this.state = { ...this.state, speed: value };
    this.send({ type: 'speed', value });
    this.notify();
  }

  step(): void { this.send({ type: 'step' }); }
  feed(): void { this.send({ type: 'feed' }); }
  select(id: number | null): void { this.send({ type: 'select', id }); }

  reset(config: GameParameters): void {
    try {
      const validated = validateParameters(config);
      this.state = { ...this.state, loading: true, error: '' };
      this.send({ type: 'reset', config: validated });
      this.holdForReducedMotion();
      this.notify();
    } catch (error) { this.reportError(String(error instanceof Error ? error.message : error)); }
  }

  save(): Promise<string> {
    if (this.disposed) return Promise.reject(new Error('Experiment not exported. The simulation is closed. Reload the page and export again.'));
    return new Promise((resolve, reject) => {
      const requestId = ++this.sequence;
      const timer = setTimeout(() => {
        this.pending.delete(requestId);
        reject(new Error('Experiment not exported. The simulation stopped responding. Reload the page and export again.'));
      }, 10000);
      this.pending.set(requestId, { resolve, reject, timer });
      this.send({ type: 'save', requestId });
    });
  }

  async loadFile(file: File): Promise<void> {
    if (file.size > MAX_SAVE_BYTES) { this.reportError('Experiment not imported. Choose an export file smaller than 8 MB. Your current experiment is unchanged.'); return; }
    try { this.send({ type: 'load', text: await file.text() }); }
    catch { this.reportError('Experiment not imported. The file could not be read. Choose it again. Your current experiment is unchanged.'); }
  }

  reportError(message: string): void {
    this.state = { ...this.state, error: message, loading: false };
    this.notify();
  }

  clearError(): void {
    this.state = { ...this.state, error: '' };
    this.notify();
  }

  private fail(message: string): void {
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(new Error(message)); }
    this.pending.clear();
    this.reportError(message);
  }

  dispose(): void {
    this.disposed = true;
    this.worker.terminate();
    document.removeEventListener('visibilitychange', this.visibility);
    clearTimeout(this.noticeTimer);
    this.fail('Simulation closed.');
    this.listeners.clear();
    this.frameListeners.clear();
  }
}

export async function downloadExperiment(client: SimulationClient): Promise<void> {
  try {
    const text = await client.save();
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `eelf-${client.state.config.seed}-${client.state.frame?.statistics.tick ?? 0}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) { client.reportError(error instanceof Error ? error.message : 'Experiment not exported. Try again.'); }
}