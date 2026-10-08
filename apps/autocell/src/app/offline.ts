/**
 * Offline-Nutzung im Browser: meldet den Service Worker (sw.js, erzeugt von
 * build/offline.ts) an und gibt Bescheid, wenn eine neue Version bereitliegt.
 * In der Desktop-App und im Entwicklungsserver passiert nichts.
 */
import { isDesktop } from './platform';

export interface OfflineEvents {
  /** Alle Dateien sind gespeichert – AutoCell läuft ab jetzt auch ohne Internet. */
  onReady: () => void;
  /** Eine neue Version ist geladen. `apply` aktiviert sie und lädt die Seite neu. */
  onUpdate: (apply: () => void) => void;
}

const UPDATE_CHECK_MS = 60 * 60 * 1000;

export function offlineSupported(): boolean {
  return import.meta.env.PROD && !isDesktop() && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && location.protocol !== 'file:';
}

export async function registerOffline(events: OfflineEvents): Promise<void> {
  if (!offlineSupported()) return;
  const sw = navigator.serviceWorker;
  let reg: ServiceWorkerRegistration;
  try {
    reg = await sw.register('./sw.js');
  } catch (e) {
    console.warn('[AutoCell] Offline-Modus nicht verfügbar:', e);
    return;
  }

  let reloading = false;
  const apply = () => {
    sw.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      location.reload();
    });
    reg.waiting?.postMessage('skipWaiting');
  };

  // Ohne steuernden Service Worker ist es die erste Installation, sonst ein Update.
  const announce = () => (sw.controller ? events.onUpdate(apply) : events.onReady());

  if (reg.waiting && sw.controller) announce();
  reg.addEventListener('updatefound', () => {
    const worker = reg.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') announce();
    });
  });

  // Lange geöffnete Tabs sollen Updates trotzdem mitbekommen.
  window.setInterval(() => void reg.update().catch(() => {}), UPDATE_CHECK_MS);
}
