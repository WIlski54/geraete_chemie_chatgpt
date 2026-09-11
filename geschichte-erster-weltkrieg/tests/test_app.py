import json
import os
import re

import app as appmodule

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def test_health(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.get_json()["ok"] is True


def test_login_requires_privacy_and_pseudonym(client):
    resp = client.post("/login", data={"pseudonym": "A", "klasse": "9", "privacy_ok": "on"})
    assert "mindestens 2 Zeichen" in resp.get_data(as_text=True)
    resp = client.post("/login", data={"pseudonym": "Fuchs", "klasse": "9"})
    assert "Datenschutz" in resp.get_data(as_text=True)
    assert client.get("/arbeitsblatt").status_code == 302
    assert client.get("/api/status").status_code == 401


def test_student_page_and_status(student):
    page = student.get("/arbeitsblatt")
    assert page.status_code == 200
    html = page.get_data(as_text=True)
    assert "Der Erste Weltkrieg" in html
    assert "inhalte.js" in html and "app.js" in html
    status = student.get("/api/status").get_json()
    assert status["ok"] and status["erledigt"] == [] and status["aufgaben_gesamt"] == 44
    assert status["ki_konfiguriert"] is False


def test_fortschritt_and_abschnitte(student):
    assert student.post("/api/fortschritt", json={"aufgabe": 1, "niveau": "B"}).get_json()["ok"]
    assert student.post("/api/fortschritt", json={"aufgabe": "T"}).get_json()["ok"]
    # doppelte Meldung wird ignoriert, ungültige Aufgabe abgelehnt
    assert student.post("/api/fortschritt", json={"aufgabe": 1, "niveau": "B"}).get_json()["erledigt"] == 2
    assert student.post("/api/fortschritt", json={"aufgabe": 99, "niveau": "A"}).status_code == 400
    assert student.post("/api/fortschritt", json={"aufgabe": 2, "niveau": "X"}).status_code == 400
    status = student.get("/api/status").get_json()
    assert {e["nr"] for e in status["erledigt"]} == {"1", "T"}
    sid = appmodule.get_db().execute("SELECT id FROM schueler").fetchone()["id"]
    info = appmodule.get_schueler_info(sid)
    assert info["aufgaben_erledigt"] == 2
    assert info["abschnitte"]["ursachen"]["erledigt"] == 1
    assert info["abschnitte"]["abschluss"]["erledigt"] == 1
    assert info["abschnitte"]["abschluss"]["gesamt"] == 4


def test_antwort_protokoll(student):
    r1 = student.post("/api/antwort", json={"aufgabe": 3, "niveau": "A", "typ": "zuordnung", "antwort": "✅ Imperialismus → Kolonien", "korrekt": True}).get_json()
    r2 = student.post("/api/antwort", json={"aufgabe": 3, "niveau": "A", "typ": "zuordnung", "antwort": "❌ falsch", "korrekt": False}).get_json()
    assert r1["versuch"] == 1 and r2["versuch"] == 2 and r2["gesamt"] == 2
    assert student.post("/api/antwort", json={"aufgabe": 3, "niveau": "A", "typ": "unbekannt", "antwort": "x"}).status_code == 400
    rows = appmodule.get_db().execute("SELECT korrekt, versuch_nr FROM antworten ORDER BY id").fetchall()
    assert [(r["korrekt"], r["versuch_nr"]) for r in rows] == [(1, 1), (0, 2)]


def test_notizen_roundtrip(student):
    resp = student.post("/api/notizen", json={"abschnitt": "ursachen", "stichpunkte": "• Imperialismus\n• Nationalismus", "quellen": "Schulbuch S. 12"})
    assert resp.get_json()["ok"]
    resp = student.post("/api/notizen", json={"abschnitt": "ursachen", "stichpunkte": "• Imperialismus\n• Nationalismus\n• Militarismus", "quellen": "Schulbuch S. 12"})
    assert resp.get_json()["ok"]
    assert student.post("/api/notizen", json={"abschnitt": "unbekannt", "stichpunkte": "x"}).status_code == 400
    data = student.get("/api/notizen").get_json()["notizen"]
    assert list(data) == ["ursachen"]
    assert data["ursachen"]["stichpunkte"].count("•") == 3
    status = student.get("/api/status").get_json()
    assert status["notizen"]["ursachen"]["quellen"] == "Schulbuch S. 12"


def test_ki_freigabe_flow(student, teacher):
    # Ohne Freigabe: geblockt
    assert student.post("/api/chat", json={"message": "Was ist der Blankoscheck?"}).get_json()["blocked"] is True
    anfrage = student.post("/api/ki-anfrage", json={"typ": "chat", "kontext": "Tutor · Auslöser"}).get_json()
    assert anfrage["status"] == "wartend"
    aid = anfrage["anfrage_id"]
    # Lehrer sieht die Anfrage und gibt frei
    state = teacher.get("/api/lehrer/state").get_json()
    assert [a["id"] for a in state["anfragen"]] == [aid]
    assert teacher.post("/api/ki-entscheidung", json={"anfrage_id": aid, "entscheid": "freigegeben"}).get_json()["ok"]
    assert teacher.get("/api/lehrer/state").get_json()["anfragen"] == []
    # Freigegeben, aber kein API-Key: klarer Hinweis statt Fehler
    chat = student.post("/api/chat", json={"message": "Was ist der Blankoscheck?", "anfrage_id": aid}).get_json()
    assert "nicht konfiguriert" in chat["response"]
    # Chat-Freigabe gilt nicht für Korrektur
    assert student.post("/api/check-answer", json={"anfrage_id": aid, "answer": "x" * 30}).get_json()["blocked"] is True
    korr = student.post("/api/ki-anfrage", json={"typ": "korrektur", "kontext": "Aufgabe 7"}).get_json()
    teacher.post("/api/ki-entscheidung", json={"anfrage_id": korr["anfrage_id"], "entscheid": "freigegeben"})
    fb = student.post("/api/check-answer", json={"anfrage_id": korr["anfrage_id"], "question": "Q", "answer": "Eine ausführliche Antwort zum Bündnissystem."}).get_json()
    assert fb["correct"] is None and "gespeichert" in fb["feedback"]
    assert student.post("/api/ki-anfrage", json={"typ": "zeichnung"}).status_code == 400


def test_ki_sperre(student, teacher):
    sid = appmodule.get_db().execute("SELECT id FROM schueler").fetchone()["id"]
    pending = student.post("/api/ki-anfrage", json={"typ": "chat"}).get_json()["anfrage_id"]
    assert teacher.post("/api/lehrer/ki-sperren", json={"schueler_id": sid, "aktion": "sperren"}).get_json()["gesperrt"] is True
    assert student.post("/api/ki-anfrage", json={"typ": "chat"}).get_json()["status"] == "gesperrt"
    row = appmodule.get_db().execute("SELECT status FROM ki_anfragen WHERE id=?", (pending,)).fetchone()
    assert row["status"] == "abgelehnt"
    assert student.get("/api/status").get_json()["ki_gesperrt"] is True
    assert teacher.post("/api/lehrer/ki-sperren", json={"schueler_id": sid, "aktion": "freigeben"}).get_json()["gesperrt"] is False


def test_teacher_pages_and_auth(student, teacher, client):
    assert client.get("/api/lehrer/state").status_code == 401
    assert client.get("/lehrer").status_code == 302
    with appmodule.app.test_client() as anon:
        assert "Falsches Passwort" in anon.post("/lehrer/login", data={"passwort": "nope"}).get_data(as_text=True)
    student.post("/api/fortschritt", json={"aufgabe": 9, "niveau": "C"})
    student.post("/api/notizen", json={"abschnitt": "abschluss", "stichpunkte": "Transfertext", "quellen": json.dumps([{"titel": "bpb", "ort": "bpb.de", "art": "Website", "wert": "sehr verlässlich", "grund": "staatlich"}])})
    dash = teacher.get("/lehrer").get_data(as_text=True)
    assert "Silberfuchs" not in dash or "student-table" in dash  # Tabelle wird per Socket/State gefüllt
    sid = appmodule.get_db().execute("SELECT id FROM schueler").fetchone()["id"]
    detail = teacher.get(f"/lehrer/schueler/{sid}").get_data(as_text=True)
    assert "Silberfuchs" in detail and 'id="tile-9"' in detail and "niv-C" in detail
    assert "Transfertext" in detail
    assert teacher.get("/lehrer/schueler/unbekannt").status_code == 302


def test_daten_loeschen_und_reset(student, teacher):
    sid = appmodule.get_db().execute("SELECT id FROM schueler").fetchone()["id"]
    student.post("/api/fortschritt", json={"aufgabe": 1, "niveau": "A"})
    student.post("/api/notizen", json={"abschnitt": "verlauf", "stichpunkte": "x"})
    assert teacher.post("/api/lehrer/daten-loeschen", json={"schueler_id": sid}).get_json()["ok"]
    db = appmodule.get_db()
    for table in ("schueler", "fortschritt", "notizen"):
        assert db.execute(f"SELECT COUNT(*) AS n FROM {table}").fetchone()["n"] == 0
    # Sitzung des gelöschten Schülers ist ungültig
    assert student.get("/api/status").status_code == 401
    assert teacher.post("/api/lehrer/sitzung-zuruecksetzen").get_json()["ok"]


def test_inhalte_js_matches_server_structure():
    """Die Aufgabennummern in inhalte.js müssen zu ABSCHNITTE in app.py passen."""
    src = open(os.path.join(ROOT, "static", "js", "inhalte.js"), encoding="utf-8").read()
    tabs_src = src.split("tabs: [", 1)[1]
    blocks = re.split(r'\n\s*key: "', tabs_src)[1:]
    gefunden = {}
    for block in blocks:
        key = block.split('"', 1)[0]
        nrs = re.findall(r'\bnr: (\d+|"T")', block)
        gefunden[key] = [int(n) if n.isdigit() else "T" for n in nrs]
    erwartet = {a["key"]: a["aufgaben"] for a in appmodule.ABSCHNITTE}
    assert gefunden == erwartet
    # Jeder Inhalts-Abschnitt nutzt alle Kernaufgabentypen
    for block in blocks:
        key = block.split('"', 1)[0]
        typen = set(re.findall(r'typ: "([a-z]+)"', block))
        if key == "abschluss":
            assert {"sortierung", "mc", "quellen", "transfer"} <= typen
        else:
            assert {"mc", "luecke", "zuordnung", "sortierung", "diagramm", "karte", "freitext", "notizen"} <= typen, key


def test_inhalte_niveaus_complete():
    src = open(os.path.join(ROOT, "static", "js", "inhalte.js"), encoding="utf-8").read()
    differenziert = re.findall(r'typ: "(mc|luecke|zuordnung|sortierung|diagramm|karte|freitext)"', src)
    assert len(differenziert) == 37
    assert src.count("niveaus: {") == len(differenziert)
    for niveau in ("A: {", "B: {", "C: {"):
        assert src.count(niveau) >= len(differenziert)
    # Jede MC-Aufgabe hat genau die richtige Zahl an Lösungen
    for block in re.findall(r'\{ (?:multi: 2, )?frage: "[^"]+", optionen: \[(.*?)\] \}', src, flags=re.S):
        oks = block.count("ok: true")
        assert oks in (1, 2)
