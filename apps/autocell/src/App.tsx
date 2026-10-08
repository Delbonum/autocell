import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  encodeAcp,
  getTemplate,
  neighborhood,
  toCSV,
  toRLE,
  type Model,
  type TemplateId,
} from '@autocell/core';
import {
  afterEdit,
  applyModel,
  clearDoc,
  createDoc,
  displayName,
  docFromTemplate,
  docToProject,
  pushUndo,
  randomizeDoc,
  recordStep,
  redo,
  resetDoc,
  undo,
  type Doc,
} from './app/doc';
import { baseName, interpretFile, projectFromGrid } from './app/fileActions';
import { registerOffline } from './app/offline';
import {
  closeDesktopWindow,
  downloadBlob,
  isDesktop,
  minimizeDesktopWindow,
  openFile,
  saveFile,
  setNativeTitleBar,
  toggleFullscreen,
  toggleMaximizeDesktopWindow,
} from './app/platform';
import { ContextMenu, RetroTools, TabBar, TitleBar, ICON_URL } from './components/Chrome';
import {
  ConfirmDialog,
  CreditsDialog,
  MessageDialog,
  ShortcutsDialog,
  StatsDialog,
  type Theme,
} from './components/Dialog';
import { NewProjectDialog, type NewProjectRequest } from './components/dialogs/NewProjectDialog';
import { PublishDialog } from './components/dialogs/PublishDialog';
import { RetroParamsDialog } from './components/dialogs/RetroParamsDialog';
import { SettingsDialog, type SettingsTab } from './components/dialogs/SettingsDialog';
import { GridCanvas, renderPng } from './components/GridCanvas';
import { MenuBar, type MenuDef } from './components/MenuBar';
import { LeftPanel, RightPanel, StatusBar, type PanelApi, type Tool } from './components/Panels';
import { StartScreen } from './components/StartScreen';
import { GameOverlay } from './eastereggs/GameOverlay';
import { KONAMI_CODE, SequenceDetector, type EasterEgg } from './eastereggs/triggers';
import { APP_VERSION } from './version';

type DialogState =
  | { type: 'new'; template?: TemplateId }
  | { type: 'settings'; tab: SettingsTab }
  | { type: 'retroParams' }
  | { type: 'credits' }
  | { type: 'shortcuts' }
  | { type: 'stats' }
  | { type: 'publish' }
  | { type: 'confirmQuit' }
  | { type: 'confirmClose'; docId: string }
  | { type: 'message'; title: string; text: string };

interface CtxState {
  x: number;
  y: number;
  clientX: number;
  clientY: number;
}

const ZOOM_STEPS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40];
const ACP_TYPES = [{ description: 'AutoCell-Projekt', accept: { 'application/vnd.autocell.project+zip': ['.acp'] } }];

function loadTheme(): Theme {
  try {
    return localStorage.getItem('autocell.theme') === 'retro' ? 'retro' : 'modern';
  } catch {
    return 'modern';
  }
}

