import { describe, expect, it } from 'vitest';
import { createProject, decodeAcp, encodeAcp, encodeAcpJson, getTemplate, nextProbeName, probeAt, ProbeLog, probeValues, UNKNOWN } from '../src';

describe('Messpunkte', () => {
  it('vergibt freie Namen', () => {
    expect(nextProbeName([])).toBe('A');
    expect(nextProbeName([{ name: 'A', x: 0, y: 0 }, { name: 'C', x: 1, y: 0 }])).toBe('B');
    const all = Array.from({ length: 26 }, (_, i) => ({ name: String.fromCharCode(65 + i), x: i, y: 0 }));
    expect(nextProbeName(all)).toBe('P27');
    expect(probeAt(all, 3, 0)).toBe(3);
    expect(probeAt(all, 3, 1)).toBe(-1);
  });

  it('liest Zellzustände, außerhalb des Rasters unbekannt', () => {
    const sim = { width: 3, height: 2, cells: [0, 1, 2, 2, 1, 0] };
    expect(probeValues([{ name: 'A', x: 2, y: 0 }, { name: 'B', x: 0, y: 1 }, { name: 'C', x: 5, y: 0 }], sim)).toEqual([2, 2, UNKNOWN]);
  });

  it('zeichnet auf, überschreibt dieselbe Generation und kürzt beim Zurückspringen', () => {
    const log = new ProbeLog();
    log.record(0, [0]);
    log.record(1, [1]);
    log.record(1, [0]);
    expect(log.series[0]).toEqual([0, 0]);
    log.record(2, [1]);
    log.record(1, [1]);
    expect(log.generations).toEqual([0, 1]);
    expect(log.series[0]).toEqual([0, 1]);
  });

  it('füllt Generationen vor einem neuen Messpunkt mit „unbekannt“', () => {
    const log = new ProbeLog();
    log.record(0, [0]);
    log.record(1, [1]);
    log.addSeries();
    log.record(2, [1, 0]);
    expect(log.series[1]).toEqual([UNKNOWN, UNKNOWN, 0]);
    log.removeSeries(0);
    expect(log.series).toEqual([[UNKNOWN, UNKNOWN, 0]]);
  });

  it('fasst Verweildauern und Wechsel zusammen', () => {
    const log = new ProbeLog();
    [0, 0, 1, 1, 1, 0, 2, 2].forEach((v, g) => log.record(g, [v]));
    const s = log.summary(0, 3);
    expect(s.observed).toBe(8);
    expect(s.time).toEqual([3, 3, 2]);
    expect(s.changes).toBe(3);
    expect(s.longestRun).toEqual([2, 3, 2]);
    expect(s.currentState).toBe(2);
    expect(s.currentRun).toBe(2);
    expect(log.summary(0, 3, 3).time).toEqual([1, 0, 2]);
  });

  it('exportiert CSV mit Zustandsnamen', () => {
    const log = new ProbeLog();
    log.addSeries();
    log.record(0, [1]);
    log.record(1, [UNKNOWN]);
    expect(log.toCSV([{ name: 'A', x: 0, y: 4 }], ['Tot', 'Lebendig'])).toBe('Generation;A (1|5)\n0;Lebendig\n1;\n');
  });

  it('übersteht Speichern und Laden (.acp und JSON)', () => {
    const p = createProject({ name: 'M', model: getTemplate('gol').model(), width: 8, height: 6, seed: 1 });
    p.probes = [{ name: 'A', x: 7, y: 5 }, { name: 'B', x: 0, y: 0 }];
    p.probeLog = new ProbeLog();
    p.probeLog.record(0, [1, 0]);
    p.probeLog.record(1, [0, 0]);
    const back = decodeAcp(encodeAcp(p, { appVersion: '2.2.0' }));
    expect(back.probes).toEqual(p.probes);
    expect(back.probeLog!.toJSON()).toEqual(p.probeLog.toJSON());
    const fromJson = decodeAcp(new TextEncoder().encode(encodeAcpJson(p, '2.2.0')));
    expect(fromJson.probes).toEqual(p.probes);
    expect(fromJson.probeLog!.series).toEqual([[], []]);
  });

  it('lehnt Messpunkte außerhalb des Rasters ab', () => {
    const p = createProject({ name: 'M', model: getTemplate('gol').model(), width: 4, height: 4, seed: 1 });
    p.probes = [{ name: 'A', x: 4, y: 0 }];
    expect(() => decodeAcp(encodeAcp(p, { appVersion: '2.2.0' }))).toThrow(/probes\[0\]\.x/);
  });
});
