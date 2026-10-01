import { neighborhoodRadius, wrapCoord } from './neighborhood';
import { Rng } from './rng';
import type { Boundary, CellArray, CompareOp, Model } from './types';

const MAX_AGE = 0xffffffff;

const OP_CODE: Record<CompareOp, number> = { '=': 0, '!=': 1, '<': 2, '<=': 3, '>': 4, '>=': 5 };

function compare(a: number, op: number, b: number): boolean {
  switch (op) {
    case 0: return a === b;
    case 1: return a !== b;
    case 2: return a < b;
    case 3: return a <= b;
    case 4: return a > b;
    default: return a >= b;
  }
}

interface CompiledCondition {
  /** 0 = neighborCount, 1 = neighborAt, 2 = age */
  kind: 0 | 1 | 2;
  op: number;
  value: number;
  states: number[];
  dx: number;
  dy: number;
}

interface CompiledRule {
  target: number;
  any: boolean;
  probability: number;
  conditions: CompiledCondition[];
}

interface CompiledModel {
  rules: CompiledRule[][];
  needsCount: boolean[];
  deltas: Int32Array;
  radius: number;
  fixedState: number;
}

/** Erzeugt ein passendes Zellarray für die angegebene Zahl von Zuständen. */
export function createCellArray(stateCount: number, size: number): CellArray {
  return stateCount <= 256 ? new Uint8Array(size) : new Uint16Array(size);
}

export interface SimulationInit {
  model: Model;
  width: number;
  height: number;
  cells?: CellArray;
  ages?: Uint32Array;
  generation?: number;
  /** Startwert des Zufallsgenerators (wird ignoriert, wenn `rngState` gesetzt ist). */
  seed?: number;
  /** Gespeicherter Zustand des Zufallsgenerators. */
  rngState?: number;
}

export interface SimulationSnapshot {
  cells: CellArray;
  ages: Uint32Array;
  generation: number;
  rngState: number;
}

/**
 * Führt einen zellulären Automaten auf einem rechteckigen Raster aus.
 *
 * Alle Zellen werden synchron aktualisiert: Jede Zelle sieht beim Prüfen der
 * Regeln ausschließlich die Zustände der vorherigen Generation.
 */
export class Simulation {
  width: number;
  height: number;
  generation: number;
  cells: CellArray;
  ages: Uint32Array;
  readonly rng: Rng;
  /** Anzahl der Zellen je Zustand (wird laufend aktualisiert). */
  counts: number[];
  /** Zahl der Zellen, die sich im letzten Schritt verändert haben. */
  lastChanged = 0;

  private _model!: Model;
  private compiled!: CompiledModel;
  private next: CellArray;
  private nextAges: Uint32Array;
  private hist: Int32Array = new Int32Array(1);
  private touched: Int32Array = new Int32Array(1);

  constructor(init: SimulationInit) {
    this.width = init.width;
    this.height = init.height;
    const n = this.width * this.height;
    const stateCount = init.model.states.length;
    this.cells = init.cells ? init.cells : createCellArray(stateCount, n);
    if (this.cells.length !== n) throw new Error(`Zellarray hat ${this.cells.length} statt ${n} Einträge.`);
    this.ages = init.ages && init.ages.length === n ? init.ages : new Uint32Array(n);
    this.next = createCellArray(stateCount, n);
    this.nextAges = new Uint32Array(n);
    this.generation = init.generation ?? 0;
    this.rng = new Rng(init.seed ?? 1);
    if (init.rngState !== undefined) this.rng.state = init.rngState;
    this.counts = [];
    this.setModel(init.model);
  }

  get model(): Model {
    return this._model;
  }

  get size(): number {
    return this.width * this.height;
  }

  /**
   * Übernimmt ein geändertes Modell (Zustände, Regeln, Nachbarschaft, Rand).
   * Zellen in nicht mehr vorhandenen Zuständen werden auf Zustand 0 gesetzt.
   */
  setModel(model: Model): void {
    const stateCount = model.states.length;
    if (stateCount < 1) throw new Error('Ein Modell braucht mindestens einen Zustand.');
    const needsWide = stateCount > 256;
    if (needsWide && this.cells instanceof Uint8Array) {
      this.cells = Uint16Array.from(this.cells);
      this.next = new Uint16Array(this.size);
    } else if (!needsWide && this.cells instanceof Uint16Array) {
      this.cells = Uint8Array.from(this.cells, (v) => (v < stateCount ? v : 0));
      this.next = new Uint8Array(this.size);
    }
    for (let i = 0; i < this.cells.length; i++) {
      if (this.cells[i] >= stateCount) {
        this.cells[i] = 0;
        this.ages[i] = 0;
      }
    }
    this._model = model;
    this.compiled = this.compile(model);
    this.hist = new Int32Array(stateCount);
    this.touched = new Int32Array(model.neighborhood.offsets.length + 1);
    this.recount();
  }

