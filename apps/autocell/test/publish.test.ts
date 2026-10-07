import { createProject, decodeAcp, getTemplate, simulationFromProject, captureSimulation } from '@autocell/core';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PUBLISH, embedSnippet, inlineJson, PLAYER_SCRIPT_URL, publishedProject, publishFileName } from '../src/app/publish';

function advanced() {
  const p = createProject({ name: 'Test <Projekt>', model: getTemplate('gol').model(), width: 10, height: 6, seed: 9 });
  const sim = simulationFromProject(p);
  for (let i = 0; i < 5; i++) sim.step();
  return captureSimulation(p, sim);
}

const opts = { ...DEFAULT_PUBLISH, fileName: 'test.acp' };
const extractJson = (html: string) => /<script type="application\/json">([\s\S]*?)<\/script>/.exec(html)![1];

describe('Im Web veröffentlichen', () => {
  it('bettet das Projekt ab Generation 0 ein', () => {
    const p = advanced();
    expect(p.current.generation).toBe(5);
    const html = embedSnippet(p, opts, '2.0.0');
    expect(html).toContain(`src="${PLAYER_SCRIPT_URL}"`);
    expect(html).toContain('<autocell-player controls autoplay>');
    const q = decodeAcp(new TextEncoder().encode(extractJson(html)));
    expect(q.current.generation).toBe(0);
    expect(Array.from(q.current.cells)).toEqual(Array.from(p.initial!));
    expect(q.current.rngState).toBe(p.settings.seed);
    expect(q.meta.name).toBe('Test <Projekt>');
  });

  it('behält auf Wunsch den aktuellen Stand', () => {
    const p = advanced();
    const q = decodeAcp(new TextEncoder().encode(extractJson(embedSnippet(p, { ...opts, fromStart: false }, '2.0.0'))));
    expect(q.current.generation).toBe(5);
    expect(Array.from(q.current.cells)).toEqual(Array.from(p.current.cells));
  });

  it('fällt ohne bekannten Anfangszustand auf den aktuellen Stand zurück', () => {
    const p = { ...advanced(), initial: null };
    expect(publishedProject(p, true).current.generation).toBe(5);
  });

  it('kann kein </script> in den Schnipsel schmuggeln', () => {
    const p = advanced();
    p.meta.description = '</script><script>alert(1)</script>';
    const json = inlineJson(p, '2.0.0');
    expect(json).not.toContain('<');
    expect(JSON.parse(json).meta.description).toBe(p.meta.description);
  });

  it('verweist im Dateimodus auf die .acp-Datei', () => {
    const html = embedSnippet(advanced(), { ...opts, mode: 'file', fileName: 'a"b.acp', loop: true, legend: true, autoplay: false }, '2.0.0');
    expect(html).toContain('<autocell-player src="a&quot;b.acp" controls legend loop></autocell-player>');
    expect(html).not.toContain('application/json');
  });

  it('erzeugt brauchbare Dateinamen', () => {
    expect(publishFileName('Größte Brände – Überblick')).toBe('grosste-brande-uberblick.acp');
    expect(publishFileName('***')).toBe('projekt.acp');
  });
});
