import { describe, expect, it } from 'vitest';
import { describeRule, getTemplate, History, lintModel, parseCSV, parseRLE, toCSV, toRLE } from '../src';

describe('CSV', () => {
  it('liest verschiedene Trennzeichen und füllt kurze Zeilen auf', () => {
    const g = parseCSV('0;1;2\n1,1\n# Kommentar\n2\t0\t1\n');
    expect(g).toEqual({ width: 3, height: 3, cells: [0, 1, 2, 1, 1, 0, 2, 0, 1] });
    expect(toCSV(g)).toBe('0;1;2\n1;1;0\n2;0;1\n');
  });

  it('meldet ungültige Werte mit Zeilennummer', () => {
    expect(() => parseCSV('0;1\n0;x')).toThrow(/Zeile 2.*„x“/);
  });
});

describe('RLE', () => {
  it('liest einen Gleiter im Golly-Format', () => {
    const g = parseRLE('#N Glider\nx = 3, y = 3, rule = B3/S23\nbo$2bo$3o!\n');
    expect(g.width).toBe(3);
    expect(g.height).toBe(3);
    expect(g.rule).toBe('B3/S23');
    expect(g.comments).toEqual(['Glider']);
    expect(g.cells).toEqual([0, 1, 0, 0, 0, 1, 1, 1, 1]);
  });

  it('schreibt und liest leere Zeilen und mehrere Zustände', () => {
    const g = { width: 4, height: 4, cells: [0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3] };
    const text = toRLE(g);
    expect(text).toContain('\n$AB2$3.C!');
    expect(parseRLE(text).cells).toEqual(g.cells);
  });

  it('Gleiter übersteht Hin- und Rückweg', () => {
    const g = { width: 3, height: 3, cells: [0, 1, 0, 0, 0, 1, 1, 1, 1] };
    expect(toRLE(g, 'B3/S23')).toBe('x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!\n');
  });
});

describe('Beschreibungen und Statistik', () => {
  it('beschreibt Regeln auf Deutsch', () => {
    const m = getTemplate('sir').model();
    expect(describeRule(m, 0, m.states[0].rules[0])).toBe(
      'Eine Zelle in „Gesund“ wechselt zu „Infiziert“, wenn sich mindestens 1 Nachbar im Zustand „Infiziert“ befindet – mit 30 % Wahrscheinlichkeit pro Generation.',
    );
    const t = getTemplate('traffic').model();
    expect(describeRule(t, 0, t.states[0].rules[0])).toContain('die Zelle links nicht im Zustand „Straße“ ist');
  });

  it('findet Auffälligkeiten im Modell', () => {
    const m = getTemplate('gol').model();
    m.states[1].name = 'tot';
    m.states[0].rules[0].probability = 0;
    expect(lintModel(m)).toEqual([
      '„Tot“, Regel 1: Wahrscheinlichkeit 0 % – die Regel greift nie.',
      'Die Zustände 1 und 2 heißen gleich.',
    ]);
  });

  it('History überschreibt dieselbe Generation und kürzt beim Zurückspringen', () => {
    const h = new History();
    h.record(0, [5, 0]);
    h.record(0, [4, 1]);
    h.record(1, [3, 2]);
    h.record(2, [2, 3]);
    h.record(1, [9, 9]);
    expect(h.toJSON()).toEqual({ generations: [0, 1], counts: [[4, 1], [9, 9]] });
    expect(h.summary(1)).toEqual({ min: 1, max: 9, mean: 5, minGeneration: 0, maxGeneration: 1 });
    expect(h.toCSV(['A', 'B'])).toBe('Generation;A;B\n0;4;1\n1;9;9\n');
  });
});
