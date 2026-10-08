/**
 * Lesen und Schreiben des AutoCell-Projektformats (.acp).
 * Die vollständige Spezifikation steht in docs/acp-format.md.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { detectPreset } from './neighborhood';
import { ProbeLog, type Probe } from './probes';
import type { Project } from './project';
import { History } from './stats';
import {
  COMPARE_OPS,
  MAX_GRID_SIZE,
  MAX_STATES,
  type Boundary,
  type CellArray,
  type CompareOp,
  type Condition,
  type Model,
  type NeighborhoodPreset,
  type Offset,
  type Rule,
  type StateDef,
} from './types';

export const ACP_FORMAT = 'autocell-project';
export const ACP_FORMAT_VERSION = 1;
export const ACP_MIME = 'application/vnd.autocell.project+zip';
export const ACP_EXTENSION = '.acp';

/** Fehler beim Lesen einer Projektdatei. `path` zeigt auf die fehlerhafte Stelle. */
export class AcpError extends Error {
  constructor(message: string, public path?: string) {
    super(path ? `${path}: ${message}` : message);
    this.name = 'AcpError';
  }
}

export interface EncodeOptions {
  /** Version der Anwendung, die die Datei schreibt (z. B. `2.0.0`). */
  appVersion: string;
  /** Statistikverlauf mitspeichern (Standard: ja). */
  includeHistory?: boolean;
  /** Kompressionsstufe 0–9 (Standard: 6). */
  level?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
}

/* ------------------------------------------------------------------ */
/* JSON-Struktur von project.json                                      */
/* ------------------------------------------------------------------ */

export type CellDataRef = { file: string } | { rle: string } | { fill: number };

export interface AcpJson {
  format: typeof ACP_FORMAT;
  formatVersion: number;
  createdWith?: { app: string; version: string };
  meta: {
    name: string;
    description?: string;
    author?: string;
    createdAt?: string;
    modifiedAt?: string;
    template?: string;
  };
  grid: { width: number; height: number };
  model: {
    states: Array<{
      name: string;
      color: string;
      initialShare?: number;
      description?: string;
      rules?: Array<{
        target: number;
        combine?: 'all' | 'any';
        probability?: number;
        enabled?: boolean;
        note?: string;
        conditions?: unknown[];
      }>;
    }>;
    neighborhood: { preset?: NeighborhoodPreset; offsets: Array<[number, number]>; includeSelf?: boolean };
    boundary: Boundary;
  };
  simulation?: {
    seed?: number;
    speed?: number;
    speedUnit?: 'gps' | 'spg';
    stopAtGeneration?: number | null;
    stopWhenStable?: boolean;
  };
  view?: { cellSize?: number; showGridLines?: boolean };
  /** Messpunkte (ab AutoCell 2.2.0, optional). */
  probes?: Array<{ name: string; x: number; y: number }>;
  data?: {
    generation?: number;
    rngState?: number;
    cellEncoding?: 'u8' | 'u16';
    cells?: CellDataRef;
    ages?: { file: string } | null;
    initial?: CellDataRef | null;
    history?: { file: string } | { generations: number[]; counts: number[][] } | null;
    /** Verlauf der Messpunkte (ab AutoCell 2.2.0, optional). */
    probeHistory?: { file: string } | { generations: number[]; series: number[][] } | null;
  };
}

/* ------------------------------------------------------------------ */
/* Schreiben                                                           */
/* ------------------------------------------------------------------ */

function cellsToBytes(cells: CellArray): Uint8Array {
  if (cells instanceof Uint8Array) return cells.slice();
  const out = new Uint8Array(cells.length * 2);
  const view = new DataView(out.buffer);
  for (let i = 0; i < cells.length; i++) view.setUint16(i * 2, cells[i], true);
  return out;
}

function agesToBytes(ages: Uint32Array): Uint8Array {
  const out = new Uint8Array(ages.length * 4);
  const view = new DataView(out.buffer);
  for (let i = 0; i < ages.length; i++) view.setUint32(i * 4, ages[i], true);
  return out;
}