  private compile(model: Model): CompiledModel {
    const stateCount = model.states.length;
    const valid = (s: number) => Number.isInteger(s) && s >= 0 && s < stateCount;
    const rules = model.states.map((st) =>
      st.rules
        .filter((r) => r.enabled !== false && valid(r.target))
        .map<CompiledRule>((r) => ({
          target: r.target,
          any: r.combine === 'any',
          probability: Math.max(0, Math.min(1, r.probability)),
          conditions: r.conditions.map<CompiledCondition>((c) => {
            if (c.type === 'neighborCount') {
              return { kind: 0, op: OP_CODE[c.op], value: c.value, states: c.states.filter(valid), dx: 0, dy: 0 };
            }
            if (c.type === 'neighborAt') {
              return { kind: 1, op: OP_CODE[c.op], value: c.state, states: [], dx: c.dx, dy: c.dy };
            }
            return { kind: 2, op: OP_CODE[c.op], value: c.value, states: [], dx: 0, dy: 0 };
          }),
        })),
    );
    const needsCount = rules.map((list) => list.some((r) => r.conditions.some((c) => c.kind === 0)));
    const offsets = model.neighborhood.offsets;
    const deltas = new Int32Array(offsets.length);
    offsets.forEach((o, k) => (deltas[k] = o.dy * this.width + o.dx));
    const b: Boundary = model.boundary;
    const fixedState = b.type === 'fixed' && valid(b.state) ? b.state : 0;
    return { rules, needsCount, deltas, radius: neighborhoodRadius(offsets), fixedState };
  }

  /** Index der Zelle (x, y) unter Berücksichtigung der Randbedingung, -1 bei festem Rand. */
  resolve(x: number, y: number): number {
    const b = this._model.boundary.type;
    const wx = wrapCoord(x, this.width, b);
    const wy = wrapCoord(y, this.height, b);
    if (wx < 0 || wy < 0) return -1;
    return wy * this.width + wx;
  }

  /** Zustand an (x, y), auch außerhalb des Rasters gemäß Randbedingung. */
  stateAt(x: number, y: number): number {
    const j = this.resolve(x, y);
    return j < 0 ? this.compiled.fixedState : this.cells[j];
  }

  get(x: number, y: number): number {
    return this.cells[y * this.width + x];
  }

  /** Setzt eine Zelle. Gibt `true` zurück, wenn sich der Zustand geändert hat. */
  set(x: number, y: number, state: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.setIndex(y * this.width + x, state);
  }

  setIndex(i: number, state: number): boolean {
    if (state < 0 || state >= this._model.states.length) throw new RangeError(`Unbekannter Zustand ${state}.`);
    const old = this.cells[i];
    if (old === state) return false;
    this.cells[i] = state;
    this.ages[i] = 0;
    this.counts[old]--;
    this.counts[state]++;
    return true;
  }

