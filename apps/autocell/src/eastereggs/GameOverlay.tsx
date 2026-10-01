import { useCallback, useEffect, useRef, useState } from 'react';
import { randomSeed } from '@autocell/core';
import type { Theme } from '../components/Dialog';
import { createSnake, snakeIntervalMs, tick, turn, type Dir, type SnakeState } from './snake';
import {
  BOARD_H,
  BOARD_W,
  createTetris,
  ghostY,
  gravityMs,
  hardDrop,
  move,
  pieceCells,
  PIECES,
  rotate,
  softDrop,
  type TetrisState,
} from './tetris';
import type { EasterEgg } from './triggers';

const PIECE_COLORS_MODERN = ['#4ea3ff', '#f2d24b', '#b07cff', '#7cf283', '#ff6b8b', '#5b7cff', '#ff9a3c'];
const PIECE_COLORS_RETRO = ['#00c0ff', '#ffff00', '#a000ff', '#00ff00', '#ff0000', '#0000ff', '#ff8000'];

interface Props {
  kind: EasterEgg;
  theme: Theme;
  /** Rastergröße des Projekts – Snake wird darauf gespielt. */
  gridWidth: number;
  gridHeight: number;
  wrap: boolean;
  onExit: () => void;
}

function loadHigh(kind: EasterEgg): number {
  try {
    return Number(localStorage.getItem(`autocell.highscore.${kind}`)) || 0;
  } catch {
    return 0;
  }
}

function saveHigh(kind: EasterEgg, v: number): void {
  try {
    localStorage.setItem(`autocell.highscore.${kind}`, String(v));
  } catch {
    /* Speicher nicht verfügbar – egal */
  }
}

export function GameOverlay(props: Props) {
  return props.kind === 'tetris' ? <Tetris {...props} /> : <Snake {...props} />;
}

function palette(theme: Theme) {
  return theme === 'retro'
    ? { bg: '#e0e0e0', line: '#000000', ghost: 'rgba(0,0,0,0.18)', snake: '#0000ff', head: '#000080', food: '#ff0000' }
    : { bg: '#0f1a13', line: '#1a2a20', ghost: 'rgba(255,255,255,0.12)', snake: '#7cf283', head: '#5ee36a', food: '#ff9a3c' };
}

