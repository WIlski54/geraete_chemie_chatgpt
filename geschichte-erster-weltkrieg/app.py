"""Interaktives Arbeitsblatt „Der Erste Weltkrieg (1914–1918)“.

Flask + Socket.IO Vollversion nach dem GSM-Blueprint:
pseudonymer Schülerzugang, differenzierte Aufgaben (A/B/C), Recherche-Notizen,
KI-Tutor mit Lehrerfreigabe, Live-Dashboard und Antwortprotokoll.
"""

import datetime as dt
import hashlib
import hmac
import json
import os
import re
import sqlite3
import threading
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from flask_socketio import SocketIO, emit, join_room

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:  # Die App bleibt ohne KI-Abhängigkeit nutzbar.
    genai = None
    genai_types = None


load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("DB_PATH") or os.path.join(BASE_DIR, "data", "weltkrieg.db")
APP_ID = "geschichte-erster-weltkrieg-v1"
AI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
DAILY_TOKEN_LIMIT = int(os.environ.get("DAILY_TOKEN_LIMIT", "50000"))
LEHRER_PASSWORD = os.environ.get("LEHRER_PASSWORD", "geschichte9")
ASSET_VERSION = "20260911a"

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-this-before-deployment")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "0") == "1",
    MAX_CONTENT_LENGTH=256 * 1024,
)
socketio = SocketIO(app, async_mode=os.environ.get("SOCKETIO_ASYNC_MODE", "threading"))

AI_CLIENT = genai.Client(api_key=GEMINI_API_KEY) if genai and GEMINI_API_KEY else None

# ── Arbeitsblatt-Struktur (muss zu static/js/inhalte.js passen) ─────────────
ABSCHNITTE = [
    {"key": "ursachen", "titel": "Ursachen", "kurz": "U", "aufgaben": [1, 2, 3, 4, 5, 6, 7, 8]},
    {"key": "ausloeser", "titel": "Auslöser", "kurz": "A", "aufgaben": [9, 10, 11, 12, 13, 14, 15, 16]},
    {"key": "verlauf", "titel": "Verlauf", "kurz": "V", "aufgaben": [17, 18, 19, 20, 21, 22, 23, 24]},
    {"key": "kriegsende", "titel": "Kriegsende", "kurz": "K", "aufgaben": [25, 26, 27, 28, 29, 30, 31, 32]},
    {"key": "folgen", "titel": "Folgen", "kurz": "F", "aufgaben": [33, 34, 35, 36, 37, 38, 39, 40]},
    {"key": "abschluss", "titel": "Zeitstrahl & Quellen", "kurz": "Z", "aufgaben": [41, 42, 43, "T"]},
]
ALLE_AUFGABEN = [str(nr) for a in ABSCHNITTE for nr in a["aufgaben"]]
AUFGABE_ZU_ABSCHNITT = {str(nr): a["key"] for a in ABSCHNITTE for nr in a["aufgaben"]}
NOTIZ_ABSCHNITTE = {a["key"] for a in ABSCHNITTE}
NIVEAUS = {"A", "B", "C", "Transfer"}
ANTWORT_TYPEN = {
    "mc", "mc-multi", "luecke", "zuordnung", "sortierung", "diagramm", "karte",
    "freitext", "freitext-kreativ", "notizen", "quellen",
}
AI_REQUEST_TYPES = {"chat", "korrektur"}

SYSTEM_PROMPT = """Du bist ein freundlicher Geschichts-Tutor für Schülerinnen und Schüler der Klasse 9
an der Gesamtschule Meiderich in Duisburg.
Thema der Stunde: Der Erste Weltkrieg (1914–1918) – Ursachen, Auslöser, Verlauf, Kriegsende und Folgen.
Wichtige Fachbegriffe: Imperialismus, Nationalismus, Militarismus, Wettrüsten, Bündnissystem
(Dreibund, Triple Entente), Pulverfass Balkan, Attentat von Sarajevo, Julikrise, Blankoscheck,
Ultimatum, Mobilmachung, Schlieffen-Plan, Zweifrontenkrieg, Marneschlacht, Stellungskrieg,
Materialschlacht (Verdun, Somme), Giftgas, U-Boot-Krieg, Kriegseintritt der USA, totaler Krieg,
Heimatfront, Russische Revolution, Brest-Litowsk, Frühjahrsoffensive, Oberste Heeresleitung,
Matrosenaufstand, Novemberrevolution, Waffenstillstand von Compiègne, Dolchstoßlegende,
14 Punkte Wilsons, Versailler Vertrag, Artikel 231, Reparationen, Völkerbund, Urkatastrophe.
Regeln:
- Erkläre auf dem Niveau einer 9. Klasse (Gesamtschule), anschaulich und mit Beispielen.
- Gib KEINE fertigen Lösungen für Aufgaben – stelle Rückfragen und gib Denkanstöße.
- Unterstütze bei der Recherche: nenne verlässliche Quellen (Schulbuch, bpb.de, LeMO des
  Deutschen Historischen Museums, Planet Wissen) und erkläre, woran man verlässliche Quellen erkennt.
- Achte auf die zeitliche Ordnung der Ereignisse und korrigiere falsche Jahreszahlen behutsam.
- Antworte auf Deutsch, in maximal 3–4 Sätzen, ermutigend und respektvoll.
- Transparenz: Du bist eine KI, das ist den Lernenden bekannt."""

