/** Stile im Shadow DOM. Anpassbar über CSS-Variablen und ::part(stage|canvas|controls|legend). */
export const STYLE = `
:host {
  --autocell-bar-bg: #eef1ef;
  --autocell-bar-fg: #1d2420;
  --autocell-bar-muted: #5f6b64;
  --autocell-bar-hover: rgba(0, 0, 0, 0.08);
  --autocell-max-height: none;
  display: block;
  font: 13px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif;
  color: var(--autocell-bar-fg);
}
@media (prefers-color-scheme: dark) {
  :host {
    --autocell-bar-bg: #1d2420;
    --autocell-bar-fg: #e3ece5;
    --autocell-bar-muted: #9aa8a0;
    --autocell-bar-hover: rgba(255, 255, 255, 0.1);
  }
}
:host([hidden]) { display: none; }
[hidden] { display: none !important; }
.stage {
  position: relative;
  width: 100%;
  max-height: var(--autocell-max-height);
  display: grid;
  place-items: center;
  overflow: hidden;
}
canvas { display: block; touch-action: none; }
canvas.interactive { cursor: crosshair; }
.msg {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 16px;
  text-align: center;
  background: var(--autocell-bar-bg);
  color: var(--autocell-bar-muted);
}
.bar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: var(--autocell-bar-bg);
}
button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: inherit;
  cursor: pointer;
}
button:hover { background: var(--autocell-bar-hover); }
button:focus-visible, a:focus-visible { outline: 2px solid currentColor; outline-offset: 1px; }
.gen { margin-left: 8px; font-variant-numeric: tabular-nums; color: var(--autocell-bar-muted); }
.spacer { flex: 1; }
.brand { color: var(--autocell-bar-muted); font-size: 12px; text-decoration: none; padding: 0 4px; }
.brand:hover { text-decoration: underline; }
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  padding: 6px 10px;
  background: var(--autocell-bar-bg);
  color: var(--autocell-bar-muted);
}
.bar + .legend { padding-top: 0; }
.item { display: inline-flex; align-items: center; gap: 6px; }
.item i { width: 11px; height: 11px; border-radius: 2px; box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.4); }
.item b { font-weight: 600; color: var(--autocell-bar-fg); font-variant-numeric: tabular-nums; }
`;
