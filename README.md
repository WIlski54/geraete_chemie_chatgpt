# Laborgeräte entdecken

Interaktives Chemie-Arbeitsblatt für den Klassenunterricht in Jahrgang 7.

## Enthalten

- pseudonymer Schülerzugang mit Datenschutz-/KI-Hinweis
- sechsteiliger, bildgestützter Lesepfad zu Werkstoffen von Laborgeräten mit Verständnisfragen und zeitgesteuerter Wiederholung
- A/B/C-differenziertes Einstiegsarbeitsblatt
- zufällige, wiederholungsarme Basis-Fragenserien zu Funktionen und Einsatz von mehr als 40 Laborgeräten
- Geräte-Quiz mit Tastatur- und Handschriftmodus
- objektbasiertes Zeichenlabor mit Auswahl, Verschieben, Formen, Text, Radierer und lehrkraftfreigegebener KI-Bildanalyse
- tap-basiertes Laborgeräte-Domino
- Originalmaterial mit iPad-sicherem Fokus-Reader
- Live-Lehrerdashboard, Antwortprotokoll und KI-Freigaben
- zeitlich begrenzte KI-Gruppenfreigaben mit Funktionsauswahl, Gruppen-/Einzellimits und dauerhafter Sofortsperre
- automatische Schüler-Zwischensicherung im Browser und auf dem App-Server samt Sitzungswiederaufnahme
- zusätzliche manuelle Schüler-JSON-Sicherung und temporäre serverseitige Unterrichtssitzungen
- geprüfte, verschlüsselte Langzeitsicherung auf dem Schul-IServ per WebDAV mit anschließender Datenbereinigung

## Lokal starten

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python app.py
```

Dann `http://127.0.0.1:5000` öffnen. Das Beispielpasswort für den Lehrerbereich ist ohne `.env` zunächst `labor7`; vor einem echten Einsatz muss es über `LEHRER_PASSWORD` geändert werden.

Für KI-Tutor, Handschrifterkennung und Zeichenfeedback wird `GEMINI_API_KEY` benötigt. Ohne Schlüssel bleiben alle übrigen Bereiche nutzbar und die KI-Flächen zeigen einen klaren Konfigurationshinweis.

## Bonus: Amiga-Emulator „AmigaWerk“

Unter `/amiga` (bzw. `static/amiga/index.html`, auch per Doppelklick ohne Server)
liegt ein vollständiger Amiga-Emulator im Browser mit Einstellungsdialog im Stil
klassischer Desktop-Emulatoren, freiem AROS-Kickstart und einer eingebauten
Demo-Diskette. Details und Lizenzen: [`static/amiga/README.md`](static/amiga/README.md).

## Verschlüsselte IServ-Sicherung

Der IServ-Prototyp ist standardmäßig deaktiviert. Erst wenn alle fünf benötigten
Variablen gesetzt sind, werden die Schaltflächen im Lehrer-Dashboard freigeschaltet:

```env
ISERV_WEBDAV_URL=https://webdav.gsm-w.de
ISERV_WEBDAV_USERNAME=...
ISERV_WEBDAV_PASSWORD=...
ISERV_BACKUP_PATH=Files/Backups_AB_KI
ISERV_BACKUP_ENCRYPTION_KEY=...
```

Einen zufälligen 32-Byte-Schlüssel im benötigten URL-safe-Base64-Format erzeugt:

```powershell
python -c "import base64,secrets; print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())"
```

Passwort und Verschlüsselungsschlüssel gehören ausschließlich in die echte `.env`
oder in die Secret-Verwaltung der Deployment-Plattform. Sie dürfen nicht in Git,
JavaScript, Screenshots oder Chatnachrichten erscheinen.

Die Anwendung legt den Zielordner absichtlich nicht selbst an. Der vorbereitete
Ordner muss über WebDAV erreichbar und für den konfigurierten Account beschreibbar
sein. Über „Verbindung testen“ lässt sich das ohne Schülerdaten prüfen.

Das Lehrer-Dashboard kann die verschlüsselten Sicherungen dieses Arbeitsblatts
auflisten, prüfen, laden und nach einer ausdrücklichen Bestätigung auch endgültig
von IServ löschen. Vor dem Löschen entschlüsselt und validiert das Backend die
Datei; Sicherungen anderer Arbeitsblätter im selben Ordner bleiben unberührt.

Der Abschlussknopf fordert zunächst alle aktuell erreichbaren Schülergeräte zu
einem letzten Autosave auf. Anschließend wird der vollständige Snapshot mit
AES-256-GCM verschlüsselt und als `.iabackup` übertragen. Die App lädt genau
diese Datei danach erneut von IServ, entschlüsselt sie und vergleicht einen
kanonischen SHA-256-Inhaltswert mit dem Ausgangssnapshot. Nur wenn diese Prüfung
erfolgreich ist, werden Schülerkonten, Antworten, Fortschritte, KI-Daten,
Zeichnungen, automatische Arbeitsstände und temporäre Sitzungskopien aus der
SQLite-Datenbank des App-Servers gelöscht. Schlägt Upload, Download, Entschlüsselung
oder Vergleich fehl, bleibt der komplette Serverstand erhalten. IServ erhält
keine unverschlüsselten Ergebnisdaten.

Die Anwendung aktiviert dabei SQLite `secure_delete`, kürzt das WAL und führt
bestmöglich `VACUUM` aus. Das löscht jedoch keine Kopien in externen
Provider-Snapshots, Volume-Backups, Serverlogs oder vorgelagerten Sicherungen.
Deren Aufbewahrung muss für den Produktivbetrieb zusätzlich in der
Hetzner-/Hosting-Konfiguration begrenzt und dokumentiert werden.

