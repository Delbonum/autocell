/**
 * <autocell-player> – spielt ein AutoCell-Projekt in einer beliebigen Webseite ab.
 *
 * Projektquelle (die erste vorhandene gilt):
 *   src="projekt.acp"                     .acp-Datei oder deren JSON-Variante
 *   <script type="application/json">…     eingebettetes Projekt (Kind-Element)
 *   template="gol" cols="80" rows="56"    Vorlage, zufällig belegt (seed="…" optional)
 *
 * Verhalten:
 *   autoplay      startet sobald sichtbar (nicht bei „Bewegung reduzieren“)
 *   controls      Steuerleiste (Start/Pause, Schritt, Zurücksetzen, Generation)
 *   legend        Zustände mit Farbe und Anzahl
 *   loop          beginnt nach einer Stoppbedingung von vorn
 *   interactive   Zellen per Klick umschalten
 *   speed="10"    Tempo in Generationen pro Sekunde (sonst aus dem Projekt)
 *
 * Ereignisse: load, error, play, pause, end
 */
import { PatternDetector, simulationFromProject, type Project, type Simulation, type SimulationSnapshot } from '@autocell/core';
import { Clock, parseSpeed, PlayerError, projectFromBytes, projectFromJsonText, projectFromTemplate } from './source';
import { STYLE } from './style';

const HOME_URL = 'https://delbonum.github.io/autocell/';
const LOOP_PAUSE_MS = 1500;
const FRAME_BUDGET_MS = 14;

const ICONS = {
  play: '<path d="M7 4.5v15l12.5-7.5z" fill="currentColor"/>',
  pause: '<path d="M6.5 4.5h4v15h-4zM13.5 4.5h4v15h-4z" fill="currentColor"/>',
  step: '<path d="M5 4.5v15l10-7.5zM16.5 4.5h3v15h-3z" fill="currentColor"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4v4h4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>',
};

