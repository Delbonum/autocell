/**
 * Grundlegende Datentypen des AutoCell-Rechenkerns.
 *
 * Zustände werden über ihren Index (0, 1, 2, …) in `Model.states`
 * angesprochen. Zustand 0 ist der „Grundzustand“: Er wird beim Leeren
 * des Rasters und vom Radierer verwendet.
 */

/** Vergleichsoperatoren für Bedingungen. */
export type CompareOp = '=' | '!=' | '<' | '<=' | '>' | '>=';

export const COMPARE_OPS: readonly CompareOp[] = ['=', '!=', '<', '<=', '>', '>='];

/**
 * Eine Bedingung, die für eine Zelle geprüft wird.
 *
 * - `neighborCount`: Anzahl der Nachbarn (gemäß Nachbarschaft), deren Zustand
 *   in `states` enthalten ist, verglichen mit `value`.
 * - `neighborAt`: Zustand der Zelle an einer festen relativen Position
 *   (z. B. „die Zelle rechts von mir“), unabhängig von der Nachbarschaft.
 * - `age`: Anzahl der Generationen, die die Zelle bereits ununterbrochen in
 *   ihrem aktuellen Zustand ist.
 */
export type Condition =
  | { type: 'neighborCount'; states: number[]; op: CompareOp; value: number }
  | { type: 'neighborAt'; dx: number; dy: number; op: '=' | '!='; state: number }
  | { type: 'age'; op: CompareOp; value: number };

/**
 * Eine Übergangsregel eines Zustands. Die Regeln eines Zustands werden von
 * oben nach unten geprüft; die erste zutreffende Regel bestimmt den neuen
 * Zustand. Trifft keine zu, bleibt die Zelle unverändert.
 */
export interface Rule {
  /** Index des Zielzustands. */
  target: number;
  /** `all`: alle Bedingungen müssen erfüllt sein, `any`: mindestens eine. */
  combine: 'all' | 'any';
  /** Wahrscheinlichkeit (0…1), mit der die Regel bei erfüllten Bedingungen greift. */
  probability: number;
  /** Bedingungen. Eine leere Liste ist immer erfüllt. */
  conditions: Condition[];
  /** Deaktivierte Regeln werden übersprungen (Standard: aktiv). */
  enabled?: boolean;
  /** Freitext-Notiz des Nutzers. */
  note?: string;
}

export interface StateDef {
  name: string;
  /** Farbe als Hex-Wert `#rrggbb`. */
  color: string;
  /** Gewicht für die zufällige Anfangsbelegung (0…100, relativ). */
  initialShare: number;
  description?: string;
  rules: Rule[];
}

export interface Offset {
  dx: number;
  dy: number;
}

export type NeighborhoodPreset =
  | 'moore'
  | 'vonNeumann'
  | 'moore2'
  | 'vonNeumann2'
  | 'lookahead'
  | 'custom';

export interface Neighborhood {
  preset: NeighborhoodPreset;
  /** Relative Positionen der Nachbarn. (0, 0) ist nicht erlaubt – dafür gibt es `includeSelf`. */
  offsets: Offset[];
  /** Zählt die Zelle selbst bei `neighborCount` mit. */
  includeSelf: boolean;
}

export type Boundary =
  | { type: 'torus' }
  | { type: 'fixed'; state: number }
  | { type: 'mirror' };

export interface Model {
  states: StateDef[];
  neighborhood: Neighborhood;
  boundary: Boundary;
}

/** Speicher für Zellzustände. Bis 256 Zustände reicht `Uint8Array`. */
export type CellArray = Uint8Array | Uint16Array;

export const MAX_STATES = 65535;
export const MAX_GRID_SIZE = 4000;
