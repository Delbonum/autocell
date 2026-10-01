import { encodeAcp, getTemplate, createProject } from '@autocell/core';
import { describe, expect, it } from 'vitest';
import { interpretFile, projectFromGrid } from '../src/app/fileActions';
import { parseVersion, APP_VERSION } from '../src/version';

const enc = (s: string) => new TextEncoder().encode(s);

describe('Datei öffnen', () => {
  it('startet Tetris bei einer Textdatei mit „HALLO KLAUS“ – unabhängig von der Endung', () => {
    expect(interpretFile('notiz.txt', enc('HALLO KLAUS'))).toEqual({ kind: 'easteregg', egg: 'tetris' });
    expect(interpretFile('projekt.acp', enc('Hallo Klaus\n'))).toEqual({ kind: 'easteregg', egg: 'tetris' });
  });

  it('öffnet .acp-Projekte', () => {
    const p = createProject({ name: 'X', model: getTemplate('gol').model(), width: 5, height: 5, seed: 1 });
    const r = interpretFile('x.acp', encodeAcp(p, { appVersion: '2.0.0' }));
    expect(r.kind).toBe('project');
  });

  it('importiert RLE und CSV', () => {
    const rle = interpretFile('glider.rle', enc('x = 3, y = 3\nbo$2bo$3o!'));
    expect(rle.kind === 'grid' && rle.format).toBe('RLE');
    const csv = interpretFile('raster.csv', enc('0;1\n1;0\n'));
    expect(csv.kind === 'grid' && csv.grid.cells).toEqual([0, 1, 1, 0]);
  });

  it('meldet andere Textdateien verständlich', () => {
    const r = interpretFile('brief.txt', enc('Lieber Klaus, wie geht es dir?'));
    expect(r).toEqual({ kind: 'error', message: '„brief.txt“ ist keine AutoCell-Projektdatei und kein unterstütztes Rasterformat (CSV, RLE).' });
  });

  it('legt für Raster mit vielen Zuständen passende Zustände an', () => {
    const p = projectFromGrid({ width: 2, height: 1, cells: [0, 4] }, 'Import');
    expect(p.model.states).toHaveLength(5);
    expect(Array.from(p.current.cells)).toEqual([0, 4]);
  });
});

describe('Version', () => {
  it('ist eine gültige SemVer-Version ab 2.0.0', () => {
    const v = parseVersion(APP_VERSION);
    expect(v).not.toBeNull();
    expect(v!.major).toBeGreaterThanOrEqual(2);
  });
});
