import base64
import datetime as dt
import hashlib
import io
import json
import os
import re
import secrets
import sqlite3
import threading
import time
import uuid
from contextlib import contextmanager
from functools import wraps

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, render_template, request, session, url_for
from flask_socketio import SocketIO, emit, join_room

from iserv_backup import (
    IservBackupError,
    IservBackupService,
    IservConfigurationError,
    IservConnectionError,
    configuration_status,
)

try:
    from google import genai
    from google.genai import types as genai_types
except ImportError:  # The app remains usable without AI dependencies.
    genai = None
    genai_types = None


load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "laborgeraete.db")
APP_ID = "chemie-laborgeraete-jg7-v1"
AI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3-flash-preview")
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
DAILY_TOKEN_LIMIT = int(os.environ.get("DAILY_TOKEN_LIMIT", "50000"))
LEHRER_PASSWORD = os.environ.get("LEHRER_PASSWORD", "labor7")

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change-this-before-deployment")
app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("SESSION_COOKIE_SECURE", "0") == "1",
)
socketio = SocketIO(app, async_mode="threading")

AI_CLIENT = genai.Client(api_key=GEMINI_API_KEY) if genai and GEMINI_API_KEY else None

teacher_action_tokens: set[str] = set()
ki_blocked_students: set[str] = set()
student_connection_lock = threading.RLock()
student_connections: dict[str, set[str]] = {}
student_connection_owners: dict[str, str] = {}
autosave_flush_condition = threading.Condition()
autosave_flush_acks: dict[str, set[str]] = {}

SYSTEM_PROMPT = """Du bist ein freundlicher Chemie-Tutor für Schülerinnen und Schüler
der Jahrgangsstufe 7 im Klassenunterricht an der Gesamtschule Meiderich in Duisburg.
Thema: Erste Begegnung mit Laborgeräten.
Wichtige Begriffe: Becherglas, Reagenzglas, Erlenmeyerkolben, Messzylinder,
Trichter, Pipette, Spatel, Schutzbrille, Gasbrenner, Stativ, Thermometer und Mörser.
Regeln:
- Erkläre altersgerecht, konkret und in höchstens vier kurzen Sätzen.
- Gib nicht sofort die komplette Lösung, sondern führe mit einem Hinweis oder einer Rückfrage.
- Sicherheit steht immer an erster Stelle.
- Nutze für chemische Gleichungen saubere LaTeX-Schreibweise mit $...$.
- Antworte auf Deutsch und mache transparent, dass du eine KI bist."""

DRAWING_DEVICE_NAMES = {
    "Becherglas",
    "Reagenzglas",
    "Erlenmeyerkolben",
    "Messzylinder",
    "Spritzflasche",
    "Mörser",
    "Gasbrenner",
    "Dreifuß",
}
ALLOWED_DRAWING_OBJECT_TYPES = {
    "path",
    "rect",
    "ellipse",
    "line",
    "i-text",
    "textbox",
    "image",
}
MAX_DRAWING_JSON_BYTES = 500_000
MAX_DRAWING_PREVIEW_CHARS = 1_500_000
MAX_WORKSPACE_STATE_BYTES = 4_000_000
AUTOSAVE_FLUSH_TIMEOUT_SECONDS = 2.5
AI_REQUEST_TYPES = {"chat", "korrektur", "zeichnung", "handschrift"}
CONTINUATION_STATE_ID = 1
AI_GROUP_STATE_ID = 1


def now_iso() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def hash_resume_token(token: str) -> str:
    return hashlib.sha256(f"{APP_ID}:{token}".encode("utf-8")).hexdigest()


def normalized_identity(value: str) -> str:
    return " ".join(str(value).strip().casefold().split())


