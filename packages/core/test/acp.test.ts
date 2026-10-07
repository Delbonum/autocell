import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  AcpError,
  ACP_MIME,
  createProject,
  decodeAcp,
  decodeRuns,
  encodeAcp,
  encodeAcpJson,
  encodeRuns,
  getTemplate,
  sniffFile,
  TEMPLATES,
} from '../src';

const make = (id: Parameters<typeof getTemplate>[0] = 'sir') =>
  createProject({ name: 'Test', model: getTemplate(id).model(), width: 30, height: 20, seed: 42, now: new Date('2026-10-01T12:00:00Z') });

describe('.acp (ZIP)', () => {
  it('ist ein ZIP mit mimetype als erstem, unkomprimiertem Eintrag', () => {
    const bytes = encodeAcp(make(), { appVersion: '2.0.0' });
    expect(sniffFile(bytes)).toBe('zip');
    // Lokaler Dateikopf: Name beginnt bei Byte 30, Kompressionsmethode bei Byte 8.
    expect(new TextDecoder().decode(bytes.subarray(30, 38))).toBe('mimetype');
    expect(bytes[8]).toBe(0);
    const files = unzipSync(bytes);
    expect(new TextDecoder().decode(files['mimetype'])).toBe(ACP_MIME);
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['project.json', 'cells.bin', 'ages.bin', 'initial.bin', 'history.json']));
    const json = JSON.parse(new TextDecoder().decode(files['project.json']));
    expect(json.format).toBe('autocell-project');
    expect(json.formatVersion).toBe(1);
    expect(json.createdWith).toEqual({ app: 'AutoCell', version: '2.0.0' });
  });

  it.each(TEMPLATES.map((t) => t.id))('Vorlage %s übersteht Speichern und Laden verlustfrei', (id) => {
    const p = make(id);
    const back = decodeAcp(encodeAcp(p, { appVersion: '2.0.0' }));
    expect(back.model).toEqual(p.model);
    expect(back.meta).toEqual(p.meta);
    expect(back.settings).toEqual(p.settings);
    expect(back.view).toEqual(p.view);
    expect(back.width).toBe(30);
    expect(Array.from(back.current.cells)).toEqual(Array.from(p.current.cells));
    expect(Array.from(back.initial!)).toEqual(Array.from(p.initial!));
    expect(back.history.toJSON()).toEqual(p.history.toJSON());
  });

  it('speichert Alter und Zufallszustand', () => {
    const p = make();
    p.current.ages[5] = 123456;
    p.current.rngState = 987654321;
    p.current.generation = 77;
    const back = decodeAcp(encodeAcp(p, { appVersion: '2.0.0' }));
    expect(back.current.ages[5]).toBe(123456);
    expect(back.current.rngState).toBe(987654321);
    expect(back.current.generation).toBe(77);
  });

  it('meldet fehlende Dateien im Archiv verständlich', () => {
    const files = unzipSync(encodeAcp(make(), { appVersion: '2.0.0' }));
    delete files['cells.bin'];
    expect(() => decodeAcp(zipSync(files))).toThrow(/cells\.bin.*fehlt/);
  });

  it('lehnt neuere Formatversionen mit Hinweis ab', () => {
    const files = unzipSync(encodeAcp(make(), { appVersion: '2.0.0' }));
    const json = JSON.parse(new TextDecoder().decode(files['project.json']));
    json.formatVersion = 2;
    json.createdWith.version = '3.1.0';
    files['project.json'] = strToU8(JSON.stringify(json));
    expect(() => decodeAcp(zipSync(files))).toThrow(/Format 2.*3\.1\.0.*aktualisieren/);
  });

  it('prüft Regeln und nennt die fehlerhafte Stelle', () => {
    const files = unzipSync(encodeAcp(make(), { appVersion: '2.0.0' }));
    const json = JSON.parse(new TextDecoder().decode(files['project.json']));
    json.model.states[1].rules[0].target = 9;
    files['project.json'] = strToU8(JSON.stringify(json));
    try {
      decodeAcp(zipSync(files));
      throw new Error('kein Fehler');
    } catch (e) {
      expect(e).toBeInstanceOf(AcpError);
      expect((e as AcpError).path).toBe('model.states[1].rules[0].target');
    }
  });
});

describe('.acp (reines JSON)', () => {
  it('lässt sich als lesbare JSON-Datei schreiben und laden', () => {
    const p = make('gol');
    const text = encodeAcpJson(p, '2.0.0');
    expect(text).toContain('"rle"');
    const back = decodeAcp(new TextEncoder().encode(text));
    expect(Array.from(back.current.cells)).toEqual(Array.from(p.current.cells));
  });

  it('akzeptiert eine minimale, von Hand geschriebene Datei', () => {
    const minimal = {
      format: 'autocell-project',
      formatVersion: 1,
      meta: { name: 'Minimal' },
      grid: { width: 3, height: 1 },
      model: {
        states: [
          { name: 'Aus', color: '#000000' },
          { name: 'An', color: '#FFFFFF', rules: [{ target: 0, conditions: [{ type: 'age', op: '>=', value: 2 }] }] },
        ],
        neighborhood: { offsets: [[-1, 0], [1, 0]] },
        boundary: { type: 'torus' },
      },
      data: { cells: { rle: '0 2*1' } },
    };
    const p = decodeAcp(new TextEncoder().encode(JSON.stringify(minimal)));
    expect(Array.from(p.current.cells)).toEqual([0, 1, 1]);
    expect(p.model.states[1].color).toBe('#ffffff');
    expect(p.model.states[1].rules[0]).toEqual({ target: 0, combine: 'all', probability: 1, conditions: [{ type: 'age', op: '>=', value: 2 }] });
    expect(p.model.neighborhood.preset).toBe('custom');
    expect(p.settings.speed).toBe(8);
  });
});

describe('Lauflängen und Dateierkennung', () => {
  it('kodiert und dekodiert Läufe', () => {
    const cells = [0, 0, 0, 1, 2, 2, 0];
    expect(encodeRuns(cells)).toBe('3*0 1 2*2 0');
    expect(decodeRuns('3*0 1 2*2 0', 7, 3)).toEqual(cells);
    expect(() => decodeRuns('3*0', 4, 1)).toThrow(/3 statt 4/);
    expect(() => decodeRuns('5', 1, 2)).toThrow(/Zustand 5/);
  });

  it('erkennt Textdateien (für Easter Eggs) und Binärmüll', () => {
    expect(sniffFile(strToU8('HALLO KLAUS'))).toBe('text');
    expect(sniffFile(strToU8('﻿  {"a":1}'))).toBe('json');
    expect(sniffFile(new Uint8Array([1, 2, 3, 0]))).toBe('binary');
    expect(sniffFile(new Uint8Array())).toBe('empty');
    expect(() => decodeAcp(strToU8('HALLO KLAUS'))).toThrow(AcpError);
  });
});

describe('Spezifikation', () => {
  it('das minimale Beispiel aus docs/acp-format.md ist gültig', async () => {
    const { readFileSync } = await import('node:fs');
    const doc = readFileSync(new URL('../../../docs/acp-format.md', import.meta.url), 'utf8');
    const section = doc.slice(doc.indexOf('## 8.'));
    const json = /```json\r?\n([\s\S]*?)```/.exec(section)![1];
    const p = decodeAcp(new TextEncoder().encode(json));
    expect(p.meta.name).toBe('Blinker');
    expect(p.current.cells[7] + p.current.cells[12] + p.current.cells[17]).toBe(3);
  });
});
