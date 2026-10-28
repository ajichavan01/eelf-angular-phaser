import '@eelf/browser/styles.css';
import { SimulationClient } from '@eelf/browser/SimulationClient.ts';
import { LabUI } from './LabUI';
import { PhaserRenderer } from './WorldScene';

const root = document.querySelector<HTMLElement>('#app')!;
const client = new SimulationClient(new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' }));
const ui = new LabUI(root, client);
let renderer: PhaserRenderer | undefined;
try { renderer = new PhaserRenderer(ui.host, client); ui.attach(renderer.scene); }
catch (error) { client.reportError(`Unable to show the world. ${error instanceof Error ? `${error.message} ` : ''}Reload the page, or open Eelf in another browser.`); }

const dispose = (): void => { ui.dispose(); renderer?.dispose(); client.dispose(); };
window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); });
if (import.meta.hot) import.meta.hot.dispose(dispose);