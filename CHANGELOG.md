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
