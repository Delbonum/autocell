/**
 * Dateipfade (Windows und Unix) und die Liste „Zuletzt geöffnet“.
 * Rein (ohne DOM und Tauri), damit testbar.
 */

export function baseNameOfPath(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function dirOfPath(path: string): string {
  const i = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'));
  const dir = i <= 0 ? path.slice(0, i + 1) : path.slice(0, i);
  // Laufwerkswurzel: „C:“ allein wäre unter Windows das aktuelle Verzeichnis.
  return /^[a-z]:$/i.test(dir) ? `${dir}\\` : dir;
}

export function joinPath(dir: string, name: string): string {
  if (!dir) return name;
  const sep = dir.includes('\\') ? '\\' : '/';
  return /[\\/]$/.test(dir) ? dir + name : dir + sep + name;
}

/** Gleicher Pfad? Unter Windows ohne Rücksicht auf Groß-/Kleinschreibung. */
export function samePath(a: string, b: string): boolean {
  const norm = (p: string) => (/^[a-z]:[\\/]|^\\\\/i.test(p) ? p.replace(/\//g, '\\').toLowerCase() : p);
  return norm(a) === norm(b);
}

export const MAX_RECENT = 8;
const RECENT_KEY = 'autocell.recent';

/** Setzt `path` an den Anfang der Liste (ohne Doppelte, höchstens MAX_RECENT). */
export function addRecent(list: readonly string[], path: string): string[] {
  return [path, ...list.filter((p) => !samePath(p, path))].slice(0, MAX_RECENT);
}

export function removeRecent(list: readonly string[], path: string): string[] {
  return list.filter((p) => !samePath(p, path));
}

export function loadRecent(storage: Pick<Storage, 'getItem'> | null = safeStorage()): string[] {
  try {
    const raw = JSON.parse(storage?.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function storeRecent(list: readonly string[], storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* egal */
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