  /** Berechnet die nächste Generation. Gibt die Zahl veränderter Zellen zurück. */
  step(): number {
    const W = this.width;
    const H = this.height;
    const cells = this.cells;
    const ages = this.ages;
    const next = this.next;
    const nextAges = this.nextAges;
    const { rules, needsCount, deltas, radius, fixedState } = this.compiled;
    const offsets = this._model.neighborhood.offsets;
    const includeSelf = this._model.neighborhood.includeSelf;
    const K = offsets.length;
    const hist = this.hist;
    const touched = this.touched;
    const rng = this.rng;
    const counts = new Array<number>(this._model.states.length).fill(0);
    let changed = 0;

    for (let y = 0; y < H; y++) {
      const innerY = y >= radius && y < H - radius;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const s = cells[i];
        const list = rules[s];
        let to = s;
        if (list.length > 0) {
          const interior = innerY && x >= radius && x < W - radius;
          let nTouched = 0;
          if (needsCount[s]) {
            for (let k = 0; k < K; k++) {
              const j = interior ? i + deltas[k] : this.resolve(x + offsets[k].dx, y + offsets[k].dy);
              const ns = j < 0 ? fixedState : cells[j];
              hist[ns]++;
              touched[nTouched++] = ns;
            }
            if (includeSelf) {
              hist[s]++;
              touched[nTouched++] = s;
            }
          }
          for (let r = 0; r < list.length; r++) {
            const rule = list[r];
            const conds = rule.conditions;
            let ok = conds.length === 0 || !rule.any;
            for (let c = 0; c < conds.length; c++) {
              const cond = conds[c];
              let hit: boolean;
              if (cond.kind === 0) {
                let sum = 0;
                for (let q = 0; q < cond.states.length; q++) sum += hist[cond.states[q]];
                hit = compare(sum, cond.op, cond.value);
              } else if (cond.kind === 1) {
                const ns = this.stateAt(x + cond.dx, y + cond.dy);
                hit = cond.op === 0 ? ns === cond.value : ns !== cond.value;
              } else {
                hit = compare(ages[i], cond.op, cond.value);
              }
              if (rule.any) {
                if (hit) { ok = true; break; }
              } else if (!hit) {
                ok = false;
                break;
              }
            }
            // Greift eine Regel wegen ihrer Wahrscheinlichkeit nicht, wird die nächste geprüft.
            if (ok && (rule.probability >= 1 || rng.next() < rule.probability)) {
              to = rule.target;
              break;
            }
          }
          for (let t = 0; t < nTouched; t++) hist[touched[t]] = 0;
        }
        next[i] = to;
        if (to === s) {
          const a = ages[i];
          nextAges[i] = a < MAX_AGE ? a + 1 : a;
        } else {
          nextAges[i] = 0;
          changed++;
        }
        counts[to]++;
      }
    }

    this.next = cells;
    this.cells = next;
    this.nextAges = ages;
    this.ages = nextAges;
    this.counts = counts;
    this.generation++;
    this.lastChanged = changed;
    return changed;
  }

  /** Zählt die Zellen je Zustand neu. */
  recount(): number[] {
    const counts = new Array<number>(this._model.states.length).fill(0);
    for (let i = 0; i < this.cells.length; i++) counts[this.cells[i]]++;
    this.counts = counts;
    return counts;
  }

  /** Setzt alle Zellen auf einen Zustand. */
  fill(state = 0): void {
    this.cells.fill(state);
    this.ages.fill(0);
    this.recount();
  }

  /**
   * Belegt das Raster zufällig gemäß den Startanteilen (`initialShare`) der
   * Zustände. Sind alle Anteile 0, wird alles auf Zustand 0 gesetzt.
   */
  randomize(rng: Rng = this.rng): void {
    const shares = this._model.states.map((s) => Math.max(0, s.initialShare || 0));
    const total = shares.reduce((a, b) => a + b, 0);
    if (total <= 0) {
      this.fill(0);
      return;
    }
    const cumulative: number[] = [];
    let acc = 0;
    for (const s of shares) cumulative.push((acc += s / total));
    for (let i = 0; i < this.cells.length; i++) {
      const v = rng.next();
      let s = 0;
      while (s < cumulative.length - 1 && v >= cumulative[s]) s++;
      this.cells[i] = s;
    }
    this.ages.fill(0);
    this.recount();
  }

  /**
   * Ändert die Rastergröße. Der Inhalt bleibt oben links erhalten, neue Zellen
   * erhalten `fillState`.
   */
  resize(width: number, height: number, fillState = 0): void {
    const n = width * height;
    const cells = createCellArray(this._model.states.length, n);
    const ages = new Uint32Array(n);
    if (fillState) cells.fill(fillState);
    for (let y = 0; y < Math.min(height, this.height); y++) {
      for (let x = 0; x < Math.min(width, this.width); x++) {
        cells[y * width + x] = this.cells[y * this.width + x];
        ages[y * width + x] = this.ages[y * this.width + x];
      }
    }
    this.width = width;
    this.height = height;
    this.cells = cells;
    this.ages = ages;
    this.next = createCellArray(this._model.states.length, n);
    this.nextAges = new Uint32Array(n);
    this.setModel(this._model);
  }

  snapshot(): SimulationSnapshot {
    return {
      cells: this.cells.slice(),
      ages: this.ages.slice(),
      generation: this.generation,
      rngState: this.rng.state,
    };
  }

  restore(s: SimulationSnapshot): void {
    if (s.cells.length !== this.size) throw new Error('Schnappschuss passt nicht zur Rastergröße.');
    this.cells.set(s.cells);
    this.ages.set(s.ages);
    this.generation = s.generation;
    this.rng.state = s.rngState;
    this.recount();
  }
}
