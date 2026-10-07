// Legt den gebauten Player samt Beispielseite in die Web-Version
// (apps/autocell/dist/player), damit beides gemeinsam veröffentlicht wird.
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const from = join(root, 'packages/player/dist');
const to = join(root, 'apps/autocell/dist/player');
if (!existsSync(from)) {
  console.error('packages/player/dist fehlt – zuerst „npm run build -w @autocell/player“ ausführen.');
  process.exit(1);
}
cpSync(from, to, { recursive: true });
console.log(`Player nach ${to} kopiert.`);
