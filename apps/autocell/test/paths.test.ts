import { describe, expect, it } from 'vitest';
import { addRecent, baseNameOfPath, dirOfPath, joinPath, loadRecent, MAX_RECENT, removeRecent, samePath, storeRecent } from '../src/app/paths';
import { withExtension } from '../src/app/desktopFiles';

describe('Dateipfade', () => {
  it('zerlegt Windows- und Unix-Pfade', () => {
    expect(baseNameOfPath('C:\\Daten\\Müller\\SIR.acp')).toBe('SIR.acp');
    expect(dirOfPath('C:\\Daten\\Müller\\SIR.acp')).toBe('C:\\Daten\\Müller');
    expect(dirOfPath('C:\\SIR.acp')).toBe('C:\\');
    expect(dirOfPath('/home/a/b.acp')).toBe('/home/a');
    expect(dirOfPath('b.acp')).toBe('');
  });

  it('setzt Pfade zusammen', () => {
    expect(joinPath('C:\\Daten', 'a.acp')).toBe('C:\\Daten\\a.acp');
    expect(joinPath('C:\\', 'a.acp')).toBe('C:\\a.acp');
    expect(joinPath('/home/a', 'a.acp')).toBe('/home/a/a.acp');
    expect(joinPath('', 'a.acp')).toBe('a.acp');
  });

  it('vergleicht Windows-Pfade ohne Groß-/Kleinschreibung', () => {
    expect(samePath('C:\\Daten\\A.acp', 'c:/daten/a.ACP')).toBe(true);
    expect(samePath('/home/A.acp', '/home/a.acp')).toBe(false);
  });

  it('ergänzt eine fehlende Endung', () => {
    expect(withExtension('C:\\Daten\\Bild', 'SIR – Generation 5.png')).toBe('C:\\Daten\\Bild.png');
    expect(withExtension('C:\\Daten\\Bild.png', 'x.png')).toBe('C:\\Daten\\Bild.png');
    expect(withExtension('C:\\Daten.v2\\Bild', 'x.csv')).toBe('C:\\Daten.v2\\Bild.csv');
  });
});

describe('Zuletzt geöffnet', () => {
  it('setzt neue Einträge nach vorn, ohne Doppelte und begrenzt', () => {
    let list: string[] = [];
    for (let i = 0; i < 10; i++) list = addRecent(list, `C:\\p${i}.acp`);
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]).toBe('C:\\p9.acp');
    list = addRecent(list, 'c:\\P5.acp');
    expect(list[0]).toBe('c:\\P5.acp');
    expect(list.filter((p) => samePath(p, 'C:\\p5.acp'))).toHaveLength(1);
    expect(removeRecent(list, 'C:\\p9.acp')).not.toContain('C:\\p9.acp');
  });

  it('speichert und lädt robust', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    storeRecent(['C:\\a.acp'], storage);
    expect(loadRecent(storage)).toEqual(['C:\\a.acp']);
    store.set('autocell.recent', '{kaputt');
    expect(loadRecent(storage)).toEqual([]);
    store.set('autocell.recent', '[1, "C:\\\\b.acp"]');
    expect(loadRecent(storage)).toEqual(['C:\\b.acp']);
  });
});