export function App() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [frame, refresh] = useReducer((x: number) => x + 1, 0);
  const [running, setRunning] = useState(false);
  const [theme, setThemeState] = useState<Theme>(loadTheme);
  const [tool, setTool] = useState<Tool>('pen');
  const [brush, setBrush] = useState(1);
  const [menu, setMenu] = useState<string | null>(null);
  const [ctx, setCtx] = useState<CtxState | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [game, setGame] = useState<EasterEgg | null>(null);
  const [quit, setQuit] = useState(false);
  /** Bereitliegende neue Version der Web-App (aktivieren lädt die Seite neu). */
  const [update, setUpdate] = useState<(() => void) | null>(null);
  const toastTimer = useRef<number>(0);
  const konami = useRef(new SequenceDetector(KONAMI_CODE));

  const doc = docs.find((d) => d.id === activeId) ?? null;
  const docRef = useRef(doc);
  docRef.current = doc;

  const showToast = useCallback((text: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(text);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  }, []);

  useEffect(() => {
    void registerOffline({
      onReady: () => showToast('AutoCell ist jetzt auch offline verfügbar'),
      onUpdate: (apply) => setUpdate(() => apply),
    });
  }, [showToast]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('autocell.theme', t);
    } catch {
      /* egal */
    }
  };

  // Desktop: im Nostalgiemodus nur die Retro-Titelleiste zeigen, nicht zusätzlich die von Windows.
  useEffect(() => {
    if (isDesktop()) void setNativeTitleBar(theme !== 'retro');
  }, [theme]);

  /* ---------------- Dokumente ---------------- */

  const addDoc = useCallback((d: Doc) => {
    setDocs((list) => [...list, d]);
    setActiveId(d.id);
    setRunning(false);
    setBrush(Math.min(1, d.sim.model.states.length - 1));
    setTool('pen');
  }, []);

  const closeDoc = useCallback(
    (id: string) => {
      setDocs((list) => {
        const i = list.findIndex((d) => d.id === id);
        const rest = list.filter((d) => d.id !== id);
        if (id === activeId) setActiveId(rest[Math.max(0, i - 1)]?.id ?? null);
        return rest;
      });
      if (id === activeId) setRunning(false);
    },
    [activeId],
  );

  const requestClose = (id: string) => {
    const d = docs.find((x) => x.id === id);
    if (d?.dirty) setDialog({ type: 'confirmClose', docId: id });
    else closeDoc(id);
  };

  const selectDoc = (id: string) => {
    setRunning(false);
    setActiveId(id);
    setCtx(null);
    const d = docs.find((x) => x.id === id);
    if (d) setBrush((b) => Math.min(b, d.sim.model.states.length - 1));
  };

  const createFromRequest = (r: NewProjectRequest) => {
    const model = getTemplate(r.template).model();
    if (r.boundary !== model.boundary.type) model.boundary = r.boundary === 'fixed' ? { type: 'fixed', state: 0 } : { type: r.boundary };
    addDoc(docFromTemplate(r.template, { name: r.name, width: r.width, height: r.height, fill: r.fill, model }));
    setDialog(null);
  };

  /* ---------------- Dateien ---------------- */

  const save = async (d: Doc, saveAs = false): Promise<boolean> => {
    try {
      const bytes = encodeAcp(docToProject(d), { appVersion: APP_VERSION });
      const res = await saveFile(saveAs || !d.fileName ? `${d.project.meta.name}.acp` : d.fileName, bytes, 'application/vnd.autocell.project+zip', saveAs ? null : d.fileHandle, ACP_TYPES);
      if (!res) return false;
      d.fileName = res.name;
      d.fileHandle = res.handle;
      d.dirty = false;
      refresh();
      showToast(`${res.name} gespeichert`);
      return true;
    } catch (e) {
      setDialog({ type: 'message', title: 'Speichern fehlgeschlagen', text: (e as Error).message });
      return false;
    }
  };

  const open = async () => {
    let f;
    try {
      f = await openFile();
    } catch (e) {
      setDialog({ type: 'message', title: 'Öffnen fehlgeschlagen', text: (e as Error).message });
      return;
    }
    if (!f) return;
    const res = interpretFile(f.name, f.bytes);
    if (res.kind === 'easteregg') {
      setRunning(false);
      setGame(res.egg);
      return;
    }
    if (res.kind === 'error') {
      setDialog({ type: 'message', title: 'Datei kann nicht geöffnet werden', text: res.message });
      return;
    }
    if (res.kind === 'project') {
      const isAcp = /\.acp$/i.test(f.name);
      addDoc(createDoc(res.project, isAcp ? f.name : null, isAcp ? f.handle : null));
      return;
    }
    const d = createDoc(projectFromGrid(res.grid, baseName(f.name)));
    d.dirty = true;
    addDoc(d);
    showToast(`${res.format}-Raster mit ${res.grid.width} × ${res.grid.height} Zellen importiert`);
  };

  const exportGrid = async (format: 'csv' | 'rle') => {
    if (!doc) return;
    const g = { width: doc.sim.width, height: doc.sim.height, cells: Array.from(doc.sim.cells) };
    try {
      const text = format === 'csv' ? toCSV(g) : toRLE(g);
      await saveFile(`${doc.project.meta.name}.${format}`, text, 'text/plain');
    } catch (e) {
      setDialog({ type: 'message', title: 'Export nicht möglich', text: (e as Error).message });
    }
  };

  const exportHistory = async () => {
    if (!doc) return;
    const csv = doc.history.toCSV(doc.sim.model.states.map((s) => s.name));
    await saveFile(`${doc.project.meta.name} – Statistik.csv`, csv, 'text/csv');
  };

  const snapshot = async () => {
    if (!doc) return;
    const blob = await renderPng(doc.sim, doc.sim.model.states.map((s) => s.color), Math.max(4, doc.project.view.cellSize));
    if (!blob) return;
    downloadBlob(blob, `${doc.project.meta.name} – Generation ${doc.sim.generation}.png`);
    showToast(`Schnappschuss gespeichert · Generation ${doc.sim.generation}`);
  };

  /* ---------------- Simulation ---------------- */

  const stepOnce = () => {
    if (!doc) return;
    doc.sim.step();
    recordStep(doc);
    refresh();
  };

  useEffect(() => {
    if (!running || !doc) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      const s = doc.project.settings;
      acc += ((t - last) / 1000) * s.speed;
      last = t;
      if (acc > 1000) acc = 1000;
      let steps = Math.floor(acc);
      acc -= steps;
      let stop: string | null = null;
      const deadline = performance.now() + 14;
      let did = 0;
      while (steps-- > 0) {
        doc.sim.step();
        recordStep(doc);
        did++;
        if (s.stopAtGeneration !== null && doc.sim.generation >= s.stopAtGeneration) {
          stop = `Angehalten bei Generation ${doc.sim.generation.toLocaleString('de-DE')}`;
          break;
        }
        if (s.stopWhenStable && doc.pattern.kind !== 'none') {
          stop = doc.pattern.kind === 'stable' ? 'Angehalten: Das Raster ist stabil.' : `Angehalten: Muster mit Periode ${doc.pattern.period} erkannt.`;
          break;
        }
        if (performance.now() > deadline) {
          acc = 0;
          break;
        }
      }
      if (did) refresh();
      if (stop) {
        setRunning(false);
        showToast(stop);
      } else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, doc, showToast]);

  const togglePlay = () => {
    if (!doc) return;
    const s = doc.project.settings;
    if (!running && s.stopAtGeneration !== null && doc.sim.generation >= s.stopAtGeneration) {
      showToast(`Generation ${s.stopAtGeneration} ist bereits erreicht – Stopp-Generation erhöhen oder zurücksetzen.`);
      return;
    }
    setRunning((r) => !r);
    setCtx(null);
  };

  const editWithUndo = (label: string, fn: (d: Doc) => void) => {
    if (!doc) return;
    pushUndo(doc, label);
    fn(doc);
    refresh();
  };

  const reset = () => {
    if (!doc) return;
    setRunning(false);
    pushUndo(doc, 'Zurücksetzen');
    if (!resetDoc(doc)) showToast('Kein Ausgangszustand gespeichert.');
    refresh();
  };

  const zoomBy = (dir: 1 | -1) => {
    if (!doc) return;
    const v = doc.project.view;
    const i = ZOOM_STEPS.findIndex((z) => z >= v.cellSize);
    const next = ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, (i < 0 ? ZOOM_STEPS.length - 1 : i) + dir))];
    doc.project.view = { ...v, cellSize: next, showGridLines: v.showGridLines };
    refresh();
  };

  const setNeighborhood = (p: 'moore' | 'vonNeumann') => {
    if (!doc) return;
    const m = doc.sim.model;
    if (m.neighborhood.preset === p) return;
    editWithUndo('Nachbarschaft', (d) => applyModel(d, { ...m, neighborhood: neighborhood(p, m.neighborhood.includeSelf) }));
  };

  const applySettings = (model: Model, width: number, height: number, meta?: { name: string; description: string; author: string }) => {
    if (!doc) return;
    setRunning(false);
    pushUndo(doc, 'Projekteinstellungen');
    applyModel(doc, model, width, height);
    if (meta) doc.project.meta = { ...doc.project.meta, ...meta };
    setBrush((b) => Math.min(b, model.states.length - 1));
    refresh();
  };

  /* ---------------- Beenden ---------------- */

  const requestQuit = () => {
    setMenu(null);
    if (docs.some((d) => d.dirty)) setDialog({ type: 'confirmQuit' });
    else doQuit();
  };

  const doQuit = () => {
    setDialog(null);
    setRunning(false);
    if (isDesktop()) void closeDesktopWindow();
    setQuit(true);
  };

  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (docs.some((d) => d.dirty) && !quit) e.preventDefault();
    };
    window.addEventListener('beforeunload', before);
    return () => window.removeEventListener('beforeunload', before);
  }, [docs, quit]);

  /* ---------------- Tastatur ---------------- */

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    if (game || quit) return;
    const target = e.target as HTMLElement;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable;
    if (e.key === 'Escape') {
      if (ctx) setCtx(null);
      else if (menu) setMenu(null);
      else if (dialog) setDialog(null);
      return;
    }
    if (typing || dialog) return;
    // Easter Egg: Konami-Code startet Snake auf dem Raster.
    if (doc && konami.current.push(e.key)) {
      setRunning(false);
      setGame('snake');
      e.preventDefault();
      return;
    }
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (ctrl) {
      const handled = true;
      if (k === 'n') setDialog({ type: 'new' });
      else if (k === 'o') void open();
      else if (k === 's' && doc) void save(doc, e.shiftKey);
      else if (k === 'z' && doc) doUndo();
      else if (k === 'y' && doc) doRedo();
      else if (k === 'r' && doc) setDialog(theme === 'retro' ? { type: 'retroParams' } : { type: 'settings', tab: 'states' });
      else if ((k === '+' || k === '=') && doc) zoomBy(1);
      else if (k === '-' && doc) zoomBy(-1);
      else if (k === 'w' && doc) requestClose(doc.id);
      else return;
      if (handled) e.preventDefault();
      return;
    }
    if (!doc) return;
    if (e.key === ' ') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (!running) stepOnce();
    } else if (k === 'b') setTool('pen');
    else if (k === 'e') setTool('erase');
    else if (k === 'g') {
      doc.project.view = { ...doc.project.view, showGridLines: !doc.project.view.showGridLines };
      refresh();
    } else if (e.key === 'Delete') editWithUndo('Raster leeren', clearDoc);
    else if (/^[1-9]$/.test(e.key) && Number(e.key) - 1 < doc.sim.model.states.length) {
      setBrush(Number(e.key) - 1);
      setTool('pen');
    }
  };

  useEffect(() => {
    const on = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  const doUndo = () => {
    if (!doc) return;
    setRunning(false);
    const l = undo(doc);
    showToast(l ? `Rückgängig: ${l}` : 'Nichts rückgängig zu machen');
    refresh();
  };

  const doRedo = () => {
    if (!doc) return;
    setRunning(false);
    const l = redo(doc);
    showToast(l ? `Wiederhergestellt: ${l}` : 'Nichts wiederherzustellen');
    refresh();
  };

  /* ---------------- Menüs ---------------- */

  const openSettings = (tab: SettingsTab) => setDialog(theme === 'retro' ? { type: 'retroParams' } : { type: 'settings', tab });
  const hasDoc = !!doc;

  const menus: MenuDef[] = useMemo(() => {
    const view: MenuDef = {
      id: 'view',
      label: 'Ansicht',
      items: [
        { label: 'Vergrößern', shortcut: 'Strg++', action: () => zoomBy(1), disabled: !hasDoc },
        { label: 'Verkleinern', shortcut: 'Strg+-', action: () => zoomBy(-1), disabled: !hasDoc },
        {
          label: 'Gitterlinien',
          shortcut: 'G',
          checked: doc?.project.view.showGridLines ?? false,
          disabled: !hasDoc,
          action: () => {
            if (!doc) return;
            doc.project.view = { ...doc.project.view, showGridLines: !doc.project.view.showGridLines };
            refresh();
          },
        },
        { separator: true },
        { label: 'Nostalgiemodus (Retro)', checked: theme === 'retro', action: () => setTheme(theme === 'retro' ? 'modern' : 'retro') },
        { label: 'Vollbild', shortcut: 'F11', action: toggleFullscreen },
      ],
    };
    const help: MenuDef = {
      id: 'help',
      label: 'Hilfe',
      items:
        theme === 'retro'
          ? [{ label: 'Credits', action: () => setDialog({ type: 'credits' }) }]
          : [
              { label: 'Tastenkürzel', action: () => setDialog({ type: 'shortcuts' }) },
              { separator: true },
              { label: 'Credits', action: () => setDialog({ type: 'credits' }) },
            ],
    };
    if (theme === 'retro') {
      // Menüs wie im ursprünglichen Entwurf, ergänzt um „Neu“ und „Ansicht“.
      return [
        {
          id: 'file',
          label: 'Datei',
          items: [
            { label: 'Neu', action: () => setDialog({ type: 'new' }) },
            { label: 'Importieren', action: () => void open() },
            { label: 'Exportieren', action: () => doc && void save(doc, true), disabled: !hasDoc },
            { label: 'Drucken', action: () => window.print(), disabled: !hasDoc },
            { label: 'Publizieren', action: () => setDialog({ type: 'publish' }), disabled: !hasDoc },
            { label: 'Beenden', action: requestQuit },
          ],
        },
        {
          id: 'edit',
          label: 'Bearbeiten',
          items: [
            { label: 'Rückgängig', action: doUndo, disabled: !doc?.undo.length },
            { label: 'Wiederherstellen', action: doRedo, disabled: !doc?.redo.length },
            { label: 'Parameter einstellen', action: () => setDialog({ type: 'retroParams' }), disabled: !hasDoc },
          ],
        },
        view,
        help,
      ];
    }
    return [
      {
        id: 'file',
        label: 'Datei',
        items: [
          { label: 'Neues Projekt …', shortcut: 'Strg+N', action: () => setDialog({ type: 'new' }) },
          { label: 'Öffnen / Importieren …', shortcut: 'Strg+O', action: () => void open() },
          { label: 'Speichern', shortcut: 'Strg+S', action: () => doc && void save(doc), disabled: !hasDoc },
          { label: 'Speichern unter …', shortcut: 'Strg+Umsch+S', action: () => doc && void save(doc, true), disabled: !hasDoc },
          { separator: true },
          { label: 'Raster als CSV exportieren …', action: () => void exportGrid('csv'), disabled: !hasDoc },
          { label: 'Raster als RLE exportieren …', action: () => void exportGrid('rle'), disabled: !hasDoc },
          { label: 'Bild (PNG) exportieren', action: () => void snapshot(), disabled: !hasDoc },
          { label: 'Drucken …', shortcut: 'Strg+P', action: () => window.print(), disabled: !hasDoc },
          { label: 'Im Web veröffentlichen …', action: () => setDialog({ type: 'publish' }), disabled: !hasDoc },
          { separator: true },
          { label: 'Projekt schließen', shortcut: 'Strg+W', action: () => doc && requestClose(doc.id), disabled: !hasDoc },
          { label: 'Beenden', shortcut: 'Alt+F4', action: requestQuit },
        ],
      },
      {
        id: 'edit',
        label: 'Bearbeiten',
        items: [
          { label: doc?.undo.length ? `Rückgängig: ${doc.undo[doc.undo.length - 1].label}` : 'Rückgängig', shortcut: 'Strg+Z', action: doUndo, disabled: !doc?.undo.length },
          { label: doc?.redo.length ? `Wiederherstellen: ${doc.redo[doc.redo.length - 1].label}` : 'Wiederherstellen', shortcut: 'Strg+Y', action: doRedo, disabled: !doc?.redo.length },
          { separator: true },
          { label: 'Zufällig füllen', action: () => editWithUndo('Zufällig füllen', randomizeDoc), disabled: !hasDoc },
          { label: 'Raster leeren', shortcut: 'Entf', action: () => editWithUndo('Raster leeren', clearDoc), disabled: !hasDoc },
          { separator: true },
          { label: 'Zustände & Regeln …', shortcut: 'Strg+R', action: () => openSettings('states'), disabled: !hasDoc },
          { label: 'Nachbarschaft & Rand …', action: () => openSettings('neighborhood'), disabled: !hasDoc },
          { label: 'Projekt & Rastergröße …', action: () => openSettings('project'), disabled: !hasDoc },
        ],
      },
      {
        id: 'sim',
        label: 'Simulation',
        items: [
          { label: running ? 'Pause' : 'Start', shortcut: 'Leertaste', action: togglePlay, disabled: !hasDoc },
          { label: 'Einzelschritt', shortcut: '→', action: stepOnce, disabled: !hasDoc || running },
          { label: 'Zurücksetzen auf Generation 0', action: reset, disabled: !hasDoc },
        ],
      },
      view,
      {
        id: 'stats',
        label: 'Statistik',
        items: [
          { label: 'Statistik-Fenster …', action: () => setDialog({ type: 'stats' }), disabled: !hasDoc },
          { label: 'Verlauf als CSV exportieren …', action: () => void exportHistory(), disabled: !hasDoc },
        ],
      },
      help,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, doc, frame, running, hasDoc]);

  /* ---------------- Panels ---------------- */

  const panelApi: PanelApi | null = doc
    ? {
        doc,
        frame,
        running,
        tool,
        brush,
        setTool,
        setBrush,
        togglePlay,
        step: stepOnce,
        reset,
        randomize: () => editWithUndo('Zufällig füllen', randomizeDoc),
        clear: () => editWithUndo('Raster leeren', clearDoc),
        zoomBy,
        zoomPercent: Math.round((doc.project.view.cellSize / 10) * 100),
        toggleGridLines: () => {
          doc.project.view = { ...doc.project.view, showGridLines: !doc.project.view.showGridLines };
          refresh();
        },
        setSpeed: (gps) => {
          doc.project.settings = { ...doc.project.settings, speed: gps };
          doc.dirty = true;
          refresh();
        },
        setSpeedUnit: (u) => {
          doc.project.settings = { ...doc.project.settings, speedUnit: u };
          refresh();
        },
        setStopAt: (g) => {
          doc.project.settings = { ...doc.project.settings, stopAtGeneration: g };
          refresh();
        },
        setStopWhenStable: (b) => {
          doc.project.settings = { ...doc.project.settings, stopWhenStable: b };
          refresh();
        },
        setNeighborhood,
        snapshot: () => void snapshot(),
        openStats: () => setDialog({ type: 'stats' }),
        openSettings,
      }
    : null;

  /* ---------------- Raster ---------------- */

  const colors = useMemo(() => doc?.sim.model.states.map((s) => s.color) ?? [], [doc, frame]); // eslint-disable-line react-hooks/exhaustive-deps

  const grid = doc && (
    <div className="grid-wrap">
      {game ? null : (
        <GridCanvas
          sim={doc.sim}
          colors={colors}
          cellSize={doc.project.view.cellSize}
          showGridLines={doc.project.view.showGridLines || theme === 'retro'}
          lineColor={theme === 'retro' ? '#000000' : '#1a2a20'}
          frame={frame}
          onStrokeStart={() => {
            pushUndo(doc, 'Zellen bemalt');
            setCtx(null);
          }}
          onPaint={(indices) => {
            const v = tool === 'erase' ? 0 : Math.min(brush, doc.sim.model.states.length - 1);
            let changed = false;
            for (const i of indices) changed = doc.sim.setIndex(i, v) || changed;
            if (changed) {
              afterEdit(doc);
              refresh();
            }
          }}
          onStrokeEnd={() => {
            const top = doc.undo[doc.undo.length - 1];
            // Ein Klick ohne Änderung soll keinen Rückgängig-Schritt hinterlassen.
            if (top && top.snapshot.cells.every((v, i) => v === doc.sim.cells[i])) doc.undo.pop();
            refresh();
          }}
          onContext={(x, y, clientX, clientY) => setCtx({ x, y, clientX, clientY })}
        />
      )}
    </div>
  );

  const gameView = game && (
    <GameOverlay
      kind={game}
      theme={theme}
      gridWidth={doc?.sim.width ?? 40}
      gridHeight={doc?.sim.height ?? 30}
      wrap={doc ? doc.sim.model.boundary.type === 'torus' : true}
      onExit={() => setGame(null)}
    />
  );

  const title = doc ? `${displayName(doc)}${doc.dirty ? ' •' : ''} — AutoCell` : `AutoCell ${APP_VERSION}`;

  /* ---------------- Dialoge ---------------- */

  const closeDialog = () => setDialog(null);
  let dialogEl: React.ReactNode = null;
  if (dialog?.type === 'new') dialogEl = <NewProjectDialog initialTemplate={dialog.template} onCreate={createFromRequest} onClose={closeDialog} />;
  else if (dialog?.type === 'credits') dialogEl = <CreditsDialog onClose={closeDialog} />;
  else if (dialog?.type === 'shortcuts') dialogEl = <ShortcutsDialog onClose={closeDialog} />;
  else if (dialog?.type === 'message') dialogEl = <MessageDialog title={dialog.title} text={dialog.text} onClose={closeDialog} />;
  else if (dialog?.type === 'stats' && doc) dialogEl = <StatsDialog doc={doc} frame={frame} onClose={closeDialog} onExportCsv={() => void exportHistory()} />;
  else if (dialog?.type === 'publish' && doc) dialogEl = <PublishDialog doc={doc} onClose={closeDialog} onToast={showToast} />;
  else if (dialog?.type === 'settings' && doc)
    dialogEl = (
      <SettingsDialog
        doc={doc}
        initialTab={dialog.tab}
        onClose={closeDialog}
        onApply={(r) => applySettings(r.model, r.width, r.height, { name: r.name, description: r.description, author: r.author })}
      />
    );
  else if (dialog?.type === 'retroParams' && doc) dialogEl = <RetroParamsDialog doc={doc} onClose={closeDialog} onApply={(m, w, h) => applySettings(m, w, h)} />;
  else if (dialog?.type === 'confirmQuit')
    dialogEl =
      theme === 'retro' ? (
        <ConfirmDialog
          title="AutoCell beenden?"
          text="Sind Sie sicher, dass Sie die Anwendung „AutoCell“ beenden möchten? Nicht gespeicherte Simulationen gehen dadurch verloren."
          onClose={closeDialog}
          buttons={[
            { label: 'Speichern', onClick: async () => { for (const d of docs.filter((x) => x.dirty)) if (!(await save(d))) return; doQuit(); } },
            { label: 'Abbrechen', onClick: closeDialog },
            { label: 'Beenden', onClick: doQuit },
          ]}
        />
      ) : (
        <ConfirmDialog
          title="AutoCell beenden?"
          text={`${docs.filter((d) => d.dirty).map(displayName).join(', ')} ${docs.filter((d) => d.dirty).length === 1 ? 'enthält' : 'enthalten'} ungespeicherte Änderungen. Wenn du AutoCell jetzt beendest, gehen sie verloren.`}
          onClose={closeDialog}
          buttons={[
            { label: 'Abbrechen', onClick: closeDialog },
            { label: 'Nicht speichern', onClick: doQuit },
            { label: 'Speichern & beenden', primary: true, onClick: async () => { for (const d of docs.filter((x) => x.dirty)) if (!(await save(d))) return; doQuit(); } },
          ]}
        />
      );
  else if (dialog?.type === 'confirmClose') {
    const d = docs.find((x) => x.id === dialog.docId);
    if (d)
      dialogEl = (
        <ConfirmDialog
          title="Projekt schließen?"
          text={`„${displayName(d)}“ enthält ungespeicherte Änderungen.`}
          onClose={closeDialog}
          buttons={[
            { label: 'Abbrechen', onClick: closeDialog },
            { label: 'Nicht speichern', onClick: () => { closeDialog(); closeDoc(d.id); } },
            { label: 'Speichern', primary: true, onClick: async () => { if (await save(d)) { closeDialog(); closeDoc(d.id); } } },
          ]}
        />
      );
  }

  /* ---------------- Layout ---------------- */

  const titleBar = (
    <TitleBar
      theme={theme}
      title={title}
      menu={<MenuBar menus={menus} open={menu} onOpen={(id) => { setMenu(id); setCtx(null); }} />}
      onMinimize={isDesktop() ? () => void minimizeDesktopWindow() : undefined}
      onMaximize={isDesktop() ? () => void toggleMaximizeDesktopWindow() : toggleFullscreen}
      onClose={requestQuit}
      dragRegion={isDesktop()}
    />
  );

  if (quit) {
    return (
      <div className="app" data-theme={theme}>
        <div className="quit-screen">
          <img src={ICON_URL} alt="" />
          <p>AutoCell wurde beendet. Du kannst dieses Fenster jetzt schließen.</p>
          <button className="btn" onClick={() => setQuit(false)}>AutoCell wieder öffnen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app" data-theme={theme}>
      {titleBar}
      {theme === 'retro' ? (
        <div className="retro-body">
          <RetroTools
            doc={doc}
            running={running}
            zoomBy={zoomBy}
            togglePlay={() => !running && togglePlay()}
            pause={() => setRunning(false)}
            stop={() => {
              setRunning(false);
              if (doc && doc.sim.generation > 0) reset();
            }}
            snapshot={() => void snapshot()}
            openStats={() => setDialog({ type: 'stats' })}
            setSpeed={(v) => panelApi?.setSpeed(Math.max(0.01, Math.min(1000, v)))}
            setSpeedUnit={(u) => panelApi?.setSpeedUnit(u)}
          />
          <div className="retro-grid-area">{gameView ?? grid}</div>
        </div>
      ) : doc && panelApi ? (
        <>
          <div className="workspace">
            <LeftPanel {...panelApi} />
            <main className="center">
              <TabBar docs={docs} activeId={activeId} onSelect={selectDoc} onClose={requestClose} onNew={() => setDialog({ type: 'new' })} />
              <div className="grid-area">{gameView ?? grid}</div>
            </main>
            <RightPanel {...panelApi} />
          </div>
          <StatusBar doc={doc} running={running} zoomPercent={panelApi.zoomPercent} />
        </>
      ) : (
        <div className="workspace">
          {gameView ? (
            <div className="grid-area">{gameView}</div>
          ) : (
            <StartScreen
              onNew={() => setDialog({ type: 'new' })}
              onOpen={() => void open()}
              onTemplate={(id) => addDoc(docFromTemplate(id))}
            />
          )}
        </div>
      )}

      {ctx && doc && (
        <ContextMenu
          theme={theme}
          doc={doc}
          {...ctx}
          onClose={() => setCtx(null)}
          onSet={(s) => {
            pushUndo(doc, 'Zustand gesetzt');
            doc.sim.set(ctx.x, ctx.y, s);
            afterEdit(doc);
            setCtx(null);
            refresh();
          }}
          onBrush={(s) => {
            setBrush(s);
            setTool('pen');
            setCtx(null);
          }}
          onHistory={() => {
            const st = doc.sim.model.states[doc.sim.get(ctx.x, ctx.y)];
            const age = doc.sim.ages[ctx.y * doc.sim.width + ctx.x];
            showToast(`Zelle (${ctx.x + 1}, ${ctx.y + 1}): seit ${age.toLocaleString('de-DE')} Generationen im Zustand „${st.name}“`);
            setCtx(null);
          }}
        />
      )}
      {dialogEl}
      {toast && <div className="toast" role="status">{toast}</div>}
      {update && (
        <div className="update-banner" role="status">
          <span>Eine neue Version von AutoCell ist verfügbar.</span>
          <button className="btn btn-primary" onClick={update}>Neu laden</button>
          <button className="btn" onClick={() => setUpdate(null)}>Später</button>
        </div>
      )}
    </div>
  );
}