KORREKTUR_PROMPT = """Du bist eine einfühlsame Geschichtslehrkraft (Klasse 9, Gesamtschule Meiderich Duisburg).
Thema: Der Erste Weltkrieg (1914–1918). Bewerte die Schülerantwort pädagogisch:
1. Lobe konkret, was RICHTIG ist – nenne richtige Begriffe, Daten und Zusammenhänge beim Namen.
2. Weise sanft auf sachliche Fehler, falsche Jahreszahlen oder Lücken hin – nie abwertend.
3. Bei unvollständigen Antworten: gib einen Hinweis, der weiterhilft, NICHT die komplette Lösung.
4. Bei Recherche-Stichpunkten: prüfe auch die zeitliche Ordnung und ob Quellen genannt sind.
5. Antworte auf Deutsch, ermutigend, maximal 3–4 Sätze.
6. Antworte NUR als JSON ohne Markdown: {"correct": true|false|null, "feedback": "dein Text", "hint": "optionaler Tipp"}
   correct=true, wenn die Antwort im Kern richtig und ausreichend ist; false bei sachlichen Fehlern;
   null, wenn es sich um eine Meinung/Beurteilung handelt, die man nicht als richtig/falsch bewerten kann."""

ki_gesperrt: set[str] = set()
student_connection_lock = threading.RLock()
student_connections: dict[str, set[str]] = {}
socket_owner: dict[str, str] = {}


# ── Hilfsfunktionen ──────────────────────────────────────────────────────────
def now_iso() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def get_db() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = sqlite3.connect(DB_PATH, timeout=10)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    return db


def init_db() -> None:
    with get_db() as db:
        db.executescript(
            """
            CREATE TABLE IF NOT EXISTS schueler (
                id TEXT PRIMARY KEY,
                pseudonym TEXT NOT NULL,
                klasse TEXT NOT NULL,
                joined_at TEXT NOT NULL,
                last_active TEXT,
                socket_id TEXT
            );
            CREATE TABLE IF NOT EXISTS fortschritt (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schueler_id TEXT NOT NULL,
                aufgabe_nr TEXT NOT NULL,
                niveau TEXT NOT NULL DEFAULT 'A',
                erledigt_at TEXT NOT NULL,
                UNIQUE(schueler_id, aufgabe_nr, niveau)
            );
            CREATE TABLE IF NOT EXISTS antworten (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schueler_id TEXT NOT NULL,
                aufgabe_nr TEXT NOT NULL,
                niveau TEXT NOT NULL,
                antwort_typ TEXT NOT NULL,
                antwort_text TEXT,
                korrekt INTEGER,
                versuch_nr INTEGER NOT NULL DEFAULT 1,
                erstellt_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS notizen (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schueler_id TEXT NOT NULL,
                abschnitt TEXT NOT NULL,
                stichpunkte TEXT NOT NULL DEFAULT '',
                quellen TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL,
                UNIQUE(schueler_id, abschnitt)
            );
            CREATE TABLE IF NOT EXISTS ki_anfragen (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schueler_id TEXT NOT NULL,
                typ TEXT NOT NULL,
                kontext TEXT,
                status TEXT NOT NULL DEFAULT 'wartend',
                token_count INTEGER NOT NULL DEFAULT 0,
                erstellt_at TEXT NOT NULL,
                bearbeitet_at TEXT
            );
            CREATE TABLE IF NOT EXISTS token_budget (
                datum TEXT PRIMARY KEY,
                tokens_used INTEGER NOT NULL DEFAULT 0
            );
            """
        )
        db.commit()


def clear_session_data() -> None:
    """DSGVO: Alle Sitzungsdaten beim Start löschen (Token-Budget bleibt)."""
    with get_db() as db:
        for table in ("fortschritt", "antworten", "notizen", "ki_anfragen", "schueler"):
            db.execute(f"DELETE FROM {table}")
        db.commit()
    ki_gesperrt.clear()


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def get_today_tokens() -> int:
    today = dt.date.today().isoformat()
    with get_db() as db:
        row = db.execute("SELECT tokens_used FROM token_budget WHERE datum=?", (today,)).fetchone()
    return int(row["tokens_used"]) if row else 0


def add_tokens(count: int) -> None:
    today = dt.date.today().isoformat()
    with get_db() as db:
        db.execute(
            "INSERT INTO token_budget (datum, tokens_used) VALUES (?, ?) "
            "ON CONFLICT(datum) DO UPDATE SET tokens_used = tokens_used + ?",
            (today, count, count),
        )
        db.commit()


