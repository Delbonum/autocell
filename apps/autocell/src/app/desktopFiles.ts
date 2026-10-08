/**
 * Dateizugriff in der Desktop-App (Tauri): Dialoge von Windows und echte
 * Dateipfade. Das Gegenstück in Rust steht in src-tauri/src/lib.rs.
 * Wird nur in der Desktop-App geladen (dynamischer Import aus platform.ts).
 */
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open, save, type DialogFilter } from '@tauri-apps/plugin-dialog';
import { baseNameOfPath, dirOfPath, joinPath } from './paths';

export interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}

const LAST_DIR_KEY = 'autocell.lastDir';

function lastDir(): string | null {
  try {
    return localStorage.getItem(LAST_DIR_KEY);
  } catch {
    return null;
  }
}

function rememberDir(path: string): void {
  try {
    localStorage.setItem(LAST_DIR_KEY, dirOfPath(path));
  } catch {
    /* egal */
  }
}

function toFilters(types: PickerType[]): DialogFilter[] {
  return types.map((t) => ({
    name: t.description,
    extensions: Object.values(t.accept).flat().map((e) => e.replace(/^\./, '')),
  }));
}

export async function readPath(path: string): Promise<{ name: string; bytes: Uint8Array; handle: string }> {
  const buf = await invoke<ArrayBuffer>('read_file', { path });
  return { name: baseNameOfPath(path), bytes: new Uint8Array(buf), handle: path };
}

export async function writePath(path: string, bytes: Uint8Array): Promise<void> {
  await invoke('write_file', bytes, { headers: { path: encodeURIComponent(path) } });
}

export async function openDialog(types: PickerType[]): Promise<{ name: string; bytes: Uint8Array; handle: string } | null> {
  const dir = lastDir();
  const picked = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Alle unterstützten Dateien', extensions: toFilters(types).flatMap((f) => f.extensions) }, ...toFilters(types)],
    ...(dir ? { defaultPath: dir } : {}),
  });
  if (typeof picked !== 'string') return null;
  rememberDir(picked);
  return readPath(picked);
}

/**
 * Speichert. Mit bekanntem Pfad ohne Rückfrage, sonst über den Speichern-Dialog.
 * Gibt den tatsächlichen Pfad zurück oder `null`, wenn abgebrochen wurde.
 */
export async function saveDialog(suggestedName: string, bytes: Uint8Array, path: string | null, types: PickerType[]): Promise<string | null> {
  let target = path;
  if (!target) {
    const dir = lastDir();
    const picked = await save({
      defaultPath: dir ? joinPath(dir, suggestedName) : suggestedName,
      filters: toFilters(types),
    });
    if (!picked) return null;
    target = withExtension(picked, suggestedName);
    rememberDir(target);
  }
  await writePath(target, bytes);
  return target;
}

/** Hängt die Endung des Vorschlags an, falls der Nutzer keine eingegeben hat. */
export function withExtension(path: string, suggestedName: string): string {
  const ext = /\.[^.\\/]+$/.exec(suggestedName)?.[0];
  return ext && !/\.[^.\\/]+$/.test(baseNameOfPath(path)) ? path + ext : path;
}

/** Dateien, mit denen AutoCell gestartet wurde (Doppelklick im Explorer). */
export function takeInitialFiles(): Promise<string[]> {
  return invoke<string[]>('take_initial_files');
}

/** Doppelklick auf eine Datei, während AutoCell schon läuft. */
export function onOpenFiles(handler: (paths: string[]) => void): Promise<() => void> {
  return listen<string[]>('open-files', (e) => handler(e.payload));
}
