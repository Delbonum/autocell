/**
 * Zugriff auf Dateien. Im Browser über die File System Access API (Chrome,
 * Edge) bzw. Datei-Upload und Download als Rückfallebene. In der Desktop-App
 * wird diese Schicht später durch die nativen Dialoge von Tauri ersetzt.
 */

export interface OpenedFile {
  name: string;
  bytes: Uint8Array;
  handle: unknown;
}

export interface SavedFile {
  name: string;
  handle: unknown;
}

interface FilePickerType {
  description: string;
  accept: Record<string, string[]>;
}

interface FsHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: Blob | BufferSource): Promise<void>; close(): Promise<void> }>;
}

type PickerWindow = Window & {
  showOpenFilePicker?: (o: { types?: FilePickerType[]; excludeAcceptAllOption?: boolean }) => Promise<FsHandle[]>;
  showSaveFilePicker?: (o: { suggestedName?: string; types?: FilePickerType[] }) => Promise<FsHandle>;
};

const w = (): PickerWindow => window as PickerWindow;

export const OPEN_TYPES: FilePickerType[] = [
  { description: 'AutoCell-Projekt', accept: { 'application/vnd.autocell.project+zip': ['.acp'] } },
  { description: 'Raster (CSV, RLE)', accept: { 'text/plain': ['.csv', '.rle', '.txt'] } },
];

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}

/** Öffnet einen Dateiauswahldialog. `null`, wenn abgebrochen wurde. */
export async function openFile(accept = '.acp,.csv,.rle,.txt,.json'): Promise<OpenedFile | null> {
  const picker = w().showOpenFilePicker;
  if (picker) {
    try {
      const [handle] = await picker({ types: OPEN_TYPES });
      const file = await handle.getFile();
      return { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), handle };
    } catch (e) {
      if (isAbort(e)) return null;
      throw e;
    }
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()), handle: null });
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/**
 * Speichert Daten. Mit vorhandenem Handle wird ohne Rückfrage überschrieben,
 * sonst erscheint ein Speichern-Dialog (oder ein Download im Browser).
 */
export async function saveFile(
  suggestedName: string,
  data: Uint8Array | string,
  mime: string,
  handle: unknown = null,
  types?: FilePickerType[],
): Promise<SavedFile | null> {
  const blob = new Blob([data as BlobPart], { type: mime });
  const picker = w().showSaveFilePicker;
  let h = handle as FsHandle | null;
  if (!h && picker) {
    try {
      h = await picker({ suggestedName, types });
    } catch (e) {
      if (isAbort(e)) return null;
      throw e;
    }
  }
  if (h) {
    const writable = await h.createWritable();
    await writable.write(blob);
    await writable.close();
    return { name: h.name, handle: h };
  }
  downloadBlob(blob, suggestedName);
  return { name: suggestedName, handle: null };
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Läuft AutoCell in der Desktop-Hülle (Tauri)? */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function toggleFullscreen(): void {
  if (document.fullscreenElement) void document.exitFullscreen();
  else void document.documentElement.requestFullscreen?.();
}
