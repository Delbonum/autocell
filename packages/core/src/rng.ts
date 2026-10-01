/**
 * Kleiner, deterministischer Zufallszahlengenerator (Mulberry32).
 *
 * Der gesamte Zustand ist eine 32-Bit-Zahl. Er wird in der .acp-Datei
 * gespeichert, damit eine pausierte Simulation nach dem Laden exakt gleich
 * weiterläuft.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Aktueller interner Zustand (zum Speichern). */
  get state(): number {
    return this.s >>> 0;
  }

  set state(value: number) {
    this.s = value >>> 0;
  }

  /** Gleichverteilte Zahl im Intervall [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) | 0;
    let t = Math.imul(this.s ^ (this.s >>> 15), 1 | this.s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Ganze Zahl im Intervall [0, n). */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
}

/** Erzeugt einen zufälligen Startwert für neue Projekte. */
export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
