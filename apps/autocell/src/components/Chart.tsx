import { useEffect, useRef } from 'react';
import type { History } from '@autocell/core';

interface Props {
  history: History;
  colors: readonly string[];
  /** Gesamtzahl der Zellen (100 %). */
  total: number;
  /** Anzahl der zuletzt gezeigten Generationen (0 = alle). */
  window?: number;
  height: number;
  gridColor: string;
  frame: number;
  /** Zustände, die gezeichnet werden (Standard: alle). */
  visible?: readonly boolean[];
  label: string;
}

/** Liniendiagramm: Anteil jedes Zustands je Generation. */
export function Chart({ history, colors, total, window = 0, height, gridColor, frame, visible, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = window_dpr();
    const w = canvas.clientWidth || 300;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const y = Math.round((k / 4) * (height - 1)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    const n = history.length;
    const start = window > 0 ? Math.max(0, n - window) : 0;
    const count = n - start;
    if (count < 1 || total <= 0) return;
    const span = Math.max(1, count - 1);
    const pad = 2;
    colors.forEach((color, s) => {
      if (visible && !visible[s]) return;
      ctx.strokeStyle = visibleOnDark(color);
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const v = history.counts[start + i][s] ?? 0;
        const x = (i / span) * (w - 1);
        const y = pad + (1 - v / total) * (height - 2 * pad);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      if (count === 1) ctx.lineTo(2, pad + (1 - (history.counts[start][s] ?? 0) / total) * (height - 2 * pad));
      ctx.stroke();
    });
  }, [history, colors, total, window, height, gridColor, frame, visible]);

  return <canvas ref={ref} style={{ height, width: '100%' }} role="img" aria-label={label} />;
}

/** Sehr dunkle Zustandsfarben (z. B. „Tot“) wären auf dem dunklen Diagramm unsichtbar. */
function visibleOnDark(hex: string): string {
  const v = parseInt(hex.slice(1), 16) || 0;
  const lum = (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  return lum < 0.18 ? '#8fa596' : hex;
}

function window_dpr(): number {
  return typeof globalThis.devicePixelRatio === 'number' ? globalThis.devicePixelRatio : 1;
}
