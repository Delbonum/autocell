import { createProject, encodeAcp, encodeAcpJson, getTemplate } from '@autocell/core';
import { describe, expect, it } from 'vitest';
import { Clock, parseSpeed, PlayerError, projectFromBytes, projectFromJsonText, projectFromTemplate } from '../src/source';

const sample = () =>
  createProject({ name: 'Test', model: getTemplate('gol').model(), width: 12, height: 8, seed: 42 });

describe('Projektquellen', () => {
  it('liest .acp (ZIP) und die JSON-Variante', () => {
    const p = sample();
    const fromZip = projectFromBytes(encodeAcp(p, { appVersion: '2.0.0' }));
    const fromJson = projectFromJsonText(encodeAcpJson(p, '2.0.0'));
    for (const q of [fromZip, fromJson]) {
      expect(q.meta.name).toBe('Test');
      expect([q.width, q.height]).toEqual([12, 8]);
      expect(Array.from(q.current.cells)).toEqual(Array.from(p.current.cells));
    }
  });

  it('meldet fremde Dateien verständlich', () => {
    expect(() => projectFromBytes(new TextEncoder().encode('x = 3, y = 3\nbo$2bo$3o!'))).toThrow(PlayerError);
    expect(() => projectFromJsonText('{"format":"etwas anderes"}')).toThrow(/keine AutoCell-Projektdatei/);
  });

  it('erzeugt Projekte aus Vorlagen, reproduzierbar per seed', () => {
    const a = projectFromTemplate('sir', '30', '20', '7');
    const b = projectFromTemplate('sir', '30', '20', '7');
    expect([a.width, a.height]).toEqual([30, 20]);
    expect(Array.from(a.current.cells)).toEqual(Array.from(b.current.cells));
    expect(projectFromTemplate('gol', null, 'abc', null).height).toBe(getTemplate('gol').defaultSize.height);
    expect(projectFromTemplate('gol', '99999', '1', null).width).toBe(1000);
    expect(() => projectFromTemplate('empty', null, null, null)).toThrow(/Unbekannte Vorlage/);
  });

  it('liest das Tempo', () => {
    expect(parseSpeed('12.5', 8)).toBe(12.5);
    expect(parseSpeed(null, 8)).toBe(8);
    expect(parseSpeed('-3', 8)).toBe(8);
    expect(parseSpeed('5000', 8)).toBe(1000);
  });
});

describe('Taktgeber', () => {
  it('liefert Generationen passend zum Tempo', () => {
    const c = new Clock(10);
    expect(c.due(50)).toBe(0);
    expect(c.due(60)).toBe(1);
    expect(c.due(200)).toBe(2);
  });

  it('holt lange Unterbrechungen nicht nach', () => {
    const c = new Clock(10);
    expect(c.due(60_000)).toBe(2);
    const fast = new Clock(1000);
    expect(fast.due(100, 20)).toBe(20);
    expect(fast.due(0)).toBe(0);
  });
});

describe('Beispielseite', () => {
  it('enthält ein gültiges eingebettetes Projekt', async () => {
    const { readFileSync } = await import('node:fs');
    const html = readFileSync(new URL('../demo/index.html', import.meta.url), 'utf8');
    const json = /<script type="application\/json">([\s\S]*?)<\/script>/.exec(html)![1];
    const p = projectFromJsonText(json);
    expect(p.meta.name).toBe('Gleiter');
    expect(Array.from(p.current.cells).filter((s) => s === 1)).toHaveLength(5);
    expect(p.settings.stopAtGeneration).toBe(64);
  });
});