def budget_ok() -> bool:
    return get_today_tokens() < DAILY_TOKEN_LIMIT


def budget_payload() -> dict:
    return {"today": get_today_tokens(), "limit": DAILY_TOKEN_LIMIT}


def response_token_count(response, fallback_text: str) -> int:
    usage = getattr(response, "usage_metadata", None)
    total = getattr(usage, "total_token_count", None) if usage else None
    return int(total) if total else estimate_tokens(fallback_text)


def generate_ai(contents: str, system_instruction: str):
    return AI_CLIENT.models.generate_content(
        model=AI_MODEL,
        contents=contents,
        config=genai_types.GenerateContentConfig(system_instruction=system_instruction),
    )


def parse_json_response(text: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.I | re.M).strip()
    try:
        result = json.loads(cleaned)
        if not isinstance(result, dict):
            raise ValueError
    except (json.JSONDecodeError, ValueError):
        return {"correct": None, "feedback": cleaned[:900], "hint": ""}
    return {
        "correct": result.get("correct") if isinstance(result.get("correct"), bool) else None,
        "feedback": str(result.get("feedback", ""))[:900],
        "hint": str(result.get("hint", ""))[:400],
    }


def touch_student(db: sqlite3.Connection, sid: str) -> None:
    db.execute("UPDATE schueler SET last_active=? WHERE id=?", (now_iso(), sid))


def student_online(sid: str) -> bool:
    with student_connection_lock:
        return bool(student_connections.get(sid))


def get_schueler_info(sid: str) -> dict:
    with get_db() as db:
        s = db.execute("SELECT * FROM schueler WHERE id=?", (sid,)).fetchone()
        if not s:
            return {}
        rows = db.execute(
            "SELECT aufgabe_nr, niveau FROM fortschritt WHERE schueler_id=?", (sid,)
        ).fetchall()
        antworten = db.execute(
            "SELECT COUNT(*) AS n FROM antworten WHERE schueler_id=?", (sid,)
        ).fetchone()["n"]
        pending = db.execute(
            "SELECT COUNT(*) AS n FROM ki_anfragen WHERE schueler_id=? AND status='wartend'", (sid,)
        ).fetchone()["n"]
        tokens = db.execute(
            "SELECT COALESCE(SUM(token_count),0) AS t FROM ki_anfragen WHERE schueler_id=?", (sid,)
        ).fetchone()["t"]
        notizen = db.execute(
            "SELECT COUNT(*) AS n FROM notizen WHERE schueler_id=? AND length(trim(stichpunkte))>0", (sid,)
        ).fetchone()["n"]
    erledigt = sorted({str(r["aufgabe_nr"]) for r in rows}, key=lambda x: (x == "T", int(x) if x.isdigit() else 0))
    abschnitte = {}
    for a in ABSCHNITTE:
        soll = [str(n) for n in a["aufgaben"]]
        abschnitte[a["key"]] = {
            "titel": a["titel"],
            "kurz": a["kurz"],
            "erledigt": len([n for n in soll if n in erledigt]),
            "gesamt": len(soll),
        }
    return {
        "id": s["id"],
        "pseudonym": s["pseudonym"],
        "klasse": s["klasse"],
        "joined_at": s["joined_at"],
        "last_active": s["last_active"],
        "online": student_online(sid),
        "ki_gesperrt": sid in ki_gesperrt,
        "aufgaben_erledigt": len(erledigt),
        "aufgaben_gesamt": len(ALLE_AUFGABEN),
        "erledigt_liste": erledigt,
        "niveaus": [{"nr": str(r["aufgabe_nr"]), "niveau": r["niveau"]} for r in rows],
        "abschnitte": abschnitte,
        "antworten": antworten,
        "notizen": notizen,
        "pending": pending,
        "tokens": int(tokens or 0),
    }


def alle_schueler_infos() -> list[dict]:
    with get_db() as db:
        ids = [r["id"] for r in db.execute("SELECT id FROM schueler ORDER BY last_active DESC").fetchall()]
    return [get_schueler_info(i) for i in ids]


def offene_anfragen() -> list[dict]:
    with get_db() as db:
        rows = db.execute(
            "SELECT k.*, s.pseudonym, s.klasse FROM ki_anfragen k JOIN schueler s ON k.schueler_id=s.id "
            "WHERE k.status='wartend' ORDER BY k.erstellt_at"
        ).fetchall()
    return [dict(r) for r in rows]


def schueler_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        sid = session.get("schueler_id")
        if not sid:
            if request.path.startswith("/api/"):
                return jsonify({"ok": False, "error": "nicht angemeldet"}), 401
            return redirect(url_for("login"))
        with get_db() as db:
            exists = db.execute("SELECT 1 FROM schueler WHERE id=?", (sid,)).fetchone()
        if not exists:
            session.clear()
            if request.path.startswith("/api/"):
                return jsonify({"ok": False, "error": "sitzung abgelaufen"}), 401
            return redirect(url_for("login"))
        return func(*args, **kwargs)

    return wrapper