/** Wandelt ein Projekt in die JSON-Struktur um (ohne Zelldaten). */
export function projectToJson(p: Project, appVersion: string): AcpJson {
  const wide = p.model.states.length > 256;
  return {
    format: ACP_FORMAT,
    formatVersion: ACP_FORMAT_VERSION,
    createdWith: { app: 'AutoCell', version: appVersion },
    meta: { ...p.meta },
    grid: { width: p.width, height: p.height },
    model: {
      states: p.model.states.map((s) => ({
        name: s.name,
        color: s.color,
        initialShare: s.initialShare,
        ...(s.description ? { description: s.description } : {}),
        rules: s.rules.map((r) => ({
          target: r.target,
          combine: r.combine,
          probability: r.probability,
          ...(r.enabled === false ? { enabled: false } : {}),
          ...(r.note ? { note: r.note } : {}),
          conditions: r.conditions.map((c) => ({ ...c })),
        })),
      })),
      neighborhood: {
        preset: p.model.neighborhood.preset,
        offsets: p.model.neighborhood.offsets.map((o) => [o.dx, o.dy] as [number, number]),
        includeSelf: p.model.neighborhood.includeSelf,
      },
      boundary: { ...p.model.boundary },
    },
    simulation: { ...p.settings },
    view: { ...p.view },
    ...(p.probes?.length ? { probes: p.probes.map((q) => ({ name: q.name, x: q.x, y: q.y })) } : {}),
    data: {
      generation: p.current.generation,
      rngState: p.current.rngState,
      cellEncoding: wide ? 'u16' : 'u8',
    },
  };
}

/** Schreibt ein Projekt als .acp-Datei (ZIP-Container). */
export function encodeAcp(p: Project, options: EncodeOptions): Uint8Array {
  const json = projectToJson(p, options.appVersion);
  const level = options.level ?? 6;
  const files: Zippable = {};
  json.data!.cells = { file: 'cells.bin' };
  files['cells.bin'] = [cellsToBytes(p.current.cells), { level }];
  json.data!.ages = { file: 'ages.bin' };
  files['ages.bin'] = [agesToBytes(p.current.ages), { level }];
  if (p.initial) {
    json.data!.initial = { file: 'initial.bin' };
    files['initial.bin'] = [cellsToBytes(p.initial), { level }];
  } else {
    json.data!.initial = null;
  }
  if (options.includeHistory !== false && p.history.length > 0) {
    json.data!.history = { file: 'history.json' };
    files['history.json'] = [strToU8(JSON.stringify(p.history.toJSON())), { level }];
  } else {
    json.data!.history = null;
  }
  if (options.includeHistory !== false && p.probes?.length && p.probeLog && p.probeLog.length > 0) {
    json.data!.probeHistory = { file: 'probes.json' };
    files['probes.json'] = [strToU8(JSON.stringify(p.probeLog.toJSON())), { level }];
  }
  // Reihenfolge im Archiv wie bei ODF: „mimetype“ unkomprimiert zuerst, dann project.json.
  return zipSync({
    mimetype: [strToU8(ACP_MIME), { level: 0 }],
    'project.json': [strToU8(JSON.stringify(json, null, 2)), { level }],
    ...files,
  });
}

/* ------------------------------------------------------------------ */
/* Lauflängenkodierung für die reine JSON-Variante                     */
/* ------------------------------------------------------------------ */

/** Kodiert Zellen als „Anzahl*Zustand“-Folge, z. B. `120*0 3*1 1*0`. */
export function encodeRuns(cells: ArrayLike<number>): string {
  const parts: string[] = [];
  let i = 0;
  while (i < cells.length) {
    const v = cells[i];
    let j = i + 1;
    while (j < cells.length && cells[j] === v) j++;
    parts.push(j - i === 1 ? String(v) : `${j - i}*${v}`);
    i = j;
  }
  return parts.join(' ');
}

