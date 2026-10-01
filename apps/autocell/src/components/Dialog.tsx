import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ACP_FORMAT_VERSION } from '@autocell/core';
import type { Doc } from '../app/doc';
import { displayName } from '../app/doc';
import { APP_NAME, APP_VERSION, BUILD_DATE, CREDITS } from '../version';
import { Chart } from './Chart';
import { Icon } from './Icons';
import { patternText } from './Panels';

export type Theme = 'modern' | 'retro';

interface DialogProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  width?: number;
  height?: number;
  footer?: ReactNode;
  children: ReactNode;
  bodyStyle?: React.CSSProperties;
  /** Ohne inneres Padding (für Dialoge mit eigenem Layout). */
  flush?: boolean;
}

export function Dialog({ title, subtitle, onClose, width, height, footer, children, bodyStyle, flush }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('input, select, textarea, button.btn-primary');
    el?.focus();
  }, []);
  return (
    <div className="dialog-backdrop">
      <div
        ref={ref}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width, height }}
      >
        <div className="dialog-titlebar">
          <img src="./icon.png" alt="" />
          <h1 className="dialog-title">
            {title}
            {subtitle && <small> — {subtitle}</small>}
          </h1>
          <button className="dialog-close" aria-label="Schließen" onClick={onClose}>
            <Icon.close size={14} strokeWidth={2.5} />
          </button>
        </div>
        {flush ? children : <div className="dialog-body" style={bodyStyle}>{children}</div>}
        {footer && <div className="dialog-footer">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- Credits ---------------- */

export function CreditsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="Credits"
      onClose={onClose}
      width={460}
      footer={<><span className="spacer" /><button className="btn btn-primary" onClick={onClose}>Schließen</button></>}
    >
      <div className="credits">
        <img src="./icon.png" alt="AutoCell-Logo" />
        <h2>{APP_NAME}</h2>
        <div style={{ color: 'var(--muted)' }}>Simulation zellulärer Automaten</div>
        <dl>
          <dt>Version</dt>
          <dd className="mono">{APP_VERSION}</dd>
          <dt>Entwickler</dt>
          <dd>{CREDITS.developer}</dd>
          {BUILD_DATE && (
            <>
              <dt>Build</dt>
              <dd className="mono">{BUILD_DATE}</dd>
            </>
          )}
          <dt>Projektformat</dt>
          <dd>.acp, Formatversion {ACP_FORMAT_VERSION}</dd>
          <dt>Verwendet</dt>
          <dd>{CREDITS.libraries.join(', ')}</dd>
        </dl>
        <p style={{ margin: '14px 0 0', color: 'var(--muted)', lineHeight: 1.5, fontSize: 12.5 }}>
          Version 2 ist eine vollständige Neuentwicklung und löst {CREDITS.predecessor} ab.
        </p>
      </div>
    </Dialog>
  );
}

/* ---------------- Rückfrage ---------------- */

export interface ConfirmButton {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export function ConfirmDialog({ title, text, buttons, onClose }: { title: string; text: ReactNode; buttons: ConfirmButton[]; onClose: () => void }) {
  return (
    <Dialog
      title={title}
      onClose={onClose}
      width={500}
      footer={
        <>
          <span className="spacer" />
          {buttons.map((b) => (
            <button key={b.label} className={`btn${b.primary ? ' btn-primary' : ''}`} onClick={b.onClick}>
              {b.label}
            </button>
          ))}
        </>
      }
    >
      <p className="confirm-text" style={{ margin: 0, lineHeight: 1.55 }}>{text}</p>
    </Dialog>
  );
}

export function MessageDialog({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  return (
    <ConfirmDialog title={title} text={text} onClose={onClose} buttons={[{ label: 'OK', onClick: onClose, primary: true }]} />
  );
}

/* ---------------- Tastenkürzel ---------------- */

export const SHORTCUTS: Array<[string, string]> = [
  ['Leertaste', 'Simulation starten / anhalten'],
  ['→', 'Einzelschritt'],
  ['Strg + Z / Strg + Y', 'Rückgängig / Wiederherstellen'],
  ['Strg + N', 'Neues Projekt'],
  ['Strg + O', 'Projekt öffnen'],
  ['Strg + S', 'Speichern'],
  ['Strg + Umschalt + S', 'Speichern unter'],
  ['Strg + R', 'Zustände & Regeln'],
  ['Strg + Plus / Minus', 'Vergrößern / Verkleinern'],
  ['B / E', 'Stift / Radierer'],
  ['1 … 9', 'Zustand als Pinsel wählen'],
  ['G', 'Gitterlinien ein/aus'],
  ['Entf', 'Raster leeren'],
  ['Rechtsklick', 'Zellmenü'],
];

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog title="Tastenkürzel" onClose={onClose} width={520}>
      <dl className="kbd-list">
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}

/* ---------------- Statistik ---------------- */

export function StatsDialog({ doc, frame, onClose, onExportCsv }: { doc: Doc; frame: number; onClose: () => void; onExportCsv: () => void }) {
  const [range, setRange] = useState<0 | 100 | 500>(0);
  const model = doc.sim.model;
  const total = doc.sim.size;
  const h = doc.history;
  const window = range === 0 ? h.length : Math.min(range, h.length);
  const fmt = (n: number) => Math.round(n).toLocaleString('de-DE');
  const pattern = patternText(doc.pattern);
  return (
    <Dialog
      title="Statistik"
      subtitle={displayName(doc)}
      onClose={onClose}
      width={980}
      footer={
        <>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>{h.length.toLocaleString('de-DE')} Generationen aufgezeichnet</span>
          <span className="spacer" />
          <button className="btn" onClick={onExportCsv}>Als CSV exportieren</button>
          <button className="btn btn-primary" onClick={onClose}>Schließen</button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="row-between">
          <div className="segmented">
            {([0, 500, 100] as const).map((r) => (
              <button key={r} aria-pressed={range === r} onClick={() => setRange(r)} style={{ padding: '6px 12px' }}>
                {r === 0 ? 'Alle' : `Letzte ${r}`}
              </button>
            ))}
          </div>
          <div className="legend">
            {model.states.map((s, i) => (
              <span key={i}><span className="swatch small" style={{ background: s.color }} />{s.name}</span>
            ))}
          </div>
        </div>
        <div className="chart-box">
          <Chart
            history={h}
            colors={model.states.map((s) => s.color)}
            total={total}
            window={range === 0 ? 0 : range}
            height={260}
            gridColor="#1d2c23"
            frame={frame}
            label="Anteil der Zustände je Generation"
          />
        </div>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Zustand</th>
              <th scope="col">Aktuell</th>
              <th scope="col">Minimum</th>
              <th scope="col">Maximum (Gen.)</th>
              <th scope="col">Mittelwert</th>
            </tr>
          </thead>
          <tbody>
            {model.states.map((s, i) => {
              const sum = h.summary(i, window);
              return (
                <tr key={i}>
                  <th scope="row" style={{ fontWeight: 500 }}>
                    <span className="swatch small" style={{ background: s.color, display: 'inline-block', marginRight: 8, verticalAlign: -1 }} />
                    {s.name}
                  </th>
                  <td>{fmt(doc.sim.counts[i] ?? 0)}</td>
                  <td>{fmt(sum.min)}</td>
                  <td>{fmt(sum.max)} ({fmt(sum.maxGeneration)})</td>
                  <td>{fmt(sum.mean)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="pattern-note">{pattern ?? 'Kein stabiler oder wiederkehrender Zustand erkannt.'}</div>
      </div>
    </Dialog>
  );
}
