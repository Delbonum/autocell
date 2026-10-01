import { describe, expect, it } from 'vitest';
import {
  createProject,
  getTemplate,
  neighborhood,
  PatternDetector,
  Simulation,
  simulationFromProject,
  type Model,
} from '../src';

const gol = () => getTemplate('gol').model();

function fromAscii(model: Model, rows: string[]): Simulation {
  const sim = new Simulation({ model, width: rows[0].length, height: rows.length });
  rows.forEach((r, y) => [...r].forEach((ch, x) => ch !== '.' && sim.set(x, y, Number(ch === '#' ? 1 : ch))));
  return sim;
}

function toAscii(sim: Simulation): string[] {
  const out: string[] = [];
  for (let y = 0; y < sim.height; y++) {
    let line = '';
    for (let x = 0; x < sim.width; x++) {
      const s = sim.get(x, y);
      line += s === 0 ? '.' : s === 1 ? '#' : String(s);
    }
    out.push(line);
  }
  return out;
}

describe('Game of Life', () => {
  it('lässt einen Blinker oszillieren', () => {
    const sim = fromAscii(gol(), ['.....', '..#..', '..#..', '..#..', '.....']);
    sim.step();
    expect(toAscii(sim)).toEqual(['.....', '.....', '.###.', '.....', '.....']);
    sim.step();
    expect(toAscii(sim)).toEqual(['.....', '..#..', '..#..', '..#..', '.....']);
    expect(sim.generation).toBe(2);
  });

  it('bewegt einen Gleiter über den Torus-Rand und zurück', () => {
    const start = ['.#......', '..#.....', '###.....', '........', '........', '........', '........', '........'];
    const sim = fromAscii(gol(), start);
    for (let i = 0; i < 32; i++) sim.step(); // 4 Generationen = 1 Zelle diagonal, 8×8-Torus
    expect(toAscii(sim)).toEqual(start);
    expect(sim.counts).toEqual([64 - 5, 5]);
  });

  it('hält einen Block stabil und erkennt das', () => {
    const sim = fromAscii(gol(), ['....', '.##.', '.##.', '....']);
    const det = new PatternDetector();
    det.observe(sim.generation, sim.cells);
    sim.step();
    expect(sim.lastChanged).toBe(0);
    expect(det.observe(sim.generation, sim.cells)).toEqual({ kind: 'stable', since: 0 });
  });

  it('erkennt die Periode eines Blinkers', () => {
    const sim = fromAscii(gol(), ['.....', '..#..', '..#..', '..#..', '.....']);
    const det = new PatternDetector();
    det.observe(0, sim.cells);
    sim.step();
    det.observe(1, sim.cells);
    sim.step();
    expect(det.observe(2, sim.cells)).toEqual({ kind: 'periodic', period: 2, since: 0 });
    sim.step();
    expect(det.observe(3, sim.cells)).toEqual({ kind: 'periodic', period: 2, since: 0 });
  });
});

describe('Randbedingungen', () => {
  it('fester Rand verhindert das Umlaufen', () => {
    const model = { ...gol(), boundary: { type: 'fixed' as const, state: 0 } };
    // Drei Zellen am linken Rand: auf dem Torus würden Nachbarn rechts entstehen.
    const sim = fromAscii(model, ['#....', '#....', '#....']);
    sim.step();
    expect(toAscii(sim)).toEqual(['.....', '##...', '.....']);
  });

  it('fester Rand mit Zustand 1 zählt Außenzellen als lebendig', () => {
    const model = { ...gol(), boundary: { type: 'fixed' as const, state: 1 } };
    const sim = new Simulation({ model, width: 3, height: 3 });
    // Ecke (0,0) hat 5 Nachbarn außerhalb → genau 3? Nein, 5 → bleibt tot.
    // Randmitte (1,0) hat 3 Nachbarn außerhalb → wird lebendig.
    sim.step();
    expect(sim.get(1, 0)).toBe(1);
    expect(sim.get(0, 0)).toBe(0);
    expect(sim.get(1, 1)).toBe(0);
  });

  it('gespiegelter Rand: Randzelle sieht sich selbst', () => {
    const model: Model = {
      states: [
        { name: 'A', color: '#000000', initialShare: 0, rules: [{ target: 1, combine: 'all', probability: 1, conditions: [{ type: 'neighborAt', dx: -1, dy: 0, op: '=', state: 1 }] }] },
        { name: 'B', color: '#ffffff', initialShare: 0, rules: [] },
      ],
      neighborhood: neighborhood('moore'),
      boundary: { type: 'mirror' },
    };
    const sim = new Simulation({ model, width: 3, height: 1 });
    sim.set(2, 0, 1);
    sim.step();
    // (0,0) sieht links von sich sich selbst (A) → bleibt A
    expect(sim.get(0, 0)).toBe(0);
  });
});

