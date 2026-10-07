/**
 * Woher der Player sein Projekt bekommt. Rein (ohne DOM), damit testbar.
 */
import { AcpError, createProject, decodeAcp, sniffFile, TEMPLATES, type Project, type TemplateId } from '@autocell/core';

/** Vorlagen, die sich über das Attribut `template` laden lassen. */
export const PLAYER_TEMPLATES = TEMPLATES.filter((t) => t.id !== 'empty').map((t) => t.id);

export class PlayerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlayerError';
  }
}

/** Liest eine .acp-Datei (ZIP) oder deren JSON-Variante. */
export function projectFromBytes(bytes: Uint8Array): Project {
  const kind = sniffFile(bytes);
  if (kind !== 'zip' && kind !== 'json') {
    throw new PlayerError('Keine AutoCell-Projektdatei (.acp oder .json erwartet).');
  }
  try {
    return decodeAcp(bytes);
  } catch (e) {
    if (e instanceof AcpError) throw new PlayerError(e.message);
    throw e;
  }
}

/** Liest ein direkt in die Seite eingebettetes Projekt (JSON-Text). */
export function projectFromJsonText(text: string): Project {
  return projectFromBytes(new TextEncoder().encode(text));
}

function sizeAttr(v: string | null, fallback: number): number {
  const n = v === null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(3, Math.min(1000, n)) : fallback;
}

/** Erstellt ein zufällig belegtes Projekt aus einer Vorlage. */
export function projectFromTemplate(id: string, cols: string | null, rows: string | null, seed: string | null): Project {
  const t = TEMPLATES.find((x) => x.id === id && x.id !== 'empty');
  if (!t) throw new PlayerError(`Unbekannte Vorlage „${id}“. Möglich sind: ${PLAYER_TEMPLATES.join(', ')}.`);
  const s = seed === null ? NaN : parseInt(seed, 10);
  return createProject({
    name: t.name,
    model: t.model(),
    width: sizeAttr(cols, t.defaultSize.width),
    height: sizeAttr(rows, t.defaultSize.height),
    template: t.id as TemplateId,
    ...(Number.isFinite(s) ? { seed: s >>> 0 } : {}),
  });
}

/** Wert des Attributs `speed` in Generationen pro Sekunde, sonst `fallback`. */
export function parseSpeed(v: string | null, fallback: number): number {
  const n = v === null ? NaN : parseFloat(v);
  return Number.isFinite(n) && n > 0 ? Math.min(1000, Math.max(0.1, n)) : fallback;
}

/**
 * Taktgeber der Wiedergabe: rechnet vergangene Zeit in fällige Generationen
 * um. Hinkt die Wiedergabe hinterher (langsames Gerät), wird der Rückstand
 * verworfen statt aufgeholt.
 */
export class Clock {
  private acc = 0;

  constructor(public speed: number) {}

  reset(): void {
    this.acc = 0;
  }

  /** Fällige Generationen nach `elapsedMs`, höchstens `max`. */
  due(elapsedMs: number, max = 1000): number {
    this.acc += Math.max(0, Math.min(elapsedMs, 250));
    const interval = 1000 / this.speed;
    const n = Math.floor(this.acc / interval);
    this.acc -= n * interval;
    if (n > max) {
      this.acc = 0;
      return max;
    }
    return n;
  }

  /** Verwirft angefangene Zeit, z. B. wenn nicht alle fälligen Schritte geschafft wurden. */
  drop(): void {
    this.acc = 0;
  }
}
