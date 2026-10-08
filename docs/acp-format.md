# Spezifikation: AutoCell-Projektdatei (`.acp`)

**Formatversion 1** · gültig ab AutoCell 2.0.0
Referenzimplementierung: `packages/core/src/acp.ts`

Eine `.acp`-Datei enthält ein vollständiges AutoCell-Projekt: Zustände, Regeln,
Nachbarschaft, Randbedingung, Simulationseinstellungen, den aktuellen
Rasterzustand und optional den Statistikverlauf. Eine pausierte Simulation läuft
nach dem Laden exakt so weiter, als wäre sie nie unterbrochen worden.

## 1. Zwei Varianten

| Variante | Erkennung | Zweck |
|---|---|---|
| **ZIP-Container** (Standard) | Datei beginnt mit `PK\x03\x04` | Normales Speichern aus AutoCell. Kompakt, auch für große Raster. |
| **Reines JSON** | erstes Nicht-Leerzeichen ist `{` (UTF-8, BOM erlaubt) | Von Hand schreiben, in Git versionieren, im Unterricht austeilen. |

Beide Varianten verwenden dieselbe JSON-Struktur (`project.json`, Abschnitt 3).
Sie unterscheiden sich nur darin, wie die Zelldaten abgelegt sind (Abschnitt 4).

MIME-Typ: `application/vnd.autocell.project+zip`
Dateiendung: `.acp`

## 2. Aufbau des ZIP-Containers

| Eintrag | Pflicht | Inhalt |
|---|---|---|
| `mimetype` | ja | ASCII-Text `application/vnd.autocell.project+zip`, **erster Eintrag, unkomprimiert** (wie bei ODF), damit Programme die Datei am Anfang erkennen |
| `project.json` | ja | Projektbeschreibung, UTF-8 (Abschnitt 3) |
| `cells.bin` | ja\* | aktueller Rasterzustand (Abschnitt 4.1) |
| `ages.bin` | nein | Alter jeder Zelle (Abschnitt 4.2) |
| `initial.bin` | nein | Rasterzustand bei Generation 0, für „Zurücksetzen“ |
| `history.json` | nein | Statistikverlauf (Abschnitt 5) |
| `probes.json` | nein | Verlauf der Messpunkte (Abschnitt 5.1, ab AutoCell 2.2.0) |

\* Welche Einträge verwendet werden, legt `project.json` → `data` fest. Unbekannte
Einträge werden beim Lesen ignoriert. Künftige Versionen dürfen weitere ablegen,
z. B. `thumbnail.png`.

## 3. `project.json`

```jsonc
{
  "format": "autocell-project",          // Pflicht, fester Wert
  "formatVersion": 1,                    // Pflicht, ganze Zahl
  "createdWith": { "app": "AutoCell", "version": "2.0.0" },

  "meta": {
    "name": "Epidemie SIR",              // Pflicht
    "description": "",
    "author": "",
    "createdAt": "2026-10-01T12:00:00.000Z",   // ISO 8601
    "modifiedAt": "2026-10-01T12:30:00.000Z",
    "template": "sir"                    // Vorlage, aus der das Projekt entstand
  },

  "grid": { "width": 80, "height": 56 }, // Pflicht, je 1 … 4000

  "model": {                             // Pflicht
    "states": [ /* Abschnitt 3.1 */ ],
    "neighborhood": { /* Abschnitt 3.3 */ },
    "boundary": { /* Abschnitt 3.4 */ }
  },

  "simulation": {
    "seed": 1234567,                     // Startwert des Zufallsgenerators, 0 … 2³²−1
    "speed": 8,                          // Generationen pro Sekunde, 0,01 … 1000
    "speedUnit": "gps",                  // Anzeige: "gps" (Gen./s) oder "spg" (s/Gen.)
    "stopAtGeneration": null,            // automatisch anhalten bei Generation n
    "stopWhenStable": false              // anhalten bei stabilem/periodischem Raster
  },

  "view": { "cellSize": 10, "showGridLines": true },

  "probes": [                            // Messpunkte, optional (ab AutoCell 2.2.0)
    { "name": "A", "x": 12, "y": 7 }     // x, y: 0-basierte Zellkoordinaten im Raster
  ],

  "data": {
    "generation": 0,                     // aktuelle Generation
    "rngState": 1234567,                 // Zustand des Zufallsgenerators
    "cellEncoding": "u8",                // "u8" (≤ 256 Zustände) oder "u16"
    "cells":   { "file": "cells.bin" },  // Abschnitt 4
    "ages":    { "file": "ages.bin" },   // oder null
    "initial": { "file": "initial.bin" },// oder null
    "history": { "file": "history.json" },// oder null, oder inline (Abschnitt 5)
    "probeHistory": { "file": "probes.json" } // optional, oder null, oder inline (5.1)
  }
}
```

