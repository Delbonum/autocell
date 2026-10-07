# Änderungsprotokoll

Alle nennenswerten Änderungen an AutoCell. Die Versionsnummern folgen
[Semantic Versioning](https://semver.org/lang/de/): MAJOR.MINOR.PATCH.

Die Version 2.0.0 ist eine vollständige Neuentwicklung. Sie ersetzt die frühere
Version 1 und ist zu deren Dateien nicht kompatibel.

## [Unveröffentlicht] – 2.0.0

### Neu
- Rechenkern `@autocell/core` in TypeScript: beliebig viele Zustände, Regeln mit
  Bedingungen (Nachbarzahl, Nachbar an Position, Alter), Wahrscheinlichkeiten,
  frei definierbare Nachbarschaften, Randbedingungen Torus/fest/gespiegelt.
- Projektformat `.acp` (Formatversion 1), siehe `docs/acp-format.md`.
- Import/Export von CSV und RLE (Golly).
- Statistikverlauf und Erkennung stabiler bzw. periodischer Muster.
- Vorlagen: Game of Life, Epidemie (SIR), Verkehrsfluss (Regel 184), Waldbrand,
  Brian’s Brain.
- Oberfläche (React): Startbildschirm, Hauptfenster mit Tabs, Werkzeugen,
  Zustandsliste, Live-Verlauf und Statusleiste; Kontextmenü „Zustand setzen“;
  Dialoge für neue Projekte, Zustände & Regeln, Nachbarschaft & Rand,
  Projekt & Raster, Statistik, Tastenkürzel und Credits.
- Nostalgiemodus: Oberfläche des ursprünglichen Entwurfs inklusive
  „Parameter einstellen“ und Beenden-Dialog.
- Rückgängig/Wiederherstellen, PNG-Schnappschuss, Druck.
- Zwei Überraschungen für Neugierige.
- Desktop-Hülle mit Tauri 2: `autocell.exe` und Windows-Installer (NSIS),
  Dateizuordnung für `.acp`.
- Desktop: im Nostalgiemodus ersetzt die Retro-Titelleiste die von Windows
  (Verschieben, Minimieren, Maximieren, Schließen).
- Web-Version auf GitHub Pages, automatisch gebaut bei jedem Push auf `main`;
  im Browser als App installierbar (Web-Manifest).
