import { CHROMOSOMES, GENE_DEFINITIONS } from '@eelf/simulation';
import type { Creature, GameParameters } from '@eelf/simulation';
import { downloadExperiment } from '@eelf/browser/SimulationClient.ts';
import type { LabState, SimulationClient } from '@eelf/browser/SimulationClient.ts';
import type { Speed } from '@eelf/browser/Runtime.ts';
import { count, cssColor, drawHistory, drawPreview, formatTime, geneLabel, hueColor } from '@eelf/browser/Drawing.ts';
import { makeIcon } from '@eelf/browser/icons.ts';
import type { IconName } from '@eelf/browser/icons.ts';
import type { WorldScene } from './WorldScene';
import markup from './lab.html?raw';

export class LabUI {
  readonly host: HTMLElement;
  private readonly root: HTMLElement;
  private readonly client: SimulationClient;
  private readonly values = new Map<string, HTMLElement>();
  private readonly abort = new AbortController();
  private readonly unsubscribe: () => void;
  private scene?: WorldScene;
  private panel = 'inspector';
  private page = 0;
  private confirmKind: 'reset' | 'import' = 'reset';
  private configSignature = '';
  private genomeSignature = '';
  private rowsSignature = '';
  private readonly rows = new Map<number, HTMLButtonElement>();

  constructor(root: HTMLElement, client: SimulationClient) {
    this.root = root;
    this.client = client;
    root.innerHTML = markup;
    this.host = this.element('#phaser-world');
    root.querySelectorAll<HTMLElement>('[data-icon]').forEach(element => element.replaceChildren(makeIcon(element.dataset.icon as IconName)));
    root.querySelectorAll<HTMLElement>('[data-value]').forEach(element => this.values.set(element.dataset.value!, element));
    const signal = this.abort.signal;
    root.addEventListener('click', event => this.click(event), { signal });
    this.element('.panel-tabs').addEventListener('keydown', event => this.tabKey(event as KeyboardEvent), { signal });
    this.element<HTMLFormElement>('#settings-form').addEventListener('submit', event => { event.preventDefault(); this.confirm('reset'); }, { signal });
    this.element('#settings-form').addEventListener('input', () => this.updateRangeLabels(), { signal });
    this.element<HTMLInputElement>('#experiment-file').addEventListener('change', event => {
      const input = event.target as HTMLInputElement;
      if (input.files?.[0]) { void client.loadFile(input.files[0]); this.scene?.fit(); }
      input.value = '';
    }, { signal });
    for (const identifier of ['#population-search', '#population-sort']) {
      this.element(identifier).addEventListener('input', () => { this.page = 0; this.renderPopulation(); }, { signal });
    }
    root.querySelectorAll<HTMLInputElement>('[data-overlay]').forEach(input => input.addEventListener('change', () => this.updateOverlays(), { signal }));
    this.unsubscribe = client.subscribe(state => this.render(state));
  }

  attach(scene: WorldScene): void { this.scene = scene; this.updateOverlays(); }

  private element<ElementType extends HTMLElement = HTMLElement>(selector: string): ElementType {
    const element = this.root.querySelector<ElementType>(selector);
    if (!element) throw new Error(`Missing UI element: ${selector}`);
    return element;
  }

  private text(key: string, value: string | number): void {
    const element = this.values.get(key);
    if (element && element.textContent !== String(value)) element.textContent = String(value);
  }

