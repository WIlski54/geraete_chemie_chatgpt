# Der Erste Weltkrieg (1914–1918) – Interaktives Arbeitsblatt

Digitale Vollversion des Recherche-Arbeitsblatts „Der Erste Weltkrieg (1914–1918)“
für Geschichte in Klasse 9 (Gesamtschule Meiderich). Flask + Socket.IO, iPad-first.

## Aufbau

Jeder Abschnitt des analogen Arbeitsblatts ist ein eigener Reiter. Jeder Reiter enthält
eine Kompakt-Info (M1–M5), die vollständige Palette der interaktiven Aufgabentypen
mit Niveau A/B/C und das Feld für die eigenen Recherche-Stichpunkte samt Quelle.

| Reiter | Aufgaben | Typen |
|---|---|---|
| Arbeitsblatt | – | Aufgabenstellung, Seitenansicht, Original-PDF, Recherche-Tipps |
| Ursachen | 1–8 | MC · Lückentext · Zuordnung · Sortierung · Diagramm (Militärausgaben) · Karte (Blöcke 1914) · KI-Freitext · Stichpunkte |
| Auslöser | 9–16 | Sortierung (Julikrise) · MC · Lückentext · Zuordnung · Diagramm (Tempo der Krise) · Karte (Orte der Julikrise) · KI-Freitext · Stichpunkte |
| Verlauf | 17–24 | MC · Lückentext · Zuordnung · Sortierung · Diagramm (Gefallene) · Karte (Fronten) · KI-Freitext · Stichpunkte |
| Kriegsende | 25–32 | MC · Lückentext · Sortierung · Zuordnung · Diagramm (US-Truppen) · Karte (Orte 1918) · KI-Freitext · Stichpunkte |
| Folgen | 33–40 | MC · Lückentext · Zuordnung · Diagramm (Verluste Versailles) · Sortierung · Karte (Europa 1920) · KI-Freitext · Stichpunkte |
| Zeitstrahl & Quellen | 41–43, T | Gesamt-Zeitstrahl · Quellenkritik-MC · Quellenverzeichnis · Transferaufgabe (KI) |

Niveau-Differenzierung (pro Aufgabe wählbar):

| Typ | A – Basis | B – Standard | C – Experte |
|---|---|---|---|
| Multiple Choice | 1 von 3 | 1 von 4 | 2 von 4 (Multi-Select) |
| Lückentext | Wortkiste (Tap-Chips) | freie Eingabe | kausaler Text, mehr Lücken |
| Zuordnung | 3 Paare | 4 Paare | 5 Paare |
| Sortierung | 3–4 Schritte mit Datum | 5–6 Schritte ohne Datum | 7–9 Schritte ohne Datum |
| Diagramm / Karte | Ablesen | Zusammenhang | Interpretation und Quellenkritik |
| Freitext | Satzstarter + Begriffe | Fachbegriffe | Beurteilung (AFB III) |

Weitere Bausteine: Fortschrittsbalken, Wiederaufnahme des Fortschritts nach Reload,
KI-Tutor (Avatar-Chat) und KI-Feedback mit Lehrerfreigabe, Live-Dashboard mit
KPI-Kacheln, Token-Budget, Freigabe-Panel und Klassenübersicht, Schüler-Detailansicht
mit Live-Antwortprotokoll, Stichpunkten/Quellen, Chat-Monitor, KI-Sperre und
DSGVO-Löschung. Inhalte liegen in `static/js/inhalte.js`, die Logik in `static/js/app.js`.

## Lokal starten

```bash
python -m venv .venv
source .venv/bin/activate          # Windows: .\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env               # Windows: Copy-Item .env.example .env
python app.py
```

Dann `http://127.0.0.1:5000` öffnen. Ohne `.env` lautet das Lehrerpasswort `geschichte9`;
vor einem echten Einsatz muss es über `LEHRER_PASSWORD` geändert werden.
Für KI-Tutor und KI-Feedback wird `GEMINI_API_KEY` benötigt; ohne Schlüssel bleiben alle
Aufgaben nutzbar, die KI-Flächen zeigen einen Hinweis.

Tests: `pip install pytest && pytest tests`

## Datenschutz

- Login nur mit Pseudonym und Klasse, Datenschutz- und KI-Hinweis muss bestätigt werden.
- Gespeichert werden Fortschritt, Antwortversuche (max. 500 Zeichen), Stichpunkte/Quellen
  und Metadaten der KI-Anfragen. Chat-Inhalte werden nicht gespeichert, nur live an die
  Detailansicht der Lehrkraft gesendet.
- Beim Start der Anwendung werden alle Sitzungsdaten gelöscht (`KEEP_SESSION_DATA=1` schaltet
  das ab). Die Lehrkraft kann einzelne Pseudonyme oder die ganze Sitzung löschen.

## Deployment (Coolify)

- Build Pack `Dockerfile`, Base Directory `/geschichte-erster-weltkrieg`,
  Dockerfile Location `/geschichte-erster-weltkrieg/Dockerfile`
- interner Port `5000`, Healthcheck `/health`, persistentes Volume nach `/app/data`
- Environment Variables aus `.env.example` in Coolify setzen (`SESSION_COOKIE_SECURE=1` hinter HTTPS)
- Der Dockerfile startet genau einen Gunicorn-/Eventlet-Worker, damit Socket.IO stabil bleibt.
