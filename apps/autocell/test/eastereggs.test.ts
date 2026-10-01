import { describe, expect, it } from 'vitest';
import { createSnake, tick, turn } from '../src/eastereggs/snake';
import {
  BOARD_H,
  BOARD_W,
  collides,
  createTetris,
  hardDrop,
  move,
  pieceCells,
  rotate,
  type TetrisState,
} from '../src/eastereggs/tetris';
import { easterEggForText, KONAMI_CODE, SequenceDetector } from '../src/eastereggs/triggers';

describe('Auslöser', () => {
  it('erkennt „HALLO KLAUS“ tolerant', () => {
    expect(easterEggForText('HALLO KLAUS')).toBe('tetris');
    expect(easterEggForText('﻿  hallo   klaus\r\n')).toBe('tetris');
    expect(easterEggForText('HALLO KLAUS!')).toBeNull();
    expect(easterEggForText('HALLO KLAUSI')).toBeNull();
  });

  it('erkennt den Konami-Code, auch nach Fehlversuchen', () => {
    const d = new SequenceDetector(KONAMI_CODE);
    const typed = ['ArrowUp', 'ArrowUp', 'ArrowUp', ...KONAMI_CODE.slice(2, 9), 'A'];
    const results = typed.map((k) => d.push(k));
    expect(results.at(-1)).toBe(true);
    expect(results.slice(0, -1).every((r) => !r)).toBe(true);
    expect(d.push('x')).toBe(false);
  });
});

describe('Tetris', () => {
  it('dreht Steine viermal zurück in die Ausgangslage', () => {
    for (const t of ['I', 'T', 'L'] as const) {
      expect(pieceCells(t, 4)).toEqual(pieceCells(t, 0));
      expect(pieceCells(t, 1)).not.toEqual(pieceCells(t, 0));
    }
  });

  it('hält Steine innerhalb des Spielfelds', () => {
    let s = createTetris(1);
    for (let i = 0; i < 20; i++) s = move(s, -1);
    expect(collides(s.board, s.piece)).toBe(false);
    expect(Math.min(...pieceCells(s.piece.type, s.piece.rot).map(([x]) => x + s.piece.x))).toBe(0);
  });

  it('löscht volle Zeilen und zählt Punkte', () => {
    let s: TetrisState = createTetris(3);
    const board = new Array(BOARD_W * BOARD_H).fill(0);
    // Unterste Zeile bis auf die Spalten 4–7 füllen
    for (let x = 0; x < BOARD_W; x++) if (x < 4 || x > 7) board[(BOARD_H - 1) * BOARD_W + x] = 1;
    s = { ...s, board, piece: { type: 'I', rot: 0, x: 4, y: 0 } };
    s = hardDrop(s);
    expect(s.lines).toBe(1);
    expect(s.board.slice((BOARD_H - 1) * BOARD_W).every((v) => v === 0)).toBe(true);
    expect(s.score).toBeGreaterThanOrEqual(100);
  });

  it('endet, wenn kein neuer Stein mehr Platz hat', () => {
    let s = createTetris(5);
    for (let i = 0; i < 60 && !s.over; i++) s = hardDrop(rotate(s));
    expect(s.over).toBe(true);
  });
});

describe('Snake', () => {
  it('läuft, wächst beim Fressen und verbietet Kehrtwenden', () => {
    let s = createSnake(10, 5, false, 1);
    s = { ...s, food: { x: s.body[0].x + 1, y: s.body[0].y } };
    s = turn(s, 'left'); // Kehrtwende wird ignoriert
    s = tick(s);
    expect(s.score).toBe(1);
    expect(s.body).toHaveLength(4);
    expect(s.dir).toBe('right');
  });

  it('stirbt an der Wand, außer der Rand ist ein Torus', () => {
    let wall = createSnake(6, 3, false, 2);
    let torus = createSnake(6, 3, true, 2);
    for (let i = 0; i < 6; i++) {
      wall = tick({ ...wall, food: null });
      torus = tick({ ...torus, food: null });
    }
    expect(wall.over).toBe(true);
    expect(torus.over).toBe(false);
  });

  it('stirbt, wenn sie sich selbst beißt', () => {
    let s = createSnake(10, 10, false, 3);
    s = { ...s, body: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 }], dir: 'right', food: null };
    s = turn(s, 'down');
    s = tick(s);
    expect(s.over).toBe(true);
  });
});
