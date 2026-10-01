import { useEffect, useRef } from 'react';
import type { Simulation } from '@autocell/core';

export interface GridCanvasProps {
  sim: Simulation;
  colors: readonly string[];
  cellSize: number;
  showGridLines: boolean;
  lineColor: string;
  /** Erhöht sich bei jeder Änderung – löst das Neuzeichnen aus. */
  frame: number;
  onStrokeStart: () => void;
  onPaint: (indices: number[]) => void;
  onStrokeEnd: () => void;
  onContext: (x: number, y: number, clientX: number, clientY: number) => void;
}

const MAX_CANVAS_PX = 16000;

function parseColors(colors: readonly string[]): Uint32Array {
  const out = new Uint32Array(colors.length);
  colors.forEach((c, i) => {
    const v = parseInt(c.slice(1), 16) || 0;
    const r = (v >> 16) & 255;
    const g = (v >> 8) & 255;
    const b = v & 255;
    // ImageData ist RGBA; als Uint32 in Little Endian also ABGR.
    out[i] = (255 << 24) | (b << 16) | (g << 8) | r;
  });
  return out;
}

/** Zellen auf einer Linie zwischen zwei Punkten (Bresenham), damit schnelles Ziehen keine Lücken lässt. */
function line(x0: number, y0: number, x1: number, y1: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    out.push([x0, y0]);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return out;
}

export function GridCanvas(props: GridCanvasProps) {
  const { sim, colors, cellSize, showGridLines, lineColor, frame } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bufferRef = useRef<HTMLCanvasElement | null>(null);
  const lastCell = useRef<[number, number] | null>(null);
  const cb = useRef(props);
  cb.current = props;

  const cs = Math.max(1, Math.min(cellSize, Math.floor(MAX_CANVAS_PX / Math.max(sim.width, sim.height))));
  const cssW = sim.width * cs;
  const cssH = sim.height * cs;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = sim.width;
    const H = sim.height;
    const dpr = Math.min(window.devicePixelRatio || 1, Math.max(1, MAX_CANVAS_PX / Math.max(cssW, cssH)));
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    let buffer = bufferRef.current;
    if (!buffer) buffer = bufferRef.current = document.createElement('canvas');
    if (buffer.width !== W || buffer.height !== H) {
      buffer.width = W;
      buffer.height = H;
    }
    const bctx = buffer.getContext('2d')!;
    const img = bctx.createImageData(W, H);
    const px = new Uint32Array(img.data.buffer);
    const lut = parseColors(colors);
    const cells = sim.cells;
    for (let i = 0; i < cells.length; i++) px[i] = lut[cells[i]] ?? 0xff000000;
    bctx.putImageData(img, 0, 0);

    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(buffer, 0, 0, pw, ph);
    const step = cs * dpr;
    if (showGridLines && step >= 4) {
      ctx.fillStyle = lineColor;
      const t = Math.max(1, Math.round(dpr));
      for (let x = 0; x <= W; x++) ctx.fillRect(Math.min(Math.round(x * step), pw - t), 0, t, ph);
      for (let y = 0; y <= H; y++) ctx.fillRect(0, Math.min(Math.round(y * step), ph - t), pw, t);
    }
  }, [frame, sim, sim.width, sim.height, colors, cs, cssW, cssH, showGridLines, lineColor]);

  const cellAt = (e: React.PointerEvent | React.MouseEvent): [number, number] | null => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * sim.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * sim.height);
    if (x < 0 || y < 0 || x >= sim.width || y >= sim.height) return null;
    return [x, y];
  };

  const paintTo = (c: [number, number]) => {
    const from = lastCell.current ?? c;
    const indices = line(from[0], from[1], c[0], c[1]).map(([x, y]) => y * sim.width + x);
    lastCell.current = c;
    cb.current.onPaint(indices);
  };

  return (
    <canvas
      ref={canvasRef}
      className="grid-canvas"
      style={{ width: cssW, height: cssH }}
      role="img"
      aria-label={`Zellraster ${sim.width} × ${sim.height}, Generation ${sim.generation}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const c = cellAt(e);
        if (!c) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        lastCell.current = null;
        cb.current.onStrokeStart();
        paintTo(c);
      }}
      onPointerMove={(e) => {
        if (lastCell.current === null || !(e.buttons & 1)) return;
        const c = cellAt(e);
        if (c && (c[0] !== lastCell.current[0] || c[1] !== lastCell.current[1])) paintTo(c);
      }}
      onPointerUp={() => {
        if (lastCell.current !== null) {
          lastCell.current = null;
          cb.current.onStrokeEnd();
        }
      }}
      onPointerCancel={() => {
        if (lastCell.current !== null) {
          lastCell.current = null;
          cb.current.onStrokeEnd();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        const c = cellAt(e);
        if (c) cb.current.onContext(c[0], c[1], e.clientX, e.clientY);
      }}
    />
  );
}

/** Rendert das Raster als PNG (für Schnappschüsse). */
export function renderPng(sim: Simulation, colors: readonly string[], cellSize: number): Promise<Blob | null> {
  const cs = Math.max(1, Math.min(cellSize, Math.floor(8000 / Math.max(sim.width, sim.height))));
  const buffer = document.createElement('canvas');
  buffer.width = sim.width;
  buffer.height = sim.height;
  const bctx = buffer.getContext('2d')!;
  const img = bctx.createImageData(sim.width, sim.height);
  const px = new Uint32Array(img.data.buffer);
  const lut = parseColors(colors);
  for (let i = 0; i < sim.cells.length; i++) px[i] = lut[sim.cells[i]];
  bctx.putImageData(img, 0, 0);
  const out = document.createElement('canvas');
  out.width = sim.width * cs;
  out.height = sim.height * cs;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buffer, 0, 0, out.width, out.height);
  return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
}
