import { readFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { offlinePlugin } from './build/offline';

// Die Wurzel-package.json ist die einzige Quelle der Versionsnummer.
const rootPkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react(), offlinePlugin(rootPkg.version)],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  build: { target: 'es2022' },
});
