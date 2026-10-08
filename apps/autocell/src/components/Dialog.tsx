import { useEffect, useRef, type ReactNode } from 'react';
import { ACP_FORMAT_VERSION } from '@autocell/core';
import { APP_NAME, APP_VERSION, BUILD_DATE, CREDITS } from '../version';
import { Icon } from './Icons';

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