def lehrer_required(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        if not session.get("is_lehrer"):
            if request.path.startswith("/api/") or request.is_json:
                return jsonify({"ok": False, "error": "nicht autorisiert"}), 401
            return redirect(url_for("lehrer_login"))
        return func(*args, **kwargs)

    return wrapper


def ensure_ai_request(request_id, typ: str, sid: str):
    """Liefert die freigegebene Anfrage oder None."""
    try:
        request_id = int(request_id)
    except (TypeError, ValueError):
        return None
    with get_db() as db:
        row = db.execute("SELECT * FROM ki_anfragen WHERE id=?", (request_id,)).fetchone()
    if not row or row["schueler_id"] != sid or row["typ"] != typ or row["status"] != "freigegeben":
        return None
    return row


def record_ai_tokens(tokens: int, request_id: int) -> None:
    add_tokens(tokens)
    with get_db() as db:
        db.execute("UPDATE ki_anfragen SET token_count=token_count+? WHERE id=?", (tokens, request_id))
        db.commit()
    socketio.emit("token_update", budget_payload(), to="lehrer_room")


# ── Seiten ───────────────────────────────────────────────────────────────────
@app.route("/")
def root():
    if session.get("schueler_id"):
        return redirect(url_for("arbeitsblatt"))
    return redirect(url_for("login"))


@app.route("/health")
def health():
    with get_db() as db:
        db.execute("SELECT 1")
    return jsonify({"ok": True, "app": APP_ID})


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        pseudonym = request.form.get("pseudonym", "").strip()[:30]
        klasse = request.form.get("klasse", "").strip()[:20]
        if len(pseudonym) < 2:
            error = "Bitte ein Pseudonym mit mindestens 2 Zeichen wählen."
        elif not klasse:
            error = "Bitte die Klasse eintragen."
        elif not request.form.get("privacy_ok"):
            error = "Bitte den Datenschutz- und KI-Hinweis bestätigen."
        else:
            sid = hashlib.sha256(f"{pseudonym}:{klasse}:{os.urandom(8).hex()}".encode()).hexdigest()[:16]
            now = now_iso()
            with get_db() as db:
                db.execute(
                    "INSERT INTO schueler (id, pseudonym, klasse, joined_at, last_active) VALUES (?,?,?,?,?)",
                    (sid, pseudonym, klasse, now, now),
                )
                db.commit()
            session.clear()
            session.update({"schueler_id": sid, "pseudonym": pseudonym, "klasse": klasse})
            socketio.emit("neuer_schueler", get_schueler_info(sid), to="lehrer_room")
            return redirect(url_for("arbeitsblatt"))
    return render_template("login.html", error=error, app_id=APP_ID, v=ASSET_VERSION)


@app.route("/logout", methods=["GET", "POST"])
def logout():
    session.pop("schueler_id", None)
    session.pop("pseudonym", None)
    session.pop("klasse", None)
    return redirect(url_for("login"))


@app.route("/arbeitsblatt")
@schueler_required
def arbeitsblatt():
    return render_template(
        "index.html",
        pseudonym=session["pseudonym"],
        klasse=session["klasse"],
        schueler_id=session["schueler_id"],
        abschnitte=ABSCHNITTE,
        aufgaben_gesamt=len(ALLE_AUFGABEN),
        v=ASSET_VERSION,
    )


@app.route("/lehrer/login", methods=["GET", "POST"])
def lehrer_login():
    error = None
    if request.method == "POST":
        if hmac.compare_digest(request.form.get("passwort", ""), LEHRER_PASSWORD):
            session["is_lehrer"] = True
            return redirect(url_for("lehrer_dashboard"))
        error = "Falsches Passwort."
    return render_template("lehrer_login.html", error=error, v=ASSET_VERSION)


@app.route("/lehrer/logout", methods=["GET", "POST"])
def lehrer_logout():
    session.pop("is_lehrer", None)
    return redirect(url_for("lehrer_login"))


@app.route("/lehrer")
@lehrer_required
def lehrer_dashboard():
    return render_template(
        "dashboard.html",
        schueler_infos=alle_schueler_infos(),
        offene=offene_anfragen(),
        today_tokens=get_today_tokens(),
        token_limit=DAILY_TOKEN_LIMIT,
        abschnitte=ABSCHNITTE,
        aufgaben_gesamt=len(ALLE_AUFGABEN),
        ki_konfiguriert=bool(AI_CLIENT),
        v=ASSET_VERSION,
    )


@app.route("/lehrer/schueler/<sid>")
@lehrer_required
def lehrer_schueler_detail(sid):
    info = get_schueler_info(sid)
    if not info:
        return redirect(url_for("lehrer_dashboard"))
    with get_db() as db:
        antworten = [
            dict(r)
            for r in db.execute(
                "SELECT * FROM antworten WHERE schueler_id=? ORDER BY erstellt_at, id", (sid,)
            ).fetchall()
        ]
        notizen = {
            r["abschnitt"]: dict(r)
            for r in db.execute("SELECT * FROM notizen WHERE schueler_id=?", (sid,)).fetchall()
        }
        anfragen = [
            dict(r)
            for r in db.execute(
                "SELECT * FROM ki_anfragen WHERE schueler_id=? ORDER BY erstellt_at DESC LIMIT 50", (sid,)
            ).fetchall()
        ]
    return render_template(
        "schueler_detail.html",
        info=info,
        antworten=antworten,
        notizen=notizen,
        anfragen=anfragen,
        abschnitte=ABSCHNITTE,
        v=ASSET_VERSION,
    )


# ── Schüler-API ──────────────────────────────────────────────────────────────
def normalize_task(value) -> str | None:
    text = str(value).strip().upper()
    if text == "T":
        return "T"
    return text if text in AUFGABE_ZU_ABSCHNITT else None


@app.route("/api/status")
@schueler_required
def api_status():
    sid = session["schueler_id"]
    with get_db() as db:
        rows = db.execute("SELECT aufgabe_nr, niveau FROM fortschritt WHERE schueler_id=?", (sid,)).fetchall()
        notizen = db.execute("SELECT abschnitt, stichpunkte, quellen FROM notizen WHERE schueler_id=?", (sid,)).fetchall()
    return jsonify(
        {
            "ok": True,
            "erledigt": [{"nr": r["aufgabe_nr"], "niveau": r["niveau"]} for r in rows],
            "notizen": {r["abschnitt"]: {"stichpunkte": r["stichpunkte"], "quellen": r["quellen"]} for r in notizen},
            "ki_gesperrt": sid in ki_gesperrt,
            "ki_konfiguriert": bool(AI_CLIENT),
            "aufgaben_gesamt": len(ALLE_AUFGABEN),
        }
    )


@app.route("/api/fortschritt", methods=["POST"])
@schueler_required
def api_fortschritt():
    data = request.get_json(silent=True) or {}
    aufgabe = normalize_task(data.get("aufgabe"))
    niveau = str(data.get("niveau", "A"))
    if aufgabe == "T":
        niveau = "Transfer"
    if not aufgabe or niveau not in NIVEAUS:
        return jsonify({"ok": False, "error": "ungültige Aufgabe"}), 400
    sid = session["schueler_id"]
    with get_db() as db:
        db.execute(
            "INSERT OR IGNORE INTO fortschritt (schueler_id, aufgabe_nr, niveau, erledigt_at) VALUES (?,?,?,?)",
            (sid, aufgabe, niveau, now_iso()),
        )
        touch_student(db, sid)
        db.commit()
    info = get_schueler_info(sid)
    info["aufgaben_neu"] = [{"nr": aufgabe, "niveau": niveau}]
    socketio.emit("fortschritt_update", info, to="lehrer_room")
    return jsonify({"ok": True, "erledigt": info["aufgaben_erledigt"], "gesamt": info["aufgaben_gesamt"]})


@app.route("/api/antwort", methods=["POST"])
@schueler_required
def api_antwort():
    data = request.get_json(silent=True) or {}
    aufgabe = normalize_task(data.get("aufgabe"))
    niveau = str(data.get("niveau", "A"))
    typ = str(data.get("typ", ""))
    if not aufgabe or niveau not in NIVEAUS or typ not in ANTWORT_TYPEN:
        return jsonify({"ok": False, "error": "ungültige Antwort"}), 400
    korrekt = data.get("korrekt")
    korrekt_db = None if korrekt is None else (1 if korrekt else 0)
    text = str(data.get("antwort", ""))[:500]
    sid = session["schueler_id"]
    now = now_iso()
    with get_db() as db:
        versuch = db.execute(
            "SELECT COUNT(*) AS n FROM antworten WHERE schueler_id=? AND aufgabe_nr=?", (sid, aufgabe)
        ).fetchone()["n"] + 1
        db.execute(
            "INSERT INTO antworten (schueler_id, aufgabe_nr, niveau, antwort_typ, antwort_text, korrekt, versuch_nr, erstellt_at) "
            "VALUES (?,?,?,?,?,?,?,?)",
            (sid, aufgabe, niveau, typ, text, korrekt_db, versuch, now),
        )
        touch_student(db, sid)
        db.commit()
        gesamt = db.execute("SELECT COUNT(*) AS n FROM antworten WHERE schueler_id=?", (sid,)).fetchone()["n"]
    socketio.emit(
        "antwort_live",
        {
            "schueler_id": sid, "aufgabe_nr": aufgabe, "niveau": niveau, "typ": typ,
            "antwort": text, "korrekt": korrekt_db, "versuch_nr": versuch, "zeit": now[11:16],
        },
        to=f"watch_{sid}",
    )
    socketio.emit("antwort_zaehler", {"schueler_id": sid, "antworten": gesamt}, to="lehrer_room")
    return jsonify({"ok": True, "versuch": versuch, "gesamt": gesamt})


@app.route("/api/notizen", methods=["GET", "POST"])
@schueler_required
def api_notizen():
    sid = session["schueler_id"]
    if request.method == "GET":
        with get_db() as db:
            rows = db.execute("SELECT abschnitt, stichpunkte, quellen, updated_at FROM notizen WHERE schueler_id=?", (sid,)).fetchall()
        return jsonify({"ok": True, "notizen": {r["abschnitt"]: dict(r) for r in rows}})
    data = request.get_json(silent=True) or {}
    abschnitt = str(data.get("abschnitt", ""))
    if abschnitt not in NOTIZ_ABSCHNITTE:
        return jsonify({"ok": False, "error": "unbekannter Abschnitt"}), 400
    stichpunkte = str(data.get("stichpunkte", ""))[:4000]
    quellen = str(data.get("quellen", ""))[:4000]
    now = now_iso()
    with get_db() as db:
        db.execute(
            "INSERT INTO notizen (schueler_id, abschnitt, stichpunkte, quellen, updated_at) VALUES (?,?,?,?,?) "
            "ON CONFLICT(schueler_id, abschnitt) DO UPDATE SET stichpunkte=excluded.stichpunkte, "
            "quellen=excluded.quellen, updated_at=excluded.updated_at",
            (sid, abschnitt, stichpunkte, quellen, now),
        )
        touch_student(db, sid)
        db.commit()
    socketio.emit(
        "notizen_live",
        {"schueler_id": sid, "abschnitt": abschnitt, "stichpunkte": stichpunkte, "quellen": quellen, "zeit": now[11:16]},
        to=f"watch_{sid}",
    )
    return jsonify({"ok": True, "updated_at": now})


@app.route("/api/ki-anfrage", methods=["POST"])
@schueler_required
def api_ki_anfrage():
    sid = session["schueler_id"]
    if sid in ki_gesperrt:
        return jsonify({"status": "gesperrt", "message": "Der KI-Zugang wurde von der Lehrkraft gesperrt."})
    if not budget_ok():
        return jsonify({"status": "budget_exceeded", "message": "Das Token-Budget für heute ist erschöpft."})
    data = request.get_json(silent=True) or {}
    typ = str(data.get("typ", "chat"))
    if typ not in AI_REQUEST_TYPES:
        return jsonify({"status": "error", "message": "Unbekannter Anfragetyp."}), 400
    kontext = str(data.get("kontext", ""))[:120]
    now = now_iso()
    with get_db() as db:
        cur = db.execute(
            "INSERT INTO ki_anfragen (schueler_id, typ, kontext, erstellt_at) VALUES (?,?,?,?)",
            (sid, typ, kontext, now),
        )
        touch_student(db, sid)
        db.commit()
        aid = cur.lastrowid
    payload = {
        "id": aid, "schueler_id": sid, "pseudonym": session.get("pseudonym", "?"),
        "klasse": session.get("klasse", "?"), "typ": typ, "kontext": kontext, "erstellt_at": now,
    }
    socketio.emit("neue_anfrage", payload, to="lehrer_room")
    return jsonify({"status": "wartend", "anfrage_id": aid})


@app.route("/api/chat", methods=["POST"])
@schueler_required
def api_chat():
    sid = session["schueler_id"]
    data = request.get_json(silent=True) or {}
    if sid in ki_gesperrt:
        return jsonify({"response": None, "blocked": True, "message": "🚫 Der KI-Zugang ist gesperrt."})
    anfrage = ensure_ai_request(data.get("anfrage_id"), "chat", sid)
    if not anfrage:
        return jsonify({"response": None, "blocked": True, "message": "Noch nicht freigegeben."})
    if not budget_ok():
        return jsonify({"response": None, "blocked": True, "message": "Das Token-Budget ist erschöpft."})
    message = str(data.get("message", "")).strip()[:1500]
    if not message:
        return jsonify({"response": "Bitte stelle zuerst eine Frage."}), 400
    if not AI_CLIENT:
        return jsonify({"response": "Die KI ist noch nicht konfiguriert (GEMINI_API_KEY fehlt). Frag bitte deine Lehrkraft.", "tokens": 0})
    try:
        transcript = []
        for item in (data.get("history") or [])[-8:]:
            role = "KI" if item.get("role") == "assistant" else "Schüler:in"
            transcript.append(f"{role}: {str(item.get('content', ''))[:1200]}")
        transcript.append(f"Schüler:in: {message}")
        kontext = str(data.get("kontext", ""))[:120]
        prompt = f"Aktueller Abschnitt des Arbeitsblatts: {kontext or 'unbekannt'}\nBisheriger Dialog:\n" + "\n".join(transcript)
        response = generate_ai(prompt, SYSTEM_PROMPT)
        reply = (response.text or "").strip() or "Ich konnte gerade keine Antwort formulieren. Versuch es bitte noch einmal."
        tokens = response_token_count(response, message + reply)
        record_ai_tokens(tokens, anfrage["id"])
        socketio.emit(
            "chat_live",
            {
                "schueler_id": sid, "pseudonym": session.get("pseudonym", "?"),
                "frage": message[:400], "antwort": reply[:800], "tokens": tokens,
                "zeit": dt.datetime.now().strftime("%H:%M"),
            },
            to=f"watch_{sid}",
        )
        return jsonify({"response": reply, "tokens": tokens})
    except Exception as exc:  # pragma: no cover - Netzwerk-/API-Fehler
        return jsonify({"response": f"Die KI konnte gerade nicht antworten: {exc}"}), 502


@app.route("/api/check-answer", methods=["POST"])
@schueler_required
def api_check_answer():
    sid = session["schueler_id"]
    data = request.get_json(silent=True) or {}
    if sid in ki_gesperrt:
        return jsonify({"correct": None, "blocked": True, "feedback": "🚫 Der KI-Zugang ist gesperrt."})
    anfrage = ensure_ai_request(data.get("anfrage_id"), "korrektur", sid)
    if not anfrage:
        return jsonify({"correct": None, "blocked": True, "feedback": "Noch nicht freigegeben."})
    if not budget_ok():
        return jsonify({"correct": None, "blocked": True, "feedback": "Das Token-Budget ist erschöpft."})
    answer = str(data.get("answer", "")).strip()[:2500]
    question = str(data.get("question", ""))[:800]
    context = str(data.get("context", ""))[:800]
    if len(answer) < 10:
        return jsonify({"correct": False, "feedback": "Bitte schreibe zuerst eine ausführlichere Antwort.", "hint": ""})
    if not AI_CLIENT:
        return jsonify(
            {
                "correct": None,
                "feedback": "Deine Antwort wurde gespeichert. Für KI-Feedback muss die Lehrkraft den Gemini-Schlüssel eintragen.",
                "hint": "Vergleiche deine Antwort mit den Kompakt-Infos des Abschnitts.",
            }
        )
    prompt = f"Aufgabe: {question}\nZusatzkontext: {context}\nSchülerantwort: {answer}"
    try:
        response = generate_ai(prompt, KORREKTUR_PROMPT)
        text = response.text or ""
        result = parse_json_response(text)
        tokens = response_token_count(response, prompt + text)
        record_ai_tokens(tokens, anfrage["id"])
        socketio.emit(
            "chat_live",
            {
                "schueler_id": sid, "pseudonym": session.get("pseudonym", "?"),
                "frage": f"[KI-Korrektur] {question[:120]} → {answer[:250]}",
                "antwort": result["feedback"][:800], "tokens": tokens,
                "zeit": dt.datetime.now().strftime("%H:%M"),
            },
            to=f"watch_{sid}",
        )
        return jsonify(result)
    except Exception as exc:  # pragma: no cover - Netzwerk-/API-Fehler
        return jsonify({"correct": None, "feedback": f"KI-Feedback derzeit nicht möglich: {exc}", "hint": ""}), 502


# ── Lehrer-API ───────────────────────────────────────────────────────────────
@app.route("/api/lehrer/state")
@lehrer_required
def api_lehrer_state():
    return jsonify(
        {
            "ok": True,
            "schueler": alle_schueler_infos(),
            "anfragen": offene_anfragen(),
            "budget": budget_payload(),
            "gesperrt": sorted(ki_gesperrt),
        }
    )


@app.route("/api/ki-entscheidung", methods=["POST"])
@lehrer_required
def api_ki_entscheidung():
    data = request.get_json(silent=True) or {}
    try:
        aid = int(data.get("anfrage_id"))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "anfrage_id fehlt"}), 400
    entscheid = data.get("entscheid")
    if entscheid not in ("freigegeben", "abgelehnt"):
        return jsonify({"ok": False, "error": "ungültige Entscheidung"}), 400
    with get_db() as db:
        row = db.execute("SELECT * FROM ki_anfragen WHERE id=?", (aid,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "unbekannte Anfrage"}), 404
        if row["status"] != "wartend":
            return jsonify({"ok": True, "status": row["status"], "already": True})
        db.execute("UPDATE ki_anfragen SET status=?, bearbeitet_at=? WHERE id=?", (entscheid, now_iso(), aid))
        db.commit()
    socketio.emit(
        "ki_entscheidung",
        {"anfrage_id": aid, "entscheid": entscheid, "typ": row["typ"]},
        to=f"schueler_{row['schueler_id']}",
    )
    socketio.emit("anfrage_erledigt", {"anfrage_id": aid, "entscheid": entscheid, "schueler_id": row["schueler_id"]}, to="lehrer_room")
    return jsonify({"ok": True, "status": entscheid})


