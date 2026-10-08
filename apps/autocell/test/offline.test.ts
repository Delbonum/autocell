import { describe, expect, it } from 'vitest';
import { cacheName, precacheList, serviceWorkerSource } from '../build/offline';

describe('Offline-Speicher', () => {
  it('nimmt App-Dateien auf, aber keine Quellkarten, den Player oder sw.js selbst', () => {
    const list = precacheList(['index.html', 'assets/index-abc.js', 'assets/index-abc.js.map', 'sw.js', 'player\\autocell-player.js', 'icon.png']);
    expect(list).toEqual(['./', 'assets/index-abc.js', 'icon.png']);
  });

  it('beschränkt Schriften auf WOFF2 in lateinischer Schrift', () => {
    const list = precacheList([
      'assets/ibm-plex-sans-latin-400-normal-a.woff2',
      'assets/ibm-plex-sans-latin-ext-400-normal-b.woff2',
      'assets/ibm-plex-sans-latin-400-normal-c.woff',
      'assets/ibm-plex-sans-cyrillic-ext-400-normal-d.woff2',
      'assets/ibm-plex-sans-greek-400-normal-e.woff2',
    ]);
    expect(list).toEqual(['./', 'assets/ibm-plex-sans-latin-400-normal-a.woff2', 'assets/ibm-plex-sans-latin-ext-400-normal-b.woff2']);
  });

  it('wechselt den Cache-Namen mit Version und Dateien', () => {
    const a = cacheName('2.2.0', ['./', 'assets/a.js']);
    expect(a).toMatch(/^autocell-2\.2\.0-[0-9a-f]{10}$/);
    expect(cacheName('2.2.0', ['./', 'assets/b.js'])).not.toBe(a);
    expect(cacheName('2.3.0', ['./', 'assets/a.js'])).not.toBe(a);
  });

  it('erzeugt gültiges JavaScript', () => {
    const src = serviceWorkerSource('autocell-x', ['./', 'assets/a.js']);
    expect(() => new Function(src)).not.toThrow();
    expect(src).toContain('"assets/a.js"');
  });
});
