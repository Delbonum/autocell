import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  strokeWidth?: number;
  fill?: boolean;
}

function Svg({ size = 16, strokeWidth = 1.75, fill = false, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const Icon = {
  play: (p: IconProps) => <Svg {...p} fill><path d="M7 5v14l11-7z" /></Svg>,
  pause: (p: IconProps) => <Svg {...p}><path d="M8 5v14M16 5v14" /></Svg>,
  stop: (p: IconProps) => <Svg {...p} fill><rect x="6" y="6" width="12" height="12" rx="1" /></Svg>,
  step: (p: IconProps) => <Svg {...p}><path d="M6 5v14l9-7z" /><path d="M18 5v14" /></Svg>,
  reset: (p: IconProps) => <Svg {...p}><path d="M4 12a8 8 0 1 0 2.3-5.6" /><path d="M4 4v4h4" /></Svg>,
  pen: (p: IconProps) => <Svg {...p}><path d="M4 20l4-1 11-11-3-3L5 16z" /></Svg>,
  eraser: (p: IconProps) => <Svg {...p}><path d="M9 20h11" /><path d="M5 15l9-9 5 5-8 8H8z" /></Svg>,
  dice: (p: IconProps) => (
    <Svg {...p}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <circle cx="9" cy="9" r="1" />
      <circle cx="15" cy="9" r="1" />
      <circle cx="9" cy="15" r="1" />
      <circle cx="15" cy="15" r="1" />
    </Svg>
  ),
  trash: (p: IconProps) => <Svg {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></Svg>,
  zoomIn: (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5M8.5 11h5M11 8.5v5" /></Svg>,
  zoomOut: (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="6" /><path d="M20 20l-4.5-4.5M8.5 11h5" /></Svg>,
  plus: (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>,
  minus: (p: IconProps) => <Svg {...p}><path d="M5 12h14" /></Svg>,
  camera: (p: IconProps) => <Svg {...p}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></Svg>,
  chart: (p: IconProps) => <Svg {...p}><path d="M4 4v16h16" /><path d="M8 15l4-5 3 3 5-7" /></Svg>,
  bars: (p: IconProps) => <Svg {...p}><path d="M5 20V12M10 20V8M15 20v-6M20 20V5M3 20h18" /></Svg>,
  file: (p: IconProps) => <Svg {...p}><path d="M6 3h8l4 4v14H6z" /></Svg>,
  folder: (p: IconProps) => <Svg {...p}><path d="M3 6h7l2 2h9v11H3z" /></Svg>,
  close: (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>,
  square: (p: IconProps) => <Svg {...p}><rect x="5" y="5" width="14" height="14" /></Svg>,
  restore: (p: IconProps) => <Svg {...p}><rect x="4" y="9" width="11" height="11" /><path d="M9 9V4h11v11h-5" /></Svg>,
  up: (p: IconProps) => <Svg {...p}><path d="M6 15l6-6 6 6" /></Svg>,
  down: (p: IconProps) => <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>,
  chevronRight: (p: IconProps) => <Svg {...p}><path d="M9 6l6 6-6 6" /></Svg>,
  check: (p: IconProps) => <Svg {...p}><path d="M5 12l5 5 9-10" /></Svg>,
};

/** Runde Symbole aus dem ursprünglichen Entwurf (Werkzeugleiste im Retro-Modus). */
export const RetroGlyph = {
  plus: () => <Svg size={20} strokeWidth={2.5}><path d="M12 5v14M5 12h14" /></Svg>,
  minus: () => <Svg size={20} strokeWidth={2.5}><path d="M5 12h14" /></Svg>,
  play: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 4l14 8-14 8 4-8z" fill="currentColor" />
    </svg>
  ),
  pause: () => <Svg size={18} strokeWidth={3.5}><path d="M8 5v14M16 5v14" /></Svg>,
  stop: () => <Svg size={16} fill><rect x="5" y="5" width="14" height="14" /></Svg>,
  camera: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8h4l2-3h6l2 3h4v11H3z" fill="currentColor" />
      <circle cx="12" cy="13" r="3.6" fill="#c0c0c0" />
      <circle cx="12" cy="13" r="2" fill="currentColor" />
    </svg>
  ),
  chart: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V14h3v6zM9 20V11h3v9zM14 20v-7h3v7zM19 20V9h2v11z" fill="currentColor" />
      <path d="M4 12l5-4 4 3 7-6" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  ),
};