@app.route("/api/lehrer/ki-sperren", methods=["POST"])
@lehrer_required
def api_ki_sperren():
    data = request.get_json(silent=True) or {}
    sid = str(data.get("schueler_id", ""))
    aktion = data.get("aktion", "sperren")
    if not sid:
        return jsonify({"ok": False}), 400
    if aktion == "sperren":
        ki_gesperrt.add(sid)
        with get_db() as db:
            db.execute("UPDATE ki_anfragen SET status='abgelehnt', bearbeitet_at=? WHERE schueler_id=? AND status='wartend'", (now_iso(), sid))
            db.commit()
    else:
        ki_gesperrt.discard(sid)
    gesperrt = sid in ki_gesperrt
    socketio.emit("ki_gesperrt", {"gesperrt": gesperrt}, to=f"schueler_{sid}")
    socketio.emit("ki_sperr_status", {"schueler_id": sid, "gesperrt": gesperrt}, to="lehrer_room")
    return jsonify({"ok": True, "gesperrt": gesperrt})


@app.route("/api/lehrer/daten-loeschen", methods=["POST"])
@lehrer_required
def api_daten_loeschen():
    data = request.get_json(silent=True) or {}
    sid = str(data.get("schueler_id", ""))
    if not sid:
        return jsonify({"ok": False}), 400
    with get_db() as db:
        for table in ("fortschritt", "antworten", "notizen", "ki_anfragen", "schueler"):
            db.execute(f"DELETE FROM {table} WHERE {'id' if table == 'schueler' else 'schueler_id'}=?", (sid,))
        db.commit()
    ki_gesperrt.discard(sid)
    socketio.emit("sitzung_beendet", {"grund": "geloescht"}, to=f"schueler_{sid}")
    socketio.emit("schueler_geloescht", {"id": sid}, to="lehrer_room")
    return jsonify({"ok": True})