export function decodeRuns(text: string, size: number, stateCount: number, path = 'rle'): number[] {
  const out: number[] = [];
  for (const token of text.trim().split(/[\s,]+/)) {
    if (!token) continue;
    const m = /^(?:(\d+)\*)?(\d+)$/.exec(token);
    if (!m) throw new AcpError(`Ungültiger Eintrag „${token}“`, path);
    const count = m[1] ? parseInt(m[1], 10) : 1;
    const state = parseInt(m[2], 10);
    if (state >= stateCount) throw new AcpError(`Zustand ${state} existiert nicht`, path);
    if (out.length + count > size) throw new AcpError(`Mehr Zellen als das Raster hat (${size})`, path);
    for (let k = 0; k < count; k++) out.push(state);
  }
  if (out.length !== size) throw new AcpError(`${out.length} statt ${size} Zellen`, path);
  return out;
}

/** Projekt als einzelne, menschenlesbare JSON-Datei (Zellen lauflängenkodiert, ohne Alter). */
export function encodeAcpJson(p: Project, appVersion: string): string {
  const json = projectToJson(p, appVersion);
  json.data!.cells = { rle: encodeRuns(p.current.cells) };
  json.data!.initial = p.initial ? { rle: encodeRuns(p.initial) } : null;
  json.data!.history = null;
  return JSON.stringify(json, null, 2);
}

/* ------------------------------------------------------------------ */
/* Lesen                                                               */
/* ------------------------------------------------------------------ */

export type FileKind = 'zip' | 'json' | 'text' | 'binary' | 'empty';

/** Erkennt grob, welche Art von Datei vorliegt. */
export function sniffFile(bytes: Uint8Array): FileKind {
  if (bytes.length === 0) return 'empty';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return 'zip';
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;
  let i = start;
  while (i < bytes.length && (bytes[i] === 0x20 || bytes[i] === 0x0a || bytes[i] === 0x0d || bytes[i] === 0x09)) i++;
  if (bytes[i] === 0x7b) return 'json';
  const sample = bytes.subarray(0, Math.min(bytes.length, 4096));
  for (const b of sample) if (b === 0 || (b < 0x09)) return 'binary';
  return 'text';
}

export function decodeText(bytes: Uint8Array): string {
  const s = strFromU8(bytes);
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

/** Liest eine .acp-Datei (ZIP oder reines JSON). */
export function decodeAcp(bytes: Uint8Array): Project {
  const kind = sniffFile(bytes);
  if (kind === 'zip') {
    let entries: Record<string, Uint8Array>;
    try {
      entries = unzipSync(bytes);
    } catch {
      throw new AcpError('Die Datei ist beschädigt (ZIP-Container nicht lesbar).');
    }
    const mime = entries['mimetype'] ? strFromU8(entries['mimetype']).trim() : null;
    if (mime !== null && mime !== ACP_MIME) throw new AcpError(`Unerwarteter Dateityp „${mime}“.`);
    const main = entries['project.json'];
    if (!main) throw new AcpError('project.json fehlt – keine AutoCell-Projektdatei.');
    return jsonToProject(parseJson(decodeText(main)), (name) => entries[name]);
  }
  if (kind === 'json') {
    return jsonToProject(parseJson(decodeText(bytes)), () => undefined);
  }
  throw new AcpError('Keine AutoCell-Projektdatei.');
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new AcpError(`project.json ist kein gültiges JSON (${(e as Error).message}).`);
  }
}

/* ---------- Prüfhelfer ---------- */

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function req(cond: boolean, msg: string, path: string): asserts cond {
  if (!cond) throw new AcpError(msg, path);
}

function int(v: unknown, path: string, min: number, max: number): number {
  req(typeof v === 'number' && Number.isInteger(v), 'ganze Zahl erwartet', path);
  req((v as number) >= min && (v as number) <= max, `Wert muss zwischen ${min} und ${max} liegen`, path);
  return v as number;
}

