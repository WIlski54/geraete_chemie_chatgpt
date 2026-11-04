# AmigaWerk – Amiga-Emulator im Browser

Ein Amiga-Emulator mit einer Oberfläche im Stil des bekannten Eigenschaften-Dialogs
klassischer Desktop-Emulatoren: Baumansicht links (Schnellstart, Hardware, Host),
Einstellungsseiten rechts, Start/Abbrechen/Hilfe unten.

## Starten

- **In der Flask-App:** `http://127.0.0.1:5000/amiga`
- **Ohne Server:** `static/amiga/index.html` doppelklicken. Alles läuft dann offline
  (der Ton nimmt automatisch den Ersatzweg über den ScriptProcessor).
- **Mit beliebigem Webserver:** den Ordner `static/amiga/` ausliefern, z. B.
  `python -m http.server` darin starten.

Nach dem Öffnen erscheint der Dialog. **Start** bootet sofort den eingebauten
AROS-Kickstart. Mit **Demo-Diskette einlegen** (Schnellstart) erscheint ein kleines
selbst geschriebenes Regenbogen-Intro aus dem Bootblock. Eigene Disketten (ADF, DMS,
ADZ, ZIP) einfach aufs Fenster ziehen.

## Funktionen

| Seite | Inhalt |
|---|---|
| Schnellstart | Modell A500 … A4000 mit typischen Ausstattungen, NTSC, Kompatibilitäts-Schieberegler, Kickstart-Wahl, DF0:/DF1: mit Verlaufsliste |
| Konfigurationen | benannte Konfigurationen speichern/laden, Export/Import als JSON |
| CPU und FPU | 68000/010/020/030, 24-Bit-Adressierung, Kompatibilität, Geschwindigkeit |
| Chipsatz | OCS, ECS Agnus/Denise, Full ECS, AGA, Blitter, Kollisionen |
| ROM | AROS eingebaut oder eigene Kickstart, Erweiterungs-ROM, Cloanto-`rom.key` |
| RAM | Chip, Slow, Zorro II/III Fast, A3000/A4000-Hauptplatinenspeicher |
| Diskettenlaufwerke | DF0:–DF3:, Typ, Schreibschutz, Geschwindigkeit, leere Disketten erzeugen |
| Festplatten | IDE0:–IDE3: (HDF) bei A600/A1200/A4000 |
| Anzeige / Filter | Auflösung, Zeilenmodus, WebGL/Canvas, Skalierung, Scanlines, Randabdunklung, Helligkeit/Kontrast/Gamma |
| Sound | Paula-Emulation, Frequenz, Stereo-Trennung, Interpolation, Filter |
| Gameports / Eingabe | Maus, Gamepad oder Joystick über Tastatur |
| Diskettenwechsler | Sammlung im Browser für mehrteilige Spiele |
| Verschiedenes | Pausieren im Hintergrund, Statusleiste, Autostart, serielle Ausgabe |

Zur Laufzeit: Werkzeugleiste (Einstellungen, Pause, Reset, Disketten, Speichern,
Ton, Bildschirmfoto, Vollbild) und Statusleiste mit Power-/HD-LED, Spuranzeige
DF0:–DF3:, FPS und CPU-Last. **F12** öffnet den Dialog, Hardware-Änderungen
führen nach Rückfrage zum Neustart des Amiga. Beschriebene Disketten werden
automatisch im Browser gesichert und lassen sich als ADF herunterladen.

## Aufbau

```
static/amiga/
  index.html        Oberfläche (Dialog, Emulator-Fenster)
  css/app.css       Gestaltung
  js/app.js         Oberflächenlogik, Übersetzung in die Kern-Konfiguration
  js/files.js       Datei-Einlesen (ZIP/ADZ entpacken), CRC32, IndexedDB
  js/demodisk.js    eingebaute Demo-Diskette (selbst geschriebener Bootblock)
  roms/aros.js      AROS-Kickstart-Ersatz, Base64 (für file://)
  sae/              Emulationskern SAE 0.9.20, unverändert
```

## Lizenzen

- **Emulationskern** `sae/`: SAE – Scripted Amiga Emulator, © Rupert Hausberger,
  GNU GPL 2.0 oder neuer (`sae/LICENSE-GPL-2.0.html`, Quelle:
  <https://github.com/naTmeg/ScriptedAmigaEmulator>, Stand siehe `sae/VERSION.txt`).
  Da Oberfläche und Kern gemeinsam ausgeliefert werden, gilt für das
  Gesamtpaket ebenfalls die GPL.
- **AROS-ROM** `roms/aros.js`: AROS Public License, <https://aros.sourceforge.io>.
- **Original-Kickstarts** von Commodore sind urheberrechtlich geschützt und
  liegen nicht bei. Legal erhältlich z. B. über „Amiga Forever“ (Cloanto).
  Geladene ROMs und Disketten bleiben im Browser der jeweiligen Person.
