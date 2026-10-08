/**
 * Offline-Nutzung der Web-Version: Vite-Plugin, das beim Bauen einen Service
 * Worker (`sw.js`) erzeugt. Er speichert alle Dateien der App beim ersten
 * Besuch im Browser-Cache und liefert sie danach auch ohne Netz aus.
 *
 * Eine neue Version wird im Hintergrund geladen, aber erst aktiv, wenn die
 * App sie anfordert (Nachricht `skipWaiting`) – siehe src/app/offline.ts.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Dateien, die nicht in den Offline-Speicher gehören. Von den Schriften genügen
 * WOFF2 und die lateinischen Zeichensätze; andere lädt der Browser bei Bedarf.
 */
const EXCLUDE = [/\.map$/, /^sw\.js$/, /^player\//, /\.woff$/, /-(cyrillic|greek|vietnamese)(-ext)?-\d+-/];

export function precacheList(files: Iterable<string>): string[] {
  const list = new Set<string>(['./']);
  for (const f of files) {
    const path = f.replace(/\\/g, '/');
    if (path === 'index.html' || EXCLUDE.some((re) => re.test(path))) continue;
    list.add(path);
  }
  return [...list].sort();
}

export function cacheName(version: string, files: string[]): string {
  const hash = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 10);
  return `autocell-${version}-${hash}`;
}

/** Quelltext des Service Workers. */
export function serviceWorkerSource(cache: string, files: string[]): string {
  return `// Erzeugt beim Bauen von AutoCell (build/offline.ts) – nicht von Hand ändern.
const CACHE = ${JSON.stringify(cache)};
const FILES = ${JSON.stringify(files, null, 2)};
const PRECACHED = new Set(FILES);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('autocell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const rel = url.pathname.slice(scope.pathname.length);
  const key = rel === '' || rel === 'index.html' ? './' : rel;
  if (!PRECACHED.has(key)) return;
  event.respondWith(
    caches.open(CACHE)
      .then((c) => c.match(key === './' ? scope.href : new URL(key, scope).href))
      .then((hit) => hit || fetch(req)),
  );
});
`;
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p));
    }
  };
  walk(dir);
  return out;
}

export function offlinePlugin(version: string): Plugin {
  let publicDir = '';
  return {
    name: 'autocell-offline',
    apply: 'build',
    configResolved(config) {
      publicDir = config.publicDir;
    },
    generateBundle(_options, bundle) {
      const files = precacheList([...Object.keys(bundle), ...listFiles(publicDir)]);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource(cacheName(version, files), files) });
    },
  };
}
