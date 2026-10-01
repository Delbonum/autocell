/**
 * Ein geöffnetes Projekt („Dokument“) samt laufender Simulation, Verlauf und
 * Rückgängig-Liste. Die Objekte werden bewusst direkt verändert (große
 * Zellarrays); die Oberfläche wird danach mit `refresh()` neu gezeichnet.
 */
import {
  captureSimulation,
  createProject,
  getTemplate,
  History,
  PatternDetector,
  randomSeed,
  Rng,
  simulationFromProject,
  type Model,
  type PatternInfo,
  type Project,
  type Simulation,
  type SimulationSnapshot,
  type TemplateId,
} from '@autocell/core';

const MAX_UNDO = 50;

interface UndoEntry {
  label: string;
  snapshot: SimulationSnapshot;
  model: Model;
  width: number;
  height: number;
  initial: Project['initial'];
}

export interface Doc {
  id: string;
  project: Project;
  sim: Simulation;
  history: History;
  detector: PatternDetector;
  pattern: PatternInfo;
  /** Dateiname, unter dem gespeichert wurde (null = noch nie gespeichert). */
  fileName: string | null;
  /** Dateihandle der File System Access API bzw. Pfad in der Desktop-App. */
  fileHandle: unknown;
  dirty: boolean;
  undo: UndoEntry[];
  redo: UndoEntry[];
}

let counter = 0;

export function createDoc(project: Project, fileName: string | null = null, fileHandle: unknown = null): Doc {
  const sim = simulationFromProject(project);
  const detector = new PatternDetector();
  detector.observe(sim.generation, sim.cells);
  if (project.history.length === 0) project.history.record(sim.generation, sim.counts);
  return {
    id: `doc-${++counter}`,
    project,
    sim,
    history: project.history,
    detector,
    pattern: { kind: 'none' },
    fileName,
    fileHandle,
    dirty: false,
    undo: [],
    redo: [],
  };
}

export function docFromTemplate(
  id: TemplateId,
  opts: { name?: string; width?: number; height?: number; fill?: 'random' | 'first'; model?: Model } = {},
): Doc {
  const t = getTemplate(id);
  const project = createProject({
    name: opts.name ?? t.name,
    model: opts.model ?? t.model(),
    width: opts.width ?? t.defaultSize.width,
    height: opts.height ?? t.defaultSize.height,
    fill: opts.fill ?? (id === 'empty' ? 'first' : 'random'),
    template: id,
  });
  const doc = createDoc(project);
  doc.dirty = true;
  return doc;
}

export function displayName(doc: Doc): string {
  return doc.fileName ?? `${doc.project.meta.name}.acp`;
}

/** Projekt mit aktuellem Simulationsstand – zum Speichern. */
export function docToProject(doc: Doc): Project {
  const p = captureSimulation(doc.project, doc.sim);
  p.history = doc.history;
  p.meta = { ...p.meta, modifiedAt: new Date().toISOString() };
  return p;
}

/* ---------- Rückgängig / Wiederherstellen ---------- */

function entry(doc: Doc, label: string): UndoEntry {
  return {
    label,
    snapshot: doc.sim.snapshot(),
    model: doc.sim.model,
    width: doc.sim.width,
    height: doc.sim.height,
    initial: doc.project.initial ? doc.project.initial.slice() : null,
  };
}

function apply(doc: Doc, e: UndoEntry): void {
  if (e.width !== doc.sim.width || e.height !== doc.sim.height) doc.sim.resize(e.width, e.height);
  doc.sim.setModel(e.model);
  doc.sim.restore(e.snapshot);
  doc.project = { ...doc.project, model: e.model, width: e.width, height: e.height, initial: e.initial };
  doc.history.truncateAfter(doc.sim.generation);
  doc.history.record(doc.sim.generation, doc.sim.counts);
  doc.detector.reset();
  doc.pattern = { kind: 'none' };
  doc.dirty = true;
}

/** Merkt sich den aktuellen Stand, bevor der Nutzer etwas verändert. */
export function pushUndo(doc: Doc, label: string): void {
  doc.undo.push(entry(doc, label));
  if (doc.undo.length > MAX_UNDO) doc.undo.shift();
  doc.redo = [];
}

export function undo(doc: Doc): string | null {
  const e = doc.undo.pop();
  if (!e) return null;
  doc.redo.push(entry(doc, e.label));
  apply(doc, e);
  return e.label;
}

export function redo(doc: Doc): string | null {
  const e = doc.redo.pop();
  if (!e) return null;
  doc.undo.push(entry(doc, e.label));
  apply(doc, e);
  return e.label;
}

/* ---------- Änderungen ---------- */

/** Nach jedem Simulationsschritt aufrufen. */
export function recordStep(doc: Doc): void {
  doc.history.record(doc.sim.generation, doc.sim.counts);
  doc.pattern = doc.detector.observe(doc.sim.generation, doc.sim.cells);
  doc.dirty = true;
}

/** Nach dem Bemalen von Zellen aufrufen. */
export function afterEdit(doc: Doc): void {
  if (doc.sim.generation === 0) doc.project.initial = doc.sim.cells.slice();
  doc.history.record(doc.sim.generation, doc.sim.counts);
  doc.detector.reset();
  doc.pattern = { kind: 'none' };
  doc.dirty = true;
}

function restartAtZero(doc: Doc): void {
  doc.sim.generation = 0;
  doc.sim.ages.fill(0);
  doc.sim.rng.state = doc.project.settings.seed;
  doc.sim.recount();
  doc.project.initial = doc.sim.cells.slice();
  doc.history.clear();
  doc.history.record(0, doc.sim.counts);
  doc.detector.reset();
  doc.detector.observe(0, doc.sim.cells);
  doc.pattern = { kind: 'none' };
  doc.dirty = true;
}

/** Zurück zum Stand von Generation 0. */
export function resetDoc(doc: Doc): boolean {
  const init = doc.project.initial;
  if (!init || init.length !== doc.sim.size) return false;
  doc.sim.cells.set(init);
  restartAtZero(doc);
  return true;
}

export function randomizeDoc(doc: Doc): void {
  const seed = randomSeed();
  doc.project.settings = { ...doc.project.settings, seed };
  doc.sim.randomize(new Rng(seed));
  restartAtZero(doc);
}

export function clearDoc(doc: Doc): void {
  doc.sim.fill(0);
  restartAtZero(doc);
}

/** Übernimmt ein geändertes Modell und ggf. eine neue Rastergröße. */
export function applyModel(doc: Doc, model: Model, width = doc.sim.width, height = doc.sim.height): void {
  const statesChanged = model.states.length !== doc.sim.model.states.length;
  if (width !== doc.sim.width || height !== doc.sim.height) {
    doc.sim.resize(width, height);
    doc.project.initial = doc.sim.generation === 0 ? doc.sim.cells.slice() : null;
  }
  doc.sim.setModel(model);
  doc.project = { ...doc.project, model, width, height };
  if (statesChanged) {
    doc.history.clear();
  }
  afterEdit(doc);
}