Beim Laden bietet das Dashboard zwei getrennte Modi an. „Zur Ansicht laden“
stellt die Sicherung als temporäre Live-Sitzung ohne Schüler-Wiederanmeldung
bereit. „Fortsetzungsstunde“ lädt dagegen die Arbeitsstände für die nächste
Stunde: Browser mit einem passenden zufälligen Token verbinden sich automatisch.
Fehlt das Token (anderes Gerät, gelöschte Browserdaten oder ältere Sicherung),
meldet sich der Schüler mit Pseudonym und Klasse an. Eindeutige Treffer kann die
Lehrkraft mit einem einzigen Sammelknopf übernehmen; mehrdeutige Treffer werden
einzeln zur Auswahl angezeigt. Eine bestehende Live-Sitzung wird in beiden Modi
erst nach Bestätigung ersetzt. Nach der Nutzung kann die geladene Sitzung wieder
über den geprüften IServ-Abschluss entfernt werden.

Jede Sicherung enthält im verschlüsselten Umschlag die eindeutige Arbeitsblatt-ID
und den frei vergebenen Sicherungsnamen. Neue Dateinamen tragen zusätzlich einen
kurzen, nicht personenbezogenen Marker der Arbeitsblatt-ID. Das Dashboard lädt
beim Öffnen die lesbaren Sicherungen, zeigt deren Namen an und blendet Dateien
anderer Arbeitsblätter im gemeinsam genutzten IServ-Ordner automatisch aus.

## Objektzeichnungen

Das Zeichenlabor speichert nicht nur ein Vorschaubild, sondern die vollständige
editierbare Objektstruktur. Freihandstriche, Linien, Rechtecke, Ellipsen und Texte
bleiben nach einem lokalen Import weiterhin auswählbar und verschiebbar. Über
„Zeichnung speichern“ kann der aktuelle Geräteentwurf ausdrücklich bestätigt
werden; Änderungen werden zusätzlich automatisch im Hintergrund abgelegt. Die Lehrkraft sieht die Vorschau in der Schülerdetailansicht; die
Objektstruktur und Vorschau sind Bestandteil lokaler Sitzungssnapshots und
verschlüsselter IServ-Sicherungen. Fabric.js wird lokal aus `static/vendor/`
ausgeliefert, damit der Editor im Unterricht nicht von einem CDN abhängt.

## Automatische Arbeitsstände

Nach Eingaben wird der vollständige Arbeitsstand entprellt zuerst in IndexedDB
des Schülergeräts und anschließend in `arbeitsstaende` auf dem App-Server
gespeichert. Lokale Einträge tragen eine Ablaufzeit von 48 Stunden. Ein zufälliges,
gehasht auf dem Server hinterlegtes Wiederaufnahmetoken verbindet denselben
Browser nach Schließen und erneutem Öffnen wieder mit der laufenden Sitzung. Nach
einem erfolgreichen IServ-Abschluss wird der lokale Arbeitsstand entfernt; nur
das zufällige Fortsetzungstoken bleibt im Browser. IServ enthält ausschließlich
den zugehörigen Hash innerhalb der verschlüsselten Sicherung. Weder IP-Adresse
noch MAC-Adresse werden zur Wiederaufnahme verwendet. Öffnet ein Schüler das
Arbeitsblatt vor der Lehrkraft, prüft die Anmeldeseite automatisch weiter und
verbindet den Lernplatz, sobald die Fortsetzungsstunde geladen wurde. Der
Sicherungsstatus ist auf der Schülerseite sichtbar, der Zeitpunkt des letzten
Server-Autosaves im Lehrer-Dashboard.

## KI-Gruppensteuerung

Die Lehrkraft kann KI-Funktionen für eine Klasse oder für alle aktuellen
Lernplätze zeitlich begrenzt freigeben. Tutor, Textfeedback, Zeichnungsanalyse
und Handschrifterkennung sind einzeln auswählbar. Zusätzlich gelten ein
Gruppenbudget, ein persönliches Budget pro Lernplatz und das globale Tagesbudget.
Die tatsächlich vom KI-Anbieter gemeldeten Gesamttokens werden bevorzugt
verwendet; nur wenn diese Metadaten fehlen, nutzt die Anwendung eine Schätzung.
Nach Zeit- oder Budgetende fällt die Anwendung auf einzelne Lehrkraftfreigaben
zurück. „KI für Gruppe sperren“ beendet die Freigabe sofort, weist noch wartende
Anfragen der Gruppe ab und speichert die Sperre in SQLite, sodass sie auch nach
einem Container-Neustart und für später hinzukommende Geräte derselben Klasse
gilt. Eine neue ausdrückliche Gruppenfreigabe hebt diese Sperre wieder auf.

## Deployment

Der enthaltene `Dockerfile` startet genau einen Gunicorn-/Eventlet-Worker, damit Socket.IO-Verbindungen stabil bleiben. Den Ordner `data/` als persistenten Speicher mounten.

### Coolify

- Quelle: Git-Repository, Build Pack `Dockerfile`
- Branch: `main`
- Base Directory: `/`
- Dockerfile Location: `/Dockerfile`
- interner Port: `5000`
- Healthcheck: `/health`
- persistentes Volume: Zielpfad `/app/data`
- `SESSION_COOKIE_SECURE=1`, sobald die Anwendung ausschließlich per HTTPS erreichbar ist

Alle Werte aus `.env.example` werden in Coolify unter **Environment Variables**
gesetzt. Echte Passwörter, API-Schlüssel und der IServ-Verschlüsselungsschlüssel
gehören nur dort hinein und niemals in das Repository oder in Build Arguments.