function drawBoard(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  cs: number,
  theme: Theme,
  cellColor: (x: number, y: number) => string | null,
) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(w * cs * dpr);
  canvas.height = Math.round(h * cs * dpr);
  canvas.style.width = `${w * cs}px`;
  canvas.style.height = `${h * cs}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pal = palette(theme);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, w * cs, h * cs);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = cellColor(x, y);
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(x * cs, y * cs, cs, cs);
      }
    }
  }
  ctx.fillStyle = pal.line;
  for (let x = 0; x <= w; x++) ctx.fillRect(Math.min(x * cs, w * cs - 1), 0, 1, h * cs);
  for (let y = 0; y <= h; y++) ctx.fillRect(0, Math.min(y * cs, h * cs - 1), w * cs, 1);
}

function useKeys(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    const on = (e: KeyboardEvent) => ref.current(e);
    window.addEventListener('keydown', on, true);
    return () => window.removeEventListener('keydown', on, true);
  }, []);
}

function Side({ title, rows, message, high, children }: { title: string; rows: Array<[string, string | number]>; message: string; high: number; children?: React.ReactNode }) {
  return (
    <div className="game-side">
      <h2>{title}</h2>
      <table className="table">
        <tbody>
          {rows.map(([k, v]) => (
            <tr key={k}>
              <td style={{ fontFamily: 'inherit' }}>{k}</td>
              <td>{typeof v === 'number' ? v.toLocaleString('de-DE') : v}</td>
            </tr>
          ))}
          <tr>
            <td style={{ fontFamily: 'inherit' }}>Rekord</td>
            <td>{high.toLocaleString('de-DE')}</td>
          </tr>
        </tbody>
      </table>
      {children}
      <div className="game-msg" role="status">{message}</div>
    </div>
  );
}

/* ---------------- Tetris ---------------- */

function Tetris({ theme, onExit }: Props) {
  const [s, setS] = useState<TetrisState>(() => createTetris(randomSeed()));
  const [paused, setPaused] = useState(false);
  const [high, setHigh] = useState(() => loadHigh('tetris'));
  const canvas = useRef<HTMLCanvasElement>(null);
  const next = useRef<HTMLCanvasElement>(null);
  const colors = theme === 'retro' ? PIECE_COLORS_RETRO : PIECE_COLORS_MODERN;

  useEffect(() => {
    if (s.over || paused) return;
    const t = setTimeout(() => setS((x) => softDrop(x)), gravityMs(s.level));
    return () => clearTimeout(t);
  }, [s, paused]);

  useEffect(() => {
    if (s.over && s.score > high) {
      setHigh(s.score);
      saveHigh('tetris', s.score);
    }
  }, [s.over, s.score, high]);

  useEffect(() => {
    if (!canvas.current) return;
    const cells = new Map<string, string>();
    const gy = ghostY(s);
    const pal = palette(theme);
    if (!s.over) {
      for (const [cx, cy] of pieceCells(s.piece.type, s.piece.rot)) cells.set(`${s.piece.x + cx},${gy + cy}`, pal.ghost);
      for (const [cx, cy] of pieceCells(s.piece.type, s.piece.rot)) cells.set(`${s.piece.x + cx},${s.piece.y + cy}`, colors[PIECES.indexOf(s.piece.type)]);
    }
    drawBoard(canvas.current, BOARD_W, BOARD_H, 28, theme, (x, y) => {
      const v = s.board[y * BOARD_W + x];
      return v ? colors[v - 1] : cells.get(`${x},${y}`) ?? null;
    });
    if (next.current) {
      const nc = new Set(pieceCells(s.next, 0).map(([x, y]) => `${x},${y}`));
      drawBoard(next.current, 4, 2, 22, theme, (x, y) => (nc.has(`${x},${y}`) ? colors[PIECES.indexOf(s.next)] : null));
    }
  }, [s, theme, colors]);

  useKeys((e) => {
    const k = e.key;
    const handled = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' ', 'Escape', 'p', 'P', 'x', 'X', 'z', 'Z', 'Enter'];
    if (!handled.includes(k)) return;
    e.preventDefault();
    e.stopPropagation();
    if (k === 'Escape') return onExit();
    if (k === 'Enter' && s.over) {
      setS(createTetris(randomSeed()));
      setPaused(false);
      return;
    }
    if (k === 'p' || k === 'P') return setPaused((p) => !p);
    if (paused || s.over) return;
    if (k === 'ArrowLeft') setS((x) => move(x, -1));
    if (k === 'ArrowRight') setS((x) => move(x, 1));
    if (k === 'ArrowDown') setS((x) => softDrop(x, true));
    if (k === 'ArrowUp' || k === 'x' || k === 'X') setS((x) => rotate(x, 1));
    if (k === 'z' || k === 'Z') setS((x) => rotate(x, -1));
    if (k === ' ') setS((x) => hardDrop(x));
  });

  const message = s.over
    ? 'Spiel vorbei! Enter: neues Spiel · Esc: zurück zu AutoCell'
    : paused
      ? 'Pause – P zum Weiterspielen'
      : '← → bewegen · ↑ drehen · ↓ schneller · Leertaste fallen lassen · P Pause · Esc beenden';

  return (
    <div className="game" aria-label="Tetris">
      <canvas ref={canvas} aria-label="Tetris-Spielfeld" />
      <Side title="Hallo Klaus!" rows={[['Punkte', s.score], ['Zeilen', s.lines], ['Level', s.level + 1]]} message={message} high={high}>
        <div className="field">
          <span className="field-label">Nächster Stein</span>
          <canvas ref={next} aria-label="Nächster Stein" />
        </div>
      </Side>
    </div>
  );
}

/* ---------------- Snake ---------------- */

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

function Snake({ theme, gridWidth, gridHeight, wrap, onExit }: Props) {
  const w = Math.max(10, Math.min(60, gridWidth));
  const h = Math.max(8, Math.min(40, gridHeight));
  const make = useCallback(() => createSnake(w, h, wrap, randomSeed()), [w, h, wrap]);
  const [s, setS] = useState<SnakeState>(make);
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);
  const [high, setHigh] = useState(() => loadHigh('snake'));
  const canvas = useRef<HTMLCanvasElement>(null);
  const cs = Math.max(8, Math.min(24, Math.floor(Math.min(580 / w, 520 / h))));

  useEffect(() => {
    if (s.over || paused || !started) return;
    const t = setTimeout(() => setS((x) => tick(x)), snakeIntervalMs(s));
    return () => clearTimeout(t);
  }, [s, paused, started]);

  useEffect(() => {
    if (s.over && s.score > high) {
      setHigh(s.score);
      saveHigh('snake', s.score);
    }
  }, [s.over, s.score, high]);

  useEffect(() => {
    if (!canvas.current) return;
    const pal = palette(theme);
    const body = new Set(s.body.slice(1).map((p) => `${p.x},${p.y}`));
    const head = `${s.body[0].x},${s.body[0].y}`;
    drawBoard(canvas.current, s.width, s.height, cs, theme, (x, y) => {
      const k = `${x},${y}`;
      if (k === head) return s.over && !s.won ? pal.food : pal.head;
      if (body.has(k)) return pal.snake;
      if (s.food && s.food.x === x && s.food.y === y) return pal.food;
      return null;
    });
  }, [s, theme, cs]);

  useKeys((e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!(k in KEY_DIR) && !['Escape', 'p', 'Enter', ' '].includes(k)) return;
    e.preventDefault();
    e.stopPropagation();
    if (k === 'Escape') return onExit();
    if ((k === 'Enter' || k === ' ') && s.over) {
      setS(make());
      setStarted(false);
      setPaused(false);
      return;
    }
    if (k === 'p') return setPaused((p) => !p);
    const dir = KEY_DIR[k];
    if (dir) {
      setStarted(true);
      setS((x) => turn(x, dir));
    }
  });

  const message = s.won
    ? 'Unglaublich – das ganze Raster ist voll! Enter: neues Spiel'
    : s.over
      ? 'Autsch! Enter: neues Spiel · Esc: zurück zu AutoCell'
      : !started
        ? 'Pfeiltasten oder WASD zum Starten'
        : paused
          ? 'Pause – P zum Weiterspielen'
          : `Pfeiltasten/WASD lenken · P Pause · Esc beenden${wrap ? ' · Torus: Ränder sind offen' : ''}`;

  return (
    <div className="game" aria-label="Snake">
      <canvas ref={canvas} aria-label="Snake-Spielfeld" />
      <Side title="Snake" rows={[['Punkte', s.score], ['Länge', s.body.length], ['Raster', `${w} × ${h}`]]} message={message} high={high} />
    </div>
  );
}