@app.route("/api/lehrer/sitzung-zuruecksetzen", methods=["POST"])
@lehrer_required
def api_sitzung_zuruecksetzen():
    with get_db() as db:
        ids = [r["id"] for r in db.execute("SELECT id FROM schueler").fetchall()]
    clear_session_data()
    for sid in ids:
        socketio.emit("sitzung_beendet", {"grund": "zurueckgesetzt"}, to=f"schueler_{sid}")
    socketio.emit("sitzung_zurueckgesetzt", {}, to="lehrer_room")
    return jsonify({"ok": True, "geloescht": len(ids)})


# ── Socket.IO ────────────────────────────────────────────────────────────────
@socketio.on("schueler_join")
def on_schueler_join(_data=None):
    sid = session.get("schueler_id")
    if not sid:
        return
    with get_db() as db:
        cur = db.execute("UPDATE schueler SET socket_id=?, last_active=? WHERE id=?", (request.sid, now_iso(), sid))
        db.commit()
    if not cur.rowcount:
        emit("sitzung_beendet", {"grund": "unbekannt"})
        return
    join_room(f"schueler_{sid}")
    with student_connection_lock:
        sockets = student_connections.setdefault(sid, set())
        became_online = not sockets
        sockets.add(request.sid)
        socket_owner[request.sid] = sid
    emit("ki_gesperrt", {"gesperrt": sid in ki_gesperrt})
    if became_online:
        socketio.emit("schueler_online", get_schueler_info(sid), to="lehrer_room")


