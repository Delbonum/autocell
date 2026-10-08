import { decodeAcp, encodeAcp, UNKNOWN } from '@autocell/core';
import { describe, expect, it } from 'vitest';
import { addProbe, applyModel, createDoc, docFromTemplate, docToProject, probeAtCell, pushUndo, recordStep, removeProbe, resetDoc, undo } from '../src/app/doc';

const run = (doc: ReturnType<typeof docFromTemplate>, n: number) => {
  for (let i = 0; i < n; i++) {
    doc.sim.step();
    recordStep(doc);
  }
};

describe('Messpunkte im Dokument', () => {
  it('zeichnet ab dem Setzen auf', () => {
    const doc = docFromTemplate('gol', { width: 12, height: 10 });
    run(doc, 3);
    const k = addProbe(doc, 4, 5);
    expect(addProbe(doc, 4, 5)).toBe(k);
    expect(doc.probes[k].name).toBe('A');
    run(doc, 2);
    const s = doc.probeLog.series[k];
    expect(doc.probeLog.generations).toEqual([3, 4, 5]);
    expect(s[2]).toBe(doc.sim.get(4, 5));
    expect(probeAtCell(doc, 4, 5)).toBe(k);
  });

  it('beginnt nach „Zurücksetzen“ neu und kürzt bei „Rückgängig“', () => {
    const doc = docFromTemplate('gol', { width: 12, height: 10 });
    addProbe(doc, 1, 1);
    run(doc, 4);
    pushUndo(doc, 'Test');
    run(doc, 3);
    undo(doc);
    expect(doc.probeLog.generations.at(-1)).toBe(4);
    resetDoc(doc);
    expect(doc.probeLog.generations).toEqual([0]);
  });

  it('entfernt Messpunkte samt Verlauf, auch beim Verkleinern des Rasters', () => {
    const doc = docFromTemplate('gol', { width: 12, height: 10 });
    addProbe(doc, 1, 1);
    addProbe(doc, 11, 9);
    addProbe(doc, 2, 2);
    run(doc, 2);
    removeProbe(doc, 0);
    expect(doc.probes.map((p) => p.name)).toEqual(['B', 'C']);
    applyModel(doc, doc.sim.model, 8, 8);
    expect(doc.probes.map((p) => p.name)).toEqual(['C']);
    expect(doc.probeLog.series).toHaveLength(1);
  });

  it('wird mit dem Projekt gespeichert und geladen', () => {
    const doc = docFromTemplate('sir', { width: 20, height: 15 });
    addProbe(doc, 3, 4);
    run(doc, 5);
    addProbe(doc, 7, 7);
    run(doc, 2);
    const back = createDoc(decodeAcp(encodeAcp(docToProject(doc), { appVersion: '2.2.0' })));
    expect(back.probes).toEqual(doc.probes);
    expect(back.probeLog.series[1].slice(0, 5)).toEqual([UNKNOWN, UNKNOWN, UNKNOWN, UNKNOWN, UNKNOWN]);
    expect(back.probeLog.toJSON()).toEqual(doc.probeLog.toJSON());
  });
});
