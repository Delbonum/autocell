import type { Boundary, Neighborhood, NeighborhoodPreset, Offset } from './types';

function build(radius: number, test: (dx: number, dy: number) => boolean): Offset[] {
  const out: Offset[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if ((dx !== 0 || dy !== 0) && test(dx, dy)) out.push({ dx, dy });
    }
  }
  return out;
}

/** Offsets der vordefinierten Nachbarschaften. */
export function presetOffsets(preset: Exclude<NeighborhoodPreset, 'custom'>): Offset[] {
  switch (preset) {
    case 'moore':
      return build(1, () => true);
    case 'vonNeumann':
      return build(1, (dx, dy) => Math.abs(dx) + Math.abs(dy) <= 1);
    case 'moore2':
      return build(2, () => true);
    case 'vonNeumann2':
      return build(2, (dx, dy) => Math.abs(dx) + Math.abs(dy) <= 2);
    case 'lookahead':
      return [1, 2, 3, 4, 5].map((dx) => ({ dx, dy: 0 }));
  }
}

export function neighborhood(preset: Exclude<NeighborhoodPreset, 'custom'>, includeSelf = false): Neighborhood {
  return { preset, offsets: presetOffsets(preset), includeSelf };
}

export function customNeighborhood(offsets: Offset[], includeSelf = false): Neighborhood {
  const seen = new Set<string>();
  const clean: Offset[] = [];
  for (const o of offsets) {
    const key = `${o.dx},${o.dy}`;
    if ((o.dx === 0 && o.dy === 0) || seen.has(key)) continue;
    seen.add(key);
    clean.push({ dx: o.dx, dy: o.dy });
  }
  return { preset: detectPreset(clean), offsets: clean, includeSelf };
}

/** Erkennt, ob eine Offset-Liste einer vordefinierten Nachbarschaft entspricht. */
export function detectPreset(offsets: Offset[]): NeighborhoodPreset {
  const key = (list: Offset[]) => list.map((o) => `${o.dx},${o.dy}`).sort().join(';');
  const k = key(offsets);
  for (const p of ['moore', 'vonNeumann', 'moore2', 'vonNeumann2', 'lookahead'] as const) {
    if (key(presetOffsets(p)) === k) return p;
  }
  return 'custom';
}

/** Größte Entfernung (Chebyshev) eines Offsets. */
export function neighborhoodRadius(offsets: Offset[]): number {
  let r = 0;
  for (const o of offsets) r = Math.max(r, Math.abs(o.dx), Math.abs(o.dy));
  return r;
}

/**
 * Bildet eine Koordinate, die außerhalb des Rasters liegen kann, auf eine
 * Rasterkoordinate ab. Gibt -1 zurück, wenn sie außerhalb liegt und die
 * Randbedingung „fest“ ist.
 */
export function wrapCoord(v: number, size: number, boundary: Boundary['type']): number {
  if (v >= 0 && v < size) return v;
  if (boundary === 'torus') return ((v % size) + size) % size;
  if (boundary === 'fixed') return -1;
  // Gespiegelt: Die Randzelle sieht sich selbst als Nachbarn jenseits des Randes.
  const period = 2 * size;
  let m = ((v % period) + period) % period;
  if (m >= size) m = period - 1 - m;
  return m;
}
