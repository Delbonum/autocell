/**
 * Messpunkte: einzelne Zellen, deren Zustand über die Zeit aufgezeichnet wird.
 */

export interface Probe {
  /** Kurzer Name, z. B. „A“. */
  name: string;
  x: number;
  y: number;
}

/** Wert für Generationen, in denen ein Messpunkt noch nicht existierte. */
export const UNKNOWN = -1;

export interface ProbeSummary {
  /** Aufgezeichnete Generationen mit bekanntem Zustand. */
  observed: number;
  /** Anzahl Generationen je Zustand. */
  time: number[];
  /** Anzahl der Zustandswechsel. */
  changes: number;
  /** Längste ununterbrochene Verweildauer je Zustand (in Generationen). */
  longestRun: number[];
  /** Zustand in der letzten aufgezeichneten Generation (`UNKNOWN`, wenn keiner). */
  currentState: number;
  /** Seit wie vielen aufgezeichneten Generationen dieser Zustand besteht. */
  currentRun: number;
}

/** Sucht einen freien Namen: A, B, …, Z, dann P27, P28, … */
export function nextProbeName(probes: readonly Probe[]): string {
  const used = new Set(probes.map((p) => p.name));
  for (let i = 0; i < 26; i++) {
    const n = String.fromCharCode(65 + i);
    if (!used.has(n)) return n;
  }
  let k = 27;
  while (used.has(`P${k}`)) k++;
  return `P${k}`;
}

/** Index des Messpunkts an (x, y) oder -1. */
export function probeAt(probes: readonly Probe[], x: number, y: number): number {
  return probes.findIndex((p) => p.x === x && p.y === y);
}

/**
 * Verlauf aller Messpunkte. `series[k][i]` ist der Zustand von Messpunkt `k`
 * in Generation `generations[i]`.
 */
export class ProbeLog {
  generations: number[] = [];
  series: number[][] = [];

  constructor(public maxLength = 100_000) {}

  get length(): number {
    return this.generations.length;
  }

  /** Zeichnet eine Generation auf. `values[k]` gehört zu Messpunkt `k`. */
  record(generation: number, values: readonly number[]): void {
    while (this.series.length < values.length) this.addSeries();
    const last = this.generations.length - 1;
    if (last >= 0 && this.generations[last] === generation) {
      values.forEach((v, k) => (this.series[k][last] = v));
      return;
    }
    if (last >= 0 && generation < this.generations[last]) this.truncateAfter(generation - 1);
    this.generations.push(generation);
    this.series.forEach((s, k) => s.push(k < values.length ? values[k] : UNKNOWN));
    if (this.generations.length > this.maxLength) {
      const drop = this.generations.length - this.maxLength;
      this.generations.splice(0, drop);
      for (const s of this.series) s.splice(0, drop);
    }
  }

  /** Neuer Messpunkt: frühere Generationen sind unbekannt. */
  addSeries(): void {
    this.series.push(new Array<number>(this.generations.length).fill(UNKNOWN));
  }

  removeSeries(k: number): void {
    this.series.splice(k, 1);
  }

  truncateAfter(generation: number): void {
    let n = this.generations.length;
    while (n > 0 && this.generations[n - 1] > generation) n--;
    this.generations.length = n;
    for (const s of this.series) s.length = n;
  }

  /** Verlauf leeren, Messpunkte behalten. */
  clear(): void {
    this.generations = [];
    this.series = this.series.map(() => []);
  }

  summary(k: number, stateCount: number, window = this.length): ProbeSummary {
    const s = this.series[k] ?? [];
    const start = Math.max(0, this.length - window);
    const time = new Array<number>(stateCount).fill(0);
    const longestRun = new Array<number>(stateCount).fill(0);
    let observed = 0;
    let changes = 0;
    let prev = UNKNOWN;
    let run = 0;
    for (let i = start; i < this.length; i++) {
      const v = s[i];
      if (v === UNKNOWN || v === undefined || v >= stateCount) {
        prev = UNKNOWN;
        run = 0;
        continue;
      }
      observed++;
      time[v]++;
      if (v === prev) run++;
      else {
        if (prev !== UNKNOWN) changes++;
        run = 1;
        prev = v;
      }
      if (run > longestRun[v]) longestRun[v] = run;
    }
    return { observed, time, changes, longestRun, currentState: prev, currentRun: prev === UNKNOWN ? 0 : run };
  }

  /** CSV: eine Spalte je Messpunkt mit dem Namen des Zustands. */
  toCSV(probes: readonly Probe[], stateNames: readonly string[]): string {
    const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const head = ['Generation', ...probes.map((p) => `${p.name} (${p.x + 1}|${p.y + 1})`)];
    const lines = [head.map(esc).join(';')];
    for (let i = 0; i < this.length; i++) {
      const row = probes.map((_, k) => {
        const v = this.series[k]?.[i] ?? UNKNOWN;
        return v === UNKNOWN ? '' : esc(stateNames[v] ?? String(v));
      });
      lines.push([String(this.generations[i]), ...row].join(';'));
    }
    return lines.join('\n') + '\n';
  }

  toJSON(): { generations: number[]; series: number[][] } {
    return { generations: this.generations.slice(), series: this.series.map((s) => s.slice()) };
  }

  static fromJSON(data: { generations: number[]; series: number[][] }, maxLength?: number): ProbeLog {
    const log = new ProbeLog(maxLength);
    log.generations = data.generations.slice();
    log.series = data.series.map((s) => {
      const out = s.slice(0, log.generations.length);
      while (out.length < log.generations.length) out.push(UNKNOWN);
      return out;
    });
    return log;
  }
}

/** Aktuelle Zustände der Messpunkte. Punkte außerhalb des Rasters liefern `UNKNOWN`. */
export function probeValues(probes: readonly Probe[], sim: { width: number; height: number; cells: ArrayLike<number> }): number[] {
  return probes.map((p) =>
    p.x >= 0 && p.y >= 0 && p.x < sim.width && p.y < sim.height ? sim.cells[p.y * sim.width + p.x] : UNKNOWN,
  );
}
