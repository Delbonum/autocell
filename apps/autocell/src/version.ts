/**
 * Programmversion und Angaben für das Credits-Fenster.
 *
 * Die Versionsnummer wird ausschließlich in der Wurzel-package.json gepflegt
 * (`npm version <neu> --no-git-tag-version && npm run version:sync`) und beim
 * Bauen eingesetzt. Hier nie von Hand eintragen.
 */
export const APP_NAME = 'AutoCell';
export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-dev';
export const BUILD_DATE: string = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : '';

export const CREDITS = {
  developer: 'WiskundeKnobbel',
  predecessor: 'AutoCell 1.x',
  libraries: ['React', 'Vite', 'fflate', 'IBM Plex (Schrift)'],
} as const;

/** Zerlegt eine SemVer-Version in ihre Teile. */
export function parseVersion(v: string): { major: number; minor: number; patch: number; pre?: string } | null {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v);
  if (!m) return null;
  return { major: +m[1], minor: +m[2], patch: +m[3], ...(m[4] ? { pre: m[4] } : {}) };
}
