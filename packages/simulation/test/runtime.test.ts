import assert from 'node:assert/strict';
import test from 'node:test';
import { Worker } from 'node:worker_threads';
import { SimulationRuntime } from '../../browser/src/Runtime.ts';
import type { Command, Response } from '../../browser/src/Runtime.ts';
import { DEFAULT_PARAMETERS } from '../src/index.ts';

test('worker runtime supports pause, exact stepping, speed and restart', () => {
  const runtime = new SimulationRuntime();
  runtime.dispatch({ type: 'init', config: DEFAULT_PARAMETERS });
  runtime.advance(0.1);
  assert.equal(runtime.world!.tick, 3);
  runtime.dispatch({ type: 'pause', paused: true });
  assert.equal(runtime.advance(1), null);
  runtime.dispatch({ type: 'step' });
  assert.equal(runtime.world!.tick, 4);
  runtime.dispatch({ type: 'speed', value: 4 });
  runtime.dispatch({ type: 'pause', paused: false });
  runtime.advance(0.1);
  assert.equal(runtime.world!.tick, 16);
  runtime.dispatch({ type: 'reset', config: DEFAULT_PARAMETERS });
  assert.equal(runtime.world!.tick, 0);
});

test('hidden tabs suspend simulation and importing a save is atomic', () => {
  const runtime = new SimulationRuntime();
  runtime.dispatch({ type: 'init', config: DEFAULT_PARAMETERS });
  runtime.dispatch({ type: 'visibility', hidden: true });
  assert.equal(runtime.advance(10), null);
  assert.equal(runtime.world!.tick, 0);
  const before = runtime.world!.save();
  const error = runtime.dispatch({ type: 'load', text: '{bad json' });
  assert.equal(error[0].type, 'error');
  assert.deepEqual(runtime.world!.save(), before);
  runtime.dispatch({ type: 'load', text: JSON.stringify(before) });
  assert.equal(runtime.paused, true);
  assert.deepEqual(runtime.world!.save(), before);
});

test('save responses are correlated and feeding changes the world', () => {
  const runtime = new SimulationRuntime();
  runtime.dispatch({ type: 'init', config: DEFAULT_PARAMETERS });
  const count = runtime.world!.food.length;
  runtime.dispatch({ type: 'feed' });
  assert.equal(runtime.world!.food.length, count + 24);
  const response = runtime.dispatch({ type: 'save', requestId: 27 })[0];
  assert.equal(response.type, 'saved');
  if (response.type === 'saved') {
    assert.equal(response.requestId, 27);
    assert.equal(JSON.parse(response.text).format, 'eelf');
  }
});

test('the actual worker adapter transports frames, steps and save files across a thread boundary', async () => {
  const workerModule = new URL('../../browser/src/SimulationWorker.ts', import.meta.url).href;
  const worker = new Worker(`
    const { parentPort } = require('node:worker_threads');
    import(${JSON.stringify(workerModule)}).then(({ installSimulationWorker }) => {
      installSimulationWorker({
        postMessage: message => parentPort.postMessage(message),
        addEventListener: (type, listener) => parentPort.on(type, data => listener({ data }))
      });
    });
  `, { eval: true, execArgv: ['--experimental-strip-types'] });
  const request = (command: Command, accepts: (response: Response) => boolean): Promise<Response> => new Promise((resolve, reject) => {
    const cleanup = (): void => { clearTimeout(timer); worker.off('message', receive); worker.off('error', fail); };
    const receive = (response: Response): void => { if (accepts(response)) { cleanup(); resolve(response); } };
    const fail = (error: Error): void => { cleanup(); reject(error); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Worker response timed out.')); }, 5000);
    worker.on('message', receive);
    worker.once('error', fail);
    worker.postMessage(command);
  });
  try {
    const initial = await request({ type: 'init', config: DEFAULT_PARAMETERS }, response => response.type === 'frame');
    assert.equal(initial.type, 'frame');
    const paused = await request({ type: 'pause', paused: true }, response => response.type === 'frame' && response.paused);
    assert.equal(paused.type, 'frame');
    const stepped = await request({ type: 'step' }, response => response.type === 'frame');
    if (paused.type === 'frame' && stepped.type === 'frame') assert.equal(stepped.frame.statistics.tick, paused.frame.statistics.tick + 1);
    const saved = await request({ type: 'save', requestId: 9 }, response => response.type === 'saved' && response.requestId === 9);
    assert.equal(saved.type, 'saved');
    if (saved.type === 'saved') assert.equal(JSON.parse(saved.text).config.seed, DEFAULT_PARAMETERS.seed);
  } finally { await worker.terminate(); }
});