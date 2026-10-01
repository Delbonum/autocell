import { useState } from 'react';
import { TEMPLATES, type Boundary, type TemplateId } from '@autocell/core';
import { Dialog } from '../Dialog';

export interface NewProjectRequest {
  template: TemplateId;
  name: string;
  width: number;
  height: number;
  boundary: Boundary['type'];
  fill: 'random' | 'first';
}

const SIZES: Array<[number, number]> = [[50, 50], [100, 70], [200, 120], [500, 500]];

const clamp = (v: string) => Math.max(1, Math.min(4000, Math.floor(Number(v)) || 1));

export function NewProjectDialog({ initialTemplate = 'gol', onCreate, onClose }: { initialTemplate?: TemplateId; onCreate: (r: NewProjectRequest) => void; onClose: () => void }) {
  const [template, setTemplate] = useState<TemplateId>(initialTemplate);
  const t = TEMPLATES.find((x) => x.id === template)!;
  const [name, setName] = useState(t.name);
  const [nameTouched, setNameTouched] = useState(false);
  const [w, setW] = useState(String(t.defaultSize.width));
  const [h, setH] = useState(String(t.defaultSize.height));
  const [boundary, setBoundary] = useState<Boundary['type']>(t.model().boundary.type);
  const [fill, setFill] = useState<'random' | 'first'>(template === 'empty' ? 'first' : 'random');

  const pick = (id: TemplateId) => {
    const nt = TEMPLATES.find((x) => x.id === id)!;
    setTemplate(id);
    if (!nameTouched) setName(nt.name);
    setW(String(nt.defaultSize.width));
    setH(String(nt.defaultSize.height));
    setBoundary(nt.model().boundary.type);
    setFill(id === 'empty' ? 'first' : 'random');
  };

  const width = clamp(w);
  const height = clamp(h);
  const big = width * height > 1_000_000;

  return (
    <Dialog
      title="Neues Projekt"
      onClose={onClose}
      width={780}
      footer={
        <>
          <span style={{ color: 'var(--muted)', fontSize: 12 }}>
            {(width * height).toLocaleString('de-DE')} Zellen{big ? ' – große Raster laufen langsamer' : ''}
          </span>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Abbrechen</button>
          <button
            className="btn btn-primary"
            onClick={() => onCreate({ template, name: name.trim() || t.name, width, height, boundary, fill })}
          >
            Projekt erstellen
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="field">
          <label htmlFor="np-name">Projektname</label>
          <input
            id="np-name"
            className="input"
            style={{ height: 36 }}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
          />
        </div>

        <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend className="section-title" style={{ marginBottom: 8 }}>Vorlage</legend>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {TEMPLATES.map((x) => (
              <button key={x.id} className="chip" style={{ height: 34, padding: '0 14px' }} aria-pressed={x.id === template} onClick={() => pick(x.id)}>
                {x.name}
              </button>
            ))}
          </div>
          <p className="hint" style={{ fontSize: 12.5 }}>{t.description}</p>
        </fieldset>

        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="section-title" style={{ marginBottom: 8 }}>Rastergröße</legend>
          <div className="row" style={{ alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
            <div className="field">
              <label htmlFor="np-w">Breite</label>
              <input id="np-w" className="input mono" type="number" min={1} max={4000} style={{ width: 96, height: 36 }} value={w} onChange={(e) => setW(e.target.value)} />
            </div>
            <span style={{ paddingBottom: 9, color: 'var(--muted)' }}>×</span>
            <div className="field">
              <label htmlFor="np-h">Höhe</label>
              <input id="np-h" className="input mono" type="number" min={1} max={4000} style={{ width: 96, height: 36 }} value={h} onChange={(e) => setH(e.target.value)} />
            </div>
            <span style={{ paddingBottom: 9, color: 'var(--muted)' }}>Zellen</span>
            <div className="row" style={{ marginLeft: 'auto', gap: 6 }}>
              {SIZES.map(([sw, sh]) => (
                <button key={sw} className="btn mono" style={{ height: 32, fontSize: 12 }} onClick={() => { setW(String(sw)); setH(String(sh)); }}>
                  {sw}×{sh}
                </button>
              ))}
            </div>
          </div>
        </fieldset>

        <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
          <legend className="section-title" style={{ marginBottom: 8 }}>Rand des Rasters</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
            {(
              [
                ['torus', 'Torus', 'Gegenüberliegende Ränder sind verbunden.'],
                ['fixed', 'Fester Rand', 'Außerhalb liegende Zellen gelten als erster Zustand.'],
                ['mirror', 'Gespiegelt', 'Randzellen sehen ihr Spiegelbild als Nachbarn.'],
              ] as const
            ).map(([id, label, desc]) => (
              <label key={id} className={`option-card${boundary === id ? ' on' : ''}`}>
                <input type="radio" name="np-edge" checked={boundary === id} onChange={() => setBoundary(id)} />
                <span><strong>{label}</strong><small>{desc}</small></span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <legend className="section-title" style={{ marginBottom: 8 }}>Anfangsbelegung</legend>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input type="radio" name="np-fill" checked={fill === 'random'} onChange={() => setFill('random')} />
            Zufällig nach den Startanteilen der Zustände
          </label>
          <label className="row" style={{ cursor: 'pointer' }}>
            <input type="radio" name="np-fill" checked={fill === 'first'} onChange={() => setFill('first')} />
            Alle Zellen im ersten Zustand („{t.model().states[0].name}“)
          </label>
        </fieldset>
      </div>
    </Dialog>
  );
}