function num(v: unknown, path: string, min: number, max: number): number {
  req(typeof v === 'number' && Number.isFinite(v), 'Zahl erwartet', path);
  req((v as number) >= min && (v as number) <= max, `Wert muss zwischen ${min} und ${max} liegen`, path);
  return v as number;
}

function str(v: unknown, path: string, fallback?: string): string {
  if (v === undefined && fallback !== undefined) return fallback;
  req(typeof v === 'string', 'Text erwartet', path);
  return v as string;
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

function op(v: unknown, path: string): CompareOp {
  req(typeof v === 'string' && (COMPARE_OPS as readonly string[]).includes(v), `Vergleich muss einer von ${COMPARE_OPS.join(' ')} sein`, path);
  return v as CompareOp;
}

function parseCondition(c: unknown, path: string, stateCount: number): Condition {
  req(isObj(c), 'Objekt erwartet', path);
  const o = c as Record<string, unknown>;
  switch (o.type) {
    case 'neighborCount': {
      req(Array.isArray(o.states), 'Liste von Zuständen erwartet', `${path}.states`);
      const states = (o.states as unknown[]).map((s, k) => int(s, `${path}.states[${k}]`, 0, stateCount - 1));
      return { type: 'neighborCount', states, op: op(o.op, `${path}.op`), value: int(o.value, `${path}.value`, 0, 1_000_000) };
    }
    case 'neighborAt': {
      const eq = o.op;
      req(eq === '=' || eq === '!=', 'Vergleich muss = oder != sein', `${path}.op`);
      return {
        type: 'neighborAt',
        dx: int(o.dx, `${path}.dx`, -MAX_GRID_SIZE, MAX_GRID_SIZE),
        dy: int(o.dy, `${path}.dy`, -MAX_GRID_SIZE, MAX_GRID_SIZE),
        op: eq as '=' | '!=',
        state: int(o.state, `${path}.state`, 0, stateCount - 1),
      };
    }
    case 'age':
      return { type: 'age', op: op(o.op, `${path}.op`), value: int(o.value, `${path}.value`, 0, 0xffffffff) };
    default:
      throw new AcpError(`Unbekannte Bedingungsart „${String(o.type)}“`, `${path}.type`);
  }
}

function parseModel(m: unknown): Model {
  req(isObj(m), 'Objekt erwartet', 'model');
  const mo = m as Record<string, unknown>;
  req(Array.isArray(mo.states) && mo.states.length >= 1, 'mindestens ein Zustand erforderlich', 'model.states');
  const rawStates = mo.states as unknown[];
  req(rawStates.length <= MAX_STATES, `höchstens ${MAX_STATES} Zustände`, 'model.states');
  const n = rawStates.length;
  const states: StateDef[] = rawStates.map((s, i) => {
    const p = `model.states[${i}]`;
    req(isObj(s), 'Objekt erwartet', p);
    const so = s as Record<string, unknown>;
    const color = str(so.color, `${p}.color`);
    req(COLOR_RE.test(color), 'Farbe im Format #rrggbb erwartet', `${p}.color`);
    const rulesRaw = so.rules === undefined ? [] : so.rules;
    req(Array.isArray(rulesRaw), 'Liste erwartet', `${p}.rules`);
    const rules: Rule[] = (rulesRaw as unknown[]).map((r, k) => {
      const rp = `${p}.rules[${k}]`;
      req(isObj(r), 'Objekt erwartet', rp);
      const ro = r as Record<string, unknown>;
      const combine = ro.combine === undefined ? 'all' : ro.combine;
      req(combine === 'all' || combine === 'any', '„all“ oder „any“ erwartet', `${rp}.combine`);
      const conds = ro.conditions === undefined ? [] : ro.conditions;
      req(Array.isArray(conds), 'Liste erwartet', `${rp}.conditions`);
      const rule: Rule = {
        target: int(ro.target, `${rp}.target`, 0, n - 1),
        combine: combine as 'all' | 'any',
        probability: ro.probability === undefined ? 1 : num(ro.probability, `${rp}.probability`, 0, 1),
        conditions: (conds as unknown[]).map((c, q) => parseCondition(c, `${rp}.conditions[${q}]`, n)),
      };
      if (ro.enabled === false) rule.enabled = false;
      if (typeof ro.note === 'string' && ro.note) rule.note = ro.note;
      return rule;
    });
    const def: StateDef = {
      name: str(so.name, `${p}.name`),
      color: color.toLowerCase(),
      initialShare: so.initialShare === undefined ? 0 : num(so.initialShare, `${p}.initialShare`, 0, 1e9),
      rules,
    };
    if (typeof so.description === 'string' && so.description) def.description = so.description;
    return def;
  });

  const nb = mo.neighborhood;
  req(isObj(nb), 'Objekt erwartet', 'model.neighborhood');
  const nbo = nb as Record<string, unknown>;
  req(Array.isArray(nbo.offsets), 'Liste von [dx, dy] erwartet', 'model.neighborhood.offsets');
  const seen = new Set<string>();
  const offsets: Offset[] = (nbo.offsets as unknown[]).map((o, k) => {
    const p = `model.neighborhood.offsets[${k}]`;
    req(Array.isArray(o) && o.length === 2, '[dx, dy] erwartet', p);
    const dx = int((o as unknown[])[0], `${p}[0]`, -64, 64);
    const dy = int((o as unknown[])[1], `${p}[1]`, -64, 64);
    req(dx !== 0 || dy !== 0, '(0, 0) ist die Zelle selbst – dafür „includeSelf“ verwenden', p);
    req(!seen.has(`${dx},${dy}`), 'doppelter Eintrag', p);
    seen.add(`${dx},${dy}`);
    return { dx, dy };
  });

  const b = mo.boundary;
  req(isObj(b), 'Objekt erwartet', 'model.boundary');
  const bo = b as Record<string, unknown>;
  let boundary: Boundary;
  if (bo.type === 'torus' || bo.type === 'mirror') boundary = { type: bo.type };
  else if (bo.type === 'fixed') boundary = { type: 'fixed', state: int(bo.state, 'model.boundary.state', 0, n - 1) };
  else throw new AcpError('„torus“, „fixed“ oder „mirror“ erwartet', 'model.boundary.type');

  return {
    states,
    neighborhood: { preset: detectPreset(offsets), offsets, includeSelf: nbo.includeSelf === true },
    boundary,
  };
}

function readCells(
  ref: unknown,
  path: string,
  size: number,
  stateCount: number,
  encoding: 'u8' | 'u16',
  file: (name: string) => Uint8Array | undefined,
): CellArray {
  const out: CellArray = stateCount <= 256 ? new Uint8Array(size) : new Uint16Array(size);
  req(isObj(ref), 'Objekt mit „file“, „rle“ oder „fill“ erwartet', path);
  const r = ref as Record<string, unknown>;
  if (typeof r.file === 'string') {
    const bytes = file(r.file);
    req(bytes !== undefined, `Datei „${r.file}“ fehlt im Archiv`, path);
    const width = encoding === 'u16' ? 2 : 1;
    req(bytes!.length === size * width, `„${r.file}“ hat ${bytes!.length} Byte, erwartet ${size * width}`, path);
    const view = new DataView(bytes!.buffer, bytes!.byteOffset, bytes!.byteLength);
    for (let i = 0; i < size; i++) {
      const v = width === 2 ? view.getUint16(i * 2, true) : bytes![i];
      req(v < stateCount, `Zelle ${i} hat unbekannten Zustand ${v}`, path);
      out[i] = v;
    }
    return out;
  }
  if (typeof r.rle === 'string') {
    out.set(decodeRuns(r.rle, size, stateCount, `${path}.rle`));
    return out;
  }
  if (r.fill !== undefined) {
    out.fill(int(r.fill, `${path}.fill`, 0, stateCount - 1));
    return out;
  }
  throw new AcpError('„file“, „rle“ oder „fill“ erwartet', path);
}

/** Wandelt eine (bereits geparste) project.json in ein Projekt um und prüft sie dabei. */
export function jsonToProject(raw: unknown, file: (name: string) => Uint8Array | undefined = () => undefined): Project {
  req(isObj(raw), 'Objekt erwartet', '(Wurzel)');
  const j = raw as Record<string, unknown>;
  req(j.format === ACP_FORMAT, 'keine AutoCell-Projektdatei', 'format');
  const fv = int(j.formatVersion, 'formatVersion', 1, Number.MAX_SAFE_INTEGER);
  if (fv > ACP_FORMAT_VERSION) {
    const by = isObj(j.createdWith) ? ` (${String(j.createdWith.app)} ${String(j.createdWith.version)})` : '';
    throw new AcpError(`Die Datei verwendet Format ${fv}${by} – bitte AutoCell aktualisieren.`);
  }

  req(isObj(j.meta), 'Objekt erwartet', 'meta');
  const meta = j.meta as Record<string, unknown>;
  req(isObj(j.grid), 'Objekt erwartet', 'grid');
  const grid = j.grid as Record<string, unknown>;
  const width = int(grid.width, 'grid.width', 1, MAX_GRID_SIZE);
  const height = int(grid.height, 'grid.height', 1, MAX_GRID_SIZE);
  const size = width * height;
  const model = parseModel(j.model);
  const n = model.states.length;

  const sim = isObj(j.simulation) ? (j.simulation as Record<string, unknown>) : {};
  const view = isObj(j.view) ? (j.view as Record<string, unknown>) : {};
  const data = isObj(j.data) ? (j.data as Record<string, unknown>) : {};
  const encoding = data.cellEncoding === undefined ? (n > 256 ? 'u16' : 'u8') : data.cellEncoding;
  req(encoding === 'u8' || encoding === 'u16', '„u8“ oder „u16“ erwartet', 'data.cellEncoding');
  req(!(encoding === 'u8' && n > 256), 'mehr als 256 Zustände benötigen „u16“', 'data.cellEncoding');

  const cells =
    data.cells === undefined
      ? readCells({ fill: 0 }, 'data.cells', size, n, encoding, file)
      : readCells(data.cells, 'data.cells', size, n, encoding, file);

  let ages = new Uint32Array(size);
  if (isObj(data.ages) && typeof data.ages.file === 'string') {
    const bytes = file(data.ages.file);
    req(bytes !== undefined, `Datei „${data.ages.file}“ fehlt im Archiv`, 'data.ages');
    req(bytes!.length === size * 4, `„${data.ages.file}“ hat die falsche Größe`, 'data.ages');
    const v = new DataView(bytes!.buffer, bytes!.byteOffset, bytes!.byteLength);
    ages = new Uint32Array(size);
    for (let i = 0; i < size; i++) ages[i] = v.getUint32(i * 4, true);
  }

  const initial =
    data.initial === undefined || data.initial === null
      ? null
      : readCells(data.initial, 'data.initial', size, n, encoding, file);

  let history = new History();
  const h = data.history;
  if (isObj(h)) {
    let hj: unknown = h;
    if (typeof h.file === 'string') {
      const bytes = file(h.file);
      req(bytes !== undefined, `Datei „${h.file}“ fehlt im Archiv`, 'data.history');
      hj = parseJson(decodeText(bytes!));
    }
    req(isObj(hj) && Array.isArray(hj.generations) && Array.isArray(hj.counts), '{ generations, counts } erwartet', 'data.history');
    const hh = hj as { generations: unknown[]; counts: unknown[] };
    req(hh.generations.length === hh.counts.length, 'generations und counts sind unterschiedlich lang', 'data.history');
    history = History.fromJSON({
      generations: hh.generations.map((g, i) => int(g, `data.history.generations[${i}]`, 0, Number.MAX_SAFE_INTEGER)),
      counts: hh.counts.map((c, i) => {
        req(Array.isArray(c), 'Liste erwartet', `data.history.counts[${i}]`);
        return (c as unknown[]).map((v) => (typeof v === 'number' ? v : 0));
      }),
    });
  }

  let probes: Probe[] = [];
  if (j.probes !== undefined) {
    req(Array.isArray(j.probes), 'Liste erwartet', 'probes');
    probes = (j.probes as unknown[]).map((q, i) => {
      const path = `probes[${i}]`;
      req(isObj(q), 'Objekt erwartet', path);
      const o = q as Record<string, unknown>;
      return {
        name: str(o.name, `${path}.name`),
        x: int(o.x, `${path}.x`, 0, width - 1),
        y: int(o.y, `${path}.y`, 0, height - 1),
      };
    });
  }

  let probeLog = new ProbeLog();
  const ph = data.probeHistory;
  if (isObj(ph) && probes.length > 0) {
    let pj: unknown = ph;
    if (typeof ph.file === 'string') {
      const bytes = file(ph.file);
      req(bytes !== undefined, `Datei „${ph.file}“ fehlt im Archiv`, 'data.probeHistory');
      pj = parseJson(decodeText(bytes!));
    }
    req(isObj(pj) && Array.isArray(pj.generations) && Array.isArray(pj.series), '{ generations, series } erwartet', 'data.probeHistory');
    const pp = pj as { generations: unknown[]; series: unknown[] };
    req(pp.series.length === probes.length, 'series passt nicht zur Zahl der Messpunkte', 'data.probeHistory');
    probeLog = ProbeLog.fromJSON({
      generations: pp.generations.map((g, i) => int(g, `data.probeHistory.generations[${i}]`, 0, Number.MAX_SAFE_INTEGER)),
      series: pp.series.map((s, k) => {
        req(Array.isArray(s), 'Liste erwartet', `data.probeHistory.series[${k}]`);
        return (s as unknown[]).map((v) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) < n ? (v as number) : -1));
      }),
    });
  }
  while (probeLog.series.length < probes.length) probeLog.addSeries();

  const now = new Date().toISOString();
  const speedUnit = sim.speedUnit === 'spg' ? 'spg' : 'gps';
  return {
    meta: {
      name: str(meta.name, 'meta.name'),
      description: str(meta.description, 'meta.description', ''),
      author: str(meta.author, 'meta.author', ''),
      createdAt: str(meta.createdAt, 'meta.createdAt', now),
      modifiedAt: str(meta.modifiedAt, 'meta.modifiedAt', now),
      ...(typeof meta.template === 'string' ? { template: meta.template } : {}),
    },
    model,
    width,
    height,
    settings: {
      seed: sim.seed === undefined ? 1 : int(sim.seed, 'simulation.seed', 0, 0xffffffff),
      speed: sim.speed === undefined ? 8 : num(sim.speed, 'simulation.speed', 0.01, 1000),
      speedUnit,
      stopAtGeneration:
        sim.stopAtGeneration === undefined || sim.stopAtGeneration === null
          ? null
          : int(sim.stopAtGeneration, 'simulation.stopAtGeneration', 1, Number.MAX_SAFE_INTEGER),
      stopWhenStable: sim.stopWhenStable === true,
    },
    view: {
      cellSize: view.cellSize === undefined ? 10 : num(view.cellSize, 'view.cellSize', 1, 100),
      showGridLines: view.showGridLines !== false,
    },
    current: {
      cells,
      ages,
      generation: data.generation === undefined ? 0 : int(data.generation, 'data.generation', 0, Number.MAX_SAFE_INTEGER),
      rngState: data.rngState === undefined ? 1 : int(data.rngState, 'data.rngState', 0, 0xffffffff),
    },
    initial,
    history,
    probes,
    probeLog,
  };
}
