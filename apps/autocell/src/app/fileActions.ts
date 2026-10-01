/**
 * Wandelt eine geöffnete Datei in ein Ergebnis um: Projekt, importiertes
 * Raster, Easter Egg oder Fehler. Rein (ohne DOM), damit testbar.
 */
import {
  AcpError,
  createProject,
  decodeAcp,
  decodeText,
  getTemplate,
  ImportError,
  parseCSV,
  parseRLE,
  sniffFile,
  type GridData,
  type Model,
  type Project,
} from '@autocell/core';
import { easterEggForText, type EasterEgg } from '../eastereggs/triggers';

export type OpenResult =
  | { kind: 'project'; project: Project }
  | { kind: 'grid'; grid: GridData; format: 'CSV' | 'RLE' }
  | { kind: 'easteregg'; egg: EasterEgg }
  | { kind: 'error'; message: string };

function ext(name: string): string {
  const m = /\.([^.]+)$/.exec(name.toLowerCase());
  return m ? m[1] : '';
}

export function interpretFile(name: string, bytes: Uint8Array): OpenResult {
  const kind = sniffFile(bytes);
  try {
    if (kind === 'zip' || kind === 'json') return { kind: 'project', project: decodeAcp(bytes) };
    if (kind === 'text') {
      const text = decodeText(bytes);
      const egg = easterEggForText(text);
      if (egg) return { kind: 'easteregg', egg };
      const e = ext(name);
      if (e === 'rle' || /^\s*(#.*\n\s*)*x\s*=/.test(text)) return { kind: 'grid', grid: parseRLE(text), format: 'RLE' };
      if (e === 'csv' || /^[\d\s;,\t]+$/.test(text)) return { kind: 'grid', grid: parseCSV(text), format: 'CSV' };
    }
    if (kind === 'empty') return { kind: 'error', message: `„${name}“ ist leer.` };
    return { kind: 'error', message: `„${name}“ ist keine AutoCell-Projektdatei und kein unterstütztes Rasterformat (CSV, RLE).` };
  } catch (e) {
    if (e instanceof AcpError || e instanceof ImportError) return { kind: 'error', message: e.message };
    throw e;
  }
}

/** Erstellt ein Projekt aus einem importierten Raster (z. B. einem Golly-Muster). */
export function projectFromGrid(grid: GridData, name: string, model?: Model): Project {
  const maxState = grid.cells.reduce((a, b) => Math.max(a, b), 0);
  let m = model ?? getTemplate('gol').model();
  if (maxState >= m.states.length) {
    const base = getTemplate('empty').model();
    const palette = ['#7cf283', '#ff9a3c', '#4ea3ff', '#e3ece5', '#f2d24b', '#b07cff', '#ff6b8b'];
    m = {
      ...base,
      states: Array.from({ length: maxState + 1 }, (_, i) => ({
        name: i === 0 ? 'Leer' : `Zustand ${i}`,
        color: i === 0 ? '#0f1a13' : palette[(i - 1) % palette.length],
        initialShare: i === 0 ? 100 : 0,
        rules: [],
      })),
    };
  }
  const p = createProject({ name, model: m, width: grid.width, height: grid.height, fill: 'first' });
  p.current.cells.set(grid.cells);
  p.initial = p.current.cells.slice();
  p.history.clear();
  return p;
}

export function baseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '');
}
