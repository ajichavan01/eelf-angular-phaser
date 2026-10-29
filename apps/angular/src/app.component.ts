import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Injector, ViewChild, afterNextRender, inject, signal } from '@angular/core';
import type { AfterViewInit, OnDestroy , ElementRef} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CHROMOSOMES, GENE_DEFINITIONS } from '@eelf/simulation';
import type { ChromosomeID, GameParameters, RenderCreature } from '@eelf/simulation';
import { SimulationClient, downloadExperiment } from '@eelf/browser/SimulationClient.ts';
import { CanvasRenderer } from '@eelf/browser/CanvasRenderer.ts';
import { count, cssColor, drawHistory, drawPreview, formatTime, geneLabel, hueColor } from '@eelf/browser/Drawing.ts';
import { IconComponent } from './icon.component';

type Panel = 'inspector' | 'environment' | 'population';

@Component({
  selector: 'eelf-app', standalone: true, imports: [FormsModule, IconComponent],
  templateUrl: './app.component.html', changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements AfterViewInit, OnDestroy {
  @ViewChild('worldCanvas', { static: true }) worldCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('preview', { static: true }) preview!: ElementRef<HTMLCanvasElement>;
  @ViewChild('history', { static: true }) history!: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput', { static: true }) fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('confirmDialog', { static: true }) confirmDialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('settingsForm', { static: true }) settingsForm!: ElementRef<HTMLFormElement>;
  readonly client = new SimulationClient(new Worker(new URL('./simulation.worker.ts', import.meta.url), { type: 'module' }));
  readonly state = signal(this.client.state);
  readonly panel = signal<Panel>('inspector');
  readonly confirmKind = signal<'reset' | 'import'>('reset');
  /** Frozen when the dialog opens so its text does not change while the simulation runs behind it. */
  readonly confirmStats = signal({ tick: 0, population: 0 });
  readonly chromosomes = CHROMOSOMES;
  readonly formatTime = formatTime;
  readonly count = count;
  readonly geneLabel = geneLabel;
  readonly speeds = [1, 2, 4] as const;
  draft: GameParameters = { ...this.client.state.config };
  senses = false;
  energy = false;
  grid = true;
  search = '';
  sort = 'id';
  page = 0;
  renderer?: CanvasRenderer;
  private unsubscribe?: () => void;
  private configSignature = JSON.stringify(this.draft);
  private readonly injector = inject(Injector);
  private readonly changeDetector = inject(ChangeDetectorRef);

  ngAfterViewInit(): void {
    try { this.renderer = new CanvasRenderer(this.worldCanvas.nativeElement, this.client); }
    catch (error) { this.client.reportError(`Unable to show the world. ${error instanceof Error ? `${error.message} ` : ''}Reload the page, or open Eelf in another browser.`); }
    this.unsubscribe = this.client.subscribe(state => {
      const active = document.activeElement;
      const focusedRow = active instanceof HTMLElement && active.classList.contains('population-row') ? active : null;
      this.state.set(state);
      if (focusedRow) this.restoreRowFocus(focusedRow.dataset.creature, [...document.querySelectorAll('.population-row')].indexOf(focusedRow));
      const signature = JSON.stringify(state.config);
      if (signature !== this.configSignature) { this.draft = { ...state.config }; this.configSignature = signature; }
      drawPreview(this.preview.nativeElement, state.selected, state.frame?.statistics.time ?? 0);
      drawHistory(this.history.nativeElement, state.frame);
    });
  }

  ngOnDestroy(): void { this.unsubscribe?.(); this.renderer?.dispose(); this.client.dispose(); }
  percent(value: number): number { return Math.round(value * 100); }
  color(hue: number): string { return cssColor(hueColor(hue)); }
  genes(chromosome: ChromosomeID): readonly string[] { return GENE_DEFINITIONS[chromosome]; }
  reset(): void { this.client.reset({ ...this.draft }); this.renderer?.fit(); this.page = 0; }
  requestReset(): void {
    const form = this.settingsForm.nativeElement;
    if (!form.checkValidity()) {
      this.panel.set('environment');
      this.changeDetector.detectChanges();
      form.reportValidity();
      return;
    }
    if (this.hasProgress()) this.openConfirm('reset'); else this.reset();
  }
  requestImport(): void { if (this.hasProgress()) this.openConfirm('import'); else this.fileInput.nativeElement.click(); }

  confirmAction(): void {
    this.confirmDialog.nativeElement.close();
    if (this.confirmKind() === 'import') this.fileInput.nativeElement.click(); else this.reset();
  }

  private hasProgress(): boolean { return (this.state().frame?.statistics.population ?? 0) > 0; }

  private openConfirm(kind: 'reset' | 'import'): void {
    this.confirmKind.set(kind);
    const statistics = this.state().frame?.statistics;
    this.confirmStats.set({ tick: statistics?.tick ?? 0, population: statistics?.population ?? 0 });
    this.changeDetector.detectChanges();
    this.confirmDialog.nativeElement.showModal();
  }

  private restoreRowFocus(id: string | undefined, index: number): void {
    afterNextRender(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      const rows = [...document.querySelectorAll<HTMLElement>('.population-row')];
      const target = rows.find(row => row.dataset.creature === id) ?? rows[Math.min(index, rows.length - 1)] ?? document.getElementById('population-heading');
      target?.focus();
    }, { injector: this.injector });
  }
  save(): void { void downloadExperiment(this.client); }

  load(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) { void this.client.loadFile(file); this.renderer?.fit(); }
    input.value = '';
  }

  updateOverlays(): void {
    if (this.renderer) this.renderer.options = { senses: this.senses, energy: this.energy, grid: this.grid };
  }

  select(id: number): void {
    this.client.select(id);
    this.panel.set('inspector');
    document.getElementById('inspector-tab')?.focus();
  }

  tabKey(event: KeyboardEvent): void {
    const panels: Panel[] = ['inspector', 'environment', 'population'];
    const index = panels.indexOf(this.panel());
    const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
    if (next < 0) return;
    event.preventDefault();
    this.panel.set(panels[next]);
    const tabs = (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs[next].focus();
  }

  filteredPopulation(): RenderCreature[] {
    const creatures = (this.state().frame?.creatures ?? []).filter(creature => String(creature.id).includes(this.search.trim()));
    return creatures.sort((left, right) => this.sort === 'energy' ? right.energy - left.energy : this.sort === 'generation' ? right.generation - left.generation : left.id - right.id);
  }

  populationRows(): RenderCreature[] {
    const creatures = this.filteredPopulation();
    const page = this.currentPage();
    return creatures.slice(page * 40, (page + 1) * 40);
  }

  currentPage(): number { return Math.min(this.page, Math.max(0, Math.ceil(this.filteredPopulation().length / 40) - 1)); }
}