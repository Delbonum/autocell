<p align="center"><img src="docs/autocell-icon.png" width="140" alt="AutoCell-Logo"></p>

# AutoCell

**Zelluläre Automaten entwerfen, simulieren und auswerten** – vom klassischen
Game of Life über Staubildung im Verkehr bis zur Ausbreitung von Krankheiten.

AutoCell 2 ist eine vollständige Neuentwicklung (Version 1 wird nicht
weitergeführt) und entsteht als Desktop-Anwendung und als Web-Anwendung, die
sich in beliebige Webseiten einbinden lässt. Beide nutzen denselben Rechenkern.

## Funktionen (Stand 2.0.0, in Entwicklung)

- Mehrere Projekte gleichzeitig in Tabs, Vorlagen für den schnellen Start
- Beliebig viele **Zustände** mit Name, Farbe und Startanteil
- **Regeln** je Zustand mit Bedingungen wie
  - Anzahl der Nachbarn in bestimmten Zuständen,
  - Zustand des Nachbarn an einer festen Position (z. B. „rechts“) oder
  - Alter der Zelle (Generationen im aktuellen Zustand),

  jeweils mit „und“/„oder“ verknüpft und mit einer Wahrscheinlichkeit
- **Nachbarschaften**: Moore, Von Neumann, erweitert, Vorausschau oder frei im 7×7-Raster
- **Randbedingungen**: Torus, fester Rand, gespiegelt
- Zellen einzeln setzen (Stift, Radierer, Zellmenü per Rechtsklick), Zufallsbelegung
- **Automatische Simulation** mit einstellbarem Tempo (Gen./s oder s/Gen.),
  Einzelschritt, Zurücksetzen und automatischem Stopp bei Generation n oder stabilem/periodischem Muster
- **Statistik**: Live-Verlauf, Kennzahlen je Zustand, Mustererkennung, CSV-Export
- Eigenes Projektformat **`.acp`** ([Spezifikation](docs/acp-format.md)), Import/Export von CSV und RLE (Golly), PNG-Schnappschüsse
- Rückgängig/Wiederherstellen, Tastenkürzel
- **Nostalgiemodus** (Ansicht › Nostalgiemodus): die Oberfläche des ursprünglichen Entwurfs

## Aufbau

```
packages/core     Rechenkern (TypeScript, ohne DOM): Simulation, Regeln, Statistik, .acp
apps/autocell     Oberfläche (React + Vite) – läuft im Browser und später in der Desktop-Hülle
docs/             Spezifikationen
scripts/          Hilfsskripte (z. B. Versionsabgleich)
```

## Entwickeln

Voraussetzung: Node.js ≥ 20.

```bash
npm install          # Abhängigkeiten aller Pakete
npm run dev          # Oberfläche unter http://localhost:5173
npm test             # alle Tests (Rechenkern und Oberflächenlogik)
npm run typecheck    # TypeScript prüfen
npm run build        # Produktions-Build nach apps/autocell/dist
```

## Versionsnummer

Die Versionsnummer folgt [SemVer](https://semver.org/lang/de/) und wird **nur**
in der `package.json` im Wurzelverzeichnis gepflegt. Beim Bauen wird sie in die
Anwendung (Credits-Fenster, `.acp`-Dateien) eingesetzt.

```bash
npm version 2.1.0 --no-git-tag-version   # Wurzel-package.json anheben
npm run version:sync                     # in alle Pakete übertragen
```

Änderungen werden in [CHANGELOG.md](CHANGELOG.md) festgehalten.

## Nächste Schritte

- Desktop-Hülle mit [Tauri](https://tauri.app) (native Datei-Dialoge, Installationspakete für Windows, macOS, Linux)
- Web-Komponente `<autocell-player>` zum Einbinden in Webseiten (Datei › Im Web veröffentlichen)
- Ausführliches Statistik-Fenster mit Messpunkten einzelner Zellen
