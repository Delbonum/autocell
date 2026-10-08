import { useEffect, useRef } from 'react';
import { Rng, Simulation, TEMPLATES, type Template, type TemplateId } from '@autocell/core';
import { baseNameOfPath, dirOfPath } from '../app/paths';
import { APP_VERSION } from '../version';
import { ICON_URL } from './Chrome';
import { Icon } from './Icons';

function Preview({ t }: { t: Template }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const W = 56;
    const H = 30;
    const model = t.model();
    const sim = new Simulation({ model, width: W, height: H, seed: 7 });
    if (t.id === 'empty') {
      for (let x = 10; x < 46; x++) sim.set(x, 14, 1);
    } else {
      sim.randomize(new Rng(t.id.length * 31 + 7));
      const steps = t.id === 'sir' ? 18 : t.id === 'fire' ? 60 : t.id === 'traffic' ? 30 : 12;
      for (let i = 0; i < steps; i++) sim.step();
    }
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    const colors = model.states.map((s) => parseInt(s.color.slice(1), 16));
    for (let i = 0; i < sim.cells.length; i++) {
      const c = colors[sim.cells[i]];
      img.data[i * 4] = c >> 16;
      img.data[i * 4 + 1] = (c >> 8) & 255;
      img.data[i * 4 + 2] = c & 255;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [t]);
  return <canvas ref={ref} style={{ aspectRatio: '56 / 30' }} aria-hidden="true" />;
}

interface StartScreenProps {
  onNew: () => void;
  onOpen: () => void;
  onTemplate: (id: TemplateId) => void;
  /** Desktop: zuletzt geöffnete Projektdateien (Pfade). */
  recent?: readonly string[];
  onOpenRecent?: (path: string) => void;
}

export function StartScreen({ onNew, onOpen, onTemplate, recent = [], onOpenRecent }: StartScreenProps) {
  return (
    <div className="start">
      <aside className="start-side">
        <div className="start-brand">
          <img src={ICON_URL} alt="AutoCell-Logo" />
          <div>
            <h1>AutoCell</h1>
            <p>Zelluläre Automaten entwerfen, simulieren und auswerten.</p>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button className="btn btn-primary" style={{ height: 46, justifyContent: 'flex-start', fontSize: 14 }} onClick={onNew}>
            <Icon.plus size={18} strokeWidth={2} />
            Neues Projekt
            <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 500 }}>Strg+N</span>
          </button>
          <button className="btn" style={{ height: 42, justifyContent: 'flex-start' }} onClick={onOpen}>
            <Icon.folder size={17} />
            Projekt öffnen oder importieren …
            <span className="mono" style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>Strg+O</span>
          </button>
          <p className="hint" style={{ marginTop: 4 }}>Öffnet .acp-Projekte sowie Raster als CSV oder RLE (Golly).</p>
        </div>
        {recent.length > 0 && onOpenRecent && (
          <nav className="recent" aria-label="Zuletzt geöffnet">
            <h2 className="section-title">Zuletzt geöffnet</h2>
            {recent.map((p) => (
              <button key={p} className="recent-item" title={p} onClick={() => onOpenRecent(p)}>
                <Icon.folder size={15} />
                <span>
                  <strong>{baseNameOfPath(p)}</strong>
                  <small>{dirOfPath(p)}</small>
                </span>
              </button>
            ))}
          </nav>
        )}
        <div style={{ marginTop: 'auto', color: 'var(--muted)', fontSize: 12 }}>Version {APP_VERSION}</div>
      </aside>
      <main className="start-main">
        <div>
          <h2 style={{ margin: 0, fontSize: 22 }}>Mit einer Vorlage beginnen</h2>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
            Jede Vorlage bringt Zustände, Regeln und Nachbarschaft mit – alles lässt sich danach frei anpassen.
          </p>
        </div>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.id} className="template-card" onClick={() => onTemplate(t.id)}>
              <Preview t={t} />
              <div>
                <strong>{t.name}</strong>
                <span>{t.description}</span>
                <span style={{ color: 'var(--muted)', fontSize: 11.5 }}>{t.category}</span>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