const svg = (body: string) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${body}</svg>`;

function colorLut(project: Project): Uint32Array {
  return Uint32Array.from(project.model.states, (s) => {
    const v = parseInt(s.color.slice(1), 16) || 0;
    // ImageData ist RGBA; als Uint32 in Little Endian also ABGR.
    return ((255 << 24) | ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255)) >>> 0;
  });
}

function reducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export class AutoCellPlayer extends HTMLElement {
  static observedAttributes = ['src', 'template', 'cols', 'rows', 'seed', 'speed', 'controls', 'legend', 'interactive'];

  private root: ShadowRoot;
  private stage: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private buffer = document.createElement('canvas');
  private msg: HTMLDivElement;
  private bar: HTMLDivElement;
  private playBtn: HTMLButtonElement;
  private stepBtn: HTMLButtonElement;
  private genLabel: HTMLSpanElement;
  private legendBox: HTMLDivElement;

  private project: Project | null = null;
  private sim: Simulation | null = null;
  private start: SimulationSnapshot | null = null;
  private detector = new PatternDetector(200);
  private lut: Uint32Array = new Uint32Array(0);
  private clock = new Clock(8);
  private cellPx = 1;

  private _playing = false;
  private visible = true;
  private raf = 0;
  private lastTime = 0;
  private loopTimer = 0;
  private loadToken = 0;
  private reloadQueued = false;
  /** Projekt kam per load() – Attribute nicht auswerten, bis sich eins ändert. */
  private manual = false;
  private painting: number | null = null;

  private resizeObs = new ResizeObserver(() => this.layout());
  private visObs = new IntersectionObserver((entries) => {
    this.visible = entries.some((e) => e.isIntersecting);
    if (this.visible && this._playing) this.schedule();
  });

  constructor() {
    super();
    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = `
      <style>${STYLE}</style>
      <div class="stage" part="stage"><canvas part="canvas" role="img"></canvas><div class="msg" hidden></div></div>
      <div class="bar" part="controls">
        <button class="play" type="button" aria-label="Start">${svg(ICONS.play)}</button>
        <button class="step" type="button" aria-label="Einzelschritt">${svg(ICONS.step)}</button>
        <button class="reset" type="button" aria-label="Zurücksetzen">${svg(ICONS.reset)}</button>
        <span class="gen" aria-live="off">Gen. 0</span>
        <span class="spacer"></span>
        <a class="brand" href="${HOME_URL}" target="_blank" rel="noopener">AutoCell</a>
      </div>
      <div class="legend" part="legend"></div>`;
    const $ = <T extends Element>(sel: string) => this.root.querySelector(sel) as T;
    this.stage = $('.stage');
    this.canvas = $('canvas');
    this.msg = $('.msg');
    this.bar = $('.bar');
    this.playBtn = $('.play');
    this.stepBtn = $('.step');
    this.genLabel = $('.gen');
    this.legendBox = $('.legend');
    this.playBtn.addEventListener('click', () => this.toggle());
    this.stepBtn.addEventListener('click', () => this.step());
    $<HTMLButtonElement>('.reset').addEventListener('click', () => this.reset());
    this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
    const stop = () => (this.painting = null);
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
  }

  /* ---------------- Lebenszyklus ---------------- */

  connectedCallback(): void {
    this.resizeObs.observe(this.stage);
    this.visObs.observe(this);
    this.syncChrome();
    if (!this.project && !this.manual) this.queueReload();
  }

  disconnectedCallback(): void {
    this.resizeObs.disconnect();
    this.visObs.disconnect();
    cancelAnimationFrame(this.raf);
    clearTimeout(this.loopTimer);
    this.raf = 0;
  }

  attributeChangedCallback(name: string, old: string | null, value: string | null): void {
    if (old === value || !this.isConnected) return;
    if (name === 'speed') this.clock.speed = parseSpeed(value, this.project?.settings.speed ?? 8);
    else if (name === 'controls' || name === 'legend' || name === 'interactive') this.syncChrome();
    else {
      this.manual = false;
      this.queueReload();
    }
  }

  /* ---------------- Öffentliche Schnittstelle ---------------- */

  get playing(): boolean {
    return this._playing;
  }

  get generation(): number {
    return this.sim?.generation ?? 0;
  }

  /** Name des geladenen Projekts. */
  get projectName(): string {
    return this.project?.meta.name ?? '';
  }

  /** Lädt ein Projekt direkt: Inhalt einer .acp-/JSON-Datei oder ein Projekt-Objekt. */
  load(source: Project | Uint8Array | ArrayBuffer): void {
    this.manual = true;
    this.loadToken++;
    try {
      const p = source instanceof Uint8Array ? projectFromBytes(source)
        : source instanceof ArrayBuffer ? projectFromBytes(new Uint8Array(source))
        : source;
      this.setProject(p);
    } catch (e) {
      this.fail(e);
    }
  }

  play(): void {
    if (!this.sim || this._playing) return;
    this._playing = true;
    this.clock.reset();
    this.syncPlayButton();
    this.schedule();
    this.dispatchEvent(new Event('play'));
  }

  pause(): void {
    clearTimeout(this.loopTimer);
    if (!this._playing) return;
    this._playing = false;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.syncPlayButton();
    this.dispatchEvent(new Event('pause'));
  }

  toggle(): void {
    if (this._playing) this.pause();
    else this.play();
  }

  /** Berechnet genau eine Generation (hält die Wiedergabe an). */
  step(): void {
    if (!this.sim) return;
    this.pause();
    this.advance(1);
    this.draw();
  }

  /** Zurück zum Stand beim Laden. */
  reset(): void {
    if (!this.sim || !this.start) return;
    clearTimeout(this.loopTimer);
    this.sim.restore(this.start);
    this.detector.reset();
    this.clock.reset();
    this.draw();
  }

  /* ---------------- Laden ---------------- */

  private queueReload(): void {
    if (this.reloadQueued) return;
    this.reloadQueued = true;
    queueMicrotask(() => {
      this.reloadQueued = false;
      if (!this.manual) void this.reload();
    });
  }

  private async reload(): Promise<void> {
    const token = ++this.loadToken;
    try {
      const p = await this.resolveSource();
      if (token === this.loadToken) this.setProject(p);
    } catch (e) {
      if (token === this.loadToken) this.fail(e);
    }
  }

  private async resolveSource(): Promise<Project> {
    const src = this.getAttribute('src');
    if (src) {
      this.showMessage('Lade Projekt …');
      let res: Response;
      try {
        res = await fetch(new URL(src, document.baseURI));
      } catch {
        throw new PlayerError(`„${src}“ konnte nicht abgerufen werden.`);
      }
      if (!res.ok) throw new PlayerError(`„${src}“ konnte nicht geladen werden (HTTP ${res.status}).`);
      // Manche Server liefern für fehlende Dateien ihre Startseite aus.
      if (res.headers.get('content-type')?.includes('text/html')) {
        throw new PlayerError(`Unter „${src}“ liegt eine Webseite statt einer Projektdatei – stimmt die Adresse?`);
      }
      return projectFromBytes(new Uint8Array(await res.arrayBuffer()));
    }
    const inline = this.querySelector('script[type="application/json"], script[type="application/vnd.autocell+json"]');
    if (inline?.textContent?.trim()) return projectFromJsonText(inline.textContent);
    return projectFromTemplate(
      this.getAttribute('template') ?? 'gol',
      this.getAttribute('cols'),
      this.getAttribute('rows'),
      this.getAttribute('seed'),
    );
  }

  private setProject(p: Project): void {
    const wasPlaying = this._playing;
    this.pause();
    this.project = p;
    this.sim = simulationFromProject(p);
    this.start = this.sim.snapshot();
    this.detector.reset();
    this.lut = colorLut(p);
    this.clock.speed = parseSpeed(this.getAttribute('speed'), p.settings.speed);
    this.canvas.setAttribute('aria-label', `${p.meta.name}: zellulärer Automat, ${p.width} × ${p.height} Zellen`);
    this.stage.style.aspectRatio = `${p.width} / ${p.height}`;
    this.buildLegend();
    this.showMessage(null);
    this.layout();
    this.dispatchEvent(new CustomEvent('load', { detail: { name: p.meta.name, width: p.width, height: p.height } }));
    if (wasPlaying || (this.hasAttribute('autoplay') && !reducedMotion())) this.play();
  }

  private fail(e: unknown): void {
    this.pause();
    const message = e instanceof Error ? e.message : String(e);
    this.showMessage(`Projekt konnte nicht geladen werden: ${message}`);
    this.dispatchEvent(new CustomEvent('error', { detail: { message } }));
    if (!(e instanceof PlayerError)) console.error('[autocell-player]', e);
  }

  private showMessage(text: string | null): void {
    this.msg.hidden = text === null;
    this.msg.textContent = text ?? '';
  }

  /* ---------------- Wiedergabe ---------------- */

  private schedule(): void {
    if (this.raf || !this._playing || !this.visible) return;
    this.lastTime = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (!this._playing || !this.visible) return;
    const due = this.clock.due(now - this.lastTime);
    this.lastTime = now;
    if (due > 0) {
      const done = this.advance(due, now);
      if (done < due) this.clock.drop();
      this.draw();
    }
    this.schedule();
  };

  /** Rechnet bis zu `n` Generationen, solange Zeit bleibt. Gibt die Zahl der berechneten zurück. */
  private advance(n: number, frameStart = performance.now()): number {
    const sim = this.sim!;
    const settings = this.project!.settings;
    let done = 0;
    while (done < n) {
      sim.step();
      done++;
      const pattern = settings.stopWhenStable ? this.detector.observe(sim.generation, sim.cells) : null;
      const atLimit = settings.stopAtGeneration !== null && sim.generation >= settings.stopAtGeneration;
      if (atLimit || (pattern && pattern.kind !== 'none')) {
        this.finish();
        break;
      }
      if (performance.now() - frameStart > FRAME_BUDGET_MS) break;
    }
    return done;
  }

  private finish(): void {
    const wasPlaying = this._playing;
    this.pause();
    this.dispatchEvent(new Event('end'));
    if (wasPlaying && this.hasAttribute('loop')) {
      this.loopTimer = window.setTimeout(() => {
        this.reset();
        this.play();
      }, LOOP_PAUSE_MS);
    }
  }

  /* ---------------- Darstellung ---------------- */

  private syncChrome(): void {
    this.bar.hidden = !this.hasAttribute('controls');
    this.legendBox.hidden = !this.hasAttribute('legend');
    this.canvas.classList.toggle('interactive', this.hasAttribute('interactive'));
  }

  private syncPlayButton(): void {
    this.playBtn.innerHTML = svg(this._playing ? ICONS.pause : ICONS.play);
    this.playBtn.setAttribute('aria-label', this._playing ? 'Pause' : 'Start');
  }

  private buildLegend(): void {
    this.legendBox.replaceChildren(
      ...this.project!.model.states.map((s) => {
        const item = document.createElement('span');
        item.className = 'item';
        const sw = document.createElement('i');
        sw.style.background = s.color;
        const label = document.createElement('span');
        label.textContent = s.name;
        const count = document.createElement('b');
        item.append(sw, label, count);
        return item;
      }),
    );
  }

  /** Passt die Canvas an den verfügbaren Platz an (ganzzahlige Pixel je Zelle, wenn möglich). */
  private layout(): void {
    const p = this.project;
    if (!p) return;
    const box = this.stage.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const fit = Math.min(box.width / p.width, box.height / p.height);
    this.cellPx = fit >= 2 ? Math.floor(fit) : fit;
    const cssW = p.width * this.cellPx;
    const cssH = p.height * this.cellPx;
    const dpr = Math.min(window.devicePixelRatio || 1, 4);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.width = Math.max(1, Math.round(cssW * dpr));
    this.canvas.height = Math.max(1, Math.round(cssH * dpr));
    this.draw();
  }

  private draw(): void {
    const sim = this.sim;
    const p = this.project;
    if (!sim || !p) return;
    const W = sim.width;
    const H = sim.height;
    const buffer = this.buffer;
    if (buffer.width !== W || buffer.height !== H) {
      buffer.width = W;
      buffer.height = H;
    }
    const bctx = buffer.getContext('2d')!;
    const img = bctx.createImageData(W, H);
    const px = new Uint32Array(img.data.buffer);
    const cells = sim.cells;
    const lut = this.lut;
    for (let i = 0; i < cells.length; i++) px[i] = lut[cells[i]];
    bctx.putImageData(img, 0, 0);

    const pw = this.canvas.width;
    const ph = this.canvas.height;
    const ctx = this.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buffer, 0, 0, pw, ph);
    const step = pw / W;
    if (p.view.showGridLines && this.cellPx >= 6) {
      ctx.fillStyle = 'rgba(128, 128, 128, 0.22)';
      const t = Math.max(1, Math.round(pw / (W * this.cellPx)));
      for (let x = 0; x <= W; x++) ctx.fillRect(Math.min(Math.round(x * step), pw - t), 0, t, ph);
      for (let y = 0; y <= H; y++) ctx.fillRect(0, Math.min(Math.round(y * step), ph - t), pw, t);
    }

    this.genLabel.textContent = `Gen. ${sim.generation.toLocaleString('de-DE')}`;
    if (!this.legendBox.hidden) {
      const counts = sim.counts;
      this.legendBox.querySelectorAll('b').forEach((b, i) => {
        const text = (counts[i] ?? 0).toLocaleString('de-DE');
        if (b.textContent !== text) b.textContent = text;
      });
    }
  }

  /* ---------------- Interaktion ---------------- */

  private cellIndex(e: PointerEvent): number {
    const sim = this.sim!;
    const r = this.canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * sim.width);
    const y = Math.floor(((e.clientY - r.top) / r.height) * sim.height);
    return x < 0 || y < 0 || x >= sim.width || y >= sim.height ? -1 : y * sim.width + x;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.sim || !this.hasAttribute('interactive') || e.button !== 0) return;
    const i = this.cellIndex(e);
    if (i < 0) return;
    e.preventDefault();
    this.canvas.setPointerCapture(e.pointerId);
    // Der Zustand der ersten Zelle bestimmt, womit gemalt wird: der nächste Zustand.
    this.painting = (this.sim.cells[i] + 1) % this.sim.model.states.length;
    this.paint(i);
  }

  private onPointerMove(e: PointerEvent): void {
    if (this.painting === null || !(e.buttons & 1)) return;
    const i = this.cellIndex(e);
    if (i >= 0) this.paint(i);
  }

  private paint(i: number): void {
    if (this.sim!.setIndex(i, this.painting!)) {
      this.detector.reset();
      this.draw();
    }
  }
}
