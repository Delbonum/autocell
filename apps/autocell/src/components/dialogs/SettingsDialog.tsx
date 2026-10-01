import { useMemo, useState } from 'react';
import {
  COMPARE_OPS,
  customNeighborhood,
  describeRule,
  lintModel,
  neighborhood,
  type CompareOp,
  type Condition,
  type Model,
  type Rule,
} from '@autocell/core';
import type { Doc } from '../../app/doc';
import { displayName } from '../../app/doc';
import { Dialog } from '../Dialog';
import { Icon } from '../Icons';

export type SettingsTab = 'states' | 'neighborhood' | 'project';

export interface SettingsResult {
  model: Model;
  width: number;
  height: number;
  name: string;
  description: string;
  author: string;
}

interface Props {
  doc: Doc;
  initialTab: SettingsTab;
  onApply: (r: SettingsResult) => void;
  onClose: () => void;
}

const OP_LABEL: Record<CompareOp, string> = { '=': '=', '!=': '≠', '<': '<', '<=': '≤', '>': '>', '>=': '≥' };

const PALETTE = ['#0f1a13', '#3f7553', '#7cf283', '#ff9a3c', '#4ea3ff', '#e3ece5', '#f2d24b', '#b07cff', '#ff6b8b', '#6b7a70'];

