import type { CellArray } from './types';

/**
 * Zeichnet für jede Generation die Anzahl der Zellen je Zustand auf.
 */
export class History {
  generations: number[] = [];
  counts: number[][] = [];

  constructor(public maxLength = 100_000) {}

  record(generation: number, counts: readonly number[]): void {
    const last = this.generations.length - 1;
    if (last >= 0 && this.generations[last] === generation) {
      // Dieselbe Generation (z. B. nach dem Bemalen) wird überschrieben.
      this.counts[last] = counts.slice();
      return;
    }
    if (last >= 0 && generation < this.generations[last]) this.truncateAfter(generation - 1);
    this.generations.push(generation);
    this.counts.push(counts.slice());
    if (this.generations.length > this.maxLength) {
      const drop = this.generations.length - this.maxLength;
      this.generations.splice(0, drop);
      this.counts.splice(0, drop);
    }
  }

  /** Entfernt alle Einträge nach `generation`. */
  truncateAfter(generation: number): void {
    let n = this.generations.length;
    while (n > 0 && this.generations[n - 1] > generation) n--;
    this.generations.length = n;
    this.counts.length = n;
  }

  clear(): void {
    this.generations = [];
    this.counts = [];
  }

  get length(): number {
    return this.generations.length;
  }

  /** Werte eines Zustands über die Zeit. */
  series(state: number): number[] {
    return this.counts.map((c) => c[state] ?? 0);
  }

  /** Kennzahlen eines Zustands im Bereich der letzten `window` Einträge. */
  summary(state: number, window = this.length): StateSummary {
    const start = Math.max(0, this.length - window);
    let min = Infinity;
    let max = -Infinity;
    let maxGeneration = 0;
    let minGeneration = 0;
    let sum = 0;
    for (let i = start; i < this.length; i++) {
      const v = this.counts[i][state] ?? 0;
      if (v < min) { min = v; minGeneration = this.generations[i]; }
      if (v > max) { max = v; maxGeneration = this.generations[i]; }
      sum += v;
    }
    const n = this.length - start;
    return n === 0
      ? { min: 0, max: 0, mean: 0, minGeneration: 0, maxGeneration: 0 }
      : { min, max, mean: sum / n, minGeneration, maxGeneration };
  }

  /** CSV mit Semikolon als Trennzeichen (öffnet sich direkt in deutschem Excel). */
  toCSV(stateNames: readonly string[]): string {
    const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [['Generation', ...stateNames].map(esc).join(';')];
    for (let i = 0; i < this.length; i++) {
      lines.push([this.generations[i], ...stateNames.map((_, k) => this.counts[i][k] ?? 0)].join(';'));
    }
    return lines.join('\n') + '\n';
  }

  toJSON(): { generations: number[]; counts: number[][] } {
    return { generations: this.generations.slice(), counts: this.counts.map((c) => c.slice()) };
  }

  static fromJSON(data: { generations: number[]; counts: number[][] }, maxLength?: number): History {
    const h = new History(maxLength);
    h.generations = data.generations.slice();
    h.counts = data.counts.map((c) => c.slice());
    return h;
  }
}

export interface StateSummary {
  min: number;
  max: number;
  mean: number;
  minGeneration: number;
  maxGeneration: number;
}

/** 64-Bit-Prüfsumme (zwei FNV-1a-Varianten) über alle Zellzustände. */
export function hashCells(cells: CellArray): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ cells.length;
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i];
    h1 = Math.imul(h1 ^ v, 0x01000193);
    h2 = Math.imul(h2 ^ (v + i * 31), 0x5bd1e995);
    h2 ^= h2 >>> 13;
  }
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export type PatternInfo =
  | { kind: 'none' }
  /** Das Raster verändert sich nicht mehr. */
  | { kind: 'stable'; since: number }
  /** Das Raster wiederholt sich mit der Periode `period`. */
  | { kind: 'periodic'; period: number; since: number };

/**
 * Erkennt stabile und periodisch wiederkehrende Rasterzustände.
 *
 * Merkt sich die Prüfsummen der letzten `window` Generationen. Taucht eine
 * Prüfsumme erneut auf, wiederholt sich das Raster.
 */
export class PatternDetector {
  private seen = new Map<string, number>();
  private order: string[] = [];
  private info: PatternInfo = { kind: 'none' };

  constructor(public window = 1000) {}

  reset(): void {
    this.seen.clear();
    this.order = [];
    this.info = { kind: 'none' };
  }

  get current(): PatternInfo {
    return this.info;
  }

  observe(generation: number, cells: CellArray): PatternInfo {
    const h = hashCells(cells);
    const prev = this.seen.get(h);
    if (prev !== undefined && prev < generation) {
      const period = generation - prev;
      const old = this.info;
      const keep =
        (old.kind === 'stable' && period === 1) || (old.kind === 'periodic' && old.period === period);
      if (!keep) {
        this.info = period === 1 ? { kind: 'stable', since: prev } : { kind: 'periodic', period, since: prev };
      }
    } else if (prev === undefined) {
      this.info = { kind: 'none' };
    }
    this.seen.set(h, generation);
    this.order.push(h);
    if (this.order.length > this.window) {
      const old = this.order.shift()!;
      if (this.seen.get(old) !== undefined && !this.order.includes(old)) this.seen.delete(old);
    }
    return this.info;
  }
}
