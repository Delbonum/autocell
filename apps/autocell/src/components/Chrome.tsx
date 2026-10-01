/**
 * Fensterrahmen: Titelleiste, Tabs, Kontextmenü, Werkzeugleiste des Retro-Modus.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Doc } from '../app/doc';
import { displayName } from '../app/doc';
import { Icon, RetroGlyph } from './Icons';
import type { Theme } from './Dialog';

export const ICON_URL = './icon.png';

interface TitleBarProps {
  theme: Theme;
  title: string;
  menu: ReactNode;
  onMinimize?: () => void;
  onMaximize: () => void;
  onClose: () => void;
}

export function TitleBar({ theme, title, menu, onMinimize, onMaximize, onClose }: TitleBarProps) {
  return (
    <header className="titlebar">
      {theme === 'retro' ? (
        <div className="retro-logo" aria-label="AutoCell">AC</div>
      ) : (
        <img className="titlebar-icon" src={ICON_URL} alt="AutoCell" />
      )}
      {menu}
      <div className="titlebar-title">{title}</div>
      <div className="window-controls">
        <button className="wc" aria-label="Minimieren" onClick={onMinimize} disabled={!onMinimize}>
          <Icon.minus size={14} strokeWidth={theme === 'retro' ? 3 : 1.75} />
        </button>
        <button className="wc" aria-label="Maximieren" onClick={onMaximize}>
          {theme === 'retro' ? <Icon.restore size={16} strokeWidth={2} /> : <Icon.square size={13} />}
        </button>
        <button className="wc wc-close" aria-label="Schließen" onClick={onClose}>
          <Icon.close size={theme === 'retro' ? 18 : 14} strokeWidth={theme === 'retro' ? 3 : 1.75} />
        </button>
      </div>
    </header>
  );
}

interface TabBarProps {
  docs: Doc[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

export function TabBar({ docs, activeId, onSelect, onClose, onNew }: TabBarProps) {
  return (
    <div className="tabbar" role="tablist" aria-label="Geöffnete Projekte">
      {docs.map((d) => (
        <div key={d.id} className="tab" data-active={d.id === activeId}>
          <button
            role="tab"
            aria-selected={d.id === activeId}
            onClick={() => onSelect(d.id)}
            onAuxClick={(e) => e.button === 1 && onClose(d.id)}
            title={displayName(d)}
            style={{ border: 0, background: 'none', padding: 0, display: 'flex', alignItems: 'center', gap: 8, height: '100%' }}
          >
            <Icon.file size={13} />
            {displayName(d)}
            {d.dirty && <span className="dirty-dot" aria-label="ungespeichert" />}
          </button>
          <button className="tab-close" aria-label={`${displayName(d)} schließen`} onClick={() => onClose(d.id)}>
            <Icon.close size={12} />
          </button>
        </div>
      ))}
      <button className="tab-add" aria-label="Neues Projekt" onClick={onNew}>
        <Icon.plus size={15} />
      </button>
    </div>
  );
}

interface CtxProps {
  theme: Theme;
  doc: Doc;
  x: number;
  y: number;
  clientX: number;
  clientY: number;
  onSet: (state: number) => void;
  onBrush: (state: number) => void;
  onHistory: () => void;
  onClose: () => void;
}

export function ContextMenu({ theme, doc, x, y, clientX, clientY, onSet, onBrush, onHistory, onClose }: CtxProps) {
  const [subOpen, setSubOpen] = useState(false);
  const states = doc.sim.model.states;
  const cur = doc.sim.get(x, y);
  const age = doc.sim.ages[y * doc.sim.width + x];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(clientX + 4, vw - (theme === 'retro' ? 460 : 250));
  const top = Math.min(clientY, vh - Math.min(420, 140 + states.length * 34));

  useEffect(() => setSubOpen(false), [x, y]);

  return (
    <>
      <button
        className="click-catcher"
        style={{ zIndex: 60 }}
        aria-label="Zellmenü schließen"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div className="ctxmenu" role="menu" style={{ left, top }} aria-label={`Zelle ${x + 1}, ${y + 1}`}>
        {theme === 'retro' ? (
          <>
            <button
              className="menu-item"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={subOpen}
              onMouseEnter={() => setSubOpen(true)}
              onClick={() => setSubOpen(true)}
            >
              <span className="menu-label">Zustand setzen</span>
              <Icon.chevronRight size={20} strokeWidth={3.5} />
            </button>
            <button className="menu-item" role="menuitem" onMouseEnter={() => setSubOpen(false)} onClick={onHistory}>
              <span className="menu-label">Verlauf</span>
            </button>
            {subOpen && (
              <div className="ctx-sub" role="menu" aria-label="Zustand setzen">
                {states.map((s, i) => (
                  <button key={i} className="menu-item" role="menuitemradio" aria-checked={i === cur} onClick={() => onSet(i)}>
                    <span className="menu-label">{s.name}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="ctx-info">
              Zelle <span className="mono" style={{ color: 'var(--text)' }}>({x + 1}, {y + 1})</span>
              <br />
              Seit {age.toLocaleString('de-DE')} Gen. im Zustand „{states[cur].name}“
            </div>
            <div className="ctx-heading">Zustand setzen</div>
            <div style={{ maxHeight: 260, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              {states.map((s, i) => (
                <button key={i} className="menu-item" role="menuitemradio" aria-checked={i === cur} onClick={() => onSet(i)}>
                  <span className="swatch small" style={{ background: s.color }} />
                  <span className="menu-label">{s.name}</span>
                  <span style={{ color: 'var(--accent)' }}>{i === cur ? '✓' : ''}</span>
                </button>
              ))}
            </div>
            <div className="menu-sep" />
            <button className="menu-item" role="menuitem" onClick={() => onBrush(cur)}>
              <span className="menu-label">Zustand dieser Zelle als Pinsel</span>
            </button>
            <button className="menu-item" role="menuitem" onClick={onHistory}>
              <span className="menu-label">Zellverlauf anzeigen</span>
            </button>
          </>
        )}
      </div>
    </>
  );
}

interface RetroToolsProps {
  doc: Doc | null;
  running: boolean;
  zoomBy: (dir: 1 | -1) => void;
  togglePlay: () => void;
  pause: () => void;
  stop: () => void;
  snapshot: () => void;
  openStats: () => void;
  setSpeed: (gps: number) => void;
  setSpeedUnit: (u: 'gps' | 'spg') => void;
}

/** Werkzeugleiste „Tools“ aus dem ursprünglichen Entwurf. */
export function RetroTools(p: RetroToolsProps) {
  const settings = p.doc?.project.settings;
  const unit = settings?.speedUnit ?? 'spg';
  const [text, setText] = useState('');
  const disabled = !p.doc;

  const commit = () => {
    const v = parseFloat(text.replace(',', '.'));
    if (v > 0) p.setSpeed(unit === 'spg' ? 1 / v : v);
    setText('');
  };

  const current = settings ? (unit === 'spg' ? 1 / settings.speed : settings.speed) : null;

  return (
    <aside className="retro-tools" aria-label="Tools">
      <h2>Tools</h2>
      <div className="retro-row">
        <button className="retro-round" aria-label="Vergrößern" onClick={() => p.zoomBy(1)} disabled={disabled}><RetroGlyph.plus /></button>
        <button className="retro-round" aria-label="Verkleinern" onClick={() => p.zoomBy(-1)} disabled={disabled}><RetroGlyph.minus /></button>
      </div>
      <div className="retro-tempo">
        <input
          aria-label={unit === 'spg' ? 'Tempo in Sekunden pro Generation' : 'Tempo in Generationen pro Sekunde'}
          placeholder={current ? `Tempo: ${current.toLocaleString('de-DE', { maximumFractionDigits: 2 })}` : 'Tempo eingeben'}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && commit()}
        />
        <button
          onClick={() => p.setSpeedUnit(unit === 'spg' ? 'gps' : 'spg')}
          title={unit === 'spg' ? 'Sekunden pro Generation (umschalten)' : 'Generationen pro Sekunde (umschalten)'}
          disabled={disabled}
        >
          {unit === 'spg' ? <>Sek.<br />Gen.</> : <>Gen.<br />Sek.</>}
        </button>
      </div>
      <div className="retro-row">
        <button className="retro-round" aria-label="Start" aria-pressed={p.running} onClick={p.togglePlay} disabled={disabled}><RetroGlyph.play /></button>
        <button className="retro-round" aria-label="Pause" onClick={p.pause} disabled={disabled}><RetroGlyph.pause /></button>
        <button className="retro-round" aria-label="Stopp (zurück zum Anfang)" onClick={p.stop} disabled={disabled}><RetroGlyph.stop /></button>
      </div>
      <div className="retro-row">
        <button className="retro-round" aria-label="Schnappschuss" onClick={p.snapshot} disabled={disabled}><RetroGlyph.camera /></button>
        <button className="retro-round" aria-label="Statistik" onClick={p.openStats} disabled={disabled}><RetroGlyph.chart /></button>
      </div>
      {p.doc && (
        <div className="retro-gen" style={{ marginTop: 'auto' }}>
          Generation {p.doc.sim.generation.toLocaleString('de-DE')}
        </div>
      )}
    </aside>
  );
}
