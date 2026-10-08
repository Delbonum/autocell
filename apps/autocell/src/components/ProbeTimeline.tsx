import { useEffect, useRef } from 'react';
import { UNKNOWN, type ProbeLog } from '@autocell/core';

interface Props {
  log: ProbeLog;
  colors: readonly string[];
  /** Anzahl der zuletzt gezeigten Generationen (0 = alle). */
  window: number;
  rowHeight: number;
  /** Abstand zwischen den Zeilen. */
  gap: number;
  frame: number;
  label: string;
}

/**
 * Zeitleiste der Messpunkte: je Messpunkt ein Band, das für jede Generation
 * die Farbe des Zustands zeigt. Unbekannte Generationen bleiben leer.
 */
export function ProbeTimeline({ log, colors, window, rowHeight, gap, frame, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const rows = log.series.length;
  const height = Math.max(1, rows * rowHeight + Math.max(0, rows - 1) * gap);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = globalThis.devicePixelRatio || 1;
    const w = canvas.clientWidth || 300;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);
    const n = log.length;
    const start = window > 0 ? Math.max(0, n - window) : 0;
    const count = n - start;
    if (count < 1) return;
    log.series.forEach((s, k) => {
      const top = k * (rowHeight + gap);
      ctx.fillStyle = 'rgba(128, 128, 128, 0.12)';
      ctx.fillRect(0, top, w, rowHeight);
      // Gleiche Zustände hintereinander als ein Rechteck zeichnen.
      let i = 0;
      while (i < count) {
        const v = s[start + i];
        let j = i + 1;
        while (j < count && s[start + j] === v) j++;
        if (v !== UNKNOWN && colors[v]) {
          const x0 = (i / count) * w;
          const x1 = (j / count) * w;
          ctx.fillStyle = colors[v];
          ctx.fillRect(Math.floor(x0), top, Math.max(1, Math.ceil(x1) - Math.floor(x0)), rowHeight);
        }
        i = j;
      }
    });
  }, [log, colors, window, rowHeight, gap, height, frame]);

  return <canvas ref={ref} style={{ height, width: '100%', display: 'block' }} role="img" aria-label={label} />;
}
