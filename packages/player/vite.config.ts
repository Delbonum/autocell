import { defineConfig } from 'vite';

// Eine einzige, eigenständige Datei zum Einbinden per <script type="module">.
// Der Inhalt von demo/ (Beispielseite) wird daneben kopiert.
export default defineConfig({
  publicDir: 'demo',
  build: {
    target: 'es2022',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'autocell-player.js',
    },
  },
});