@socketio.on("lehrer_join")
def on_lehrer_join(_data=None):
    if not session.get("is_lehrer"):
        return
    join_room("lehrer_room")
    emit("alle_schueler", alle_schueler_infos())
    emit("token_update", budget_payload())
    emit("offene_anfragen", offene_anfragen())
    emit("sperr_status_all", {"gesperrt": sorted(ki_gesperrt)})


@socketio.on("watch_schueler")
def on_watch_schueler(data):
    if not session.get("is_lehrer"):
        return
    sid = str((data or {}).get("schueler_id", ""))
    if sid:
        join_room(f"watch_{sid}")
        emit("ki_sperr_status", {"schueler_id": sid, "gesperrt": sid in ki_gesperrt})


@socketio.on("disconnect")
def on_disconnect(*_args):
    with student_connection_lock:
        sid = socket_owner.pop(request.sid, None)
        if not sid:
            return
        sockets = student_connections.get(sid, set())
        sockets.discard(request.sid)
        went_offline = not sockets
        if went_offline:
            student_connections.pop(sid, None)
    if went_offline:
        with get_db() as db:
            db.execute("UPDATE schueler SET socket_id=NULL, last_active=? WHERE id=?", (now_iso(), sid))
            db.commit()
        socketio.emit("schueler_offline", {"id": sid}, to="lehrer_room")


init_db()
if os.environ.get("KEEP_SESSION_DATA", "0") != "1":
    clear_session_data()


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "5000")), debug=os.environ.get("FLASK_DEBUG", "0") == "1", allow_unsafe_werkzeug=True)
