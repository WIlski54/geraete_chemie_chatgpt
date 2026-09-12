# CLAUDE.md – Interaktives Arbeitsblatt „Der Erste Weltkrieg (1914–1918)“

Kontext für Claude Code beim Weiterarbeiten an diesem Projekt.

## Was das ist

Digitale Vollversion eines Recherche-Arbeitsblatts (Geschichte, Klasse 9, Gesamtschule
Meiderich Duisburg). Entstanden nach dem Skill „stephan-interaktives-arbeitsblatt-vollprojekt“.
Zielgeräte: iPads im Klassenraum (Tap statt Drag & Drop, Touch-Ziele mindestens 44 px, keine
Hover-only-Funktionen). Sprache der Oberfläche und des Codes-Kommentare: Deutsch.

## Stack

- Flask 3 + Flask-SocketIO 5 (`app.py`), SQLite im WAL-Modus (`data/weltkrieg.db`)
- Google Gemini über `google-genai` (Modell aus `GEMINI_MODEL`, Standard `gemini-3-flash-preview`);
  ohne `GEMINI_API_KEY` bleibt alles nutzbar, KI-Flächen zeigen einen Hinweis
- Frontend ohne Build-Schritt: Vanilla JS, Chart.js und Socket.IO-Client lokal in `static/vendor`
- Deployment: Dockerfile mit einem Gunicorn-/Eventlet-Worker, Coolify, Healthcheck `/health`

## Starten und testen

```bash
python -m venv .venv && source .venv/bin/activate   # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt pytest
cp .env.example .env
python app.py                                        # http://127.0.0.1:5000
pytest tests -q                                      # 12 Tests, laufen ohne API-Key
```

Lehrerbereich: `/lehrer/login`, Passwort aus `LEHRER_PASSWORD` (Standard `geschichte9`).

## Dateien

| Datei | Inhalt |
|---|---|
| `app.py` | Routen, API, Socket-Events, DB-Schema, KI-Prompts, `ABSCHNITTE` (Aufgabenstruktur) |
| `static/js/inhalte.js` | Alle Inhalte: Reiter, Kompakt-Infos, Aufgaben mit Niveau A/B/C, Kartendaten |
| `static/js/app.js` | Schüler-Logik: Renderer je Aufgabentyp, Fortschritt, Notizen-Autosave, KI-Freigabe, Chat, Karte |
| `static/js/dashboard.js`, `detail.js` | Lehrer-Dashboard und Schüler-Detailansicht (Live über Socket.IO) |
| `static/css/app.css` | Gesamtes Styling (GSM-Farben: Blau #006AB3, Orange #F7B800, Magenta #AD007C) |
| `templates/*.html` | login, lehrer_login, index (Schüler), dashboard, schueler_detail |
| `static/material/` | Original-PDF und Seitenbilder des analogen Arbeitsblatts |
| `tests/` | pytest: API-Flows und Konsistenz `inhalte.js` ↔ `ABSCHNITTE` |

## Inhalte ändern (häufigster Fall)

Alles Fachliche steht in `static/js/inhalte.js`. Struktur: `INHALTE.tabs[]` mit `key`, `label`,
`intro` (Kompakt-Info) und `aufgaben[]`. Jede Aufgabe hat `nr`, `typ`, `eyebrow`, `titel` und je
nach Typ `niveaus: {A, B, C}`.

| `typ` | Konfiguration je Niveau |
|---|---|
| `mc` | `frage`, `optionen: [{t, ok}]`, optional `multi: 2` (genau zwei richtige) |
| `luecke` | `text` mit Lücken `[Antwort|Alternative]`, `modus: "chips"` (Wortkiste, mit `ablenker`) oder `"input"` |
| `zuordnung` | `links`, `rechts` (Spaltentitel), `paare: [[links, rechts], …]` |
| `sortierung` | `items` in der richtigen Reihenfolge (werden gemischt), `hinweis` |
| `diagramm` | `chart` auf Aufgabenebene (Chart.js-Spezifikation) plus MC-Frage je Niveau |
| `karte` | `karte` (Schlüssel in `INHALTE.karten`), `benoetigt` (Anzahl zu erkundender Punkte) plus MC-Frage je Niveau |
| `freitext` | `aufgabe`, `begriffe`, `min` (Zeichen), Niveau A zusätzlich `starter` (Satzanfänge); `kontext` für die KI |
| `notizen` | Recherche-Stichpunkte je Abschnitt: `abschnitt`, `hinweis`, `kiFrage` |
| `quellen` | Quellenverzeichnis (nur im Abschluss-Reiter), `min` |
| `transfer` | Transferaufgabe mit `nr: "T"`, einstufig |

Kartenpunkte in `INHALTE.karten.<name>.punkte` mit `lon`/`lat` (Längen-/Breitengrad),
`bloc` (Farbe: mm, en, neutral, front, ort, neu, verlust, rest), `titel`, `text`.
Die Europakarte ist eine vereinfachte SVG-Skizze in `app.js` (`buildMapSVG`, Projektion
x = (lon + 12) · 17, y = (63 − lat) · 22).

**Feste Regel:** Die Aufgabennummern je Reiter müssen mit `ABSCHNITTE` in `app.py` übereinstimmen
(Test `test_inhalte_js_matches_server_structure`). Neue Aufgabe = in beiden Dateien eintragen.
Nummern sind fortlaufend 1–43 plus `"T"`.

## Konventionen aus dem Skill

- Jede differenzierte Aufgabe hat alle drei Niveaus; Niveauwechsel rendert nur die eigene Card neu.
- Keine doppelten `id`-Werte; Buttons `btn-tab-*`, Panels `tab-*`, Cards `card-<nr>`, Feedback `fb-<nr>`.
- Jede Antwort geht über `sendAntwort(nr, typ, text, korrekt)` an `/api/antwort`; bei geblockter KI
  (`data.blocked`) kein `sendAntwort`.
- KI nie direkt: `requestKiAccess(typ, kontext, callback)` → Modal → Lehrerfreigabe → erst dann fetch.
  Chat-Eingabe erst nach Freigabe leeren.
- Socket-Räume: `lehrer_room` (Dashboard und Detail), `watch_<sid>` (nur Detail: `chat_live`,
  `antwort_live`, `notizen_live`), `schueler_<sid>` (Entscheidungen). Jedes Event an genau einen Raum.
- DSGVO: nur Pseudonym und Klasse; Chat-Inhalte werden nicht gespeichert; `clear_session_data()` beim Start.
- JS-Kommentare einzeilig halten (keine mehrzeiligen Unicode-Linien).

## Qualitätssicherung vor dem Abschluss

```bash
node --check static/js/*.js
pytest tests -q
grep -o 'id="[^"]*"' templates/index.html | sort | uniq -d   # muss leer sein
```
