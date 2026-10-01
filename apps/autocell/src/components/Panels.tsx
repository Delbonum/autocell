import type { PatternInfo } from '@autocell/core';
import type { Doc } from '../app/doc';
import { Chart } from './Chart';
import { Icon } from './Icons';

export type Tool = 'pen' | 'erase';

/** Was die Seitenleisten anzeigen und auslösen können. */
export interface PanelApi {
  doc: Doc;
  frame: number;
  running: boolean;
  tool: Tool;
  brush: number;
  setTool: (t: Tool) => void;
  setBrush: (s: number) => void;
  togglePlay: () => void;
  step: () => void;
  reset: () => void;
  randomize: () => void;
  clear: () => void;
  zoomBy: (dir: 1 | -1) => void;
  zoomPercent: number;
  toggleGridLines: () => void;
  setSpeed: (gps: number) => void;
  setSpeedUnit: (u: 'gps' | 'spg') => void;
  setStopAt: (g: number | null) => void;
  setStopWhenStable: (b: boolean) => void;
  setNeighborhood: (p: 'moore' | 'vonNeumann') => void;
  snapshot: () => void;
  openStats: () => void;
  openSettings: (tab: 'states' | 'neighborhood' | 'project') => void;
}

const fmt = (n: number) => n.toLocaleString('de-DE');
const pct = (n: number, total: number) => `${((n / total) * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;

export function speedLabel(gps: number, unit: 'gps' | 'spg'): string {
  return unit === 'gps'
    ? `${gps.toLocaleString('de-DE', { maximumFractionDigits: 2 })}/s`
    : `${(1 / gps).toLocaleString('de-DE', { maximumFractionDigits: 2 })} s`;
}

/** Tempostufen des Schiebereglers (Generationen pro Sekunde). */
export const SPEED_STEPS = [0.25, 0.5, 1, 2, 3, 4, 6, 8, 10, 15, 20, 30, 45, 60, 90, 120, 200, 400];

export function nearestSpeedStep(gps: number): number {
  let best = 0;
  SPEED_STEPS.forEach((v, i) => {
    if (Math.abs(Math.log(v / gps)) < Math.abs(Math.log(SPEED_STEPS[best] / gps))) best = i;
  });
  return best;
}

export function patternText(p: PatternInfo): string | null {
  if (p.kind === 'stable') return `Stabil seit Generation ${fmt(p.since)} – das Raster verändert sich nicht mehr.`;
  if (p.kind === 'periodic') return `Wiederkehrendes Muster: Periode ${fmt(p.period)} (seit Generation ${fmt(p.since)}).`;
  return null;
}

export function LeftPanel(api: PanelApi) {
  const { doc, tool, running } = api;
  const s = doc.project.settings;
  const states = doc.sim.model.states;
  return (
    <aside className="panel panel-left" aria-label="Werkzeuge und Simulation">
      <section className="section">
        <h2 className="section-title">Werkzeuge</h2>
        <div className="tool-grid">
          <button className="tool" aria-pressed={tool === 'pen'} onClick={() => api.setTool('pen')} title="Stift (B)">
            <Icon.pen size={18} />
            Stift
          </button>
          <button className="tool" aria-pressed={tool === 'erase'} onClick={() => api.setTool('erase')} title="Radierer (E)">
            <Icon.eraser size={18} />
            Radierer
          </button>
          <button className="tool" onClick={api.randomize} title="Zufällig nach Startanteilen füllen">
            <Icon.dice size={18} />
            Zufall
          </button>
          <button className="tool" onClick={api.clear} title="Raster leeren (Entf)">
            <Icon.trash size={18} />
            Leeren
          </button>
        </div>
        <p className="hint">
          Linksklick bzw. Ziehen malt mit{' '}
          <strong style={{ color: 'var(--text)' }}>
            {tool === 'erase' ? `${states[0].name} (Radierer)` : states[api.brush]?.name}
          </strong>
          . Rechtsklick öffnet das Zellmenü.
        </p>
      </section>

      <section className="section">
        <h2 className="section-title">Simulation</h2>
        <button className={`btn btn-primary btn-play${running ? ' is-running' : ''}`} onClick={api.togglePlay}>
          {running ? <Icon.pause size={18} strokeWidth={2.25} /> : <Icon.play size={18} />}
          {running ? 'Pause' : 'Start'}
        </button>
        <div className="grid-2">
          <button className="btn" onClick={api.step} title="Einzelschritt (→)">
            <Icon.step size={15} />
            Schritt
          </button>
          <button className="btn" onClick={api.reset} title="Zurück zu Generation 0">
            <Icon.reset size={15} />
            Zurück
          </button>
        </div>
        <div className="row-between">
          <label htmlFor="tempo" className="field-label">Tempo</label>
          <div className="segmented" style={{ fontSize: 11 }}>
            <button aria-pressed={s.speedUnit === 'gps'} onClick={() => api.setSpeedUnit('gps')}>Gen./s</button>
            <button aria-pressed={s.speedUnit === 'spg'} onClick={() => api.setSpeedUnit('spg')}>s/Gen.</button>
          </div>
        </div>
        <div className="row">
          <input
            id="tempo"
            type="range"
            min={0}
            max={SPEED_STEPS.length - 1}
            value={nearestSpeedStep(s.speed)}
            onChange={(e) => api.setSpeed(SPEED_STEPS[Number(e.target.value)])}
            style={{ flex: 1 }}
          />
          <span className="mono" style={{ width: 58, textAlign: 'right' }}>{speedLabel(s.speed, s.speedUnit)}</span>
        </div>
        <div className="row-between">
          <label htmlFor="stopgen" className="field-label">Automatisch stoppen bei Gen.</label>
          <input
            id="stopgen"
            className="input small mono"
            type="number"
            min={1}
            placeholder="—"
            value={s.stopAtGeneration ?? ''}
            onChange={(e) => api.setStopAt(e.target.value ? Math.max(1, Math.floor(Number(e.target.value))) : null)}
          />
        </div>
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={s.stopWhenStable} onChange={(e) => api.setStopWhenStable(e.target.checked)} />
          Bei stabilem oder wiederkehrendem Muster stoppen
        </label>
      </section>

      <section className="section">
        <h2 className="section-title">Ansicht</h2>
        <div className="row">
          <button className="btn btn-icon" onClick={() => api.zoomBy(-1)} aria-label="Verkleinern">
            <Icon.zoomOut size={16} />
          </button>
          <span className="mono" style={{ flex: 1, textAlign: 'center' }}>{api.zoomPercent} %</span>
          <button className="btn btn-icon" onClick={() => api.zoomBy(1)} aria-label="Vergrößern">
            <Icon.zoomIn size={16} />
          </button>
        </div>
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={doc.project.view.showGridLines} onChange={api.toggleGridLines} />
          Gitterlinien anzeigen
        </label>
      </section>

      <section className="section" style={{ marginTop: 'auto', gap: 6 }}>
        <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={api.snapshot}>
          <Icon.camera size={16} />
          Schnappschuss (PNG)
        </button>
        <button className="btn" style={{ justifyContent: 'flex-start' }} onClick={api.openStats}>
          <Icon.chart size={16} />
          Statistik öffnen
        </button>
      </section>
    </aside>
  );
}

export function RightPanel(api: PanelApi) {
  const { doc } = api;
  const model = doc.sim.model;
  const total = doc.sim.size;
  const counts = doc.sim.counts;
  const colors = model.states.map((s) => s.color);
  const nb = model.neighborhood.preset;
  const nbOffsets = new Set(model.neighborhood.offsets.map((o) => `${o.dx},${o.dy}`));
  const note = patternText(doc.pattern);
  const kpiState = model.states.length > 1 ? 1 : 0;
  return (
    <aside className="panel panel-right" aria-label="Zustände und Statistik">
      <section className="section" style={{ gap: 8 }}>
        <div className="section-head">
          <h2 className="section-title">Zustände</h2>
          <button className="link-button" onClick={() => api.openSettings('states')}>Regeln bearbeiten</button>
        </div>
        {model.states.map((s, i) => (
          <button
            key={i}
            className="state-row"
            aria-pressed={api.tool === 'pen' && api.brush === i}
            onClick={() => {
              api.setBrush(i);
              api.setTool('pen');
            }}
            title={`Mit „${s.name}“ malen`}
          >
            <span className="swatch" style={{ background: s.color }} />
            <span className="state-name">{s.name}</span>
            <span className="state-count">{fmt(counts[i] ?? 0)}</span>
            <span className="state-pct">{pct(counts[i] ?? 0, total)}</span>
          </button>
        ))}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Nachbarschaft</h2>
          <button className="link-button" onClick={() => api.openSettings('neighborhood')}>Eigene definieren</button>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <div className="nb-mini" aria-hidden="true">
            {[-1, 0, 1].flatMap((dy) =>
              [-1, 0, 1].map((dx) => (
                <span key={`${dx},${dy}`} className={dx === 0 && dy === 0 ? 'self' : nbOffsets.has(`${dx},${dy}`) ? 'on' : ''} />
              )),
            )}
          </div>
          <div className="segmented strong" style={{ flex: 1 }}>
            <button aria-pressed={nb === 'moore'} onClick={() => api.setNeighborhood('moore')}>Moore</button>
            <button aria-pressed={nb === 'vonNeumann'} onClick={() => api.setNeighborhood('vonNeumann')}>Von Neumann</button>
          </div>
        </div>
        <div className="row-between" style={{ fontSize: 12, color: 'var(--muted)' }}>
          <span>Rand</span>
          <span style={{ color: 'var(--text)' }}>{boundaryLabel(doc)}</span>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Verlauf</h2>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>letzte 120 Gen.</span>
        </div>
        <div className="chart-box">
          <Chart
            history={doc.history}
            colors={colors}
            total={total}
            window={120}
            height={96}
            gridColor="#1a2a20"
            frame={api.frame}
            label="Verlauf der Zustandsanteile"
          />
        </div>
        <div className="legend">
          {model.states.map((s, i) => (
            <span key={i}>
              <span className="swatch small" style={{ background: s.color }} />
              {s.name}
            </span>
          ))}
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="kpi-label">Generation</div>
            <div className="kpi-value">{fmt(doc.sim.generation)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">{model.states[kpiState].name}</div>
            <div className="kpi-value">{fmt(counts[kpiState] ?? 0)}</div>
          </div>
        </div>
        {note && <div className="pattern-note">{note}</div>}
      </section>
    </aside>
  );
}

export function boundaryLabel(doc: Doc): string {
  const b = doc.sim.model.boundary;
  if (b.type === 'torus') return 'Torus (Ränder verbunden)';
  if (b.type === 'mirror') return 'Gespiegelt';
  return `Fest („${doc.sim.model.states[b.state]?.name ?? b.state}“)`;
}

const NB_NAMES: Record<string, string> = {
  moore: 'Moore',
  vonNeumann: 'Von Neumann',
  moore2: 'Moore r=2',
  vonNeumann2: 'Von Neumann r=2',
  lookahead: 'Vorausschau',
  custom: 'Eigene',
};

export function StatusBar({ doc, running, zoomPercent }: { doc: Doc; running: boolean; zoomPercent: number }) {
  const n = doc.sim.model.neighborhood;
  return (
    <footer className="statusbar">
      <span style={{ color: 'var(--text)' }}>
        <span className={`status-dot${running ? ' on' : ''}`} />
        {running ? 'Simulation läuft' : doc.sim.generation > 0 ? 'Pausiert' : 'Bereit'}
      </span>
      <span>Generation <b className="mono">{fmt(doc.sim.generation)}</b></span>
      <span>Raster <b className="mono">{doc.sim.width} × {doc.sim.height}</b></span>
      <span>Nachbarschaft <b>{NB_NAMES[n.preset]} ({n.offsets.length + (n.includeSelf ? 1 : 0)})</b></span>
      <span>Rand <b>{doc.sim.model.boundary.type === 'torus' ? 'Torus' : doc.sim.model.boundary.type === 'mirror' ? 'Gespiegelt' : 'Fest'}</b></span>
      <span style={{ marginLeft: 'auto' }}>Zoom <b className="mono">{zoomPercent} %</b></span>
      <span>{doc.dirty ? 'Ungespeicherte Änderungen' : 'Gespeichert'}</span>
    </footer>
  );
}
