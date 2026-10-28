import { SimulationRuntime } from './Runtime.ts';
import type { Command, Response } from './Runtime.ts';

interface WorkerScope {
  postMessage(message: Response): void;
  addEventListener(type: 'message', listener: (event: MessageEvent<Command>) => void): void;
}

export function installSimulationWorker(scope: WorkerScope): void {
  const runtime = new SimulationRuntime();
  let previous = performance.now();
  scope.addEventListener('message', event => {
    for (const response of runtime.dispatch(event.data)) scope.postMessage(response);
    if (['init', 'reset', 'pause', 'visibility', 'load'].includes(event.data.type)) previous = performance.now();
  });
  setInterval(() => {
    const now = performance.now();
    const frame = runtime.advance((now - previous) / 1000);
    previous = now;
    if (frame) scope.postMessage(frame);
  }, 50);
}