describe('Regeln', () => {
  it('Alter-Bedingung wechselt nach N Generationen', () => {
    const model: Model = {
      states: [
        { name: 'A', color: '#000000', initialShare: 1, rules: [{ target: 1, combine: 'all', probability: 1, conditions: [{ type: 'age', op: '>=', value: 3 }] }] },
        { name: 'B', color: '#ffffff', initialShare: 0, rules: [] },
      ],
      neighborhood: neighborhood('vonNeumann'),
      boundary: { type: 'torus' },
    };
    const sim = new Simulation({ model, width: 2, height: 2 });
    sim.step(); // Alter 1
    sim.step(); // Alter 2
    sim.step(); // Alter 3
    expect(sim.counts).toEqual([4, 0]);
    sim.step(); // Alter 3 erfüllt → B
    expect(sim.counts).toEqual([0, 4]);
    expect(sim.ages[0]).toBe(0);
  });

  it('Wahrscheinlichkeit 0 greift nie, danach wird die nächste Regel geprüft', () => {
    const model: Model = {
      states: [
        {
          name: 'A',
          color: '#000000',
          initialShare: 1,
          rules: [
            { target: 1, combine: 'all', probability: 0, conditions: [] },
            { target: 2, combine: 'all', probability: 1, conditions: [] },
          ],
        },
        { name: 'B', color: '#ffffff', initialShare: 0, rules: [] },
        { name: 'C', color: '#ff0000', initialShare: 0, rules: [] },
      ],
      neighborhood: neighborhood('moore'),
      boundary: { type: 'torus' },
    };
    const sim = new Simulation({ model, width: 4, height: 4 });
    sim.step();
    expect(sim.counts).toEqual([0, 0, 16]);
  });

  it('ist bei gleichem Startwert reproduzierbar', () => {
    const p = createProject({ name: 'x', model: getTemplate('sir').model(), width: 40, height: 30, seed: 1234 });
    const a = simulationFromProject(p);
    const b = simulationFromProject(p);
    for (let i = 0; i < 50; i++) {
      a.step();
      b.step();
    }
    expect(Array.from(a.cells)).toEqual(Array.from(b.cells));
    expect(a.rng.state).toBe(b.rng.state);
  });

  it('Regel 184 erhält die Zahl der Fahrzeuge', () => {
    const p = createProject({ name: 'v', model: getTemplate('traffic').model(), width: 60, height: 5, seed: 7 });
    const sim = simulationFromProject(p);
    const cars = (c: number[]) => c[1] + c[2];
    const before = cars(sim.counts);
    for (let i = 0; i < 100; i++) sim.step();
    expect(cars(sim.counts)).toBe(before);
    expect(cars(sim.recount())).toBe(before);
  });

  it('includeSelf zählt die eigene Zelle mit', () => {
    const model: Model = {
      states: [
        { name: 'A', color: '#000000', initialShare: 0, rules: [] },
        { name: 'B', color: '#ffffff', initialShare: 0, rules: [{ target: 0, combine: 'all', probability: 1, conditions: [{ type: 'neighborCount', states: [1], op: '=', value: 1 }] }] },
      ],
      neighborhood: { ...neighborhood('moore'), includeSelf: true },
      boundary: { type: 'torus' },
    };
    const sim = new Simulation({ model, width: 5, height: 5 });
    sim.set(2, 2, 1);
    sim.step();
    expect(sim.get(2, 2)).toBe(0);
  });
});

describe('Simulation – Verwaltung', () => {
  it('resize erhält den Inhalt oben links', () => {
    const sim = fromAscii(gol(), ['#.', '.#']);
    sim.resize(3, 3);
    expect(toAscii(sim)).toEqual(['#..', '.#.', '...']);
    expect(sim.counts).toEqual([7, 2]);
  });

  it('setModel mit weniger Zuständen setzt verwaiste Zellen auf 0', () => {
    const sir = getTemplate('sir').model();
    const sim = new Simulation({ model: sir, width: 3, height: 1 });
    sim.set(0, 0, 2);
    sim.set(1, 0, 1);
    sim.setModel({ ...sir, states: sir.states.slice(0, 2) });
    expect(Array.from(sim.cells)).toEqual([0, 1, 0]);
  });

  it('wechselt bei mehr als 256 Zuständen auf 16 Bit', () => {
    const model: Model = {
      states: Array.from({ length: 300 }, (_, i) => ({ name: `S${i}`, color: '#000000', initialShare: 0, rules: [] })),
      neighborhood: neighborhood('moore'),
      boundary: { type: 'torus' },
    };
    const sim = new Simulation({ model, width: 2, height: 2 });
    expect(sim.cells).toBeInstanceOf(Uint16Array);
    sim.set(1, 1, 299);
    expect(sim.get(1, 1)).toBe(299);
  });

  it('snapshot/restore stellt Raster und Zufallszustand wieder her', () => {
    const p = createProject({ name: 'x', model: getTemplate('sir').model(), width: 20, height: 20, seed: 9 });
    const sim = simulationFromProject(p);
    const snap = sim.snapshot();
    for (let i = 0; i < 10; i++) sim.step();
    const after10 = Array.from(sim.cells);
    sim.restore(snap);
    expect(sim.generation).toBe(0);
    for (let i = 0; i < 10; i++) sim.step();
    expect(Array.from(sim.cells)).toEqual(after10);
  });
});
