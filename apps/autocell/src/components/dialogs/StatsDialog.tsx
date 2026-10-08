import { useState } from 'react';
import type { Doc } from '../../app/doc';
import { displayName, removeProbe, renameProbe } from '../../app/doc';
import { Chart } from '../Chart';
import { Dialog } from '../Dialog';
import { Icon } from '../Icons';
import { patternText } from '../Panels';
import { ProbeTimeline } from '../ProbeTimeline';

export type StatsTab = 'overview' | 'probes';

type Range = 0 | 100 | 500;

const ROW = 22;
const GAP = 6;

const fmt = (n: number) => Math.round(n).toLocaleString('de-DE');
const pct = (part: number, whole: number) =>
  whole > 0 ? `${(Math.round((part / whole) * 1000) / 10).toLocaleString('de-DE')} %` : '–';

interface Props {
  doc: Doc;
  frame: number;
  initialTab?: StatsTab;
  onClose: () => void;
  onExportCsv: () => void;
  onExportProbesCsv: () => void;
  /** Nach Änderungen an den Messpunkten (Raster neu zeichnen). */
  onChange: () => void;
}

export function StatsDialog({ doc, frame, initialTab = 'overview', onClose, onExportCsv, onExportProbesCsv, onChange }: Props) {
  const [tab, setTab] = useState<StatsTab>(initialTab);
  const [range, setRange] = useState<Range>(0);
  const h = doc.history;

  return (
    <Dialog
      title="Statistik"
      subtitle={displayName(doc)}
      onClose={onClose}
      width={1000}
      flush
      footer={
        <>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {h.length.toLocaleString('de-DE')} Generationen aufgezeichnet
            {doc.probes.length > 0 && ` · ${doc.probes.length} Messpunkt${doc.probes.length === 1 ? '' : 'e'}`}
          </span>
          <span className="spacer" />
          {tab === 'overview' ? (
            <button className="btn" onClick={onExportCsv}>Als CSV exportieren</button>
          ) : (
            <button className="btn" onClick={onExportProbesCsv} disabled={doc.probes.length === 0}>Messpunkte als CSV</button>
          )}
          <button className="btn btn-primary" onClick={onClose}>Schließen</button>
        </>
      }
    >
      <div className="dialog-tabs" role="tablist">
        {(
          [
            ['overview', 'Übersicht'],
            ['probes', `Messpunkte${doc.probes.length ? ` (${doc.probes.length})` : ''}`],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className="dialog-tab" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        <span className="spacer" />
        <div className="segmented" style={{ alignSelf: 'center' }} aria-label="Zeitraum">
          {([0, 500, 100] as const).map((r) => (
            <button key={r} aria-pressed={range === r} onClick={() => setRange(r)} style={{ padding: '5px 12px' }}>
              {r === 0 ? 'Alle' : `Letzte ${r}`}
            </button>
          ))}
        </div>
      </div>
      <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 440 }}>
        {tab === 'overview' ? <Overview doc={doc} frame={frame} range={range} /> : <Probes doc={doc} frame={frame} range={range} onChange={onChange} />}
      </div>
    </Dialog>
  );
}

/* ---------------- Übersicht ---------------- */

function Overview({ doc, frame, range }: { doc: Doc; frame: number; range: Range }) {
  const model = doc.sim.model;
  const total = doc.sim.size;
  const h = doc.history;
  const win = range === 0 ? h.length : Math.min(range, h.length);
  const prev = h.length >= 2 ? h.counts[h.length - 2] : null;
  const pattern = patternText(doc.pattern);
  return (
    <>
      <div className="legend">
        {model.states.map((s, i) => (
          <span key={i}><span className="swatch small" style={{ background: s.color }} />{s.name}</span>
        ))}
      </div>
      <div className="chart-box">
        <Chart
          history={h}
          colors={model.states.map((s) => s.color)}
          total={total}
          window={range}
          height={240}
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
            <th scope="col">Anteil</th>
            <th scope="col">Änderung</th>
            <th scope="col">Minimum (Gen.)</th>
            <th scope="col">Maximum (Gen.)</th>
            <th scope="col">Mittelwert</th>
          </tr>
        </thead>
        <tbody>
          {model.states.map((s, i) => {
            const sum = h.summary(i, win);
            const now = doc.sim.counts[i] ?? 0;
            const delta = prev ? now - (prev[i] ?? 0) : 0;
            return (
              <tr key={i}>
                <th scope="row" style={{ fontWeight: 500 }}>
                  <span className="swatch small" style={{ background: s.color, display: 'inline-block', marginRight: 8, verticalAlign: -1 }} />
                  {s.name}
                </th>
                <td>{fmt(now)}</td>
                <td>{pct(now, total)}</td>
                <td style={{ color: delta === 0 ? 'var(--muted)' : undefined }}>{delta > 0 ? `+${fmt(delta)}` : fmt(delta)}</td>
                <td>{fmt(sum.min)} ({fmt(sum.minGeneration)})</td>
                <td>{fmt(sum.max)} ({fmt(sum.maxGeneration)})</td>
                <td>{fmt(sum.mean)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="pattern-note">
        {pattern ?? 'Kein stabiler oder wiederkehrender Zustand erkannt.'}
        {doc.sim.lastChanged > 0 && ` Im letzten Schritt haben sich ${fmt(doc.sim.lastChanged)} Zellen verändert (${pct(doc.sim.lastChanged, total)}).`}
      </div>
    </>
  );
}

/* ---------------- Messpunkte ---------------- */

function Probes({ doc, frame, range, onChange }: { doc: Doc; frame: number; range: Range; onChange: () => void }) {
  const states = doc.sim.model.states;
  const colors = states.map((s) => s.color);
  const log = doc.probeLog;
  const win = range === 0 ? log.length : Math.min(range, log.length);
  const first = log.length > 0 ? log.generations[log.length - win] : 0;
  const last = log.length > 0 ? log.generations[log.length - 1] : 0;

  if (doc.probes.length === 0) {
    return (
      <div style={{ margin: 'auto', maxWidth: 460, textAlign: 'center', color: 'var(--muted)', lineHeight: 1.6 }}>
        <p style={{ margin: 0, fontSize: 15, color: 'var(--text)' }}>Noch keine Messpunkte</p>
        <p>
          Ein Messpunkt beobachtet eine einzelne Zelle und zeichnet ihren Zustand in jeder Generation auf.
          Setze ihn per <strong>Rechtsklick auf eine Zelle › Messpunkt setzen</strong>.
        </p>
      </div>
    );
  }

  return (
    <>
      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '64px minmax(0, 1fr)', columnGap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: GAP }}>
            {doc.probes.map((p, k) => (
              <div key={k} className="mono" style={{ height: ROW, lineHeight: `${ROW}px`, fontSize: 12, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>
                {p.name}
              </div>
            ))}
          </div>
          <div className="chart-box" style={{ padding: 0, background: 'transparent', border: 0 }}>
            <ProbeTimeline log={log} colors={colors} window={range} rowHeight={ROW} gap={GAP} frame={frame} label="Zustand der Messpunkte je Generation" />
          </div>
          <span />
          <div className="row-between mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
            <span>Gen. {fmt(first)}</span>
            <span>Gen. {fmt(last)}</span>
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="table probe-table">
          <thead>
            <tr>
              <th scope="col">Messpunkt</th>
              <th scope="col">Zelle</th>
              <th scope="col">Aktuell</th>
              {states.map((s, i) => (
                <th key={i} scope="col" title={`Anteil der Zeit im Zustand „${s.name}“`}>
                  <span className="swatch small" style={{ background: s.color, display: 'inline-block', marginRight: 5, verticalAlign: -1 }} />
                  {s.name}
                </th>
              ))}
              <th scope="col" title="Wie oft der Zustand gewechselt hat">Wechsel</th>
              <th scope="col" title="Längste ununterbrochene Zeit in einem Zustand">Längste Phase</th>
              <th scope="col"><span className="visually-hidden">Entfernen</span></th>
            </tr>
          </thead>
          <tbody>
            {doc.probes.map((p, k) => {
              const sum = log.summary(k, states.length, win);
              const cur = doc.sim.get(p.x, p.y);
              const age = doc.sim.ages[p.y * doc.sim.width + p.x];
              const longest = sum.longestRun.reduce((best, v, i) => (v > sum.longestRun[best] ? i : best), 0);
              return (
                <tr key={`${p.x},${p.y}`}>
                  <th scope="row">
                    <input
                      className="input mono"
                      aria-label={`Name von Messpunkt ${p.name}`}
                      defaultValue={p.name}
                      maxLength={12}
                      style={{ width: 64, height: 26, fontSize: 12 }}
                      onBlur={(e) => { renameProbe(doc, k, e.target.value); onChange(); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    />
                  </th>
                  <td>({p.x + 1}|{p.y + 1})</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className="swatch small" style={{ background: states[cur]?.color, display: 'inline-block', marginRight: 6, verticalAlign: -1 }} />
                    <span style={{ fontFamily: 'inherit' }}>{states[cur]?.name}</span>
                    <span style={{ color: 'var(--muted)' }}> · {fmt(age)} Gen.</span>
                  </td>
                  {states.map((_, i) => (
                    <td key={i} style={{ color: sum.time[i] ? undefined : 'var(--muted)' }}>{pct(sum.time[i], sum.observed)}</td>
                  ))}
                  <td>{fmt(sum.changes)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {sum.observed ? `${fmt(sum.longestRun[longest])} × ${states[longest]?.name}` : '–'}
                  </td>
                  <td>
                    <button className="icon-btn" aria-label={`Messpunkt ${p.name} entfernen`} title="Entfernen" onClick={() => { removeProbe(doc, k); onChange(); }}>
                      <Icon.close size={13} strokeWidth={2.2} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint" style={{ fontSize: 12 }}>
        Prozentwerte beziehen sich auf die aufgezeichneten Generationen des gewählten Zeitraums. Messpunkte setzen und
        entfernen: Rechtsklick auf eine Zelle.
      </p>
    </>
  );
}