@contextmanager
def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA secure_delete=ON")
    try:
        yield db
    finally:
        db.close()


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
                socket_id TEXT,
                resume_token_hash TEXT
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
            CREATE TABLE IF NOT EXISTS ki_anfragen (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schueler_id TEXT NOT NULL,
                typ TEXT NOT NULL,
                kontext TEXT,
                status TEXT NOT NULL DEFAULT 'wartend',
                token_count INTEGER NOT NULL DEFAULT 0,
                erstellt_at TEXT NOT NULL,
                bearbeitet_at TEXT,
                grant_mode TEXT NOT NULL DEFAULT 'einzel'
            );
            CREATE TABLE IF NOT EXISTS chat_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schueler_id TEXT NOT NULL,
                request_id INTEGER,
                role TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS zeichnungen (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                schueler_id TEXT NOT NULL,
                geraet TEXT NOT NULL,
                canvas_json TEXT NOT NULL,
                preview_data TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(schueler_id, geraet)
            );
            CREATE TABLE IF NOT EXISTS arbeitsstaende (
                schueler_id TEXT PRIMARY KEY,
                state_json TEXT NOT NULL,
                revision INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS token_budget (
                datum TEXT PRIMARY KEY,
                tokens_used INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS gespeicherte_sitzungen (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                snapshot_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS fortsetzungsstatus (
                id INTEGER PRIMARY KEY CHECK (id=1),
                active INTEGER NOT NULL DEFAULT 0,
                source_name TEXT,
                started_at TEXT
            );
            CREATE TABLE IF NOT EXISTS fortsetzungsziele (
                student_id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'verfuegbar'
            );
            CREATE TABLE IF NOT EXISTS fortsetzungsanfragen (
                id TEXT PRIMARY KEY,
                new_student_id TEXT NOT NULL,
                pseudonym TEXT NOT NULL,
                klasse TEXT NOT NULL,
                resume_token_hash TEXT NOT NULL,
                target_student_id TEXT,
                status TEXT NOT NULL DEFAULT 'wartend',
                created_at TEXT NOT NULL,
                decided_at TEXT
            );
            CREATE TABLE IF NOT EXISTS ki_gruppenfreigabe (
                id INTEGER PRIMARY KEY CHECK (id=1),
                active INTEGER NOT NULL DEFAULT 0,
                locked INTEGER NOT NULL DEFAULT 0,
                klasse TEXT NOT NULL DEFAULT '',
                allowed_types TEXT NOT NULL DEFAULT '[]',
                starts_at TEXT,
                expires_at TEXT,
                token_limit INTEGER NOT NULL DEFAULT 0,
                tokens_used INTEGER NOT NULL DEFAULT 0,
                per_student_limit INTEGER NOT NULL DEFAULT 0
            );
            """
        )
        student_columns = {
            row["name"] for row in db.execute("PRAGMA table_info(schueler)").fetchall()
        }
        if "resume_token_hash" not in student_columns:
            db.execute("ALTER TABLE schueler ADD COLUMN resume_token_hash TEXT")
        ai_request_columns = {
            row["name"] for row in db.execute("PRAGMA table_info(ki_anfragen)").fetchall()
        }
        if "grant_mode" not in ai_request_columns:
            db.execute(
                "ALTER TABLE ki_anfragen ADD COLUMN grant_mode TEXT NOT NULL DEFAULT 'einzel'"
            )
        ai_group_columns = {
            row["name"] for row in db.execute("PRAGMA table_info(ki_gruppenfreigabe)").fetchall()
        }
        if "locked" not in ai_group_columns:
            db.execute(
                "ALTER TABLE ki_gruppenfreigabe ADD COLUMN locked INTEGER NOT NULL DEFAULT 0"
            )
        db.execute(
            "INSERT OR IGNORE INTO fortsetzungsstatus(id,active) VALUES (?,0)",
            (CONTINUATION_STATE_ID,),
        )
        db.execute(
            "INSERT OR IGNORE INTO ki_gruppenfreigabe(id,active) VALUES (?,0)",
            (AI_GROUP_STATE_ID,),
        )
        # Socket-IDs belong to one running server process. After a restart they
        # are necessarily stale and must never make old pupils appear online.
        db.execute("UPDATE schueler SET socket_id=NULL")
        db.commit()


init_db()


def active_student_ids() -> set[str]:
    """Return the pupils with at least one live Socket.IO connection."""
    with student_connection_lock:
        return {student_id for student_id, sockets in student_connections.items() if sockets}


def clear_active_student_connections(student_ids: set[str] | None = None) -> None:
    """Forget ephemeral connection state after reset, delete or snapshot restore."""
    with student_connection_lock:
        targets = set(student_connections) if student_ids is None else set(student_ids)
        for student_id in targets:
            for socket_id in student_connections.pop(student_id, set()):
                student_connection_owners.pop(socket_id, None)


def request_student_autosave_flush(
    timeout_seconds: float = AUTOSAVE_FLUSH_TIMEOUT_SECONDS,
) -> dict:
    """Ask connected clients to persist their latest state before archiving."""
    online_ids = active_student_ids()
    if not online_ids:
        return {"online": 0, "confirmed": 0, "missing": 0}

    request_id = uuid.uuid4().hex
    with autosave_flush_condition:
        autosave_flush_acks[request_id] = set()
    for student_id in online_ids:
        socketio.emit(
            "autosave_flush",
            {"request_id": request_id},
            to=f"schueler_{student_id}",
        )

    deadline = time.monotonic() + max(0.1, timeout_seconds)
    with autosave_flush_condition:
        while True:
            confirmed = autosave_flush_acks.get(request_id, set()) & online_ids
            if confirmed == online_ids:
                break
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            autosave_flush_condition.wait(remaining)
        confirmed = set(autosave_flush_acks.pop(request_id, set())) & online_ids
    return {
        "online": len(online_ids),
        "confirmed": len(confirmed),
        "missing": len(online_ids - confirmed),
    }


def schueler_required(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        student_id = session.get("schueler_id")
        if not student_id:
            return redirect(url_for("login"))
        with get_db() as db:
            exists = db.execute(
                "SELECT 1 FROM schueler WHERE id=?", (student_id,)
            ).fetchone()
        if not exists:
            session.pop("schueler_id", None)
            session.pop("pseudonym", None)
            session.pop("klasse", None)
            session.pop("resume_token", None)
            if request.path.startswith("/api/"):
                return jsonify({"ok": False, "error": "Die Unterrichtssitzung wurde beendet."}), 401
            return redirect(url_for("login"))
        return func(*args, **kwargs)

    return wrapped


def teacher_authorized() -> bool:
    token = request.headers.get("X-Teacher-Action-Token", "")
    return bool(session.get("is_lehrer") or (token and token in teacher_action_tokens))


def teacher_api_required(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        if not teacher_authorized():
            return jsonify({"ok": False, "error": "Nicht autorisiert."}), 403
        return func(*args, **kwargs)

    return wrapped


def teacher_page_required(func):
    @wraps(func)
    def wrapped(*args, **kwargs):
        if not session.get("is_lehrer"):
            return redirect(url_for("lehrer_login"))
        return func(*args, **kwargs)

    return wrapped


def estimate_tokens(text: str) -> int:
    return max(1, len(text) // 4)


def get_today_tokens() -> int:
    today = dt.date.today().isoformat()
    with get_db() as db:
        row = db.execute(
            "SELECT tokens_used FROM token_budget WHERE datum=?", (today,)
        ).fetchone()
    return int(row["tokens_used"]) if row else 0


def add_tokens(count: int) -> None:
    today = dt.date.today().isoformat()
    with get_db() as db:
        db.execute(
            """INSERT INTO token_budget(datum, tokens_used) VALUES (?, ?)
               ON CONFLICT(datum) DO UPDATE SET tokens_used=tokens_used+excluded.tokens_used""",
            (today, max(0, int(count))),
        )
        db.commit()


def response_token_count(response, fallback_text: str) -> int:
    usage = getattr(response, "usage_metadata", None)
    actual = getattr(usage, "total_token_count", None) if usage else None
    try:
        return max(1, int(actual)) if actual is not None else estimate_tokens(fallback_text)
    except (TypeError, ValueError):
        return estimate_tokens(fallback_text)


def ai_group_status(student_id: str | None = None, request_type: str | None = None) -> dict:
    now = dt.datetime.now()
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM ki_gruppenfreigabe WHERE id=?", (AI_GROUP_STATE_ID,)
        ).fetchone()
        if not row:
            return {"active": False, "allowed": False, "reason": "Keine Gruppenfreigabe."}
        state = dict(row)
        expires_at = None
        try:
            expires_at = dt.datetime.fromisoformat(state.get("expires_at") or "")
        except ValueError:
            pass
        was_active = bool(state.get("active"))
        token_limit = int(state.get("token_limit") or 0)
        exhausted = bool(
            was_active
            and token_limit > 0
            and int(state.get("tokens_used") or 0) >= token_limit
        )
        daily_exhausted = get_today_tokens() >= DAILY_TOKEN_LIMIT
        expired = bool(was_active and expires_at and expires_at <= now)
        if was_active and (expired or exhausted or daily_exhausted):
            db.execute(
                "UPDATE ki_gruppenfreigabe SET active=0 WHERE id=?",
                (AI_GROUP_STATE_ID,),
            )
            db.commit()
            state["active"] = 0
        allowed_types = []
        try:
            allowed_types = json.loads(state.get("allowed_types") or "[]")
        except json.JSONDecodeError:
            allowed_types = []
        state["allowed_types"] = [
            item for item in allowed_types if item in AI_REQUEST_TYPES
        ]
        state["active"] = bool(state.get("active"))
        state["locked"] = bool(state.get("locked"))
        state["remaining_tokens"] = max(
            0, int(state.get("token_limit") or 0) - int(state.get("tokens_used") or 0)
        )
        state["daily_tokens"] = get_today_tokens()
        state["daily_limit"] = DAILY_TOKEN_LIMIT
        state["allowed"] = state["active"]
        state["reason"] = ""
        if not state["active"]:
            state["allowed"] = False
            if daily_exhausted:
                state["reason"] = "Das KI-Tagesbudget ist erreicht."
            elif expired or exhausted:
                state["reason"] = "Die Gruppenfreigabe ist abgelaufen oder ihr Budget ist erreicht. Einzelanfragen sind wieder möglich."
            else:
                state["reason"] = "Einzelanfragen sind aktiv; eine Gruppenfreigabe läuft nicht."
            return state
        if request_type and request_type not in state["allowed_types"]:
            state["allowed"] = False
            state["reason"] = "Diese KI-Funktion ist für die Gruppe nicht freigegeben."
            return state
        if student_id:
            student = db.execute(
                "SELECT klasse FROM schueler WHERE id=?", (student_id,)
            ).fetchone()
            if not student:
                state["allowed"] = False
                state["reason"] = "Der Lernplatz wurde nicht gefunden."
                return state
            if state.get("klasse") and normalized_identity(student["klasse"]) != normalized_identity(
                state["klasse"]
            ):
                state["allowed"] = False
                state["reason"] = "Die Gruppenfreigabe gilt für eine andere Klasse."
                return state
            usage = db.execute(
                """SELECT COALESCE(SUM(token_count),0) AS used
                   FROM ki_anfragen
                   WHERE schueler_id=? AND grant_mode='gruppe' AND erstellt_at>=?""",
                (student_id, state.get("starts_at") or ""),
            ).fetchone()
            state["student_tokens"] = int(usage["used"] if usage else 0)
            if state["student_tokens"] >= int(state.get("per_student_limit") or 0):
                state["allowed"] = False
                state["reason"] = "Dein persönliches KI-Budget für diese Freigabe ist erreicht."
        return state


def ai_group_lock_applies(student_id: str) -> bool:
    with get_db() as db:
        state = db.execute(
            "SELECT locked,klasse FROM ki_gruppenfreigabe WHERE id=?",
            (AI_GROUP_STATE_ID,),
        ).fetchone()
        if not state or not state["locked"]:
            return False
        student = db.execute(
            "SELECT klasse FROM schueler WHERE id=?", (student_id,)
        ).fetchone()
    return bool(
        student
        and (
            not state["klasse"]
            or normalized_identity(student["klasse"]) == normalized_identity(state["klasse"])
        )
    )


def record_ai_tokens(count: int, request_id, student_id: str) -> dict:
    token_count = max(0, int(count))
    today = dt.date.today().isoformat()
    with get_db() as db:
        db.execute(
            """INSERT INTO token_budget(datum,tokens_used) VALUES (?,?)
               ON CONFLICT(datum) DO UPDATE SET tokens_used=tokens_used+excluded.tokens_used""",
            (today, token_count),
        )
        request_row = db.execute(
            "SELECT grant_mode FROM ki_anfragen WHERE id=? AND schueler_id=?",
            (request_id, student_id),
        ).fetchone()
        db.execute(
            "UPDATE ki_anfragen SET token_count=token_count+? WHERE id=? AND schueler_id=?",
            (token_count, request_id, student_id),
        )
        if request_row and request_row["grant_mode"] == "gruppe":
            db.execute(
                "UPDATE ki_gruppenfreigabe SET tokens_used=tokens_used+? WHERE id=?",
                (token_count, AI_GROUP_STATE_ID),
            )
        db.commit()
    return ai_group_status()


def ensure_ai_request(request_id, request_type: str, student_id: str):
    if (
        student_id in ki_blocked_students
        or ai_group_lock_applies(student_id)
        or get_today_tokens() >= DAILY_TOKEN_LIMIT
    ):
        return None
    if not request_id:
        return None
    with get_db() as db:
        row = db.execute(
            """SELECT * FROM ki_anfragen
               WHERE id=? AND typ=? AND schueler_id=? AND status='freigegeben'""",
            (request_id, request_type, student_id),
        ).fetchone()
    if row and row["grant_mode"] == "gruppe":
        return row if ai_group_status(student_id, request_type)["allowed"] else None
    return row


def generate_ai(contents, system_instruction: str | None = None):
    if not AI_CLIENT:
        return None
    return AI_CLIENT.models.generate_content(
        model=AI_MODEL,
        contents=contents,
        config=genai_types.GenerateContentConfig(
            system_instruction=system_instruction or SYSTEM_PROMPT
        ),
    )


def parse_json_response(text: str) -> dict:
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.I).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return {"correct": None, "feedback": cleaned[:900], "hint": ""}


def log_chat(student_id: str, request_id, role: str, message: str) -> None:
    with get_db() as db:
        db.execute(
            "INSERT INTO chat_messages(schueler_id,request_id,role,message,created_at) VALUES (?,?,?,?,?)",
            (student_id, request_id, role, message[:4000], now_iso()),
        )
        db.commit()


def table_rows(db: sqlite3.Connection, table: str) -> list[dict]:
    return [dict(row) for row in db.execute(f"SELECT * FROM {table}").fetchall()]


LIVE_TABLES = [
    "schueler",
    "fortschritt",
    "antworten",
    "ki_anfragen",
    "chat_messages",
    "zeichnungen",
    "arbeitsstaende",
    "token_budget",
]

SNAPSHOT_COLUMNS = {
    "schueler": [
        "id",
        "pseudonym",
        "klasse",
        "joined_at",
        "last_active",
        "socket_id",
        "resume_token_hash",
    ],
    "fortschritt": [
        "id",
        "schueler_id",
        "aufgabe_nr",
        "niveau",
        "erledigt_at",
    ],
    "antworten": [
        "id",
        "schueler_id",
        "aufgabe_nr",
        "niveau",
        "antwort_typ",
        "antwort_text",
        "korrekt",
        "versuch_nr",
        "erstellt_at",
    ],
    "ki_anfragen": [
        "id",
        "schueler_id",
        "typ",
        "kontext",
        "status",
        "token_count",
        "erstellt_at",
        "bearbeitet_at",
        "grant_mode",
    ],
    "chat_messages": [
        "id",
        "schueler_id",
        "request_id",
        "role",
        "message",
        "created_at",
    ],
    "zeichnungen": [
        "id",
        "schueler_id",
        "geraet",
        "canvas_json",
        "preview_data",
        "updated_at",
    ],
    "arbeitsstaende": [
        "schueler_id",
        "state_json",
        "revision",
        "updated_at",
    ],
    "token_budget": ["datum", "tokens_used"],
}


def capture_live_snapshot(
    db: sqlite3.Connection, *, preserve_resume_tokens: bool = False
) -> dict:
    snapshot = {table: table_rows(db, table) for table in LIVE_TABLES}
    # Presence is runtime state. Resume hashes are preserved only for the
    # encrypted IServ continuation archive, never for ordinary local snapshots.
    for student in snapshot["schueler"]:
        student["socket_id"] = None
        if not preserve_resume_tokens:
            student["resume_token_hash"] = None
    return snapshot


def validate_live_snapshot(snapshot: dict) -> dict:
    if not isinstance(snapshot, dict):
        raise ValueError("Der Sitzungssnapshot ist ungültig.")
    normalized = {}
    total_rows = 0
    for table in LIVE_TABLES:
        rows = snapshot.get(table, [])
        if not isinstance(rows, list):
            raise ValueError(f"Der Bereich {table} ist ungültig.")
        total_rows += len(rows)
        if total_rows > 100000:
            raise ValueError("Der Sitzungssnapshot enthält zu viele Datensätze.")
        columns = SNAPSHOT_COLUMNS[table]
        expected = set(columns)
        clean_rows = []
        for row in rows:
            if not isinstance(row, dict):
                raise ValueError(f"Ein Datensatz in {table} ist unvollständig.")
            compatible_row = dict(row)
            if table == "schueler":
                compatible_row.setdefault("resume_token_hash", None)
            if table == "ki_anfragen":
                compatible_row.setdefault("grant_mode", "einzel")
            if set(compatible_row) != expected:
                raise ValueError(f"Ein Datensatz in {table} ist unvollständig.")
            clean = {column: compatible_row[column] for column in columns}
            if table == "schueler":
                clean["socket_id"] = None
            clean_rows.append(clean)
        normalized[table] = clean_rows
    return normalized


def persist_local_snapshot(
    db: sqlite3.Connection, name: str, snapshot: dict, timestamp: str | None = None
) -> str:
    snapshot_id = uuid.uuid4().hex[:16]
    saved_at = timestamp or now_iso()
    db.execute(
        "INSERT INTO gespeicherte_sitzungen(id,name,snapshot_json,created_at,updated_at) VALUES (?,?,?,?,?)",
        (
            snapshot_id,
            str(name).strip()[:80] or "Unterrichtssitzung",
            json.dumps(snapshot, ensure_ascii=False),
            saved_at,
            saved_at,
        ),
    )
    return snapshot_id


def restore_live_snapshot(db: sqlite3.Connection, snapshot: dict) -> None:
    validated = validate_live_snapshot(snapshot)
    try:
        for table in LIVE_TABLES:
            db.execute(f"DELETE FROM {table}")
            columns = SNAPSHOT_COLUMNS[table]
            placeholders = ",".join("?" for _ in columns)
            for item in validated[table]:
                db.execute(
                    f"INSERT INTO {table}({','.join(columns)}) VALUES ({placeholders})",
                    tuple(item[column] for column in columns),
                )
        db.commit()
    except Exception:
        db.rollback()
        raise


def set_continuation_mode(
    db: sqlite3.Connection, *, active: bool, source_name: str = ""
) -> None:
    db.execute("DELETE FROM fortsetzungsziele")
    db.execute("DELETE FROM fortsetzungsanfragen")
    db.execute(
        """INSERT INTO fortsetzungsstatus(id,active,source_name,started_at)
           VALUES (?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET
             active=excluded.active,source_name=excluded.source_name,started_at=excluded.started_at""",
        (
            CONTINUATION_STATE_ID,
            int(active),
            str(source_name).strip()[:80] if active else "",
            now_iso() if active else None,
        ),
    )
    if active:
        db.execute(
            "INSERT INTO fortsetzungsziele(student_id,status) SELECT id,'verfuegbar' FROM schueler"
        )
    db.commit()


def continuation_is_active(db: sqlite3.Connection) -> bool:
    row = db.execute(
        "SELECT active FROM fortsetzungsstatus WHERE id=?", (CONTINUATION_STATE_ID,)
    ).fetchone()
    return bool(row and row["active"])


def continuation_candidates(
    db: sqlite3.Connection, pseudonym: str, klasse: str
) -> list[dict]:
    rows = db.execute(
        """SELECT s.id,s.pseudonym,s.klasse,
                  (SELECT COUNT(*) FROM fortschritt f WHERE f.schueler_id=s.id) AS progress_count,
                  (SELECT COUNT(*) FROM antworten a WHERE a.schueler_id=s.id) AS answer_count
           FROM fortsetzungsziele z
           JOIN schueler s ON s.id=z.student_id
           WHERE z.status='verfuegbar'"""
    ).fetchall()
    wanted_name = normalized_identity(pseudonym)
    wanted_class = normalized_identity(klasse)
    return [
        dict(row)
        for row in rows
        if normalized_identity(row["pseudonym"]) == wanted_name
        and normalized_identity(row["klasse"]) == wanted_class
    ]


def continuation_dashboard_state(db: sqlite3.Connection) -> dict:
    state_row = db.execute(
        "SELECT active,source_name,started_at FROM fortsetzungsstatus WHERE id=?",
        (CONTINUATION_STATE_ID,),
    ).fetchone()
    state = dict(state_row) if state_row else {"active": 0}
    target_counts = {
        row["status"]: int(row["n"])
        for row in db.execute(
            "SELECT status,COUNT(*) AS n FROM fortsetzungsziele GROUP BY status"
        ).fetchall()
    }
    waiting = [
        dict(row)
        for row in db.execute(
            """SELECT id,pseudonym,klasse,target_student_id,status,created_at
               FROM fortsetzungsanfragen WHERE status='wartend' ORDER BY created_at"""
        ).fetchall()
    ]
    target_frequency: dict[str, int] = {}
    for item in waiting:
        candidates = continuation_candidates(db, item["pseudonym"], item["klasse"])
        item["candidates"] = candidates
        item["target_student_id"] = candidates[0]["id"] if len(candidates) == 1 else None
        if item["target_student_id"]:
            target_frequency[item["target_student_id"]] = (
                target_frequency.get(item["target_student_id"], 0) + 1
            )
    for item in waiting:
        target = item.get("target_student_id")
        item["unique"] = bool(target and target_frequency.get(target) == 1)
    state.update(
        {
            "active": bool(state.get("active")),
            "targets_total": sum(target_counts.values()),
            "targets_claimed": target_counts.get("verbunden", 0),
            "targets_available": target_counts.get("verfuegbar", 0),
            "requests": waiting,
            "unique_count": sum(1 for item in waiting if item["unique"]),
        }
    )
    return state


def approve_continuation_request(
    db: sqlite3.Connection, request_row: sqlite3.Row, target_student_id: str
) -> None:
    target = db.execute(
        """SELECT s.id FROM fortsetzungsziele z JOIN schueler s ON s.id=z.student_id
           WHERE z.student_id=? AND z.status='verfuegbar'""",
        (target_student_id,),
    ).fetchone()
    if not target:
        raise ValueError("Dieser Arbeitsstand ist bereits vergeben oder nicht verfügbar.")
    db.execute(
        "UPDATE schueler SET resume_token_hash=?,last_active=? WHERE id=?",
        (request_row["resume_token_hash"], now_iso(), target_student_id),
    )
    db.execute(
        "UPDATE fortsetzungsziele SET status='verbunden' WHERE student_id=?",
        (target_student_id,),
    )
    db.execute(
        """UPDATE fortsetzungsanfragen
           SET target_student_id=?,status='freigegeben',decided_at=? WHERE id=?""",
        (target_student_id, now_iso(), request_row["id"]),
    )


def snapshot_summary(snapshot: dict) -> dict:
    validated = validate_live_snapshot(snapshot)
    return {
        "students": len(validated["schueler"]),
        "answers": len(validated["antworten"]),
        "progress": len(validated["fortschritt"]),
        "chats": len(validated["chat_messages"]),
        "drawings": len(validated["zeichnungen"]),
        "drafts": len(validated["arbeitsstaende"]),
        "ai_requests": len(validated["ki_anfragen"]),
    }


def snapshot_digest(snapshot: dict) -> str:
    validated = validate_live_snapshot(snapshot)
    canonical = json.dumps(
        validated,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


STUDENT_DATA_TABLES = [
    "fortsetzungsanfragen",
    "fortsetzungsziele",
    "fortschritt",
    "antworten",
    "ki_anfragen",
    "chat_messages",
    "zeichnungen",
    "arbeitsstaende",
    "schueler",
]


def purge_classroom_data(*, delete_local_snapshots: bool = True) -> dict:
    """Remove temporary pupil data after a verified durable archive exists."""
    with get_db() as db:
        student_ids = {
            row["id"] for row in db.execute("SELECT id FROM schueler").fetchall()
        }
        counts = {
            table: int(db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
            for table in STUDENT_DATA_TABLES
        }
        for table in STUDENT_DATA_TABLES:
            db.execute(f"DELETE FROM {table}")
        db.execute(
            "UPDATE fortsetzungsstatus SET active=0,source_name='',started_at=NULL WHERE id=?",
            (CONTINUATION_STATE_ID,),
        )
        db.execute(
            "UPDATE ki_gruppenfreigabe SET active=0,locked=0 WHERE id=?",
            (AI_GROUP_STATE_ID,),
        )
        local_snapshot_count = 0
        if delete_local_snapshots:
            local_snapshot_count = int(
                db.execute("SELECT COUNT(*) FROM gespeicherte_sitzungen").fetchone()[0]
            )
            db.execute("DELETE FROM gespeicherte_sitzungen")
        db.commit()

    clear_active_student_connections(student_ids)
    ki_blocked_students.clear()
    for student_id in student_ids:
        socketio.emit("session_archived", {}, to=f"schueler_{student_id}")
    socketio.emit("session_reset", {}, to="lehrer_room")

    compacted = True
    cleanup_db = None
    try:
        cleanup_db = sqlite3.connect(DB_PATH, isolation_level=None)
        cleanup_db.execute("PRAGMA secure_delete=ON")
        cleanup_db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        cleanup_db.execute("VACUUM")
        cleanup_db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    except sqlite3.DatabaseError:
        # Deletion is already committed. Compaction is only best-effort hardening.
        compacted = False
    finally:
        if cleanup_db is not None:
            cleanup_db.close()

    return {
        "students": len(student_ids),
        "rows": counts,
        "local_snapshots": local_snapshot_count,
        "database_compacted": compacted,
    }


def make_iserv_service() -> IservBackupService:
    return IservBackupService.from_env()


def iserv_error_response(exc: IservBackupError, **extra):
    status = 503 if isinstance(exc, IservConfigurationError) else 502
    if not isinstance(exc, (IservConfigurationError, IservConnectionError)):
        status = 422
    return jsonify({"ok": False, "error": str(exc), **extra}), status


@app.route("/")
def root():
    return redirect(url_for("schueler") if session.get("schueler_id") else url_for("login"))


@app.get("/amiga")
def amiga():
    """Amiga-Emulator AmigaWerk (rein statisch unter static/amiga/)."""
    return redirect(url_for("static", filename="amiga/index.html"))


@app.get("/health")
def health():
    try:
        with get_db() as db:
            db.execute("SELECT 1").fetchone()
        return jsonify({"ok": True, "app_id": APP_ID})
    except sqlite3.DatabaseError:
        return jsonify({"ok": False}), 503


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        pseudonym = request.form.get("pseudonym", "").strip()[:30]
        klasse = request.form.get("klasse", "7").strip()[:20]
        privacy_ok = request.form.get("privacy_ok") == "on"
        if len(pseudonym) < 2:
            error = "Bitte nutze ein Pseudonym mit mindestens zwei Zeichen."
        elif not klasse:
            error = "Bitte gib deine Klasse an."
        elif not privacy_ok:
            error = "Bitte lies und bestätige den Datenschutz- und KI-Hinweis."
        else:
            sid = hashlib.sha256(
                f"{pseudonym}:{klasse}:{secrets.token_hex(8)}".encode("utf-8")
            ).hexdigest()[:16]
            resume_token = secrets.token_urlsafe(32)
            joined = now_iso()
            with get_db() as db:
                if continuation_is_active(db):
                    candidates = continuation_candidates(db, pseudonym, klasse)
                    request_id = uuid.uuid4().hex[:20]
                    db.execute(
                        """INSERT INTO fortsetzungsanfragen
                           (id,new_student_id,pseudonym,klasse,resume_token_hash,target_student_id,status,created_at)
                           VALUES (?,?,?,?,?,?,?,?)""",
                        (
                            request_id,
                            sid,
                            pseudonym,
                            klasse,
                            hash_resume_token(resume_token),
                            candidates[0]["id"] if len(candidates) == 1 else None,
                            "wartend",
                            joined,
                        ),
                    )
                    db.commit()
                    session["continuation_request_id"] = request_id
                    session["continuation_resume_token"] = resume_token
                    socketio.emit("fortsetzung_update", {}, to="lehrer_room")
                    return redirect(url_for("continuation_waiting"))
                db.execute(
                    "INSERT INTO schueler(id,pseudonym,klasse,joined_at,last_active,resume_token_hash) VALUES (?,?,?,?,?,?)",
                    (sid, pseudonym, klasse, joined, joined, hash_resume_token(resume_token)),
                )
                db.commit()
            session["schueler_id"] = sid
            session["pseudonym"] = pseudonym
            session["klasse"] = klasse
            session["resume_token"] = resume_token
            socketio.emit(
                "neuer_schueler",
                {
                    "id": sid,
                    "pseudonym": pseudonym,
                    "klasse": klasse,
                    "joined_at": joined,
                    "aufgaben_erledigt": 0,
                },
                to="lehrer_room",
            )
            return redirect(url_for("schueler"))
    return render_template("login.html", error=error, app_id=APP_ID)


@app.get("/fortsetzung/warten")
def continuation_waiting():
    request_id = session.get("continuation_request_id")
    if not request_id:
        return redirect(url_for("login"))
    with get_db() as db:
        row = db.execute(
            "SELECT pseudonym,klasse,status FROM fortsetzungsanfragen WHERE id=?",
            (request_id,),
        ).fetchone()
    if not row:
        session.pop("continuation_request_id", None)
        session.pop("continuation_resume_token", None)
        return redirect(url_for("login"))
    return render_template(
        "fortsetzung_warten.html",
        pseudonym=row["pseudonym"],
        klasse=row["klasse"],
    )


@app.post("/api/fortsetzung/status")
def continuation_request_status():
    request_id = session.get("continuation_request_id")
    if not request_id:
        return jsonify({"ok": False, "error": "Keine Fortsetzungsanfrage."}), 404
    with get_db() as db:
        row = db.execute(
            "SELECT * FROM fortsetzungsanfragen WHERE id=?", (request_id,)
        ).fetchone()
    if not row:
        return jsonify({"ok": False, "error": "Fortsetzungsanfrage nicht gefunden."}), 404
    if row["status"] == "wartend":
        return jsonify({"ok": True, "status": "wartend"})
    if row["status"] == "abgelehnt":
        session.pop("continuation_request_id", None)
        session.pop("continuation_resume_token", None)
        return jsonify({"ok": True, "status": "abgelehnt"})
    if row["status"] != "freigegeben" or not row["target_student_id"]:
        return jsonify({"ok": False, "error": "Fortsetzung ist unvollständig."}), 409
    resume_token = session.get("continuation_resume_token", "")
    if not resume_token or not secrets.compare_digest(
        row["resume_token_hash"], hash_resume_token(resume_token)
    ):
        return jsonify({"ok": False, "error": "Fortsetzungstoken ungültig."}), 401
    with get_db() as db:
        student = db.execute(
            "SELECT id,pseudonym,klasse FROM schueler WHERE id=?",
            (row["target_student_id"],),
        ).fetchone()
    if not student:
        return jsonify({"ok": False, "error": "Arbeitsstand nicht gefunden."}), 404
    session["schueler_id"] = student["id"]
    session["pseudonym"] = student["pseudonym"]
    session["klasse"] = student["klasse"]
    session["resume_token"] = resume_token
    session.pop("continuation_request_id", None)
    session.pop("continuation_resume_token", None)
    return jsonify(
        {"ok": True, "status": "freigegeben", "redirect": url_for("schueler")}
    )


@app.post("/fortsetzung/abbrechen")
def cancel_continuation_request():
    request_id = session.pop("continuation_request_id", None)
    session.pop("continuation_resume_token", None)
    if request_id:
        with get_db() as db:
            db.execute(
                """UPDATE fortsetzungsanfragen SET status='abgelehnt',decided_at=?
                   WHERE id=? AND status='wartend'""",
                (now_iso(), request_id),
            )
            db.commit()
        socketio.emit("fortsetzung_update", {}, to="lehrer_room")
    return redirect(url_for("login"))


@app.post("/api/resume")
def resume_student_session():
    data = request.get_json(silent=True) or {}
    student_id = str(data.get("student_id", ""))[:32]
    token = str(data.get("token", ""))[:200]
    if not student_id or not token:
        return jsonify({"ok": False}), 400
    with get_db() as db:
        student = db.execute(
            "SELECT id,pseudonym,klasse,resume_token_hash FROM schueler WHERE id=?",
            (student_id,),
        ).fetchone()
    if not student:
        return jsonify(
            {
                "ok": False,
                "pending_restore": True,
                "message": "Dein früherer Arbeitsstand ist derzeit nicht als Fortsetzungsstunde geladen.",
            }
        ), 409
    if not student["resume_token_hash"] or not secrets.compare_digest(
        student["resume_token_hash"], hash_resume_token(token)
    ):
        return jsonify({"ok": False, "expired": True}), 401
    session["schueler_id"] = student["id"]
    session["pseudonym"] = student["pseudonym"]
    session["klasse"] = student["klasse"]
    session["resume_token"] = token
    with get_db() as db:
        if continuation_is_active(db):
            db.execute(
                "UPDATE fortsetzungsziele SET status='verbunden' WHERE student_id=?",
                (student["id"],),
            )
            db.commit()
            socketio.emit("fortsetzung_update", {}, to="lehrer_room")
    return jsonify({"ok": True, "redirect": url_for("schueler")})


@app.post("/logout")
def student_logout():
    student_id = session.pop("schueler_id", None)
    session.pop("pseudonym", None)
    session.pop("klasse", None)
    session.pop("resume_token", None)
    if student_id:
        clear_active_student_connections({student_id})
        with get_db() as db:
            db.execute(
                "UPDATE schueler SET socket_id=NULL,resume_token_hash=NULL WHERE id=?",
                (student_id,),
            )
            db.commit()
        socketio.emit("schueler_offline", {"id": student_id}, to="lehrer_room")
    return redirect(url_for("login"))


@app.route("/schueler")
@schueler_required
def schueler():
    return render_template(
        "index.html",
        pseudonym=session.get("pseudonym"),
        klasse=session.get("klasse"),
        app_id=APP_ID,
        student_id=session.get("schueler_id"),
        resume_token=session.get("resume_token", ""),
    )


@app.route("/lehrer/login", methods=["GET", "POST"])
def lehrer_login():
    error = None
    if request.method == "POST":
        if secrets.compare_digest(request.form.get("passwort", ""), LEHRER_PASSWORD):
            session["is_lehrer"] = True
            token = secrets.token_urlsafe(24)
            teacher_action_tokens.add(token)
            session["teacher_action_token"] = token
            return redirect(url_for("dashboard"))
        error = "Das Passwort ist nicht korrekt."
    return render_template("lehrer_login.html", error=error)


@app.route("/lehrer")
@teacher_page_required
def dashboard():
    token = session.get("teacher_action_token")
    if not token or token not in teacher_action_tokens:
        token = secrets.token_urlsafe(24)
        teacher_action_tokens.add(token)
        session["teacher_action_token"] = token
    return render_template(
        "dashboard.html", teacher_action_token=token, daily_limit=DAILY_TOKEN_LIMIT
    )


@app.route("/lehrer/schueler/<student_id>")
@teacher_page_required
def schueler_detail(student_id):
    token = session.get("teacher_action_token", "")
    with get_db() as db:
        student = db.execute("SELECT * FROM schueler WHERE id=?", (student_id,)).fetchone()
        answers = db.execute(
            "SELECT * FROM antworten WHERE schueler_id=? ORDER BY id DESC", (student_id,)
        ).fetchall()
        chats = db.execute(
            "SELECT * FROM chat_messages WHERE schueler_id=? ORDER BY id", (student_id,)
        ).fetchall()
        drawings = db.execute(
            "SELECT geraet,canvas_json,preview_data,updated_at FROM zeichnungen WHERE schueler_id=? ORDER BY updated_at DESC",
            (student_id,),
        ).fetchall()
    if not student:
        return redirect(url_for("dashboard"))
    drawing_items = []
    for row in drawings:
        item = dict(row)
        try:
            item["object_count"] = len(json.loads(item["canvas_json"]).get("objects", []))
        except (json.JSONDecodeError, AttributeError):
            item["object_count"] = 0
        item.pop("canvas_json", None)
        drawing_items.append(item)
    return render_template(
        "schueler_detail.html",
        student=dict(student),
        answers=[dict(row) for row in answers],
        chats=[dict(row) for row in chats],
        drawings=drawing_items,
        teacher_action_token=token,
    )


@app.post("/lehrer/logout")
def lehrer_logout():
    token = session.pop("teacher_action_token", None)
    if token:
        teacher_action_tokens.discard(token)
    session.pop("is_lehrer", None)
    return redirect(url_for("lehrer_login"))


@app.post("/api/fortschritt")
@schueler_required
def save_progress():
    data = request.get_json(silent=True) or {}
    task = str(data.get("aufgabe", ""))[:20]
    level = str(data.get("niveau", "A"))[:20]
    if not task:
        return jsonify({"ok": False, "error": "Aufgabe fehlt."}), 400
    sid = session["schueler_id"]
    timestamp = now_iso()
    with get_db() as db:
        db.execute(
            """INSERT INTO fortschritt(schueler_id,aufgabe_nr,niveau,erledigt_at)
               VALUES (?,?,?,?)
               ON CONFLICT(schueler_id,aufgabe_nr,niveau)
               DO UPDATE SET erledigt_at=excluded.erledigt_at""",
            (sid, task, level, timestamp),
        )
        db.execute("UPDATE schueler SET last_active=? WHERE id=?", (timestamp, sid))
        db.commit()
        total = db.execute(
            "SELECT COUNT(*) AS n FROM fortschritt WHERE schueler_id=?", (sid,)
        ).fetchone()["n"]
    socketio.emit(
        "fortschritt_update",
        {"id": sid, "aufgabe": task, "niveau": level, "total": total},
        to="lehrer_room",
    )
    return jsonify({"ok": True, "total": total})


@app.post("/api/antwort")
@schueler_required
def save_answer():
    data = request.get_json(silent=True) or {}
    sid = session["schueler_id"]
    task = str(data.get("aufgabe", "?"))[:20]
    level = str(data.get("niveau", "A"))[:20]
    answer_type = str(data.get("typ", "text"))[:40]
    answer = str(data.get("antwort", ""))[:2000]
    correct = data.get("korrekt")
    correct_db = None if correct is None else int(bool(correct))
    with get_db() as db:
        attempt = db.execute(
            "SELECT COUNT(*) AS n FROM antworten WHERE schueler_id=? AND aufgabe_nr=?",
            (sid, task),
        ).fetchone()["n"] + 1
        cur = db.execute(
            """INSERT INTO antworten
               (schueler_id,aufgabe_nr,niveau,antwort_typ,antwort_text,korrekt,versuch_nr,erstellt_at)
               VALUES (?,?,?,?,?,?,?,?)""",
            (sid, task, level, answer_type, answer, correct_db, attempt, now_iso()),
        )
        db.execute("UPDATE schueler SET last_active=? WHERE id=?", (now_iso(), sid))
        db.commit()
        answer_id = cur.lastrowid
    socketio.emit(
        "antwort_live",
        {
            "id": answer_id,
            "schueler_id": sid,
            "aufgabe_nr": task,
            "niveau": level,
            "typ": answer_type,
            "antwort": answer,
            "korrekt": correct,
            "versuch_nr": attempt,
            "zeit": dt.datetime.now().strftime("%H:%M"),
        },
        to=f"watch_{sid}",
    )
    return jsonify({"ok": True, "versuch": attempt})


@app.get("/api/arbeitsstand")
@schueler_required
def get_workspace_state():
    student_id = session["schueler_id"]
    with get_db() as db:
        row = db.execute(
            "SELECT state_json,revision,updated_at FROM arbeitsstaende WHERE schueler_id=?",
            (student_id,),
        ).fetchone()
    if not row:
        return jsonify({"ok": True, "state": None, "revision": 0, "updated_at": None})
    try:
        state = json.loads(row["state_json"])
    except json.JSONDecodeError:
        return jsonify({"ok": False, "error": "Der gespeicherte Arbeitsstand ist beschädigt."}), 500
    return jsonify(
        {
            "ok": True,
            "state": state,
            "revision": row["revision"],
            "updated_at": row["updated_at"],
        }
    )


@app.post("/api/arbeitsstand")
@schueler_required
def save_workspace_state():
    data = request.get_json(silent=True) or {}
    state = data.get("state")
    try:
        revision = int(data.get("revision", 0))
    except (TypeError, ValueError):
        revision = 0
    if not isinstance(state, dict):
        return jsonify({"ok": False, "error": "Der Arbeitsstand ist ungültig."}), 400
    if state.get("schema_version") != 1 or state.get("app_id") != APP_ID:
        return jsonify({"ok": False, "error": "Der Arbeitsstand gehört nicht zu diesem Arbeitsblatt."}), 400
    if revision < 1 or revision > 2_000_000_000:
        return jsonify({"ok": False, "error": "Die Arbeitsstand-Version ist ungültig."}), 400
    state_json = json.dumps(state, ensure_ascii=False, separators=(",", ":"))
    if len(state_json.encode("utf-8")) > MAX_WORKSPACE_STATE_BYTES:
        return jsonify({"ok": False, "error": "Der Arbeitsstand ist zu groß."}), 413
    student_id = session["schueler_id"]
    timestamp = now_iso()
    with get_db() as db:
        db.execute(
            """INSERT INTO arbeitsstaende(schueler_id,state_json,revision,updated_at)
               VALUES (?,?,?,?)
               ON CONFLICT(schueler_id) DO UPDATE SET
                 state_json=excluded.state_json,
                 revision=excluded.revision,
                 updated_at=excluded.updated_at
               WHERE excluded.revision > arbeitsstaende.revision""",
            (student_id, state_json, revision, timestamp),
        )
        current = db.execute(
            "SELECT revision,updated_at FROM arbeitsstaende WHERE schueler_id=?",
            (student_id,),
        ).fetchone()
        db.execute(
            "UPDATE schueler SET last_active=? WHERE id=?", (timestamp, student_id)
        )
        db.commit()
    socketio.emit(
        "autosave_update",
        {
            "id": student_id,
            "revision": current["revision"],
            "updated_at": current["updated_at"],
        },
        to="lehrer_room",
    )
    return jsonify(
        {
            "ok": True,
            "revision": current["revision"],
            "updated_at": current["updated_at"],
            "accepted": current["revision"] == revision,
        }
    )


@app.get("/api/zeichnungen")
@schueler_required
def get_student_drawings():
    student_id = session["schueler_id"]
    with get_db() as db:
        rows = db.execute(
            "SELECT geraet,canvas_json,updated_at FROM zeichnungen WHERE schueler_id=? ORDER BY updated_at",
            (student_id,),
        ).fetchall()
    drawings = []
    for row in rows:
        try:
            canvas = json.loads(row["canvas_json"])
        except json.JSONDecodeError:
            continue
        drawings.append(
            {"device": row["geraet"], "canvas": canvas, "updated_at": row["updated_at"]}
        )
    return jsonify({"ok": True, "drawings": drawings})


@app.post("/api/zeichnungen")
@schueler_required
def save_student_drawing():
    data = request.get_json(silent=True) or {}
    device = str(data.get("device", "")).strip()
    canvas = data.get("canvas")
    preview = str(data.get("preview", ""))
    if device not in DRAWING_DEVICE_NAMES:
        return jsonify({"ok": False, "error": "Unbekannter Zeichenauftrag."}), 400
    if not isinstance(canvas, dict) or not isinstance(canvas.get("objects"), list):
        return jsonify({"ok": False, "error": "Die Objektdaten sind ungültig."}), 400
    if len(canvas["objects"]) > 500:
        return jsonify({"ok": False, "error": "Die Zeichnung enthält zu viele Objekte."}), 413
    for item in canvas["objects"]:
        if not isinstance(item, dict) or item.get("type") not in ALLOWED_DRAWING_OBJECT_TYPES:
            return jsonify({"ok": False, "error": "Die Zeichnung enthält ein nicht unterstütztes Objekt."}), 400
    canvas_json = json.dumps(canvas, ensure_ascii=False, separators=(",", ":"))
    if len(canvas_json.encode("utf-8")) > MAX_DRAWING_JSON_BYTES:
        return jsonify({"ok": False, "error": "Die Objektdaten sind zu groß."}), 413
    if (
        not preview.startswith("data:image/png;base64,")
        or len(preview) > MAX_DRAWING_PREVIEW_CHARS
        or not re.fullmatch(r"data:image/png;base64,[A-Za-z0-9+/=]+", preview)
    ):
        return jsonify({"ok": False, "error": "Die Bildvorschau ist ungültig."}), 400
    student_id = session["schueler_id"]
    timestamp = now_iso()
    with get_db() as db:
        db.execute(
            """INSERT INTO zeichnungen(schueler_id,geraet,canvas_json,preview_data,updated_at)
               VALUES (?,?,?,?,?)
               ON CONFLICT(schueler_id,geraet) DO UPDATE SET
                 canvas_json=excluded.canvas_json,
                 preview_data=excluded.preview_data,
                 updated_at=excluded.updated_at""",
            (student_id, device, canvas_json, preview, timestamp),
        )
        db.execute(
            "UPDATE schueler SET last_active=? WHERE id=?", (timestamp, student_id)
        )
        db.commit()
    socketio.emit(
        "zeichnung_update",
        {"schueler_id": student_id, "geraet": device, "updated_at": timestamp},
        to=f"watch_{student_id}",
    )
    return jsonify({"ok": True, "device": device, "updated_at": timestamp})


@app.delete("/api/zeichnungen/<device>")
@schueler_required
def delete_student_drawing(device):
    if device not in DRAWING_DEVICE_NAMES:
        return jsonify({"ok": False, "error": "Unbekannter Zeichenauftrag."}), 400
    student_id = session["schueler_id"]
    timestamp = now_iso()
    with get_db() as db:
        db.execute(
            "DELETE FROM zeichnungen WHERE schueler_id=? AND geraet=?",
            (student_id, device),
        )
        db.execute(
            "UPDATE schueler SET last_active=? WHERE id=?", (timestamp, student_id)
        )
        db.commit()
    socketio.emit(
        "zeichnung_update",
        {"schueler_id": student_id, "geraet": device, "updated_at": timestamp},
        to=f"watch_{student_id}",
    )
    return jsonify({"ok": True, "device": device, "deleted": True})


@app.post("/api/ki-zugang")
@schueler_required
def check_ai_group_access():
    data = request.get_json(silent=True) or {}
    request_type = str(data.get("typ", ""))[:30]
    if request_type not in AI_REQUEST_TYPES:
        return jsonify({"status": "invalid_type"}), 400
    sid = session["schueler_id"]
    if sid in ki_blocked_students or ai_group_lock_applies(sid):
        return jsonify(
            {"status": "blocked", "message": "Der KI-Zugang ist für deinen Lernplatz gesperrt."}
        )
    group = ai_group_status(sid, request_type)
    if not group["allowed"]:
        return jsonify({"status": "einzelanfrage", "reason": group.get("reason", "")})
    context = str(data.get("kontext", ""))[:300]
    created = now_iso()
    with get_db() as db:
        cur = db.execute(
            """INSERT INTO ki_anfragen
               (schueler_id,typ,kontext,status,erstellt_at,bearbeitet_at,grant_mode)
               VALUES (?,?,?,?,?,?,?)""",
            (sid, request_type, context, "freigegeben", created, created, "gruppe"),
        )
        db.commit()
        request_id = cur.lastrowid
    return jsonify(
        {
            "status": "freigegeben",
            "anfrage_id": request_id,
            "mode": "gruppe",
            "expires_at": group.get("expires_at"),
            "remaining_tokens": group.get("remaining_tokens", 0),
        }
    )


@app.post("/api/ki-anfrage")
@schueler_required
def request_ai_access():
    if get_today_tokens() >= DAILY_TOKEN_LIMIT:
        return jsonify({"status": "budget_exceeded"})
    data = request.get_json(silent=True) or {}
    request_type = str(data.get("typ", "chat"))[:30]
    if request_type not in AI_REQUEST_TYPES:
        return jsonify({"status": "invalid_type"}), 400
    sid = session["schueler_id"]
    if sid in ki_blocked_students or ai_group_lock_applies(sid):
        return jsonify({"status": "blocked", "message": "Der KI-Zugang ist gesperrt."})
    context = str(data.get("kontext", ""))[:300]
    created = now_iso()
    with get_db() as db:
        cur = db.execute(
            """INSERT INTO ki_anfragen(schueler_id,typ,kontext,erstellt_at,grant_mode)
               VALUES (?,?,?,?,?)""",
            (sid, request_type, context, created, "einzel"),
        )
        db.commit()
        request_id = cur.lastrowid
    socketio.emit(
        "neue_anfrage",
        {
            "id": request_id,
            "schueler_id": sid,
            "pseudonym": session.get("pseudonym", "?"),
            "klasse": session.get("klasse", "?"),
            "typ": request_type,
            "kontext": context,
            "erstellt_at": created,
        },
        to="lehrer_room",
    )
    return jsonify({"status": "wartend", "anfrage_id": request_id})


@app.post("/api/lehrer/ki-gruppe")
@teacher_api_required
def control_ai_group():
    data = request.get_json(silent=True) or {}
    action = str(data.get("action", ""))
    if action not in {"grant", "lock"}:
        return jsonify({"ok": False, "error": "Unbekannte KI-Gruppenaktion."}), 400
    with get_db() as db:
        previous = db.execute(
            "SELECT * FROM ki_gruppenfreigabe WHERE id=?", (AI_GROUP_STATE_ID,)
        ).fetchone()
        scope_class = str((previous["klasse"] if previous else "") or "")
        if action == "lock":
            db.execute(
                "UPDATE ki_gruppenfreigabe SET active=0,locked=1 WHERE id=?",
                (AI_GROUP_STATE_ID,),
            )
            students = db.execute("SELECT id,klasse FROM schueler").fetchall()
            affected = [
                row["id"]
                for row in students
                if not scope_class
                or normalized_identity(row["klasse"]) == normalized_identity(scope_class)
            ]
            ki_blocked_students.update(affected)
            waiting = db.execute(
                """SELECT k.id,k.schueler_id,k.typ,s.klasse FROM ki_anfragen k
                   JOIN schueler s ON s.id=k.schueler_id WHERE k.status='wartend'"""
            ).fetchall()
            rejected = [
                dict(row)
                for row in waiting
                if not scope_class
                or normalized_identity(row["klasse"]) == normalized_identity(scope_class)
            ]
            for row in rejected:
                db.execute(
                    "UPDATE ki_anfragen SET status='abgelehnt',bearbeitet_at=? WHERE id=?",
                    (now_iso(), row["id"]),
                )
            db.commit()
            for student_id in affected:
                socketio.emit(
                    "ki_gesperrt", {"gesperrt": True, "gruppe": True}, to=f"schueler_{student_id}"
                )
            for row in rejected:
                socketio.emit(
                    "ki_entscheidung",
                    {"id": row["id"], "entscheid": "abgelehnt", "typ": row["typ"]},
                    to=f"schueler_{row['schueler_id']}",
                )
            socketio.emit("ki_gruppe_status", ai_group_status(), to="lehrer_room")
            return jsonify(
                {
                    "ok": True,
                    "action": "lock",
                    "affected": len(affected),
                    "rejected": len(rejected),
                }
            )

        allowed_types = [
            str(item) for item in (data.get("types") or []) if str(item) in AI_REQUEST_TYPES
        ]
        if not allowed_types:
            return jsonify({"ok": False, "error": "Mindestens eine KI-Funktion auswählen."}), 400
        try:
            minutes = max(1, min(60, int(data.get("minutes", 10))))
            requested_limit = max(100, int(data.get("token_limit", 5000)))
            per_student_limit = max(100, int(data.get("per_student_limit", 1000)))
        except (TypeError, ValueError):
            return jsonify({"ok": False, "error": "Zeit und Tokenlimits müssen Zahlen sein."}), 400
        remaining_daily = max(0, DAILY_TOKEN_LIMIT - get_today_tokens())
        if remaining_daily <= 0:
            return jsonify({"ok": False, "error": "Das KI-Tagesbudget ist bereits erreicht."}), 409
        token_limit = min(requested_limit, remaining_daily)
        per_student_limit = min(per_student_limit, token_limit)
        scope_class = str(data.get("klasse", "")).strip()[:20]
        starts = dt.datetime.now()
        expires = starts + dt.timedelta(minutes=minutes)
        db.execute(
            """UPDATE ki_gruppenfreigabe SET active=1,locked=0,klasse=?,allowed_types=?,starts_at=?,
               expires_at=?,token_limit=?,tokens_used=0,per_student_limit=? WHERE id=?""",
            (
                scope_class,
                json.dumps(allowed_types),
                starts.isoformat(timespec="seconds"),
                expires.isoformat(timespec="seconds"),
                token_limit,
                per_student_limit,
                AI_GROUP_STATE_ID,
            ),
        )
        students = db.execute("SELECT id,klasse FROM schueler").fetchall()
        affected = [
            row["id"]
            for row in students
            if not scope_class
            or normalized_identity(row["klasse"]) == normalized_identity(scope_class)
        ]
        for student_id in affected:
            ki_blocked_students.discard(student_id)
        pending = db.execute(
            """SELECT k.id,k.schueler_id,k.typ,s.klasse FROM ki_anfragen k
               JOIN schueler s ON s.id=k.schueler_id WHERE k.status='wartend'"""
        ).fetchall()
        auto_approved = []
        for row in pending:
            if row["typ"] not in allowed_types:
                continue
            if scope_class and normalized_identity(row["klasse"]) != normalized_identity(scope_class):
                continue
            db.execute(
                """UPDATE ki_anfragen SET status='freigegeben',bearbeitet_at=?,grant_mode='gruppe'
                   WHERE id=?""",
                (now_iso(), row["id"]),
            )
            auto_approved.append(dict(row))
        db.commit()
    for student_id in affected:
        socketio.emit(
            "ki_gesperrt", {"gesperrt": False, "gruppe": True}, to=f"schueler_{student_id}"
        )
    for row in auto_approved:
        socketio.emit(
            "ki_entscheidung",
            {"id": row["id"], "entscheid": "freigegeben", "typ": row["typ"]},
            to=f"schueler_{row['schueler_id']}",
        )
    status = ai_group_status()
    socketio.emit("ki_gruppe_status", status, to="lehrer_room")
    return jsonify(
        {
            "ok": True,
            "action": "grant",
            "affected": len(affected),
            "auto_approved": len(auto_approved),
            "ai_group": status,
        }
    )


@app.post("/api/ki-entscheidung")
@teacher_api_required
def decide_ai_request():
    data = request.get_json(silent=True) or {}
    try:
        request_id = int(data.get("anfrage_id"))
    except (TypeError, ValueError):
        return jsonify({"ok": False}), 400
    decision = data.get("entscheid")
    if decision not in {"freigegeben", "abgelehnt"}:
        return jsonify({"ok": False}), 400
    with get_db() as db:
        row = db.execute("SELECT * FROM ki_anfragen WHERE id=?", (request_id,)).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Anfrage nicht gefunden."}), 404
        db.execute(
            "UPDATE ki_anfragen SET status=?,bearbeitet_at=? WHERE id=?",
            (decision, now_iso(), request_id),
        )
        db.commit()
    socketio.emit(
        "ki_entscheidung",
        {"id": request_id, "entscheid": decision, "typ": row["typ"]},
        to=f"schueler_{row['schueler_id']}",
    )
    return jsonify({"ok": True})


@app.post("/api/chat")
@schueler_required
def chat():
    data = request.get_json(silent=True) or {}
    sid = session["schueler_id"]
    request_id = data.get("anfrage_id")
    if sid in ki_blocked_students:
        return jsonify({"blocked": True, "message": "Der KI-Zugang ist gesperrt."})
    if not ensure_ai_request(request_id, "chat", sid):
        return jsonify({"blocked": True, "message": "Noch nicht freigegeben."})
    if get_today_tokens() >= DAILY_TOKEN_LIMIT:
        return jsonify({"blocked": True, "message": "Das Tagesbudget ist erreicht."})
    message = str(data.get("message", "")).strip()[:2000]
    if not message:
        return jsonify({"response": "Bitte stelle zuerst eine Frage."}), 400
    if not AI_CLIENT:
        return jsonify(
            {"response": "Die KI ist noch nicht konfiguriert. Die Lehrkraft muss einen GEMINI_API_KEY setzen.", "tokens": 0}
        )
    try:
        transcript = []
        for item in (data.get("history") or [])[-8:]:
            role = "KI" if item.get("role") == "assistant" else "Schüler"
            transcript.append(f"{role}: {str(item.get('content', ''))[:1500]}")
        transcript.append(f"Schüler: {message}")
        response = generate_ai("Bisheriger Dialog:\n" + "\n".join(transcript))
        reply = response.text
        tokens = response_token_count(response, message + reply)
        group = record_ai_tokens(tokens, request_id, sid)
        log_chat(sid, request_id, "user", message)
        log_chat(sid, request_id, "assistant", reply)
        socketio.emit(
            "chat_live",
            {
                "schueler_id": sid,
                "pseudonym": session.get("pseudonym", "?"),
                "frage": message[:500],
                "antwort": reply[:800],
                "tokens": tokens,
                "zeit": dt.datetime.now().strftime("%H:%M"),
            },
            to=f"watch_{sid}",
        )
        socketio.emit(
            "token_update",
            {"today": get_today_tokens(), "limit": DAILY_TOKEN_LIMIT, "ai_group": group},
            to="lehrer_room",
        )
        return jsonify({"response": reply, "tokens": tokens})
    except Exception as exc:
        return jsonify({"response": f"Die KI konnte gerade nicht antworten: {exc}"}), 502


@app.post("/api/check-answer")
@schueler_required
def check_answer():
    data = request.get_json(silent=True) or {}
    sid = session["schueler_id"]
    request_id = data.get("anfrage_id")
    if not ensure_ai_request(request_id, "korrektur", sid):
        return jsonify({"blocked": True})
    answer = str(data.get("answer", ""))[:2500]
    prompt = f"""Bewerte diese Antwort für Chemie Klasse 7 zum Thema Laborgeräte.
Aufgabe: {str(data.get('question', ''))[:800]}
Kontext: {str(data.get('context', ''))[:800]}
Schülerantwort: {answer}
Lobe Konkretes, benenne eine Lücke und gib nur einen weiterführenden Tipp.
Antworte ausschließlich als JSON: {{"correct": true|false|null, "feedback": "...", "hint": "..."}}"""
    if not AI_CLIENT:
        return jsonify(
            {"correct": None, "feedback": "Die Antwort wurde gespeichert. Für KI-Feedback muss die Lehrkraft den Gemini-Schlüssel konfigurieren.", "hint": "Vergleiche deine Antwort mit der Geräteübersicht."}
        )
    try:
        response = generate_ai(prompt, "Du bist eine einfühlsame Chemielehrkraft für Klasse 7.")
        response_text = response.text
        result = parse_json_response(response_text)
        tokens = response_token_count(response, prompt + response_text)
        group = record_ai_tokens(tokens, request_id, sid)
        socketio.emit(
            "token_update",
            {"today": get_today_tokens(), "limit": DAILY_TOKEN_LIMIT, "ai_group": group},
            to="lehrer_room",
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"correct": None, "feedback": f"KI-Feedback derzeit nicht möglich: {exc}", "hint": ""}), 502


@app.post("/api/check-drawing")
@schueler_required
def check_drawing():
    data = request.get_json(silent=True) or {}
    sid = session["schueler_id"]
    request_type = str(data.get("request_type", "zeichnung"))
    request_id = data.get("anfrage_id")
    if request_type not in {"zeichnung", "handschrift"} or not ensure_ai_request(
        request_id, request_type, sid
    ):
        return jsonify({"blocked": True})
    expected = str(data.get("expected", "Laborgerät"))[:80]
    image_data = str(data.get("image", ""))
    match = re.match(r"^data:image/png;base64,(.+)$", image_data)
    if not match:
        return jsonify({"correct": False, "feedback": "Die Zeichnung konnte nicht gelesen werden.", "hint": "Zeichne noch einmal mit einem dunklen Stift."}), 400
    try:
        raw = base64.b64decode(match.group(1), validate=True)
    except (ValueError, base64.binascii.Error):
        return jsonify({"correct": False, "feedback": "Ungültige Bilddaten.", "hint": "Leere die Leinwand und versuche es erneut."}), 400
    if len(raw) > 2_500_000:
        return jsonify({"correct": False, "feedback": "Die Zeichnung ist zu groß.", "hint": "Leere die Leinwand und zeichne erneut."}), 413
    if request_type == "handschrift":
        prompt = f"""Lies die deutsche Handschrift auf dem Bild. Erwarteter Gerätename: {expected}.
Bewerte großzügig bei Rechtschreibfehlern, aber verwechsle keine Laborgeräte.
Antworte ausschließlich als JSON: {{"recognized": "...", "correct": true|false, "feedback": "ein kurzer konkreter Satz", "hint": "..."}}"""
    else:
        prompt = f"""Analysiere die einfache Schülerzeichnung eines Laborgeräts. Sollgerät: {expected}.
Klasse 7, Erstbegegnung. Prüfe nur gut erkennbare Formmerkmale, nicht künstlerische Qualität.
Nenne ein richtig dargestelltes Merkmal und genau einen konkreten Verbesserungsvorschlag.
Antworte ausschließlich als JSON: {{"correct": true|false|null, "feedback": "2 kurze Sätze", "hint": "ein Formmerkmal"}}"""
    if not AI_CLIENT:
        return jsonify(
            {"correct": None, "recognized": "", "feedback": "Die Zeichnung wurde erfasst. Für die Bildanalyse muss die Lehrkraft den Gemini-Schlüssel konfigurieren.", "hint": "Vergleiche Umriss, Öffnung, Standfläche und Skala mit der Übersicht."}
        )
    try:
        image_part = genai_types.Part.from_bytes(data=raw, mime_type="image/png")
        response = generate_ai(
            [image_part, prompt],
            "Du analysierst respektvoll einfache Lernzeichnungen von Laborgeräten.",
        )
        response_text = response.text
        result = parse_json_response(response_text)
        tokens = response_token_count(response, prompt + response_text)
        group = record_ai_tokens(tokens, request_id, sid)
        socketio.emit(
            "token_update",
            {"today": get_today_tokens(), "limit": DAILY_TOKEN_LIMIT, "ai_group": group},
            to="lehrer_room",
        )
        return jsonify(result)
    except Exception as exc:
        return jsonify({"correct": None, "feedback": f"Bildanalyse derzeit nicht möglich: {exc}", "hint": ""}), 502


@app.get("/api/lehrer/state")
@teacher_api_required
def teacher_state():
    online_ids = active_student_ids()
    with get_db() as db:
        students = [
            dict(row)
            for row in db.execute(
                """SELECT s.*,
                   (SELECT COUNT(*) FROM fortschritt f WHERE f.schueler_id=s.id) AS progress_count,
                   (SELECT COUNT(*) FROM antworten a WHERE a.schueler_id=s.id) AS answer_count,
                   (SELECT updated_at FROM arbeitsstaende w WHERE w.schueler_id=s.id) AS autosave_updated_at,
                   (SELECT revision FROM arbeitsstaende w WHERE w.schueler_id=s.id) AS autosave_revision
                   FROM schueler s ORDER BY s.joined_at DESC"""
            ).fetchall()
        ]
        for student in students:
            student["online"] = student["id"] in online_ids
            student.pop("socket_id", None)
            student.pop("resume_token_hash", None)
        requests = [
            dict(row)
            for row in db.execute(
                """SELECT k.*,s.pseudonym,s.klasse FROM ki_anfragen k
                   LEFT JOIN schueler s ON s.id=k.schueler_id
                   WHERE k.status='wartend' ORDER BY k.id DESC"""
            ).fetchall()
        ]
        snapshots = [
            dict(row)
            for row in db.execute(
                "SELECT id,name,created_at,updated_at FROM gespeicherte_sitzungen ORDER BY updated_at DESC"
            ).fetchall()
        ]
        continuation = continuation_dashboard_state(db)
    return jsonify(
        {
            "students": students,
            "requests": requests,
            "snapshots": snapshots,
            "tokens": get_today_tokens(),
            "limit": DAILY_TOKEN_LIMIT,
            "continuation": continuation,
            "ai_group": ai_group_status(),
        }
    )


@app.post("/api/lehrer/fortsetzung/approve-unique")
@teacher_api_required
def approve_unique_continuations():
    approved = 0
    with get_db() as db:
        if not continuation_is_active(db):
            return jsonify({"ok": False, "error": "Der Fortsetzungsmodus ist nicht aktiv."}), 409
        state = continuation_dashboard_state(db)
        for item in state["requests"]:
            if not item.get("unique") or not item.get("target_student_id"):
                continue
            request_row = db.execute(
                "SELECT * FROM fortsetzungsanfragen WHERE id=? AND status='wartend'",
                (item["id"],),
            ).fetchone()
            if not request_row:
                continue
            approve_continuation_request(db, request_row, item["target_student_id"])
            approved += 1
        db.commit()
    socketio.emit("fortsetzung_update", {}, to="lehrer_room")
    return jsonify({"ok": True, "approved": approved})


@app.post("/api/lehrer/fortsetzung/<request_id>")
@teacher_api_required
def decide_continuation_request(request_id):
    data = request.get_json(silent=True) or {}
    action = str(data.get("action", ""))
    with get_db() as db:
        request_row = db.execute(
            "SELECT * FROM fortsetzungsanfragen WHERE id=? AND status='wartend'",
            (request_id,),
        ).fetchone()
        if not request_row:
            return jsonify({"ok": False, "error": "Anfrage nicht gefunden."}), 404
        if action == "reject":
            db.execute(
                "UPDATE fortsetzungsanfragen SET status='abgelehnt',decided_at=? WHERE id=?",
                (now_iso(), request_id),
            )
        elif action == "new":
            db.execute(
                """INSERT INTO schueler(id,pseudonym,klasse,joined_at,last_active,resume_token_hash)
                   VALUES (?,?,?,?,?,?)""",
                (
                    request_row["new_student_id"],
                    request_row["pseudonym"],
                    request_row["klasse"],
                    request_row["created_at"],
                    now_iso(),
                    request_row["resume_token_hash"],
                ),
            )
            db.execute(
                """UPDATE fortsetzungsanfragen SET target_student_id=?,status='freigegeben',decided_at=?
                   WHERE id=?""",
                (request_row["new_student_id"], now_iso(), request_id),
            )
        elif action == "approve":
            target_id = str(data.get("target_student_id", ""))[:32]
            if not target_id:
                candidates = continuation_candidates(
                    db, request_row["pseudonym"], request_row["klasse"]
                )
                if len(candidates) != 1:
                    return jsonify(
                        {"ok": False, "error": "Bitte einen eindeutigen Arbeitsstand auswählen."}
                    ), 409
                target_id = candidates[0]["id"]
            try:
                approve_continuation_request(db, request_row, target_id)
            except ValueError as exc:
                return jsonify({"ok": False, "error": str(exc)}), 409
        else:
            return jsonify({"ok": False, "error": "Unbekannte Aktion."}), 400
        db.commit()
    socketio.emit("fortsetzung_update", {}, to="lehrer_room")
    return jsonify({"ok": True, "action": action})


@app.post("/api/lehrer/fortsetzung/end")
@teacher_api_required
def end_continuation_mode():
    with get_db() as db:
        db.execute(
            "UPDATE fortsetzungsanfragen SET status='abgelehnt',decided_at=? WHERE status='wartend'",
            (now_iso(),),
        )
        db.execute("DELETE FROM fortsetzungsziele")
        db.execute(
            "UPDATE fortsetzungsstatus SET active=0 WHERE id=?",
            (CONTINUATION_STATE_ID,),
        )
        db.commit()
    socketio.emit("fortsetzung_update", {}, to="lehrer_room")
    return jsonify({"ok": True})


@app.post("/api/lehrer/student/<student_id>/toggle-ai")
@teacher_api_required
def toggle_student_ai(student_id):
    blocked = student_id not in ki_blocked_students
    if blocked:
        ki_blocked_students.add(student_id)
    else:
        ki_blocked_students.discard(student_id)
    socketio.emit("ki_gesperrt", {"gesperrt": blocked}, to=f"schueler_{student_id}")
    return jsonify({"ok": True, "blocked": blocked})


@app.delete("/api/lehrer/student/<student_id>")
@teacher_api_required
def delete_student(student_id):
    clear_active_student_connections({student_id})
    with get_db() as db:
        db.execute(
            "DELETE FROM fortsetzungsanfragen WHERE new_student_id=? OR target_student_id=?",
            (student_id, student_id),
        )
        db.execute("DELETE FROM fortsetzungsziele WHERE student_id=?", (student_id,))
        for table in ["fortschritt", "antworten", "ki_anfragen", "chat_messages", "zeichnungen", "arbeitsstaende"]:
            db.execute(f"DELETE FROM {table} WHERE schueler_id=?", (student_id,))
        db.execute("DELETE FROM schueler WHERE id=?", (student_id,))
        db.commit()
    ki_blocked_students.discard(student_id)
    socketio.emit("session_invalidated", {}, to=f"schueler_{student_id}")
    return jsonify({"ok": True})


@app.post("/api/lehrer/reset")
@teacher_api_required
def reset_live_session():
    with get_db() as db:
        student_ids = {
            row["id"] for row in db.execute("SELECT id FROM schueler").fetchall()
        }
        for table in ["fortsetzungsanfragen", "fortsetzungsziele", "fortschritt", "antworten", "ki_anfragen", "chat_messages", "zeichnungen", "arbeitsstaende", "schueler"]:
            db.execute(f"DELETE FROM {table}")
        db.execute(
            "UPDATE fortsetzungsstatus SET active=0,source_name='',started_at=NULL WHERE id=?",
            (CONTINUATION_STATE_ID,),
        )
        db.execute(
            "UPDATE ki_gruppenfreigabe SET active=0,locked=0 WHERE id=?",
            (AI_GROUP_STATE_ID,),
        )
        db.commit()
    clear_active_student_connections(student_ids)
    ki_blocked_students.clear()
    for student_id in student_ids:
        socketio.emit("session_invalidated", {}, to=f"schueler_{student_id}")
    socketio.emit("session_reset", {}, to="lehrer_room")
    return jsonify({"ok": True})


@app.post("/api/lehrer/snapshots")
@teacher_api_required
def save_snapshot():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "Unterrichtssitzung")).strip()[:80] or "Unterrichtssitzung"
    timestamp = now_iso()
    with get_db() as db:
        snapshot = capture_live_snapshot(db)
        snapshot_id = persist_local_snapshot(db, name, snapshot, timestamp)
        db.commit()
    return jsonify({"ok": True, "id": snapshot_id})


@app.post("/api/lehrer/snapshots/<snapshot_id>/load")
@teacher_api_required
def load_snapshot(snapshot_id):
    with get_db() as db:
        row = db.execute(
            "SELECT snapshot_json FROM gespeicherte_sitzungen WHERE id=?", (snapshot_id,)
        ).fetchone()
        if not row:
            return jsonify({"ok": False, "error": "Sitzung nicht gefunden."}), 404
        snapshot = json.loads(row["snapshot_json"])
        previous_student_ids = {
            student_row["id"]
            for student_row in db.execute("SELECT id FROM schueler").fetchall()
        }
        try:
            restore_live_snapshot(db, snapshot)
            set_continuation_mode(db, active=False)
        except ValueError as exc:
            return jsonify({"ok": False, "error": str(exc)}), 422
    clear_active_student_connections(previous_student_ids)
    for student_id in previous_student_ids:
        socketio.emit("session_invalidated", {}, to=f"schueler_{student_id}")
    socketio.emit("session_reloaded", {}, to="lehrer_room")
    return jsonify({"ok": True})


@app.delete("/api/lehrer/snapshots/<snapshot_id>")
@teacher_api_required
def delete_snapshot(snapshot_id):
    with get_db() as db:
        db.execute("DELETE FROM gespeicherte_sitzungen WHERE id=?", (snapshot_id,))
        db.commit()
    return jsonify({"ok": True})


@app.get("/api/lehrer/iserv/status")
@teacher_api_required
def iserv_status():
    return jsonify({"ok": True, **configuration_status()})


@app.post("/api/lehrer/iserv/test")
@teacher_api_required
def test_iserv_connection():
    try:
        service = make_iserv_service()
        result = service.test_connection()
        return jsonify(
            {
                **result,
                "path": service.config.backup_path,
                "encryption": "AES-256-GCM",
            }
        )
    except IservBackupError as exc:
        return iserv_error_response(exc)


@app.get("/api/lehrer/iserv/backups")
@teacher_api_required
def list_iserv_backups():
    try:
        backups = make_iserv_service().list_backup_summaries(APP_ID)
        return jsonify(
            {
                "ok": True,
                "backups": backups,
                "worksheet": "Laborgeräte",
                "app_id": APP_ID,
            }
        )
    except IservBackupError as exc:
        return iserv_error_response(exc)


@app.post("/api/lehrer/iserv/backups")
@teacher_api_required
def save_iserv_backup():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "Unterrichtssitzung")).strip()[:80]
    name = name or "Unterrichtssitzung"
    try:
        service = make_iserv_service()
    except IservBackupError as exc:
        return iserv_error_response(exc)
    flush = request_student_autosave_flush()
    with get_db() as db:
        snapshot = capture_live_snapshot(db, preserve_resume_tokens=True)
    expected_digest = snapshot_digest(snapshot)
    try:
        remote = service.upload_snapshot(name, APP_ID, snapshot)
        envelope = service.download_snapshot(remote["filename"], APP_ID)
        verified_snapshot = validate_live_snapshot(envelope["snapshot"])
        if snapshot_digest(verified_snapshot) != expected_digest:
            return jsonify(
                {
                    "ok": False,
                    "error": "Die zur Kontrolle geladene IServ-Datei stimmt nicht mit den gesicherten Daten überein. Die Serverdaten wurden nicht gelöscht.",
                    "server_data_kept": True,
                    "flush": flush,
                }
            ), 502
        purge = purge_classroom_data(delete_local_snapshots=True)
        return jsonify(
            {
                "ok": True,
                "backup": remote,
                "verified": True,
                "purged": True,
                "flush": flush,
                "purge": purge,
            }
        )
    except IservBackupError as exc:
        return iserv_error_response(exc, server_data_kept=True, flush=flush)
    except (KeyError, ValueError) as exc:
        return jsonify(
            {
                "ok": False,
                "error": f"Die IServ-Sicherung konnte nicht verifiziert werden: {exc}",
                "server_data_kept": True,
                "flush": flush,
            }
        ), 502


@app.get("/api/lehrer/iserv/backups/<remote_name>/preview")
@teacher_api_required
def preview_iserv_backup(remote_name):
    try:
        envelope = make_iserv_service().download_snapshot(remote_name, APP_ID)
        summary = snapshot_summary(envelope["snapshot"])
        return jsonify(
            {
                "ok": True,
                "filename": remote_name,
                "name": str(envelope.get("name", "Unterrichtssitzung"))[:80],
                "created_at": envelope.get("created_at", ""),
                "summary": summary,
            }
        )
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 422
    except IservBackupError as exc:
        return iserv_error_response(exc)


@app.post("/api/lehrer/iserv/backups/<remote_name>/load")
@teacher_api_required
def load_iserv_backup(remote_name):
    data = request.get_json(silent=True) or {}
    mode = str(data.get("mode", "review"))
    if mode not in {"review", "continue"}:
        return jsonify({"ok": False, "error": "Unbekannter Lademodus."}), 400
    try:
        envelope = make_iserv_service().download_snapshot(remote_name, APP_ID)
        snapshot = validate_live_snapshot(envelope["snapshot"])
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 422
    except IservBackupError as exc:
        return iserv_error_response(exc)

    with get_db() as db:
        previous_student_ids = [
            row["id"] for row in db.execute("SELECT id FROM schueler").fetchall()
        ]
    if mode == "review":
        for student in snapshot["schueler"]:
            student["resume_token_hash"] = None
    with get_db() as db:
        restore_live_snapshot(db, snapshot)
        set_continuation_mode(
            db,
            active=mode == "continue",
            source_name=str(envelope.get("name", "Unterrichtssitzung"))[:80],
        )

    clear_active_student_connections(set(previous_student_ids))
    ki_blocked_students.clear()
    for student_id in previous_student_ids:
        socketio.emit("session_invalidated", {}, to=f"schueler_{student_id}")
    socketio.emit("session_reloaded", {}, to="lehrer_room")
    return jsonify(
        {
            "ok": True,
            "name": str(envelope.get("name", "Unterrichtssitzung"))[:80],
            "temporary_server_restore": True,
            "continuation_mode": mode == "continue",
        }
    )


@app.delete("/api/lehrer/iserv/backups/<remote_name>")
@teacher_api_required
def delete_iserv_backup(remote_name):
    data = request.get_json(silent=True) or {}
    if data.get("confirmed") is not True:
        return jsonify(
            {"ok": False, "error": "Das endgültige Löschen wurde nicht bestätigt."}
        ), 400
    try:
        deleted = make_iserv_service().delete_snapshot(remote_name, APP_ID)
        return jsonify({"ok": True, "deleted": deleted})
    except ValueError as exc:
        return jsonify({"ok": False, "error": str(exc)}), 422
    except IservBackupError as exc:
        return iserv_error_response(exc)


@socketio.on("schueler_join")
def on_student_join(_data=None):
    student_id = session.get("schueler_id")
    if not student_id:
        return
    socket_id = request.sid
    timestamp = now_iso()
    with get_db() as db:
        cursor = db.execute(
            "UPDATE schueler SET socket_id=?,last_active=? WHERE id=?",
            (socket_id, timestamp, student_id),
        )
        db.commit()
    if not cursor.rowcount:
        return
    join_room(f"schueler_{student_id}")
    with student_connection_lock:
        previous_owner = student_connection_owners.get(socket_id)
        if previous_owner and previous_owner != student_id:
            previous_sockets = student_connections.get(previous_owner, set())
            previous_sockets.discard(socket_id)
            if not previous_sockets:
                student_connections.pop(previous_owner, None)
        sockets = student_connections.setdefault(student_id, set())
        became_online = not sockets
        sockets.add(socket_id)
        student_connection_owners[socket_id] = student_id
    if became_online:
        socketio.emit("schueler_online", {"id": student_id}, to="lehrer_room")


@socketio.on("lehrer_join")
def on_teacher_join():
    if not session.get("is_lehrer"):
        return
    join_room("lehrer_room")
    emit("token_update", {"today": get_today_tokens(), "limit": DAILY_TOKEN_LIMIT})


@socketio.on("autosave_ack")
def on_autosave_ack(data):
    student_id = session.get("schueler_id")
    request_id = str((data or {}).get("request_id", ""))
    if not student_id or not request_id or (data or {}).get("ok") is not True:
        return
    with autosave_flush_condition:
        pending = autosave_flush_acks.get(request_id)
        if pending is not None:
            pending.add(student_id)
            autosave_flush_condition.notify_all()


@socketio.on("watch_schueler")
def on_watch_student(data):
    if session.get("is_lehrer") and data.get("schueler_id"):
        join_room(f"watch_{data['schueler_id']}")


@socketio.on("disconnect")
def on_disconnect():
    socket_id = request.sid
    with student_connection_lock:
        student_id = student_connection_owners.pop(socket_id, None)
        if not student_id:
            # A teacher socket may share a Flask session with a pupil tab. It
            # must never change that pupil's presence state.
            return
        sockets = student_connections.get(student_id, set())
        sockets.discard(socket_id)
        replacement_socket = next(iter(sockets), None)
        if not sockets:
            student_connections.pop(student_id, None)
    with get_db() as db:
        db.execute(
            "UPDATE schueler SET socket_id=? WHERE id=?",
            (replacement_socket, student_id),
        )
        db.commit()
    if replacement_socket is None:
        socketio.emit("schueler_offline", {"id": student_id}, to="lehrer_room")


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=os.environ.get("FLASK_DEBUG") == "1")
