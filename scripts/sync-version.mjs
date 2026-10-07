// Überträgt die Version aus der Wurzel-package.json (einzige Quelle der Wahrheit)
// in alle Pakete und – sobald vorhanden – in die Tauri-Konfiguration.
//
//   npm version 2.1.0 --no-git-tag-version && npm run version:sync
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error(`Ungültige Version in package.json: ${version}`);
  process.exit(1);
}

const targets = [
  'packages/core/package.json',
  'packages/player/package.json',
  'apps/autocell/package.json',
  'apps/autocell/src-tauri/tauri.conf.json',
];
for (const rel of targets) {
  const file = join(root, rel);
  if (!existsSync(file)) continue;
  const json = JSON.parse(readFileSync(file, 'utf8'));
  if (json.version === version) continue;
  json.version = version;
  writeFileSync(file, JSON.stringify(json, null, 2) + '\n');
  console.log(`${rel} → ${version}`);
}
console.log(`AutoCell ${version}`);
