# Änderungsprotokoll

Alle nennenswerten Änderungen an AutoCell. Die Versionsnummern folgen
[Semantic Versioning](https://semver.org/lang/de/): MAJOR.MINOR.PATCH.

Die Version 2.0.0 ist eine vollständige Neuentwicklung. Sie ersetzt die frühere
Version 1 und ist zu deren Dateien nicht kompatibel.

## [2.3.0] – 2026-10-08

### Neu
- Desktop: Öffnen, Speichern und alle Exporte (CSV, RLE, PNG) über die
  Dialoge von Windows mit echten Dateipfaden. „Speichern“ schreibt ohne
  Rückfrage in die geöffnete Datei, auch nach einem Neustart; geschrieben wird
  über eine temporäre Datei, damit ein Abbruch die alte Datei nicht beschädigt.
  Der Dialog merkt sich den zuletzt benutzten Ordner.
- Desktop: Doppelklick auf eine `.acp`-Datei im Explorer öffnet sie in
  AutoCell – läuft AutoCell schon, im vorhandenen Fenster.
- Desktop: „Zuletzt geöffnet“ im Datei-Menü und auf dem Startbildschirm.

### Geändert
- PNG-Schnappschüsse werden auch im Browser über einen Speichern-Dialog
  abgelegt (wo der Browser ihn anbietet) statt sofort heruntergeladen.

## [2.2.0] – 2026-10-08

### Neu
- Web-Version offline nutzbar: Ein Service Worker speichert die App beim ersten
  Besuch; danach startet sie auch ohne Internet. Neue Versionen werden im
  Hintergrund geladen und per Hinweis „Neu laden“ aktiviert.
- Ausführliches Statistik-Fenster mit den Reitern „Übersicht“ (zusätzlich
  Anteil, Änderung zur Vorgeneration, Minimum mit Generation, veränderte Zellen)
  und „Messpunkte“.
- Messpunkte: einzelne Zellen per Rechtsklick beobachten. Zeitleiste je
  Messpunkt, Anteil der Zeit je Zustand, Zahl der Wechsel, längste Phase,
  CSV-Export; Markierung im Raster. „Zellverlauf anzeigen“ öffnet die
  Auswertung der Zelle.
- `.acp`: optionale Felder `probes` und `data.probeHistory` (`probes.json`),
  Formatversion bleibt 1.

## [2.1.0] – 2026-10-08

### Neu
- Desktop: im Nostalgiemodus ersetzt die Retro-Titelleiste die von Windows
  (Verschieben, Minimieren, Maximieren, Schließen).
- Web-Version auf GitHub Pages, automatisch gebaut bei jedem Push auf `main`;
  im Browser als App installierbar (Web-Manifest).
- AutoCell-Player `<autocell-player>`: Web-Komponente zum Einbinden von
  Simulationen in beliebige Webseiten (Projekt per `src`, eingebettet oder als
  Vorlage; Steuerleiste, Legende, Autoplay, Wiederholen, anklickbare Zellen),
  mit Beispielseite unter `/player/`.
- Datei › Im Web veröffentlichen (im Nostalgiemodus „Publizieren“): erzeugt den
  Code-Schnipsel für den Player, mit Live-Vorschau.

### Geändert
- `npm run version:sync` überträgt die Version auch in `Cargo.toml` und
  `Cargo.lock`.

## [2.0.0] – 2026-10-07

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
