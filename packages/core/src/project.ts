import type { Probe, ProbeLog } from './probes';
import { randomSeed, Rng } from './rng';
import { createCellArray, Simulation } from './simulation';
import { History } from './stats';
import type { CellArray, Model } from './types';

export interface ProjectMeta {
  name: string;
  description: string;
  author: string;
  /** ISO-8601-Zeitstempel */
  createdAt: string;
  modifiedAt: string;
  /** Kennung der Vorlage, aus der das Projekt entstanden ist (z. B. `gol`). */
  template?: string;
}

export interface SimulationSettings {
  /** Startwert des Zufallsgenerators für Anfangsbelegung und Wahrscheinlichkeiten. */
  seed: number;
  /** Tempo in Generationen pro Sekunde. */
  speed: number;
  /** Anzeige des Tempos: Generationen pro Sekunde oder Sekunden pro Generation. */
  speedUnit: 'gps' | 'spg';
  /** Automatisch anhalten, sobald diese Generation erreicht ist (`null` = nie). */
  stopAtGeneration: number | null;
  /** Automatisch anhalten, wenn das Raster stabil wird oder sich periodisch wiederholt. */
  stopWhenStable: boolean;
}

export interface ViewSettings {
  /** Kantenlänge einer Zelle in Bildschirmpixeln bei 100 % Zoom. */
  cellSize: number;
  showGridLines: boolean;
}

export interface CellState {
  cells: CellArray;
  ages: Uint32Array;
  generation: number;
  rngState: number;
}

/** Ein vollständiges AutoCell-Projekt – genau das, was in einer .acp-Datei steht. */
export interface Project {
  meta: ProjectMeta;
  model: Model;
  width: number;
  height: number;
  settings: SimulationSettings;
  view: ViewSettings;
  /** Aktueller Rasterzustand. */
  current: CellState;
  /** Rasterzustand bei Generation 0 (für „Zurücksetzen“), sofern bekannt. */
  initial: CellArray | null;
  /** Aufgezeichnete Statistik. */
  history: History;
  /** Messpunkte (einzelne beobachtete Zellen). */
  probes?: Probe[];
  /** Aufgezeichneter Verlauf der Messpunkte. */
  probeLog?: ProbeLog;
}

export interface NewProjectOptions {
  name: string;
  model: Model;
  width: number;
  height: number;
  /** `random`: gemäß Startanteilen, `first`: alles Zustand 0. */
  fill?: 'random' | 'first';
  seed?: number;
  author?: string;
  description?: string;
  template?: string;
  now?: Date;
}

export function defaultSettings(seed = randomSeed()): SimulationSettings {
  return { seed, speed: 8, speedUnit: 'gps', stopAtGeneration: null, stopWhenStable: false };
}

export function defaultView(width: number, height: number): ViewSettings {
  const cellSize = Math.max(2, Math.min(20, Math.floor(720 / Math.max(width, height))));
  return { cellSize, showGridLines: cellSize >= 6 };
}

export function createProject(o: NewProjectOptions): Project {
  const now = (o.now ?? new Date()).toISOString();
  const settings = defaultSettings(o.seed);
  const sim = new Simulation({ model: o.model, width: o.width, height: o.height, seed: settings.seed });
  if (o.fill !== 'first') sim.randomize(new Rng(settings.seed));
  const project: Project = {
    meta: {
      name: o.name,
      description: o.description ?? '',
      author: o.author ?? '',
      createdAt: now,
      modifiedAt: now,
      template: o.template,
    },
    model: o.model,
    width: o.width,
    height: o.height,
    settings,
    view: defaultView(o.width, o.height),
    current: { cells: sim.cells, ages: sim.ages, generation: 0, rngState: sim.rng.state },
    initial: sim.cells.slice(),
    history: new History(),
  };
  project.history.record(0, sim.counts);
  return project;
}

/** Erzeugt eine laufende Simulation aus einem Projekt. */
export function simulationFromProject(p: Project): Simulation {
  return new Simulation({
    model: p.model,
    width: p.width,
    height: p.height,
    cells: p.current.cells.slice(),
    ages: p.current.ages.slice(),
    generation: p.current.generation,
    seed: p.settings.seed,
    rngState: p.current.rngState,
  });
}

/** Überträgt den Zustand einer Simulation zurück ins Projekt (z. B. vor dem Speichern). */
export function captureSimulation(p: Project, sim: Simulation): Project {
  return {
    ...p,
    model: sim.model,
    width: sim.width,
    height: sim.height,
    current: {
      cells: sim.cells.slice(),
      ages: sim.ages.slice(),
      generation: sim.generation,
      rngState: sim.rng.state,
    },
  };
}

/** Leeres Zellarray in passender Größe. */
export function emptyCells(model: Model, width: number, height: number): CellArray {
  return createCellArray(model.states.length, width * height);
}