const DIRECTIONS: Array<[string, number, number]> = [
  ['links', -1, 0],
  ['rechts', 1, 0],
  ['oben', 0, -1],
  ['unten', 0, 1],
  ['oben links', -1, -1],
  ['oben rechts', 1, -1],
  ['unten links', -1, 1],
  ['unten rechts', 1, 1],
];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function SettingsDialog({ doc, initialTab, onApply, onClose }: Props) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [model, setModelState] = useState<Model>(() => clone(doc.sim.model));
  const [sel, setSel] = useState(0);
  const [width, setWidth] = useState(String(doc.sim.width));
  const [height, setHeight] = useState(String(doc.sim.height));
  const [name, setName] = useState(doc.project.meta.name);
  const [description, setDescription] = useState(doc.project.meta.description);
  const [author, setAuthor] = useState(doc.project.meta.author);

  const edit = (fn: (m: Model) => void) => {
    const m = clone(model);
    fn(m);
    setModelState(m);
  };

  const warnings = useMemo(() => lintModel(model), [model]);
  const result = (): SettingsResult => ({
    model,
    width: Math.max(1, Math.min(4000, Math.floor(Number(width)) || doc.sim.width)),
    height: Math.max(1, Math.min(4000, Math.floor(Number(height)) || doc.sim.height)),
    name: name.trim() || doc.project.meta.name,
    description,
    author,
  });

  return (
    <Dialog
      title="Projekteinstellungen"
      subtitle={displayName(doc)}
      onClose={onClose}
      width={1100}
      height={760}
      flush
      footer={
        <>
          <span style={{ color: warnings.length ? 'var(--warn)' : 'var(--muted)', fontSize: 12 }}>
            {warnings.length ? `${warnings.length} Hinweis${warnings.length > 1 ? 'e' : ''} zum Modell` : 'Änderungen gelten ab der nächsten Generation.'}
          </span>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button className="btn" onClick={() => onApply(result())}>Übernehmen</button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onApply(result());
              onClose();
            }}
          >
            OK
          </button>
        </>
      }
    >
      <div className="dialog-tabs" role="tablist">
        {(
          [
            ['states', 'Zustände & Regeln'],
            ['neighborhood', 'Nachbarschaft & Rand'],
            ['project', 'Projekt & Raster'],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className="dialog-tab" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'states' && <StatesTab model={model} sel={Math.min(sel, model.states.length - 1)} setSel={setSel} edit={edit} warnings={warnings} />}
      {tab === 'neighborhood' && <NeighborhoodTab model={model} edit={edit} setModel={setModelState} />}
      {tab === 'project' && (
        <div className="dialog-body" style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 640 }}>
          <div className="field">
            <label htmlFor="st-name">Projektname</label>
            <input id="st-name" className="input" style={{ height: 36 }} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="st-author">Autor/in</label>
            <input id="st-author" className="input" style={{ height: 36 }} value={author} onChange={(e) => setAuthor(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="st-desc">Beschreibung</label>
            <textarea id="st-desc" className="input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="row" style={{ alignItems: 'flex-end', gap: 10 }}>
            <div className="field">
              <label htmlFor="st-w">Breite</label>
              <input id="st-w" className="input mono" type="number" min={1} max={4000} style={{ width: 96, height: 36 }} value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>
            <span style={{ paddingBottom: 9, color: 'var(--muted)' }}>×</span>
            <div className="field">
              <label htmlFor="st-h">Höhe</label>
              <input id="st-h" className="input mono" type="number" min={1} max={4000} style={{ width: 96, height: 36 }} value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
            <span style={{ paddingBottom: 9, color: 'var(--muted)' }}>Zellen</span>
          </div>
          <p className="hint">Beim Ändern der Größe bleibt der Inhalt oben links erhalten; neue Zellen erhalten den ersten Zustand.</p>
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function StatesTab({ model, sel, setSel, edit, warnings }: { model: Model; sel: number; setSel: (i: number) => void; edit: (fn: (m: Model) => void) => void; warnings: string[] }) {
  const cur = model.states[sel];

  const addState = () => {
    edit((m) => {
      m.states.push({ name: `Zustand ${m.states.length + 1}`, color: PALETTE[(m.states.length + 2) % PALETTE.length], initialShare: 0, rules: [] });
    });
    setSel(model.states.length);
  };

  const removeState = () => {
    if (model.states.length < 2) return;
    const gone = sel;
    edit((m) => {
      m.states.splice(gone, 1);
      const remap = (s: number) => (s > gone ? s - 1 : s === gone ? 0 : s);
      for (const st of m.states) {
        st.rules = st.rules.filter((r) => r.target !== gone);
        for (const r of st.rules) {
          r.target = remap(r.target);
          r.conditions = r.conditions
            .map((c) => {
              if (c.type === 'neighborCount') return { ...c, states: [...new Set(c.states.filter((s) => s !== gone).map(remap))] };
              if (c.type === 'neighborAt') return { ...c, state: remap(c.state) };
              return c;
            })
            .filter((c) => c.type !== 'neighborCount' || c.states.length > 0);
        }
      }
      if (m.boundary.type === 'fixed') m.boundary = { type: 'fixed', state: remap(m.boundary.state) };
    });
    setSel(Math.max(0, gone - 1));
  };

  const moveState = (dir: -1 | 1) => {
    const a = sel;
    const b = sel + dir;
    if (b < 0 || b >= model.states.length) return;
    edit((m) => {
      [m.states[a], m.states[b]] = [m.states[b], m.states[a]];
      const swap = (s: number) => (s === a ? b : s === b ? a : s);
      for (const st of m.states) {
        for (const r of st.rules) {
          r.target = swap(r.target);
          for (const c of r.conditions) {
            if (c.type === 'neighborCount') c.states = c.states.map(swap);
            if (c.type === 'neighborAt') c.state = swap(c.state);
          }
        }
      }
      if (m.boundary.type === 'fixed') m.boundary = { type: 'fixed', state: swap(m.boundary.state) };
    });
    setSel(b);
  };

  const editRule = (ri: number, fn: (r: Rule) => void) => edit((m) => fn(m.states[sel].rules[ri]));

  return (
    <div className="split">
      <div className="split-list" aria-label="Zustände">
        <h2 className="section-title" style={{ margin: '0 0 6px 4px' }}>Zustände ({model.states.length})</h2>
        {model.states.map((s, i) => (
          <button key={i} className="state-row" aria-pressed={i === sel} onClick={() => setSel(i)}>
            <span className="swatch" style={{ background: s.color }} />
            <span className="state-name">{s.name || 'Unbenannt'}</span>
            <span className="state-count">#{i}</span>
          </button>
        ))}
        <button className="btn" style={{ borderStyle: 'dashed', justifyContent: 'flex-start' }} onClick={addState}>
          <Icon.plus size={14} />
          Zustand hinzufügen
        </button>
        <p className="hint" style={{ marginTop: 'auto' }}>
          Zustand #0 ist der Grundzustand: Mit ihm wird geleert und radiert.
        </p>
      </div>

      <div className="split-main">
        <div className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
          <div className="field">
            <label htmlFor="s-name">Name</label>
            <input id="s-name" className="input" style={{ width: 200, height: 36 }} value={cur.name} onChange={(e) => edit((m) => (m.states[sel].name = e.target.value))} />
          </div>
          <div className="field">
            <label htmlFor="s-color">Farbe</label>
            <div className="row">
              <input
                type="color"
                aria-label="Farbe wählen"
                value={cur.color}
                onChange={(e) => edit((m) => (m.states[sel].color = e.target.value))}
                style={{ width: 40, height: 36, padding: 0, border: 0, background: 'none' }}
              />
              <input
                id="s-color"
                className="input mono"
                style={{ width: 96, height: 36 }}
                value={cur.color}
                onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && edit((m) => (m.states[sel].color = e.target.value.toLowerCase()))}
              />
            </div>
          </div>
          <div className="row" role="group" aria-label="Farbvorschläge" style={{ gap: 5, paddingBottom: 5 }}>
            {PALETTE.map((hex) => (
              <button
                key={hex}
                aria-label={`Farbe ${hex}`}
                onClick={() => edit((m) => (m.states[sel].color = hex))}
                style={{ width: 24, height: 24, padding: 0, borderRadius: 6, border: `2px solid ${hex === cur.color ? 'var(--text)' : 'transparent'}`, background: hex }}
              />
            ))}
          </div>
          <div className="field" style={{ marginLeft: 'auto' }}>
            <label htmlFor="s-share">Startanteil</label>
            <input
              id="s-share"
              className="input mono"
              type="number"
              min={0}
              step="any"
              style={{ width: 80, height: 36 }}
              value={cur.initialShare}
              onChange={(e) => edit((m) => (m.states[sel].initialShare = Math.max(0, Number(e.target.value) || 0)))}
            />
          </div>
        </div>

        <div className="row-between" style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Übergänge von „{cur.name}“</h2>
            <p className="hint" style={{ fontSize: 12.5, marginTop: 4 }}>
              Regeln werden von oben nach unten geprüft. Die erste zutreffende Regel bestimmt den neuen Zustand – greift sie wegen ihrer
              Wahrscheinlichkeit nicht, wird die nächste geprüft. Trifft keine zu, bleibt die Zelle unverändert.
            </p>
          </div>
        </div>

        {cur.rules.length === 0 && (
          <div style={{ padding: 20, borderRadius: 10, border: '1px dashed var(--line2)', color: 'var(--muted)', textAlign: 'center' }}>
            Noch keine Regel – Zellen in diesem Zustand bleiben dauerhaft unverändert.
          </div>
        )}

        {cur.rules.map((r, ri) => (
          <section className="rule-card" key={ri} style={{ opacity: r.enabled === false ? 0.6 : 1 }}>
            <div className="rule-head">
              <span className="rule-badge">Regel {ri + 1}</span>
              <span>Wechsel zu</span>
              <select className="input" aria-label="Zielzustand" value={r.target} onChange={(e) => editRule(ri, (x) => (x.target = Number(e.target.value)))}>
                {model.states.map((s, i) => (
                  <option key={i} value={i}>{s.name}</option>
                ))}
              </select>
              <span>, wenn</span>
              <select className="input" aria-label="Verknüpfung" value={r.combine} onChange={(e) => editRule(ri, (x) => (x.combine = e.target.value as Rule['combine']))}>
                <option value="all">alle Bedingungen</option>
                <option value="any">mindestens eine Bedingung</option>
              </select>
              <span>erfüllt sind, mit</span>
              <input
                className="input small mono"
                type="number"
                min={0}
                max={100}
                step="any"
                aria-label="Wahrscheinlichkeit in Prozent"
                value={Math.round(r.probability * 10000) / 100}
                onChange={(e) => editRule(ri, (x) => (x.probability = Math.max(0, Math.min(100, Number(e.target.value) || 0)) / 100))}
              />
              <span>%</span>
              <span style={{ marginLeft: 'auto' }} />
              <label className="row" style={{ gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={r.enabled !== false} onChange={(e) => editRule(ri, (x) => (e.target.checked ? delete x.enabled : (x.enabled = false)))} />
                aktiv
              </label>
              <button className="btn btn-icon" style={{ width: 30, height: 30 }} aria-label="Regel nach oben" disabled={ri === 0} onClick={() => edit((m) => { const l = m.states[sel].rules; [l[ri - 1], l[ri]] = [l[ri], l[ri - 1]]; })}>
                <Icon.up size={14} />
              </button>
              <button className="btn btn-icon" style={{ width: 30, height: 30 }} aria-label="Regel nach unten" disabled={ri === cur.rules.length - 1} onClick={() => edit((m) => { const l = m.states[sel].rules; [l[ri + 1], l[ri]] = [l[ri], l[ri + 1]]; })}>
                <Icon.down size={14} />
              </button>
              <button className="btn btn-icon" style={{ width: 30, height: 30 }} aria-label={`Regel ${ri + 1} löschen`} onClick={() => edit((m) => m.states[sel].rules.splice(ri, 1))}>
                <Icon.trash size={14} />
              </button>
            </div>
            <div className="rule-body">
              {r.conditions.map((c, ci) => (
                <ConditionRow
                  key={ci}
                  model={model}
                  cond={c}
                  join={ci === 0 ? 'wenn' : r.combine === 'any' ? 'oder' : 'und'}
                  onChange={(nc) => editRule(ri, (x) => (x.conditions[ci] = nc))}
                  onRemove={() => editRule(ri, (x) => x.conditions.splice(ci, 1))}
                />
              ))}
              <button
                className="link-button"
                style={{ alignSelf: 'flex-start', marginLeft: 48, fontSize: 13 }}
                onClick={() => editRule(ri, (x) => x.conditions.push({ type: 'neighborCount', states: [Math.min(1, model.states.length - 1)], op: '>=', value: 1 }))}
              >
                + Bedingung
              </button>
              <p className="in-words"><span style={{ color: 'var(--muted)' }}>In Worten: </span>{describeRule(model, sel, r)}</p>
            </div>
          </section>
        ))}

        <div className="row">
          <button
            className="btn"
            onClick={() =>
              edit((m) =>
                m.states[sel].rules.push({
                  target: sel === 0 ? Math.min(1, m.states.length - 1) : 0,
                  combine: 'all',
                  probability: 1,
                  conditions: [{ type: 'neighborCount', states: [Math.min(1, m.states.length - 1)], op: '>=', value: 1 }],
                }),
              )
            }
          >
            <Icon.plus size={14} />
            Regel hinzufügen
          </button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-icon" aria-label="Zustand nach oben" disabled={sel === 0} onClick={() => moveState(-1)}><Icon.up size={14} /></button>
          <button className="btn btn-icon" aria-label="Zustand nach unten" disabled={sel === model.states.length - 1} onClick={() => moveState(1)}><Icon.down size={14} /></button>
          <button className="btn btn-danger" disabled={model.states.length < 2} onClick={removeState}>Zustand löschen</button>
        </div>

        {warnings.length > 0 && (
          <ul className="warnings">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConditionRow({ model, cond, join, onChange, onRemove }: { model: Model; cond: Condition; join: string; onChange: (c: Condition) => void; onRemove: () => void }) {
  const changeType = (t: Condition['type']) => {
    const s = Math.min(1, model.states.length - 1);
    if (t === 'neighborCount') onChange({ type: 'neighborCount', states: [s], op: '>=', value: 1 });
    else if (t === 'neighborAt') onChange({ type: 'neighborAt', dx: 1, dy: 0, op: '=', state: s });
    else onChange({ type: 'age', op: '>=', value: 5 });
  };
  const dirKey = cond.type === 'neighborAt' ? `${cond.dx},${cond.dy}` : '';
  const dirKnown = DIRECTIONS.some(([, dx, dy]) => `${dx},${dy}` === dirKey);
  return (
    <div className="cond-row">
      <span className="cond-join">{join}</span>
      <select className="input" aria-label="Art der Bedingung" value={cond.type} onChange={(e) => changeType(e.target.value as Condition['type'])}>
        <option value="neighborCount">Anzahl Nachbarn im Zustand</option>
        <option value="neighborAt">Nachbar an Position</option>
        <option value="age">Generationen im aktuellen Zustand</option>
      </select>
      {cond.type === 'neighborCount' && (
        <>
          <span className="row" style={{ gap: 4, flexWrap: 'wrap' }} role="group" aria-label="Gezählte Zustände">
            {model.states.map((s, i) => (
              <button
                key={i}
                className="chip"
                aria-pressed={cond.states.includes(i)}
                onClick={() => {
                  const has = cond.states.includes(i);
                  const states = has ? cond.states.filter((x) => x !== i) : [...cond.states, i].sort((a, b) => a - b);
                  if (states.length) onChange({ ...cond, states });
                }}
              >
                <span className="swatch small" style={{ background: s.color }} />
                {s.name}
              </button>
            ))}
          </span>
          <OpSelect value={cond.op} onChange={(op) => onChange({ ...cond, op })} />
          <input className="input small mono" type="number" min={0} aria-label="Anzahl" value={cond.value} onChange={(e) => onChange({ ...cond, value: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
        </>
      )}
      {cond.type === 'neighborAt' && (
        <>
          <select
            className="input"
            aria-label="Position"
            value={dirKnown ? dirKey : 'custom'}
            onChange={(e) => {
              if (e.target.value === 'custom') return;
              const [dx, dy] = e.target.value.split(',').map(Number);
              onChange({ ...cond, dx, dy });
            }}
          >
            {DIRECTIONS.map(([label, dx, dy]) => (
              <option key={label} value={`${dx},${dy}`}>{label}</option>
            ))}
            <option value="custom">eigene (dx, dy)</option>
          </select>
          {!dirKnown && (
            <>
              <input className="input small mono" type="number" aria-label="dx" value={cond.dx} onChange={(e) => onChange({ ...cond, dx: Math.floor(Number(e.target.value) || 0) })} />
              <input className="input small mono" type="number" aria-label="dy" value={cond.dy} onChange={(e) => onChange({ ...cond, dy: Math.floor(Number(e.target.value) || 0) })} />
            </>
          )}
          <select className="input" aria-label="Vergleich" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as '=' | '!=' })}>
            <option value="=">ist</option>
            <option value="!=">ist nicht</option>
          </select>
          <select className="input" aria-label="Zustand" value={cond.state} onChange={(e) => onChange({ ...cond, state: Number(e.target.value) })}>
            {model.states.map((s, i) => (
              <option key={i} value={i}>{s.name}</option>
            ))}
          </select>
        </>
      )}
      {cond.type === 'age' && (
        <>
          <OpSelect value={cond.op} onChange={(op) => onChange({ ...cond, op })} />
          <input className="input small mono" type="number" min={0} aria-label="Generationen" value={cond.value} onChange={(e) => onChange({ ...cond, value: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
        </>
      )}
      <button className="btn btn-icon" style={{ width: 28, height: 28, border: 0, background: 'transparent' }} aria-label="Bedingung entfernen" onClick={onRemove}>
        <Icon.close size={13} />
      </button>
    </div>
  );
}

function OpSelect({ value, onChange }: { value: CompareOp; onChange: (op: CompareOp) => void }) {
  return (
    <select className="input mono" aria-label="Vergleich" value={value} onChange={(e) => onChange(e.target.value as CompareOp)}>
      {COMPARE_OPS.map((op) => (
        <option key={op} value={op}>{OP_LABEL[op]}</option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */

const PRESETS = [
  ['moore', 'Moore', 'Reichweite 1 · 8 Nachbarn'],
  ['vonNeumann', 'Von Neumann', 'Reichweite 1 · 4 Nachbarn'],
  ['moore2', 'Moore, erweitert', 'Reichweite 2 · 24 Nachbarn'],
  ['vonNeumann2', 'Von Neumann, erweitert', 'Reichweite 2 · 12 Nachbarn'],
  ['lookahead', 'Vorausschau (Verkehr)', '5 Zellen nach rechts'],
] as const;

function NeighborhoodTab({ model, edit, setModel }: { model: Model; edit: (fn: (m: Model) => void) => void; setModel: (m: Model) => void }) {
  const nb = model.neighborhood;
  const set = new Set(nb.offsets.map((o) => `${o.dx},${o.dy}`));
  const outside = nb.offsets.filter((o) => Math.abs(o.dx) > 3 || Math.abs(o.dy) > 3).length;
  const b = model.boundary;

  const toggle = (dx: number, dy: number) => {
    const key = `${dx},${dy}`;
    const offsets = set.has(key) ? nb.offsets.filter((o) => `${o.dx},${o.dy}` !== key) : [...nb.offsets, { dx, dy }];
    setModel({ ...model, neighborhood: customNeighborhood(offsets, nb.includeSelf) });
  };

  return (
    <div className="split">
      <div className="split-list" style={{ width: 280 }} aria-label="Nachbarschaftstypen">
        <h2 className="section-title" style={{ margin: '0 0 6px 4px' }}>Nachbarschaftstyp</h2>
        {PRESETS.map(([id, label, sub]) => (
          <button key={id} className="state-row" aria-pressed={nb.preset === id} onClick={() => setModel({ ...model, neighborhood: neighborhood(id, nb.includeSelf) })}>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontWeight: 500 }}>{label}</span>
              <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>{sub}</span>
            </span>
          </button>
        ))}
        <div className="state-row" aria-pressed={nb.preset === 'custom'} style={{ cursor: 'default' }}>
          <span style={{ flex: 1 }}>
            <span style={{ display: 'block', fontWeight: 500 }}>Eigene</span>
            <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12 }}>Felder rechts anklicken</span>
          </span>
        </div>
      </div>
      <div className="split-main" style={{ flexDirection: 'row', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16 }}>Nachbarzellen festlegen</h2>
            <p className="hint" style={{ fontSize: 12.5, marginTop: 4, maxWidth: 400 }}>
              Felder anklicken, um sie zur Nachbarschaft hinzuzufügen oder zu entfernen. „Z“ ist die betrachtete Zelle.
            </p>
          </div>
          <div className="nb-editor" role="group" aria-label="Nachbarschaft 7 × 7">
            {[-3, -2, -1, 0, 1, 2, 3].flatMap((dy) =>
              [-3, -2, -1, 0, 1, 2, 3].map((dx) =>
                dx === 0 && dy === 0 ? (
                  <button key="self" className="nb-cell self" disabled aria-label="Betrachtete Zelle">Z</button>
                ) : (
                  <button
                    key={`${dx},${dy}`}
                    className="nb-cell"
                    aria-pressed={set.has(`${dx},${dy}`)}
                    aria-label={`Versatz ${dx}, ${dy}`}
                    onClick={() => toggle(dx, dy)}
                  >
                    {set.has(`${dx},${dy}`) ? '•' : ''}
                  </button>
                ),
              ),
            )}
          </div>
          <div className="kpis" style={{ gridTemplateColumns: 'repeat(2, 140px)' }}>
            <div className="kpi">
              <div className="kpi-label">Nachbarn</div>
              <div className="kpi-value">{nb.offsets.length + (nb.includeSelf ? 1 : 0)}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Außerhalb 7 × 7</div>
              <div className="kpi-value">{outside}</div>
            </div>
          </div>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={nb.includeSelf} onChange={(e) => edit((m) => (m.neighborhood.includeSelf = e.target.checked))} />
            Zelle selbst beim Zählen mitberücksichtigen
          </label>
        </div>

        <div style={{ flex: 1, minWidth: 300, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Rand des Rasters</h2>
          <p className="hint" style={{ fontSize: 12.5 }}>Legt fest, welche Nachbarn Zellen am Rand haben.</p>
          {(
            [
              ['torus', 'Torus', 'Gegenüberliegende Ränder sind verbunden – wer rechts hinausläuft, kommt links wieder herein.'],
              ['fixed', 'Fester Rand', 'Zellen außerhalb des Rasters haben einen festen Zustand.'],
              ['mirror', 'Gespiegelt', 'Randzellen sehen ihr Spiegelbild als Nachbarn.'],
            ] as const
          ).map(([id, label, desc]) => (
            <label key={id} className={`option-card${b.type === id ? ' on' : ''}`}>
              <input
                type="radio"
                name="edge"
                checked={b.type === id}
                onChange={() => setModel({ ...model, boundary: id === 'fixed' ? { type: 'fixed', state: 0 } : { type: id } })}
              />
              <span><strong>{label}</strong><small>{desc}</small></span>
            </label>
          ))}
          {b.type === 'fixed' && (
            <div className="row" style={{ paddingLeft: 4 }}>
              <label htmlFor="nb-fixed" className="field-label">Zellen außerhalb gelten als</label>
              <select id="nb-fixed" className="input" value={b.state} onChange={(e) => setModel({ ...model, boundary: { type: 'fixed', state: Number(e.target.value) } })}>
                {model.states.map((s, i) => (
                  <option key={i} value={i}>{s.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
