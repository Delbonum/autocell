/**
 * „Parameter einstellen“ – der Regeldialog aus dem ursprünglichen Entwurf.
 * Er bearbeitet je Zustand die erste Regel mit höchstens einer
 * Nachbar- und einer Alter-Bedingung. Alles Weitere bleibt unverändert
 * erhalten und ist im modernen Modus bearbeitbar.
 */
import { useState } from 'react';
import { COMPARE_OPS, type CompareOp, type Condition, type Model, type Rule } from '@autocell/core';
import type { Doc } from '../../app/doc';
import { Dialog } from '../Dialog';

const OPS: Record<CompareOp, string> = { '=': '=', '!=': '!=', '<': '<', '<=': '<=', '>': '>', '>=': '>=' };
const COLORS = ['#ff0000', '#0000ff', '#00a000', '#ffff00', '#ff00ff', '#00ffff', '#000000', '#ffffff'];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

type CountCond = Extract<Condition, { type: 'neighborCount' }>;
type AgeCond = Extract<Condition, { type: 'age' }>;

function firstRule(model: Model, s: number): Rule | undefined {
  return model.states[s].rules[0];
}

export function RetroParamsDialog({ doc, onApply, onClose }: { doc: Doc; onApply: (model: Model, width: number, height: number) => void; onClose: () => void }) {
  const [model, setModel] = useState<Model>(() => clone(doc.sim.model));
  const [size, setSize] = useState(String(doc.sim.width));
  const [count, setCount] = useState(String(doc.sim.model.states.length));

  const edit = (fn: (m: Model) => void) => {
    const m = clone(model);
    fn(m);
    setModel(m);
  };

  const ensureRule = (m: Model, s: number): Rule => {
    if (!m.states[s].rules[0]) m.states[s].rules.push({ target: (s + 1) % m.states.length, combine: 'any', probability: 1, conditions: [] });
    return m.states[s].rules[0];
  };

  const setStateCount = (v: string) => {
    setCount(v);
    const n = Math.floor(Number(v));
    if (!(n >= 1 && n <= 32)) return;
    edit((m) => {
      while (m.states.length < n) {
        const i = m.states.length;
        m.states.push({ name: `Zustand ${i + 1}`, color: COLORS[i % COLORS.length], initialShare: 0, rules: [] });
      }
      if (m.states.length > n) {
        m.states.length = n;
        for (const st of m.states) {
          st.rules = st.rules.filter((r) => r.target < n);
          for (const r of st.rules) {
            r.conditions = r.conditions.filter((c) =>
              c.type === 'neighborCount' ? c.states.every((x) => x < n) : c.type === 'neighborAt' ? c.state < n : true,
            );
          }
        }
        if (m.boundary.type === 'fixed' && m.boundary.state >= n) m.boundary = { type: 'fixed', state: 0 };
      }
    });
  };

  const save = () => {
    const n = Math.max(1, Math.min(4000, Math.floor(Number(size)) || doc.sim.width));
    const sameAspect = doc.sim.width === doc.sim.height;
    onApply(model, n, sameAspect ? n : Math.max(1, Math.round((n * doc.sim.height) / doc.sim.width)));
    onClose();
  };

  return (
    <Dialog
      title="Parameter einstellen"
      onClose={onClose}
      bodyStyle={{ padding: '18px 26px' }}
      height={Math.min(780, window.innerHeight - 40)}
      footer={
        <>
          <button className="btn" onClick={save}>Speichern</button>
          <button className="btn" onClick={onClose}>Abbrechen</button>
        </>
      }
    >
      <div className="retro-params">
        <div className="rp-row">
          <label htmlFor="rp-size" style={{ width: 175 }}>Sichtbarer Bereich:</label>
          <input id="rp-size" className="input rp-box" style={{ width: 48 }} value={size} onChange={(e) => setSize(e.target.value)} />
        </div>
        <div className="rp-row">
          <label htmlFor="rp-count" style={{ width: 175 }}>Anzahl der Zustände:</label>
          <input id="rp-count" className="input rp-box" value={count} onChange={(e) => setStateCount(e.target.value)} />
        </div>

        {model.states.map((st, s) => {
          const rule = firstRule(model, s);
          const countCond = rule?.conditions.find((c): c is CountCond => c.type === 'neighborCount');
          const ageCond = rule?.conditions.find((c): c is AgeCond => c.type === 'age');
          const conds = rule?.conditions ?? [];
          const extra =
            st.rules.length > 1 ||
            conds.some((c) => c.type === 'neighborAt') ||
            conds.filter((c) => c.type === 'neighborCount').length > 1 ||
            conds.filter((c) => c.type === 'age').length > 1 ||
            (rule ? rule.probability < 1 : false);
          const setCount = (patch: Partial<CountCond> | null) =>
            edit((m) => {
              const r = ensureRule(m, s);
              const i = r.conditions.findIndex((c) => c.type === 'neighborCount');
              if (patch === null) {
                if (i >= 0) r.conditions.splice(i, 1);
                // Ohne Bedingung würde die Regel immer greifen – dann lieber gar keine Regel.
                if (r.conditions.length === 0) m.states[s].rules.shift();
                return;
              }
              const base: CountCond = i >= 0 ? (r.conditions[i] as CountCond) : { type: 'neighborCount', states: [s], op: '>=', value: 2 };
              const next = { ...base, ...patch };
              if (i >= 0) r.conditions[i] = next;
              else r.conditions.unshift(next);
            });
          const setAge = (patch: Partial<AgeCond> | null) =>
            edit((m) => {
              const r = ensureRule(m, s);
              const i = r.conditions.findIndex((c) => c.type === 'age');
              if (patch === null) {
                if (i >= 0) r.conditions.splice(i, 1);
                // Ohne Bedingung würde die Regel immer greifen – dann lieber gar keine Regel.
                if (r.conditions.length === 0) m.states[s].rules.shift();
                return;
              }
              const base: AgeCond = i >= 0 ? (r.conditions[i] as AgeCond) : { type: 'age', op: '>=', value: 5 };
              const next = { ...base, ...patch };
              if (i >= 0) r.conditions[i] = next;
              else r.conditions.push(next);
            });
          return (
            <div className="rp-state" key={s}>
              <h3>Zustand {s + 1}</h3>
              <div className="rp-row rp-indent">
                <label htmlFor={`rp-name-${s}`} style={{ width: 66 }}>Name:</label>
                <input id={`rp-name-${s}`} className="input rp-text" value={st.name} onChange={(e) => edit((m) => (m.states[s].name = e.target.value))} />
              </div>
              <div className="rp-row rp-indent">
                <label htmlFor={`rp-color-${s}`} style={{ width: 66 }}>Farbe:</label>
                <input
                  id={`rp-color-${s}`}
                  className="input rp-text"
                  defaultValue={st.color}
                  onChange={(e) => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && edit((m) => (m.states[s].color = e.target.value.toLowerCase()))}
                />
                <span className="rp-swatch" style={{ background: st.color }} />
              </div>
              <div className="rp-row rp-indent">
                Wechseln zu Zustand
                <input
                  className="input rp-box"
                  aria-label="Zielzustand"
                  value={rule ? rule.target + 1 : (s + 1) % model.states.length + 1}
                  onChange={(e) => {
                    const t = Math.floor(Number(e.target.value)) - 1;
                    if (t >= 0 && t < model.states.length) edit((m) => (ensureRule(m, s).target = t));
                  }}
                />
                , wenn sich:
              </div>
              <div className="rp-row" style={{ paddingLeft: 60 }}>
                <input type="checkbox" aria-label="Nachbar-Bedingung verwenden" checked={!!countCond} onChange={(e) => setCount(e.target.checked ? {} : null)} />
                <select aria-label="Vergleich" value={countCond?.op ?? '>='} disabled={!countCond} onChange={(e) => setCount({ op: e.target.value as CompareOp })}>
                  {COMPARE_OPS.map((op) => <option key={op} value={op}>{OPS[op]}</option>)}
                </select>
                <input
                  className="input rp-box"
                  aria-label="Anzahl Nachbarn"
                  value={countCond?.value ?? 2}
                  disabled={!countCond}
                  onChange={(e) => setCount({ value: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                />
                Nachbarn im Zustand
                <input
                  className="input rp-box"
                  aria-label="Nachbarzustand"
                  value={countCond ? countCond.states[0] + 1 : s + 1}
                  disabled={!countCond}
                  onChange={(e) => {
                    const v = Math.floor(Number(e.target.value)) - 1;
                    if (v >= 0 && v < model.states.length) setCount({ states: [v] });
                  }}
                />
              </div>
              <div className="rp-row" style={{ paddingLeft: 98 }}>befinden.</div>
              <div className="rp-row rp-indent">
                <label htmlFor={`rp-or-${s}`}>oder:</label>
                <input
                  id={`rp-or-${s}`}
                  type="checkbox"
                  checked={rule?.combine === 'any'}
                  onChange={(e) => edit((m) => (ensureRule(m, s).combine = e.target.checked ? 'any' : 'all'))}
                  title="Angehakt: eine der beiden Bedingungen genügt. Leer: beide müssen erfüllt sein."
                />
              </div>
              <div className="rp-row" style={{ paddingLeft: 60 }}>
                <input type="checkbox" aria-label="Alter-Bedingung verwenden" checked={!!ageCond} onChange={(e) => setAge(e.target.checked ? {} : null)} />
                die Zelle seit
                <select aria-label="Vergleich" value={ageCond?.op ?? '>='} disabled={!ageCond} onChange={(e) => setAge({ op: e.target.value as CompareOp })}>
                  {COMPARE_OPS.map((op) => <option key={op} value={op}>{OPS[op]}</option>)}
                </select>
                <input
                  className="input rp-box"
                  aria-label="Generationen"
                  value={ageCond?.value ?? ''}
                  disabled={!ageCond}
                  onChange={(e) => setAge({ value: Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
                />
                Generationen im
              </div>
              <div className="rp-row" style={{ paddingLeft: 98 }}>
                Zustand
                <input className="input rp-box" aria-label="Zustand" value={s + 1} readOnly />
                befindet.
              </div>
              {extra && <div className="rp-row rp-indent" style={{ fontSize: 12, color: '#444' }}>+ weitere Regeln (im normalen Modus bearbeitbar)</div>}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