  private click(event: MouseEvent): void {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button.dataset.panel) { this.setPanel(button.dataset.panel); return; }
    if (button.dataset.speed) { this.client.setSpeed(Number(button.dataset.speed) as Speed); return; }
    if (button.dataset.creature) { this.client.select(Number(button.dataset.creature)); this.setPanel('inspector'); this.element('#inspector-tab').focus(); return; }
    switch (button.dataset.command) {
      case 'pause': this.client.togglePause(); break;
      case 'step': this.client.step(); break;
      case 'reset': this.restart(); break;
      case 'confirm-reset': this.confirm('reset'); break;
      case 'confirm-cancel': this.element<HTMLDialogElement>('#confirm-dialog').close(); break;
      case 'confirm-accept': this.element<HTMLDialogElement>('#confirm-dialog').close(); this.accept(this.confirmKind); break;
      case 'feed': this.client.feed(); break;
      case 'save': void downloadExperiment(this.client); break;
      case 'load': this.confirm('import'); break;
      case 'clear-error': this.client.clearError(); this.element<HTMLButtonElement>('[data-command="load"]').focus(); break;
      case 'clear-filter': {
        const search = this.element<HTMLInputElement>('#population-search');
        search.value = ''; this.page = 0; this.renderPopulation(); search.focus();
        break;
      }
      case 'zoom-in': this.scene?.adjustZoom(1.25); break;
      case 'zoom-out': this.scene?.adjustZoom(0.8); break;
      case 'fit': this.scene?.fit(); break;
      case 'pan-up': this.scene?.pan(0, 80); break;
      case 'pan-down': this.scene?.pan(0, -80); break;
      case 'pan-left': this.scene?.pan(80, 0); break;
      case 'pan-right': this.scene?.pan(-80, 0); break;
      case 'previous-page': this.page = Math.max(0, this.page - 1); this.renderPopulation(); break;
      case 'next-page': this.page++; this.renderPopulation(); break;
    }
  }

  private confirm(kind: 'reset' | 'import'): void {
    const stats = this.client.state.frame?.statistics;
    if (kind === 'reset' && !this.element<HTMLFormElement>('#settings-form').checkValidity()) { this.restart(); return; }
    if (!stats || stats.population === 0) { this.accept(kind); return; }
    this.confirmKind = kind;
    this.text('confirm-title', kind === 'import' ? 'Replace current experiment?' : 'Restart experiment?');
    this.text('confirm-body', kind === 'import'
      ? 'Importing a file replaces the running experiment. Export it first to keep it.'
      : `This discards the current experiment at Tick ${stats.tick} with ${count(stats.population, 'creature', 'creatures')}. Export it first to keep it.`);
    this.text('confirm-accept', kind === 'import' ? 'Choose file' : 'Restart experiment');
    this.element<HTMLDialogElement>('#confirm-dialog').showModal();
  }

  private accept(kind: 'reset' | 'import'): void {
    if (kind === 'import') this.element<HTMLInputElement>('#experiment-file').click(); else this.restart();
  }

  private restart(): void {
    const form = this.element<HTMLFormElement>('#settings-form');
    if (!form.checkValidity()) { this.setPanel('environment'); form.reportValidity(); return; }
    const values = new FormData(form);
    const config = { ...this.client.state.config };
    for (const key of Object.keys(config) as (keyof GameParameters)[]) config[key] = Number(values.get(key));
    this.client.reset(config);
    this.scene?.fit();
    this.page = 0;
  }

  private setPanel(panel: string): void {
    this.panel = panel;
    this.root.querySelectorAll<HTMLButtonElement>('[data-panel]').forEach(button => {
      const selected = button.dataset.panel === panel;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
      this.element(`#${button.dataset.panel}-panel`).hidden = !selected;
    });
    if (panel === 'population') this.renderPopulation();
  }

  private tabKey(event: KeyboardEvent): void {
    const panels = ['inspector', 'environment', 'population'];
    const index = panels.indexOf(this.panel);
    const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
    if (next < 0) return;
    event.preventDefault();
    this.setPanel(panels[next]);
    this.element<HTMLButtonElement>(`[data-panel="${panels[next]}"]`).focus();
  }

  private updateOverlays(): void {
    if (!this.scene) return;
    for (const key of ['senses', 'energy', 'grid'] as const) this.scene.options[key] = this.element<HTMLInputElement>(`[data-overlay="${key}"]`).checked;
  }

  private updateRangeLabels(): void {
    const growth = this.element<HTMLInputElement>('[name="foodGrowth"]').value;
    const mutation = Number(this.element<HTMLInputElement>('[name="mutationRate"]').value);
    this.element('#food-growth-value').textContent = `${growth} / s`;
    this.element('#mutation-value').textContent = `${Math.round(mutation * 100)}%`;
    this.element<HTMLInputElement>('[name="initialPopulation"]').max = this.element<HTMLInputElement>('[name="maxPopulation"]').value;
  }

  private render(state: LabState): void {
    const stats = state.frame?.statistics;
    this.text('population', stats?.population ?? 0);
    this.text('births', `+${count(stats?.births ?? 0, 'birth', 'births')} / ${count(stats?.deaths ?? 0, 'death', 'deaths')}`);
    this.text('generation', stats?.generation ?? 1);
    this.text('plants', stats?.plants ?? 0);
    this.text('meat', `plants / ${stats?.meat ?? 0} meat`);
    this.text('elapsed', formatTime(stats?.time ?? 0));
    this.text('tick', `Tick ${stats?.tick ?? 0}`);
    this.text('compute', `${state.computeMs.toFixed(1)} ms / worker`);
    this.text('run-state', state.loading ? 'Initializing' : state.paused ? 'Paused' : 'Live ecosystem');
    this.text('world-caption', `Seed ${state.config.seed} / ${state.config.width} × ${state.config.height}`);
    this.text('pause-label', state.paused ? 'Run' : 'Pause');
    this.text('error', state.error);
    this.text('notice', state.notice);
    this.element('.error-banner').hidden = !state.error;
    this.element('.status-dot').classList.toggle('paused', state.paused);
    this.element('#loading-state').hidden = !state.loading;
    this.element('#extinct-state').hidden = !stats || stats.population !== 0;
    const pause = this.element<HTMLButtonElement>('[data-command="pause"]');
    pause.disabled = state.loading || !state.frame || stats?.population === 0;
    pause.toggleAttribute('data-paused', state.paused);
    const label = state.paused ? 'Run simulation' : 'Pause simulation';
    pause.setAttribute('aria-label', label); pause.title = label;
    this.element<HTMLButtonElement>('[data-command="step"]').disabled = !state.paused;
    for (const command of ['feed', 'save']) this.element<HTMLButtonElement>(`[data-command="${command}"]`).disabled = !state.frame;
    this.root.querySelectorAll<HTMLButtonElement>('[data-speed]').forEach(button => {
      const active = Number(button.dataset.speed) === state.speed;
      button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
    });
    const signature = JSON.stringify(state.config);
    if (signature !== this.configSignature) {
      this.configSignature = signature;
      for (const [key, value] of Object.entries(state.config)) this.element<HTMLInputElement>(`[name="${key}"]`).value = String(value);
      this.updateRangeLabels();
    }
    this.renderInspector(state.selected);
    drawPreview(this.element<HTMLCanvasElement>('#creature-preview'), state.selected, stats?.time ?? 0);
    drawHistory(this.element<HTMLCanvasElement>('#history-chart'), state.frame);
    if (this.panel === 'population') this.renderPopulation();
  }

  private renderInspector(creature: Creature | null): void {
    this.element('#inspector-details').hidden = !creature;
    this.element('#no-selection').hidden = !!creature;
    this.text('selected-creature', creature ? `Creature #${creature.id}` : 'No selection');
    this.text('action', creature?.action ?? '');
    if (!creature) return;
    const traits = creature.traits;
    const energy = Math.round(creature.energy / traits.maxEnergy * 100);
    const health = Math.round(creature.health / traits.maxHealth * 100);
    this.text('energy', `${energy}%`); this.text('health', `${health}%`);
    this.element('#energy-meter').style.width = `${energy}%`;
    this.element('#health-meter').style.width = `${health}%`;
    this.text('selected-generation', creature.generation);
    this.text('age', `${formatTime(creature.age)} / ${formatTime(traits.lifespan)}`);
    this.text('speed', `${traits.speed.toFixed(1)} u/s`);
    this.text('mass', traits.mass.toFixed(1));
    this.text('sensing', `${traits.visionRange.toFixed(0)} / ${traits.scentRange.toFixed(0)}`);
    this.text('parents', creature.parents.length ? creature.parents.join(', ') : 'Founder');
    for (const feature of ['eyes', 'mouth', 'flippers', 'tail'] as const) {
      const element = this.element(`[data-feature="${feature}"]`);
      const present = traits[feature] > 0;
      element.classList.toggle('enabled', present);
      const state = element.querySelector('[data-feature-state]')!;
      const label = present ? ', present' : ', absent';
      if (state.textContent !== label) state.textContent = label;
    }
    const signature = JSON.stringify(creature.genome);
    if (signature === this.genomeSignature) return;
    this.genomeSignature = signature;
    const sections = CHROMOSOMES.map(chromosome => {
      const details = document.createElement('details'); details.className = 'chromosome'; details.open = chromosome === 'Body';
      const summary = document.createElement('summary'); summary.textContent = chromosome;
      const count = document.createElement('span'); count.textContent = String(GENE_DEFINITIONS[chromosome].length); summary.append(count); details.append(summary);
      GENE_DEFINITIONS[chromosome].forEach((identifier, index) => {
        const row = document.createElement('div'); row.className = 'gene-row';
        const name = document.createElement('span'); name.textContent = geneLabel(identifier);
        const track = document.createElement('span'); track.className = 'gene-track';
        const bar = document.createElement('i'); bar.style.width = `${creature.genome[chromosome][index] * 100}%`; track.append(bar);
        const value = document.createElement('span'); value.className = 'gene-value'; value.textContent = creature.genome[chromosome][index].toFixed(2);
        row.append(name, track, value); details.append(row);
      });
      return details;
    });
    this.element('#genome').replaceChildren(...sections);
  }

  private renderPopulation(): void {
    const search = this.element<HTMLInputElement>('#population-search').value.trim();
    const sort = this.element<HTMLSelectElement>('#population-sort').value;
    const creatures = (this.client.state.frame?.creatures ?? []).filter(creature => String(creature.id).includes(search));
    creatures.sort((left, right) => sort === 'energy' ? right.energy - left.energy : sort === 'generation' ? right.generation - left.generation : left.id - right.id);
    this.page = Math.min(this.page, Math.max(0, Math.ceil(creatures.length / 40) - 1));
    const visible = creatures.slice(this.page * 40, (this.page + 1) * 40);
    this.text('population-total', count(creatures.length, 'creature', 'creatures'));
    this.text('population-empty', search ? `No creatures match "${search}".` : 'No living creatures');
    this.element('[data-command="clear-filter"]').hidden = !search;
    this.text('page-number', `Page ${this.page + 1}`);
    this.element('#population-empty').hidden = creatures.length !== 0;
    this.element<HTMLButtonElement>('[data-command="previous-page"]').disabled = this.page === 0;
    this.element<HTMLButtonElement>('[data-command="next-page"]').disabled = (this.page + 1) * 40 >= creatures.length;
    for (const creature of visible) {
      let button = this.rows.get(creature.id);
      if (!button) {
        button = document.createElement('button'); button.className = 'population-row'; button.dataset.creature = String(creature.id);
        button.innerHTML = '<span class="population-swatch"></span><span><strong></strong><small></small></span><span class="mono"></span>';
        this.rows.set(creature.id, button);
      }
      button.querySelector<HTMLElement>('.population-swatch')!.style.background = cssColor(hueColor(creature.traits.hue));
      button.querySelector('strong')!.textContent = `Creature #${creature.id}`;
      button.querySelector('small')!.textContent = `Generation ${creature.generation}`;
      button.querySelector('.mono')!.textContent = `${Math.round(creature.energy * 100)}%`;
    }
    const signature = visible.map(creature => creature.id).join(',');
    if (signature !== this.rowsSignature) {
      const list = this.element('#population-list');
      const active = document.activeElement;
      const focused = active instanceof HTMLElement ? active.dataset.creature : undefined;
      const focusedIndex = focused ? [...list.children].indexOf(active as HTMLElement) : -1;
      list.replaceChildren(...visible.map(creature => this.rows.get(creature.id)!));
      if (focused) {
        const rows = [...list.children] as HTMLElement[];
        const target = visible.some(creature => String(creature.id) === focused) ? this.rows.get(Number(focused)) : rows[Math.min(focusedIndex, rows.length - 1)];
        (target ?? this.element('#population-heading')).focus();
      }
      this.rowsSignature = signature;
    }
    const ids = new Set(visible.map(creature => creature.id));
    for (const id of this.rows.keys()) if (!ids.has(id)) this.rows.delete(id);
  }

  dispose(): void { this.abort.abort(); this.unsubscribe(); }
}