/**
 * „Im Web veröffentlichen“: erzeugt den HTML-Schnipsel für <autocell-player>.
 * Rein (ohne DOM), damit testbar.
 */
import { encodeAcpJson, type Project } from '@autocell/core';

/** Adresse des Players in der veröffentlichten Web-Version. */
export const PLAYER_SCRIPT_URL = 'https://delbonum.github.io/autocell/player/autocell-player.js';
export const PLAYER_DOCS_URL = 'https://delbonum.github.io/autocell/player/';

/** Ab dieser Größe wird vom Einbetten in den Schnipsel abgeraten. */
export const INLINE_WARN_BYTES = 300_000;

export interface PublishOptions {
  /** `inline`: Projekt steht im Schnipsel, `file`: separate .acp-Datei per `src`. */
  mode: 'inline' | 'file';
  /** Dateiname für `mode: 'file'`. */
  fileName: string;
  /** Wiedergabe bei Generation 0 statt beim aktuellen Stand beginnen. */
  fromStart: boolean;
  autoplay: boolean;
  controls: boolean;
  legend: boolean;
  loop: boolean;
  interactive: boolean;
}

export const DEFAULT_PUBLISH: Omit<PublishOptions, 'fileName'> = {
  mode: 'inline',
  fromStart: true,
  autoplay: true,
  controls: true,
  legend: false,
  loop: false,
  interactive: false,
};

/** Das Projekt so, wie es veröffentlicht wird (ohne Statistikverlauf). */
export function publishedProject(p: Project, fromStart: boolean): Project {
  const startable = fromStart && p.initial !== null && p.initial.length === p.width * p.height;
  return {
    ...p,
    current: startable
      ? {
          cells: p.initial!.slice(),
          ages: new Uint32Array(p.width * p.height),
          generation: 0,
          rngState: p.settings.seed,
        }
      : p.current,
  };
}

/** JSON für das Einbetten; „<“ maskiert, damit kein „</script>“ den Block beendet. */
export function inlineJson(p: Project, appVersion: string): string {
  return encodeAcpJson(p, appVersion).replace(/</g, '\\u003c');
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Dateiname für die hochzuladende Projektdatei. */
export function publishFileName(projectName: string): string {
  const base = projectName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'projekt'}.acp`;
}

function attributes(o: PublishOptions): string {
  const flags = (['controls', 'legend', 'autoplay', 'loop', 'interactive'] as const).filter((k) => o[k]);
  return flags.map((f) => ` ${f}`).join('');
}

/** Der vollständige Schnipsel zum Einfügen in eine Webseite. */
export function embedSnippet(p: Project, o: PublishOptions, appVersion: string): string {
  const script = `<script type="module" src="${PLAYER_SCRIPT_URL}"></script>`;
  if (o.mode === 'file') {
    return `${script}\n<autocell-player src="${escapeAttr(o.fileName)}"${attributes(o)}></autocell-player>\n`;
  }
  const json = inlineJson(publishedProject(p, o.fromStart), appVersion)
    .split('\n')
    .map((line) => `    ${line}`)
    .join('\n');
  return `${script}\n<autocell-player${attributes(o)}>\n  <script type="application/json">\n${json}\n  </script>\n</autocell-player>\n`;
}
