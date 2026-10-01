/**
 * Import und Export von Rasterdaten in verbreiteten Formaten:
 * - CSV: eine Zeile pro Rasterzeile, Zustandsnummern getrennt durch ; , Tab oder Leerzeichen
 * - RLE: Lauflängenformat von Golly/LifeWiki (b/o für 2 Zustände, ./A–X für bis zu 25)
 */

export interface GridData {
  width: number;
  height: number;
  /** Zustandsnummer je Zelle, zeilenweise. */
  cells: number[];
}

export class ImportError extends Error {
  constructor(message: string, public line?: number) {
    super(line !== undefined ? `Zeile ${line}: ${message}` : message);
    this.name = 'ImportError';
  }
}

/* ---------------- CSV ---------------- */

export function parseCSV(text: string): GridData {
  const rows = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));
  if (rows.length === 0) throw new ImportError('Die Datei enthält keine Daten.');
  const parsed = rows.map((row, y) =>
    row.split(/[;,\t ]+/).map((v) => {
      if (!/^\d+$/.test(v)) throw new ImportError(`„${v}“ ist keine Zustandsnummer.`, y + 1);
      return parseInt(v, 10);
    }),
  );
  const width = Math.max(...parsed.map((r) => r.length));
  const cells: number[] = [];
  for (const r of parsed) for (let x = 0; x < width; x++) cells.push(r[x] ?? 0);
  return { width, height: parsed.length, cells };
}

export function toCSV(g: GridData, separator = ';'): string {
  const lines: string[] = [];
  for (let y = 0; y < g.height; y++) lines.push(g.cells.slice(y * g.width, (y + 1) * g.width).join(separator));
  return lines.join('\n') + '\n';
}

/* ---------------- RLE ---------------- */

export interface RleData extends GridData {
  rule?: string;
  comments: string[];
}

function tagToState(ch: string): number | null {
  if (ch === 'b' || ch === '.') return 0;
  if (ch === 'o') return 1;
  if (ch >= 'A' && ch <= 'X') return ch.charCodeAt(0) - 64;
  return null;
}

export function parseRLE(text: string): RleData {
  const comments: string[] = [];
  let width = 0;
  let height = 0;
  let rule: string | undefined;
  const body: string[] = [];
  let headerSeen = false;
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith('#')) {
      comments.push(line.replace(/^#\w?\s?/, ''));
      return;
    }
    if (!headerSeen && /^x\s*=/.test(line)) {
      headerSeen = true;
      const m = /x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)(?:\s*,\s*rule\s*=\s*(\S+))?/.exec(line);
      if (!m) throw new ImportError('Kopfzeile „x = …, y = …“ nicht lesbar.', idx + 1);
      width = parseInt(m[1], 10);
      height = parseInt(m[2], 10);
      rule = m[3];
      return;
    }
    body.push(line);
  });

  const rows: number[][] = [[]];
  let count = '';
  let done = false;
  for (const ch of body.join('')) {
    if (done) break;
    if (ch >= '0' && ch <= '9') {
      count += ch;
      continue;
    }
    const n = count ? parseInt(count, 10) : 1;
    count = '';
    if (ch === '!') {
      done = true;
    } else if (ch === '$') {
      for (let k = 0; k < n; k++) rows.push([]);
    } else {
      const s = tagToState(ch);
      if (s === null) throw new ImportError(`Unbekanntes Zeichen „${ch}“ im RLE-Muster.`);
      const row = rows[rows.length - 1];
      for (let k = 0; k < n; k++) row.push(s);
    }
  }
  // Leere Zeilen am Ende stammen nur vom letzten „$“.
  while (rows.length > 1 && rows[rows.length - 1].length === 0 && rows.length > height) rows.pop();
  width = Math.max(width, ...rows.map((r) => r.length));
  height = Math.max(height, rows.length);
  const cells: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) cells.push(rows[y]?.[x] ?? 0);
  return { width, height, cells, rule, comments };
}

export function toRLE(g: GridData, rule?: string): string {
  const maxState = g.cells.reduce((a, b) => Math.max(a, b), 0);
  if (maxState > 24) throw new ImportError('RLE unterstützt höchstens 25 Zustände.');
  const tag = (s: number) => (maxState <= 1 ? (s ? 'o' : 'b') : s === 0 ? '.' : String.fromCharCode(64 + s));
  const parts: string[] = [];
  let lastY = 0;
  for (let y = 0; y < g.height; y++) {
    const row = g.cells.slice(y * g.width, (y + 1) * g.width);
    let end = row.length;
    while (end > 0 && row[end - 1] === 0) end--;
    if (end === 0) continue;
    const gap = y - lastY;
    if (gap > 0) parts.push(`${gap > 1 ? gap : ''}$`);
    lastY = y;
    let x = 0;
    while (x < end) {
      let j = x + 1;
      while (j < end && row[j] === row[x]) j++;
      parts.push(`${j - x > 1 ? j - x : ''}${tag(row[x])}`);
      x = j;
    }
  }
  parts.push('!');
  const lines: string[] = [`x = ${g.width}, y = ${g.height}${rule ? `, rule = ${rule}` : ''}`];
  let line = '';
  for (const p of parts) {
    if (line.length + p.length > 70) {
      lines.push(line);
      line = '';
    }
    line += p;
  }
  lines.push(line);
  return lines.join('\n') + '\n';
}
