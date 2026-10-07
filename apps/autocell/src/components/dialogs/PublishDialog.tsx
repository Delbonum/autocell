import { useEffect, useMemo, useRef, useState } from 'react';
import { ACP_MIME, encodeAcp } from '@autocell/core';
import '@autocell/player';
import { docToProject, type Doc } from '../../app/doc';
import { saveFile } from '../../app/platform';
import {
  DEFAULT_PUBLISH,
  embedSnippet,
  INLINE_WARN_BYTES,
  PLAYER_DOCS_URL,
  publishedProject,
  publishFileName,
  type PublishOptions,
} from '../../app/publish';
import { APP_VERSION } from '../../version';
import { Dialog } from '../Dialog';

const FLAGS: Array<[keyof PublishOptions, string, string]> = [
  ['autoplay', 'Automatisch starten', 'sobald der Player sichtbar ist'],
  ['controls', 'Steuerleiste', 'Start/Pause, Einzelschritt, Zurücksetzen'],
  ['legend', 'Legende', 'Zustände mit Farbe und Anzahl'],
  ['loop', 'Wiederholen', 'nach einer Stoppbedingung von vorn beginnen'],
  ['interactive', 'Zellen anklickbar', 'Besucher können Zellen umschalten'],
];

const ACP_TYPES = [{ description: 'AutoCell-Projekt', accept: { [ACP_MIME]: ['.acp'] } }];

function formatBytes(n: number): string {
  return n < 1024 ? `${n} Byte` : n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function PublishDialog({ doc, onClose, onToast }: { doc: Doc; onClose: () => void; onToast: (text: string) => void }) {
  // Einmal beim Öffnen festhalten: Läuft die Simulation weiter, ändert sich der Schnipsel nicht ständig.
  const project = useMemo(() => docToProject(doc), [doc]);
  const [o, setO] = useState<PublishOptions>({ ...DEFAULT_PUBLISH, fileName: publishFileName(project.meta.name) });
  const set = (patch: Partial<PublishOptions>) => setO((prev) => ({ ...prev, ...patch }));

  const snippet = useMemo(() => embedSnippet(project, o, APP_VERSION), [project, o]);
  const bytes = new TextEncoder().encode(snippet).length;
  const atStart = project.current.generation === 0;

  const preview = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = preview.current;
    if (!host) return;
    const el = document.createElement('autocell-player');
    for (const [k] of FLAGS) if (o[k]) el.setAttribute(k, '');
    host.replaceChildren(el);
    el.load(publishedProject(project, o.fromStart));
    return () => el.pause();
  }, [project, o.fromStart, o.autoplay, o.controls, o.legend, o.loop, o.interactive]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      onToast('Code kopiert – jetzt in die Webseite einfügen');
    } catch {
      onToast('Kopieren nicht möglich – bitte den Code markieren und mit Strg+C kopieren');
    }
  };

  const downloadAcp = async () => {
    try {
      const data = encodeAcp(publishedProject(project, o.fromStart), { appVersion: APP_VERSION, includeHistory: false });
      const res = await saveFile(o.fileName, data, ACP_MIME, null, ACP_TYPES);
      if (res) {
        if (res.name !== o.fileName) set({ fileName: res.name });
        onToast(`${res.name} gespeichert`);
      }
    } catch (e) {
      onToast(`Speichern fehlgeschlagen: ${(e as Error).message}`);
    }
  };

  return (
    <Dialog
      title="Im Web veröffentlichen"
      subtitle={project.meta.name}
      onClose={onClose}
      width={980}
      footer={
        <>
          <a className="hint" href={PLAYER_DOCS_URL} target="_blank" rel="noopener" style={{ fontSize: 12 }}>
            Anleitung und weitere Optionen
          </a>
          <span className="spacer" />
          {o.mode === 'file' && <button className="btn" onClick={() => void downloadAcp()}>Projektdatei speichern …</button>}
          <button className="btn" onClick={onClose}>Schließen</button>
          <button className="btn btn-primary" onClick={() => void copy()}>Code kopieren</button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend className="section-title" style={{ marginBottom: 8 }}>Projekt einbinden</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label className={`option-card${o.mode === 'inline' ? ' on' : ''}`}>
                <input type="radio" name="pub-mode" checked={o.mode === 'inline'} onChange={() => set({ mode: 'inline' })} />
                <span><strong>Im Code</strong><small>Ein Schnipsel enthält alles – nur einfügen.</small></span>
              </label>
              <label className={`option-card${o.mode === 'file' ? ' on' : ''}`}>
                <input type="radio" name="pub-mode" checked={o.mode === 'file'} onChange={() => set({ mode: 'file' })} />
                <span><strong>Als Datei</strong><small>.acp-Datei neben die Webseite hochladen.</small></span>
              </label>
            </div>
            {o.mode === 'file' && (
              <div className="field" style={{ marginTop: 10 }}>
                <label htmlFor="pub-file">Dateiname bzw. Adresse der Projektdatei</label>
                <input id="pub-file" className="input mono" style={{ height: 34 }} value={o.fileName} onChange={(e) => set({ fileName: e.target.value })} />
              </div>
            )}
          </fieldset>

          <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <legend className="section-title" style={{ marginBottom: 8 }}>Start</legend>
            <label className="row" style={{ cursor: 'pointer' }}>
              <input type="radio" name="pub-start" checked={o.fromStart} onChange={() => set({ fromStart: true })} />
              Bei Generation 0 beginnen
            </label>
            <label className="row" style={{ cursor: atStart ? 'default' : 'pointer', opacity: atStart ? 0.55 : 1 }}>
              <input type="radio" name="pub-start" disabled={atStart} checked={!o.fromStart} onChange={() => set({ fromStart: false })} />
              Beim aktuellen Stand beginnen (Generation {project.current.generation.toLocaleString('de-DE')})
            </label>
          </fieldset>

          <fieldset style={{ border: 0, margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <legend className="section-title" style={{ marginBottom: 8 }}>Player</legend>
            {FLAGS.map(([k, label, desc]) => (
              <label key={k} className="row" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={o[k] as boolean} onChange={(e) => set({ [k]: e.target.checked })} />
                {label}
                <span className="hint" style={{ fontSize: 12 }}>– {desc}</span>
              </label>
            ))}
          </fieldset>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          <span className="section-title">Vorschau</span>
          <div ref={preview} style={{ border: '1px solid var(--line2)', borderRadius: 8, overflow: 'hidden', maxHeight: 330 }} />
        </div>
      </div>

      <div className="field" style={{ marginTop: 18 }}>
        <label htmlFor="pub-code">
          Code für die Webseite
          <span className="hint" style={{ marginLeft: 8, fontSize: 12 }}>{formatBytes(bytes)}</span>
        </label>
        <textarea
          id="pub-code"
          className="input mono"
          readOnly
          spellCheck={false}
          value={snippet}
          onFocus={(e) => e.currentTarget.select()}
          style={{ height: 132, fontSize: 12, whiteSpace: 'pre', resize: 'vertical' }}
        />
        {o.mode === 'inline' && bytes > INLINE_WARN_BYTES && (
          <p className="hint" style={{ fontSize: 12, color: 'var(--warn)' }}>
            Das Projekt ist recht groß für einen Schnipsel. „Als Datei“ hält die Webseite schlanker.
          </p>
        )}
        {o.mode === 'file' && (
          <p className="hint" style={{ fontSize: 12 }}>
            Projektdatei speichern und unter diesem Namen in denselben Ordner wie die Webseite hochladen.
          </p>
        )}
      </div>
    </Dialog>
  );
}