Fehlende optionale Felder erhalten beim Lesen diese Standardwerte:
`description`/`author` = `""`, `simulation.seed` = 1, `speed` = 8,
`speedUnit` = `"gps"`, `stopAtGeneration` = `null`, `stopWhenStable` = `false`,
`view.cellSize` = 10, `showGridLines` = `true`, `data.generation` = 0,
`data.rngState` = 1, `data.cells` = alle Zellen Zustand 0, Alter = 0.

### 3.1 Zustände

Zustände werden über ihren **Index** in `states` angesprochen (0, 1, 2, …).
Zustand 0 ist der Grundzustand: Mit ihm werden das Raster geleert und
Zellen radiert. Es sind 1 bis 65 535 Zustände möglich.

```jsonc
{
  "name": "Infiziert",                   // Pflicht
  "color": "#ff9a3c",                    // Pflicht, #rrggbb (wird klein geschrieben)
  "initialShare": 0.4,                   // Gewicht für zufällige Anfangsbelegung (≥ 0)
  "description": "optional",
  "rules": [ /* Abschnitt 3.2, Standard: [] */ ]
}
```

### 3.2 Regeln und Bedingungen

Jeder Zustand hat eine geordnete Liste von Übergangsregeln. In jeder Generation
wird für jede Zelle die Regelliste **ihres aktuellen Zustands** von oben nach
unten geprüft:

1. Deaktivierte Regeln (`"enabled": false`) werden übersprungen.
2. Sind die Bedingungen erfüllt (`combine: "all"` = alle, `"any"` = mindestens
   eine; eine leere Liste ist immer erfüllt), wird mit der Wahrscheinlichkeit
   `probability` gewürfelt.
3. Gelingt der Wurf, wechselt die Zelle in `target`, und die Prüfung endet.
   Misslingt er, wird **die nächste Regel** geprüft.
4. Greift keine Regel, bleibt die Zelle unverändert.

Alle Zellen werden **synchron** aktualisiert: Bedingungen sehen ausschließlich
die vorherige Generation.

```jsonc
{
  "target": 2,              // Pflicht, Index des Zielzustands
  "combine": "all",         // "all" | "any", Standard "all"
  "probability": 1,         // 0 … 1, Standard 1
  "enabled": true,          // Standard true
  "note": "Freitext",
  "conditions": [ … ]       // Standard []
}
```

**Bedingungsarten**

| `type` | Felder | Bedeutung |
|---|---|---|
| `neighborCount` | `states: number[]`, `op`, `value` | Anzahl der Nachbarn (gemäß Nachbarschaft), deren Zustand in `states` liegt |
| `neighborAt` | `dx`, `dy`, `op` (`=` oder `!=`), `state` | Zustand der Zelle an der relativen Position (dx, dy), unabhängig von der Nachbarschaft. x wächst nach rechts, y nach unten. |
| `age` | `op`, `value` | Anzahl der Generationen, die die Zelle ununterbrochen im aktuellen Zustand ist (0 direkt nach einem Wechsel) |

Vergleichsoperatoren `op`: `=`, `!=`, `<`, `<=`, `>`, `>=`.

Beispiel Game of Life, Zustand „Lebendig“ (1) stirbt bei Unter- oder Überbevölkerung:

```json
{ "target": 0, "combine": "any", "probability": 1, "conditions": [
  { "type": "neighborCount", "states": [1], "op": "<", "value": 2 },
  { "type": "neighborCount", "states": [1], "op": ">", "value": 3 }
] }
```

### 3.3 Nachbarschaft

```jsonc
{
  "preset": "moore",                     // nur informativ, siehe unten
  "offsets": [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]],
  "includeSelf": false                   // Zelle selbst bei neighborCount mitzählen
}
```

`offsets` ist maßgeblich: eine Liste relativer Positionen `[dx, dy]`, jeweils
−64 … 64, ohne `[0, 0]` und ohne Duplikate. `preset` wird beim Lesen aus
`offsets` neu bestimmt und dient nur der Anzeige:
`moore`, `vonNeumann`, `moore2`, `vonNeumann2`, `lookahead` (5 Zellen nach
rechts) oder `custom`.

### 3.4 Randbedingung

