/**
 * Spiellogik für das Tetris-Easter-Egg (ohne Darstellung, daher testbar).
 * Alle Funktionen erzeugen einen neuen Spielzustand.
 */
import { Rng } from '@autocell/core';

export type PieceType = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export const PIECES: readonly PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export const BOARD_W = 10;
export const BOARD_H = 20;

/** Grundform jedes Steins in einem N×N-Kasten. */
const BASE: Record<PieceType, { n: number; cells: Array<[number, number]> }> = {
  I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] },
};

/** Zellen eines Steins in Drehlage `rot` (0–3, im Uhrzeigersinn). */
export function pieceCells(type: PieceType, rot: number): Array<[number, number]> {
  const { n, cells } = BASE[type];
  let out = cells;
  for (let r = 0; r < ((rot % 4) + 4) % 4; r++) out = out.map(([x, y]) => [n - 1 - y, x] as [number, number]);
  return out;
}

export interface ActivePiece {
  type: PieceType;
  rot: number;
  x: number;
  y: number;
}

export interface TetrisState {
  /** 0 = leer, sonst 1 + Index in PIECES. */
  board: number[];
  piece: ActivePiece;
  next: PieceType;
  bag: PieceType[];
  rngState: number;
  score: number;
  lines: number;
  level: number;
  over: boolean;
}

const LINE_SCORES = [0, 100, 300, 500, 800];

function draw(bag: PieceType[], rng: Rng): { piece: PieceType; bag: PieceType[] } {
  let b = bag;
  if (b.length === 0) {
    // „7-Bag“: jeder Stein genau einmal pro Runde, in zufälliger Reihenfolge.
    b = [...PIECES];
    for (let i = b.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [b[i], b[j]] = [b[j], b[i]];
    }
  }
  return { piece: b[0], bag: b.slice(1) };
}

function spawn(type: PieceType): ActivePiece {
  return { type, rot: 0, x: Math.floor((BOARD_W - BASE[type].n) / 2), y: 0 };
}

export function collides(board: number[], p: ActivePiece): boolean {
  for (const [cx, cy] of pieceCells(p.type, p.rot)) {
    const x = p.x + cx;
    const y = p.y + cy;
    if (x < 0 || x >= BOARD_W || y >= BOARD_H) return true;
    if (y >= 0 && board[y * BOARD_W + x] !== 0) return true;
  }
  return false;
}

export function createTetris(seed: number): TetrisState {
  const rng = new Rng(seed);
  const a = draw([], rng);
  const b = draw(a.bag, rng);
  return {
    board: new Array(BOARD_W * BOARD_H).fill(0),
    piece: spawn(a.piece),
    next: b.piece,
    bag: b.bag,
    rngState: rng.state,
    score: 0,
    lines: 0,
    level: 0,
    over: false,
  };
}

/** Wartezeit zwischen zwei Fallschritten in Millisekunden. */
export function gravityMs(level: number): number {
  return Math.max(70, 800 - level * 70);
}

export function move(s: TetrisState, dx: number): TetrisState {
  if (s.over) return s;
  const p = { ...s.piece, x: s.piece.x + dx };
  return collides(s.board, p) ? s : { ...s, piece: p };
}

export function rotate(s: TetrisState, dir: 1 | -1 = 1): TetrisState {
  if (s.over) return s;
  const rot = (s.piece.rot + dir + 4) % 4;
  // Einfache „Wall Kicks“: seitlich ausweichen, notfalls eine Zeile nach oben.
  for (const [kx, ky] of [[0, 0], [-1, 0], [1, 0], [-2, 0], [2, 0], [0, -1]]) {
    const p = { ...s.piece, rot, x: s.piece.x + kx, y: s.piece.y + ky };
    if (!collides(s.board, p)) return { ...s, piece: p };
  }
  return s;
}

function lock(s: TetrisState, bonus: number): TetrisState {
  const board = s.board.slice();
  const id = PIECES.indexOf(s.piece.type) + 1;
  let toppedOut = false;
  for (const [cx, cy] of pieceCells(s.piece.type, s.piece.rot)) {
    const y = s.piece.y + cy;
    if (y < 0) toppedOut = true;
    else board[y * BOARD_W + s.piece.x + cx] = id;
  }
  // Volle Zeilen entfernen
  const rows: number[][] = [];
  let cleared = 0;
  for (let y = 0; y < BOARD_H; y++) {
    const row = board.slice(y * BOARD_W, (y + 1) * BOARD_W);
    if (row.every((v) => v !== 0)) cleared++;
    else rows.push(row);
  }
  const newBoard = [...new Array(cleared * BOARD_W).fill(0), ...rows.flat()];
  const lines = s.lines + cleared;
  const rng = new Rng(0);
  rng.state = s.rngState;
  const d = draw(s.bag, rng);
  const piece = spawn(s.next);
  const over = toppedOut || collides(newBoard, piece);
  return {
    ...s,
    board: newBoard,
    piece,
    next: d.piece,
    bag: d.bag,
    rngState: rng.state,
    score: s.score + bonus + LINE_SCORES[cleared] * (s.level + 1),
    lines,
    level: Math.floor(lines / 10),
    over,
  };
}

/** Ein Schritt nach unten (Schwerkraft oder ↓). Setzt den Stein ab, wenn es nicht weitergeht. */
export function softDrop(s: TetrisState, manual = false): TetrisState {
  if (s.over) return s;
  const p = { ...s.piece, y: s.piece.y + 1 };
  if (collides(s.board, p)) return lock(s, 0);
  return { ...s, piece: p, score: s.score + (manual ? 1 : 0) };
}

/** Lässt den Stein ganz nach unten fallen. */
export function hardDrop(s: TetrisState): TetrisState {
  if (s.over) return s;
  const y = ghostY(s);
  return lock({ ...s, piece: { ...s.piece, y } }, 2 * (y - s.piece.y));
}

/** Zeile, in der der Stein beim Fallenlassen landen würde (für die Vorschau). */
export function ghostY(s: TetrisState): number {
  let y = s.piece.y;
  while (!collides(s.board, { ...s.piece, y: y + 1 })) y++;
  return y;
}
