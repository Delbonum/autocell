/**
 * Auslöser der Easter Eggs. Hier zentral, damit sie leicht zu ändern sind.
 *
 * 1. Tetris: Man öffnet statt einer Projektdatei eine Textdatei, in der nur
 *    „HALLO KLAUS“ steht (Groß-/Kleinschreibung und Leerraum egal).
 * 2. Snake: Im Hauptfenster den Konami-Code tippen:
 *    ↑ ↑ ↓ ↓ ← → ← → B A
 */

export type EasterEgg = 'tetris' | 'snake';

export const TETRIS_PHRASE = 'HALLO KLAUS';

/** Prüft den Inhalt einer geöffneten Textdatei. */
export function easterEggForText(text: string): EasterEgg | null {
  const normalized = text.replace(/^﻿/, '').replace(/\s+/g, ' ').trim().toUpperCase();
  return normalized === TETRIS_PHRASE ? 'tetris' : null;
}

export const KONAMI_CODE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
] as const;

/**
 * Erkennt eine Tastenfolge. `push` gibt `true` zurück, sobald die Folge
 * vollständig eingegeben wurde.
 */
export class SequenceDetector {
  private recent: string[] = [];

  constructor(private readonly sequence: readonly string[]) {}

  push(key: string): boolean {
    this.recent.push(key.length === 1 ? key.toLowerCase() : key);
    if (this.recent.length > this.sequence.length) this.recent.shift();
    const done = this.recent.length === this.sequence.length && this.recent.every((k, i) => k === this.sequence[i]);
    if (done) this.recent = [];
    return done;
  }

  reset(): void {
    this.recent = [];
  }
}