| Wert | Bedeutung |
|---|---|
| `{ "type": "torus" }` | gegenüberliegende Ränder sind verbunden |
| `{ "type": "fixed", "state": 0 }` | Positionen außerhalb gelten als Zustand `state` |
| `{ "type": "mirror" }` | gespiegelt: Die Position −1 entspricht 0, −2 entspricht 1 usw. |

## 4. Zelldaten

Jedes Zellfeld (`data.cells`, `data.initial`) ist eines von:

| Form | Beispiel | Verwendung |
|---|---|---|
| `{ "file": "<Eintrag>" }` | `{ "file": "cells.bin" }` | nur im ZIP-Container |
| `{ "rle": "<Läufe>" }` | `{ "rle": "120*0 3*1 0" }` | beide Varianten |
| `{ "fill": n }` | `{ "fill": 0 }` | alle Zellen im Zustand n |

Zellen sind immer **zeilenweise** angeordnet: Index = `y · width + x`,
beginnend oben links.

### 4.1 Binär (`cells.bin`, `initial.bin`)

Ohne Kopf, genau `width · height` Werte:
`cellEncoding: "u8"` → 1 Byte je Zelle; `"u16"` → 2 Byte je Zelle,
**Little Endian**. Mehr als 256 Zustände erfordern `"u16"`.

### 4.2 Alter (`ages.bin`)

Ohne Kopf, `width · height` vorzeichenlose 32-Bit-Zahlen, Little Endian.
Fehlt die Datei, gilt Alter 0 für alle Zellen.

### 4.3 Lauflängen (`rle`)

Durch Leerzeichen (oder Kommas) getrennte Einträge `Anzahl*Zustand` oder nur
`Zustand` (= Anzahl 1). Die Summe der Anzahlen muss genau `width · height`
ergeben.

## 5. Statistikverlauf

```json
{ "generations": [0, 1, 2], "counts": [[4470, 10, 0], [4462, 18, 0], [4451, 29, 0]] }
```

`counts[i][s]` ist die Anzahl der Zellen im Zustand `s` in Generation
`generations[i]`. Der Verlauf steht entweder in `history.json` oder inline in
`data.history`.

### 5.1 Messpunkte

Messpunkte sind einzelne Zellen, deren Zustand je Generation aufgezeichnet wird
(Statistik-Fenster › Messpunkte). Ihre Lage steht in `probes`, der Verlauf in
`probes.json` oder inline in `data.probeHistory`:

```json
{ "generations": [0, 1, 2], "series": [[1, 1, 0], [-1, 0, 0]] }
```

`series[k][i]` ist der Zustand von Messpunkt `k` in Generation `generations[i]`;
`-1` bedeutet „nicht aufgezeichnet“ (der Messpunkt kam erst später hinzu).
`series` hat genau so viele Einträge wie `probes`. Fehlt der Verlauf, beginnt
die Aufzeichnung beim Laden neu. Ältere AutoCell-Versionen ignorieren beides.

## 6. Versionierung und Kompatibilität

- `formatVersion` wird nur bei **inkompatiblen** Änderungen erhöht. Neue
  optionale Felder erhöhen sie nicht; Leser ignorieren unbekannte Felder.
- Eine Datei mit höherer `formatVersion` als unterstützt wird mit der Meldung
  „bitte AutoCell aktualisieren“ abgelehnt (inklusive `createdWith`).
- `createdWith.version` ist die Programmversion (SemVer, siehe `CHANGELOG.md`),
  nicht die Formatversion.
- Dateien aus AutoCell 1.x werden nicht unterstützt.

## 7. Fehlermeldungen

Beim Lesen wird die Datei vollständig geprüft. Fehler nennen die genaue Stelle,
z. B. `model.states[1].rules[0].target: Wert muss zwischen 0 und 2 liegen`.

## 8. Minimales Beispiel (reines JSON)

```json
{
  "format": "autocell-project",
  "formatVersion": 1,
  "meta": { "name": "Blinker" },
  "grid": { "width": 5, "height": 5 },
  "model": {
    "states": [
      { "name": "Tot", "color": "#0f1a13",
        "rules": [{ "target": 1, "conditions": [{ "type": "neighborCount", "states": [1], "op": "=", "value": 3 }] }] },
      { "name": "Lebendig", "color": "#7cf283",
        "rules": [{ "target": 0, "combine": "any", "conditions": [
          { "type": "neighborCount", "states": [1], "op": "<", "value": 2 },
          { "type": "neighborCount", "states": [1], "op": ">", "value": 3 } ] }] }
    ],
    "neighborhood": { "offsets": [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] },
    "boundary": { "type": "torus" }
  },
  "data": { "cells": { "rle": "7*0 1 4*0 1 4*0 1 7*0" } }
}
```
