/**
 * Spiellogik für das Snake-Easter-Egg (ohne Darstellung, daher testbar).
 * Gespielt wird auf dem Raster des Projekts; ist dessen Rand ein Torus, kann
 * die Schlange durch die Wände gehen.
 */
import { Rng } from '@autocell/core';

export type Dir = 'up' | 'down' | 'left' | 'right';

const DELTA: Record<Dir, [number, number]> = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };

export interface Point {
  x: number;
  y: number;
}

export interface SnakeState {
  width: number;
  height: number;
  /** Kopf zuerst. */
  body: Point[];
  dir: Dir;
  /** Noch nicht ausgeführte Richtungswechsel (höchstens 2, damit schnelle Eingaben nicht verloren gehen). */
  queue: Dir[];
  food: Point | null;
  wrap: boolean;
  score: number;
  over: boolean;
  won: boolean;
  rngState: number;
}

export function createSnake(width: number, height: number, wrap: boolean, seed: number): SnakeState {
  const cy = Math.floor(height / 2);
  const cx = Math.floor(width / 3);
  const body = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }].filter((p) => p.x >= 0);
  const rng = new Rng(seed);
  const s: SnakeState = { width, height, body, dir: 'right', queue: [], food: null, wrap, score: 0, over: false, won: false, rngState: 0 };
  s.food = placeFood(s, rng);
  s.rngState = rng.state;
  return s;
}

function placeFood(s: SnakeState, rng: Rng): Point | null {
  const occupied = new Set(s.body.map((p) => p.y * s.width + p.x));
  const free = s.width * s.height - occupied.size;
  if (free <= 0) return null;
  let k = rng.int(free);
  for (let i = 0; i < s.width * s.height; i++) {
    if (occupied.has(i)) continue;
    if (k-- === 0) return { x: i % s.width, y: Math.floor(i / s.width) };
  }
  return null;
}

export function turn(s: SnakeState, dir: Dir): SnakeState {
  if (s.over) return s;
  const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
  if (dir === last || dir === OPPOSITE[last] || s.queue.length >= 2) return s;
  return { ...s, queue: [...s.queue, dir] };
}

export function tick(s: SnakeState): SnakeState {
  if (s.over) return s;
  const [dir, ...queue] = s.queue.length ? s.queue : [s.dir];
  const [dx, dy] = DELTA[dir];
  let x = s.body[0].x + dx;
  let y = s.body[0].y + dy;
  if (s.wrap) {
    x = (x + s.width) % s.width;
    y = (y + s.height) % s.height;
  } else if (x < 0 || y < 0 || x >= s.width || y >= s.height) {
    return { ...s, dir, queue, over: true };
  }
  const eats = s.food !== null && s.food.x === x && s.food.y === y;
  // Das Schwanzende rückt weiter – außer die Schlange wächst gerade.
  const body = eats ? s.body : s.body.slice(0, -1);
  if (body.some((p) => p.x === x && p.y === y)) return { ...s, dir, queue, over: true };
  const next: SnakeState = { ...s, dir, queue, body: [{ x, y }, ...body] };
  if (eats) {
    const rng = new Rng(0);
    rng.state = s.rngState;
    next.score = s.score + 1;
    next.food = placeFood(next, rng);
    next.rngState = rng.state;
    if (next.food === null) {
      next.won = true;
      next.over = true;
    }
  }
  return next;
}

/** Wartezeit zwischen zwei Schritten: wird mit der Länge schneller. */
export function snakeIntervalMs(s: SnakeState): number {
  return Math.max(55, 140 - s.score * 3);
}
