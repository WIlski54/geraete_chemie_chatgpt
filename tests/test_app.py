import json
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

import app as core


class LaborgeraeteAppTest(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        core.DB_PATH = os.path.join(self.tempdir.name, "test.db")
        core.clear_active_student_connections()
        core.init_db()
        core.app.config.update(TESTING=True, SECRET_KEY="test-secret")
        core.teacher_action_tokens.clear()
        core.ki_blocked_students.clear()
        self.student = core.app.test_client()
        self.teacher = core.app.test_client()

    def tearDown(self):
        core.clear_active_student_connections()
        self.tempdir.cleanup()

    @staticmethod
    def login_student(client, pseudonym="Neonfuchs"):
        response = client.post(
            "/login",
            data={"pseudonym": pseudonym, "klasse": "7a", "privacy_ok": "on"},
            follow_redirects=False,
        )
        return response

    @staticmethod
    def teacher_headers(client):
        with client.session_transaction() as teacher_session:
            return {
                "X-Teacher-Action-Token": teacher_session["teacher_action_token"]
            }

    def test_complete_classroom_flow(self):
        response = self.login_student(self.student)
        self.assertEqual(response.status_code, 302)
        self.assertIn("/schueler", response.headers["Location"])

        response = self.student.post(
            "/api/antwort",
            json={
                "aufgabe": "1",
                "niveau": "A",
                "typ": "auswahl",
                "antwort": "Schutzbrille",
                "korrekt": True,
            },
        )
        self.assertTrue(response.get_json()["ok"])
        response = self.student.post(
            "/api/fortschritt", json={"aufgabe": "1", "niveau": "A"}
        )
        self.assertEqual(response.get_json()["total"], 1)

        request_response = self.student.post(
            "/api/ki-anfrage", json={"typ": "zeichnung", "kontext": "Becherglas"}
        )
        request_id = request_response.get_json()["anfrage_id"]

        response = self.teacher.post(
            "/lehrer/login", data={"passwort": core.LEHRER_PASSWORD}
        )
        self.assertEqual(response.status_code, 302)
        with self.teacher.session_transaction() as teacher_session:
            token = teacher_session["teacher_action_token"]
        headers = {"X-Teacher-Action-Token": token}

        state = self.teacher.get("/api/lehrer/state", headers=headers).get_json()
        self.assertEqual(len(state["students"]), 1)
        self.assertEqual(len(state["requests"]), 1)
        self.assertEqual(state["students"][0]["answer_count"], 1)

        decision = self.teacher.post(
            "/api/ki-entscheidung",
            json={"anfrage_id": request_id, "entscheid": "freigegeben"},
            headers=headers,
        )
        self.assertTrue(decision.get_json()["ok"])

        snapshot = self.teacher.post(
            "/api/lehrer/snapshots",
            json={"name": "7a Stunde 1"},
            headers=headers,
        ).get_json()
        self.assertTrue(snapshot["ok"])
        with core.get_db() as db:
            local_copy = json.loads(
                db.execute(
                    "SELECT snapshot_json FROM gespeicherte_sitzungen WHERE id=?",
                    (snapshot["id"],),
                ).fetchone()["snapshot_json"]
            )
        self.assertIsNone(local_copy["schueler"][0]["resume_token_hash"])

        reset = self.teacher.post("/api/lehrer/reset", headers=headers)
        self.assertTrue(reset.get_json()["ok"])
        empty_state = self.teacher.get("/api/lehrer/state", headers=headers).get_json()
        self.assertEqual(empty_state["students"], [])
        self.assertEqual(len(empty_state["snapshots"]), 1)

        loaded = self.teacher.post(
            f"/api/lehrer/snapshots/{snapshot['id']}/load", headers=headers
        )
        self.assertTrue(loaded.get_json()["ok"])
        restored = self.teacher.get("/api/lehrer/state", headers=headers).get_json()
        self.assertEqual(restored["students"][0]["pseudonym"], "Neonfuchs")
        self.assertFalse(restored["students"][0]["online"])

    def test_presence_ignores_teacher_disconnect_in_same_browser_profile(self):
        shared_browser = core.app.test_client()
        self.login_student(shared_browser)
        student_socket = core.socketio.test_client(
            core.app, flask_test_client=shared_browser
        )
        student_socket.emit("schueler_join", {})

        shared_browser.post("/lehrer/login", data={"passwort": core.LEHRER_PASSWORD})
        headers = self.teacher_headers(shared_browser)
        teacher_socket = core.socketio.test_client(
            core.app, flask_test_client=shared_browser
        )
        teacher_socket.emit("lehrer_join")

        state = shared_browser.get("/api/lehrer/state", headers=headers).get_json()
        self.assertTrue(state["students"][0]["online"])

        teacher_socket.disconnect()

        state = shared_browser.get("/api/lehrer/state", headers=headers).get_json()
        self.assertTrue(state["students"][0]["online"])
        self.assertNotIn("socket_id", state["students"][0])

        student_socket.disconnect()
        state = shared_browser.get("/api/lehrer/state", headers=headers).get_json()
        self.assertFalse(state["students"][0]["online"])

    def test_presence_tracks_multiple_student_tabs_and_rejects_stale_db_socket(self):
        self.login_student(self.student)
        first_socket = core.socketio.test_client(
            core.app, flask_test_client=self.student
        )
        second_socket = core.socketio.test_client(
            core.app, flask_test_client=self.student
        )
        first_socket.emit("schueler_join", {})
        second_socket.emit("schueler_join", {})

        self.teacher.post("/lehrer/login", data={"passwort": core.LEHRER_PASSWORD})
        headers = self.teacher_headers(self.teacher)
        first_socket.disconnect()
        state = self.teacher.get("/api/lehrer/state", headers=headers).get_json()
        self.assertTrue(state["students"][0]["online"])

        second_socket.disconnect()
        with core.get_db() as db:
            db.execute("UPDATE schueler SET socket_id='alte-server-id'")
            db.commit()
        state = self.teacher.get("/api/lehrer/state", headers=headers).get_json()
        self.assertFalse(state["students"][0]["online"])

    def test_privacy_checkbox_is_required(self):
        response = self.student.post(
            "/login", data={"pseudonym": "Neonfuchs", "klasse": "7a"}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn("bestätige den Datenschutz", response.get_data(as_text=True))

    def test_healthcheck_verifies_database_access(self):
        response = self.student.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["app_id"], core.APP_ID)

    def test_amiga_emulator_is_served(self):
        response = self.student.get("/amiga")
        self.assertEqual(response.status_code, 302)
        self.assertTrue(response.headers["Location"].endswith("/static/amiga/index.html"))
        page = self.student.get("/static/amiga/index.html")
        self.assertEqual(page.status_code, 200)
        html = page.get_data(as_text=True)
        page.close()
        self.assertIn("AmigaWerk", html)
        for asset in ("sae/amiga.js", "roms/aros.js", "js/app.js", "js/demodisk.js", "css/app.css"):
            self.assertIn(asset, html)
            res = self.student.get("/static/amiga/" + asset)
            self.assertEqual(res.status_code, 200, asset)
            res.close()

    def test_workspace_autosave_and_resume_token_restore_the_same_student(self):
        self.login_student(self.student)
        with self.student.session_transaction() as student_session:
            student_id = student_session["schueler_id"]
            resume_token = student_session["resume_token"]
        state = {
            "schema_version": 1,
            "app_id": core.APP_ID,
            "fields": {"task1B": "Schützen: Schutzbrille"},
            "levels": {"1": "B"},
        }
        saved = self.student.post(
            "/api/arbeitsstand", json={"revision": 7, "state": state}
        )
        self.assertEqual(saved.status_code, 200)
        self.assertTrue(saved.get_json()["accepted"])

        reopened_browser = core.app.test_client()
        resumed = reopened_browser.post(
            "/api/resume", json={"student_id": student_id, "token": resume_token}
        )
        self.assertEqual(resumed.status_code, 200)
        restored = reopened_browser.get("/api/arbeitsstand").get_json()
        self.assertEqual(restored["revision"], 7)
        self.assertEqual(restored["state"]["fields"]["task1B"], "Schützen: Schutzbrille")

        rejected = core.app.test_client().post(
            "/api/resume", json={"student_id": student_id, "token": "falsch"}
        )
        self.assertEqual(rejected.status_code, 401)

    def test_snapshot_validation_accepts_backups_from_before_autosave(self):
        self.login_student(self.student)
        self.student.post(
            "/api/ki-anfrage", json={"typ": "chat", "kontext": "Altbestand"}
        )
        with core.get_db() as db:
            legacy_snapshot = core.capture_live_snapshot(db)
        legacy_snapshot.pop("arbeitsstaende")
        for student in legacy_snapshot["schueler"]:
            student.pop("resume_token_hash")
        for ai_request in legacy_snapshot["ki_anfragen"]:
            ai_request.pop("grant_mode")
        validated = core.validate_live_snapshot(legacy_snapshot)
        self.assertEqual(validated["arbeitsstaende"], [])
        self.assertIsNone(validated["schueler"][0]["resume_token_hash"])
        self.assertEqual(validated["ki_anfragen"][0]["grant_mode"], "einzel")

    def test_iserv_continuation_automatically_resumes_same_browser_token(self):
        self.login_student(self.student)
        with self.student.session_transaction() as student_session:
            student_id = student_session["schueler_id"]
            resume_token = student_session["resume_token"]
        self.student.post(
            "/api/arbeitsstand",
            json={
                "revision": 4,
                "state": {
                    "schema_version": 1,
                    "app_id": core.APP_ID,
                    "fields": {"task1B": "alter Arbeitsstand"},
                },
            },
        )
        with core.get_db() as db:
            archived_snapshot = core.capture_live_snapshot(
                db, preserve_resume_tokens=True
            )
        self.assertIsNotNone(archived_snapshot["schueler"][0]["resume_token_hash"])

        self.teacher.post("/lehrer/login", data={"passwort": core.LEHRER_PASSWORD})
        headers = self.teacher_headers(self.teacher)

        class ContinuationService:
            def download_snapshot(self, remote_name, expected_app_id):
                return {
                    "app_id": expected_app_id,
                    "name": "7a · Stunde 1",
                    "snapshot": archived_snapshot,
                }

        with patch.object(core, "make_iserv_service", return_value=ContinuationService()):
            loaded = self.teacher.post(
                "/api/lehrer/iserv/backups/fortsetzung.iabackup/load",
                json={"mode": "continue"},
                headers=headers,
            )
        self.assertEqual(loaded.status_code, 200)
        self.assertTrue(loaded.get_json()["continuation_mode"])

        reopened = core.app.test_client()
        resumed = reopened.post(
            "/api/resume", json={"student_id": student_id, "token": resume_token}
        )
        self.assertEqual(resumed.status_code, 200)
        restored = reopened.get("/api/arbeitsstand").get_json()
        self.assertEqual(restored["revision"], 4)
        state = self.teacher.get("/api/lehrer/state", headers=headers).get_json()
        self.assertTrue(state["continuation"]["active"])
        self.assertEqual(state["continuation"]["targets_claimed"], 1)

    def test_continuation_bulk_approves_unique_manual_login(self):
        self.login_student(self.student, pseudonym="Mondfalter")
        self.student.post(
            "/api/antwort",
            json={
                "aufgabe": "1",
                "niveau": "A",
                "typ": "auswahl",
                "antwort": "Schutzbrille",
                "korrekt": True,
            },
        )
        with core.get_db() as db:
            archived_snapshot = core.capture_live_snapshot(
                db, preserve_resume_tokens=True
            )
        old_student_id = archived_snapshot["schueler"][0]["id"]
        archived_snapshot["schueler"][0]["resume_token_hash"] = None

        self.teacher.post("/lehrer/login", data={"passwort": core.LEHRER_PASSWORD})
        headers = self.teacher_headers(self.teacher)

        class LegacyContinuationService:
            def download_snapshot(self, remote_name, expected_app_id):
                return {
                    "app_id": expected_app_id,
                    "name": "7a · ältere Sicherung",
                    "snapshot": archived_snapshot,
                }

        with patch.object(core, "make_iserv_service", return_value=LegacyContinuationService()):
            loaded = self.teacher.post(
                "/api/lehrer/iserv/backups/legacy.iabackup/load",
                json={"mode": "continue"},
                headers=headers,
            )
        self.assertEqual(loaded.status_code, 200)

        returning_student = core.app.test_client()
        waiting = self.login_student(returning_student, pseudonym="Mondfalter")
        self.assertEqual(waiting.status_code, 302)
        self.assertIn("/fortsetzung/warten", waiting.headers["Location"])

        state = self.teacher.get("/api/lehrer/state", headers=headers).get_json()
        self.assertEqual(state["continuation"]["unique_count"], 1)
        approved = self.teacher.post(
            "/api/lehrer/fortsetzung/approve-unique", headers=headers
        )
        self.assertEqual(approved.get_json()["approved"], 1)

        completed = returning_student.post("/api/fortsetzung/status")
        self.assertEqual(completed.get_json()["status"], "freigegeben")
        with returning_student.session_transaction() as student_session:
            self.assertEqual(student_session["schueler_id"], old_student_id)
        detail = self.teacher.get(f"/lehrer/schueler/{old_student_id}")
        self.assertIn("Schutzbrille", detail.get_data(as_text=True))

    def test_group_ai_grant_applies_limits_and_immediate_lock(self):
        self.login_student(self.student)
        self.teacher.post("/lehrer/login", data={"passwort": core.LEHRER_PASSWORD})
        headers = self.teacher_headers(self.teacher)
        granted = self.teacher.post(
            "/api/lehrer/ki-gruppe",
            json={
                "action": "grant",
                "klasse": "7a",
                "minutes": 10,
                "token_limit": 1200,
                "per_student_limit": 500,
                "types": ["chat", "zeichnung"],
            },
            headers=headers,
        )
        self.assertEqual(granted.status_code, 200)
        group = granted.get_json()["ai_group"]
        self.assertTrue(group["active"])
        self.assertEqual(group["remaining_tokens"], 1200)

        access = self.student.post(
            "/api/ki-zugang", json={"typ": "zeichnung", "kontext": "Reagenzglas"}
        )
        self.assertEqual(access.get_json()["status"], "freigegeben")
        request_id = access.get_json()["anfrage_id"]
        with core.get_db() as db:
            row = db.execute(
                "SELECT grant_mode,status FROM ki_anfragen WHERE id=?", (request_id,)
            ).fetchone()
        self.assertEqual(row["grant_mode"], "gruppe")
        self.assertEqual(row["status"], "freigegeben")

        locked = self.teacher.post(
            "/api/lehrer/ki-gruppe", json={"action": "lock"}, headers=headers
        )
        self.assertEqual(locked.status_code, 200)
        # Die Gruppensperre liegt in SQLite und übersteht damit auch einen
        # Container-Neustart, bei dem die flüchtige Einzelliste leer wäre.
        core.ki_blocked_students.clear()
        blocked = self.student.post(
            "/api/ki-zugang", json={"typ": "zeichnung", "kontext": "erneut"}
        )
        self.assertEqual(blocked.get_json()["status"], "blocked")
        later_student = core.app.test_client()
        self.login_student(later_student, pseudonym="Spätfuchs")
        later_blocked = later_student.post(
            "/api/ki-zugang", json={"typ": "chat", "kontext": "später Login"}
        )
        self.assertEqual(later_blocked.get_json()["status"], "blocked")

    def test_dashboard_exposes_continuation_and_group_controls(self):
        self.teacher.post("/lehrer/login", data={"passwort": core.LEHRER_PASSWORD})
        page = self.teacher.get("/lehrer").get_data(as_text=True)
        self.assertIn("KI für eine Gruppe", page)
        self.assertIn("Fortsetzungsmodus", page)
        self.assertIn("Alle eindeutigen Zuordnungen übernehmen", page)

    def test_editable_drawing_is_saved_and_survives_session_restore(self):
        self.login_student(self.student)
        with self.student.session_transaction() as student_session:
            student_id = student_session["schueler_id"]
        preview = (
            "data:image/png;base64,"
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        )
        canvas = {
            "version": "5.3.0",
            "objects": [
                {
                    "type": "rect",
                    "left": 100,
                    "top": 80,
                    "width": 180,
                    "height": 110,
                    "fill": "rgba(255,255,255,0)",
                    "stroke": "#006AB3",
                    "strokeWidth": 5,
                }
            ],
        }
        saved = self.student.post(
            "/api/zeichnungen",
            json={"device": "Becherglas", "canvas": canvas, "preview": preview},
        )
        self.assertEqual(saved.status_code, 200)
        self.assertTrue(saved.get_json()["ok"])
        library = self.student.get("/api/zeichnungen").get_json()
        self.assertEqual(library["drawings"][0]["canvas"]["objects"][0]["type"], "rect")

        rejected = self.student.post(
            "/api/zeichnungen",
            json={
                "device": "Becherglas",
                "canvas": {"objects": [{"type": "script"}]},
                "preview": preview,
            },
        )
        self.assertEqual(rejected.status_code, 400)

        self.teacher.post("/lehrer/login", data={"passwort": core.LEHRER_PASSWORD})
        headers = self.teacher_headers(self.teacher)
        detail = self.teacher.get(f"/lehrer/schueler/{student_id}")
        self.assertIn("Gespeicherte Objektzeichnungen", detail.get_data(as_text=True))
        self.assertIn("Becherglas", detail.get_data(as_text=True))

        snapshot = self.teacher.post(
            "/api/lehrer/snapshots", json={"name": "mit Zeichnung"}, headers=headers
        ).get_json()
        self.teacher.post("/api/lehrer/reset", headers=headers)
        self.teacher.post(
            f"/api/lehrer/snapshots/{snapshot['id']}/load", headers=headers
        )
        with core.get_db() as db:
            restored = db.execute(
                "SELECT canvas_json,preview_data FROM zeichnungen WHERE schueler_id=?",
                (student_id,),
            ).fetchone()
        self.assertIsNotNone(restored)
        self.assertEqual(restored["preview_data"], preview)
        self.assertEqual(
            json.loads(restored["canvas_json"])["objects"][0]["type"],
            "rect",
        )

    def test_device_images_are_available_to_the_worksheet(self):
        for filename in (
            "Kiste.jpg",
            "Becherglas.png",
            "Messzylinder.png",
            "Gasbrenner.png",
            "Mörser.png",
            "Reagenzgläser.png",
        ):
            response = self.student.get(f"/static/img/Geräte/{filename}")
            try:
                self.assertEqual(response.status_code, 200, filename)
                self.assertGreater(len(response.data), 100, filename)
            finally:
                response.close()
        editor_library = self.student.get("/static/vendor/fabric-5.3.0.min.js")
        try:
            self.assertEqual(editor_library.status_code, 200)
            self.assertGreater(len(editor_library.data), 300_000)
        finally:
            editor_library.close()

    def test_encrypted_iserv_dashboard_flow_verifies_then_purges_temporary_data(self):
        self.student.post(
            "/login",
            data={"pseudonym": "Neonfuchs", "klasse": "7a", "privacy_ok": "on"},
        )
        self.student.post(
            "/api/antwort",
            json={
                "aufgabe": "1",
                "niveau": "A",
                "typ": "auswahl",
                "antwort": "Schutzbrille",
                "korrekt": True,
            },
        )
        self.student.post(
            "/api/arbeitsstand",
            json={
                "revision": 1,
                "state": {
                    "schema_version": 1,
                    "app_id": core.APP_ID,
                    "fields": {"task1B": "Messzylinder"},
                },
            },
        )
        self.teacher.post("/lehrer/login", data={"passwort": core.LEHRER_PASSWORD})
        with self.teacher.session_transaction() as teacher_session:
            headers = {"X-Teacher-Action-Token": teacher_session["teacher_action_token"]}
        temporary = self.teacher.post(
            "/api/lehrer/snapshots",
            json={"name": "temporärer Zwischenstand"},
            headers=headers,
        )
        self.assertTrue(temporary.get_json()["ok"])

        with core.get_db() as db:
            remote_snapshot = core.capture_live_snapshot(db)

        class FakeIservService:
            config = SimpleNamespace(backup_path="Files/Backups_AB_KI")

            def list_backup_summaries(self, expected_app_id):
                self.listed_for = expected_app_id
                return [
                    {
                        "filename": "20260821T120000Z_abcdef123456.iabackup",
                        "name": "7a Stunde 1",
                        "created_at": "2026-08-21T12:00:00Z",
                        "size": 512,
                    }
                ]

            def upload_snapshot(self, name, app_id, snapshot):
                self.uploaded = snapshot
                return {
                    "filename": "20260821T120000Z_abcdef123456.iabackup",
                    "name": name,
                    "created_at": "2026-08-21T12:00:00Z",
                    "size": 512,
                }

            def download_snapshot(self, remote_name, expected_app_id):
                return {
                    "format": "gsm-interaktives-arbeitsblatt-iserv-backup",
                    "schema_version": 1,
                    "app_id": expected_app_id,
                    "name": "7a Stunde 1",
                    "created_at": "2026-08-21T12:00:00Z",
                    "snapshot": getattr(self, "uploaded", remote_snapshot),
                }

            def delete_snapshot(self, remote_name, expected_app_id):
                self.deleted = (remote_name, expected_app_id)
                return {
                    "ok": True,
                    "filename": remote_name,
                    "name": "7a Stunde 1",
                }

        service = FakeIservService()
        remote_name = "20260821T120000Z_abcdef123456.iabackup"
        with patch.object(core, "make_iserv_service", return_value=service):
            overview = self.teacher.get(
                "/api/lehrer/iserv/backups", headers=headers
            ).get_json()
            self.assertEqual(overview["worksheet"], "Laborgeräte")
            self.assertEqual(overview["backups"][0]["name"], "7a Stunde 1")
            self.assertEqual(service.listed_for, core.APP_ID)

            saved = self.teacher.post(
                "/api/lehrer/iserv/backups",
                json={"name": "7a Stunde 1"},
                headers=headers,
            )
            self.assertEqual(saved.status_code, 200)
            self.assertTrue(saved.get_json()["ok"])
            self.assertTrue(saved.get_json()["verified"])
            self.assertTrue(saved.get_json()["purged"])
            self.assertEqual(service.uploaded["schueler"][0]["pseudonym"], "Neonfuchs")

            purged_state = self.teacher.get(
                "/api/lehrer/state", headers=headers
            ).get_json()
            self.assertEqual(purged_state["students"], [])
            self.assertEqual(purged_state["snapshots"], [])

            preview = self.teacher.get(
                f"/api/lehrer/iserv/backups/{remote_name}/preview", headers=headers
            ).get_json()
            self.assertEqual(preview["summary"]["students"], 1)
            self.assertEqual(preview["summary"]["answers"], 1)

            loaded = self.teacher.post(
                f"/api/lehrer/iserv/backups/{remote_name}/load", headers=headers
            )
            self.assertEqual(loaded.status_code, 200)
            self.assertTrue(loaded.get_json()["temporary_server_restore"])

            unconfirmed_delete = self.teacher.delete(
                f"/api/lehrer/iserv/backups/{remote_name}", headers=headers
            )
            self.assertEqual(unconfirmed_delete.status_code, 400)

            deleted = self.teacher.delete(
                f"/api/lehrer/iserv/backups/{remote_name}",
                json={"confirmed": True},
                headers=headers,
            )
            self.assertEqual(deleted.status_code, 200)
            self.assertEqual(service.deleted, (remote_name, core.APP_ID))

        state = self.teacher.get("/api/lehrer/state", headers=headers).get_json()
        self.assertEqual(state["students"][0]["pseudonym"], "Neonfuchs")
        self.assertEqual(state["students"][0]["autosave_revision"], 1)
        self.assertEqual(state["snapshots"], [])

    def test_student_script_contains_explicit_positive_answer_feedback(self):
        response = self.student.get("/static/js/app.js")
        try:
            self.assertEqual(response.status_code, 200)
            self.assertIn("Deine Antwort war richtig!", response.get_data(as_text=True))
        finally:
            response.close()

    def test_basis_tasks_offer_non_repeating_random_device_questions(self):
        self.login_student(self.student)
        page = self.student.get("/schueler").get_data(as_text=True)
        self.assertIn('data-random-next="1"', page)
        self.assertIn('data-random-next="3"', page)
        script = self.student.get("/static/js/app.js")
        try:
            source = script.get_data(as_text=True)
            self.assertGreaterEqual(source.count("{id: '1-"), 20)
            self.assertGreaterEqual(source.count("{id: '3-"), 20)
            self.assertIn("filter(question => !state.seenIds.includes(question.id))", source)
            self.assertIn("random_questions:", source)
            self.assertIn("auswahl-serie", source)
        finally:
            script.close()

    def test_material_introduction_gates_sections_with_timed_rereading(self):
        self.login_student(self.student)
        page = self.student.get("/schueler").get_data(as_text=True)
        self.assertIn('id="material-introduction"', page)
        self.assertEqual(page.count('class="material-intro-slide"'), 6)
        self.assertIn('id="material-overview-content" hidden', page)
        self.assertIn("Die Stoffe hinter den Laborgeräten", page)
        self.assertIn("Chemie ist die Wissenschaft von den", page)
        script = self.student.get("/static/js/app.js")
        try:
            source = script.get_data(as_text=True)
            self.assertEqual(source.count("rereadSeconds:"), 6)
            self.assertIn("materialIntroState.phase = 'reread'", source)
            self.assertIn("item.rereadSeconds * 1000", source)
            self.assertIn("materialIntroState.phase = 'question'", source)
            self.assertIn("materialIntroState.completed = finished", source)
            self.assertIn("finished ? 'complete' : 'passed'", source)
            self.assertIn("material_intro:", source)
            self.assertIn("restoreMaterialIntroduction(data.material_intro || {})", source)
            self.assertIn("'lesepfad-mc'", source)
        finally:
            script.close()

    def test_learning_tabs_unlock_in_sequence_and_backup_stays_available(self):
        self.login_student(self.student)
        page = self.student.get("/schueler").get_data(as_text=True)
        self.assertIn('data-tab="start" data-unlock-requires="M"', page)
        self.assertIn('data-tab="quiz" data-unlock-requires="1,2,3"', page)
        self.assertIn('data-tab="drawing" data-unlock-requires="Q"', page)
        self.assertIn('data-tab="domino" data-unlock-requires="Z"', page)
        self.assertIn('data-tab="backup" aria-selected="false"', page)
        self.assertNotIn('data-tab="backup" data-unlock-requires=', page)

        script = self.student.get("/static/js/app.js")
        try:
            source = script.get_data(as_text=True)
            self.assertIn("function updateTabLocks()", source)
            self.assertIn("required.every(item => completedTasks.has(item))", source)
            self.assertIn("button.disabled = !unlocked", source)
            self.assertIn("if (button?.disabled)", source)
            self.assertIn("updateTabLocks();", source)
        finally:
            script.close()

    def test_failed_iserv_verification_keeps_all_server_data(self):
        self.login_student(self.student)
        self.student.post(
            "/api/antwort",
            json={"aufgabe": "1", "niveau": "A", "typ": "text", "antwort": "Test"},
        )
        self.teacher.post("/lehrer/login", data={"passwort": core.LEHRER_PASSWORD})
        headers = self.teacher_headers(self.teacher)

        class MismatchingService:
            def upload_snapshot(self, name, app_id, snapshot):
                return {"filename": "mismatch.iabackup", "name": name}

            def download_snapshot(self, remote_name, expected_app_id):
                with core.get_db() as db:
                    wrong = core.capture_live_snapshot(db)
                wrong["antworten"] = []
                return {"snapshot": wrong}

        with patch.object(core, "make_iserv_service", return_value=MismatchingService()):
            response = self.teacher.post(
                "/api/lehrer/iserv/backups",
                json={"name": "Fehlerprobe"},
                headers=headers,
            )
        self.assertEqual(response.status_code, 502)
        self.assertTrue(response.get_json()["server_data_kept"])
        state = self.teacher.get("/api/lehrer/state", headers=headers).get_json()
        self.assertEqual(len(state["students"]), 1)
        self.assertEqual(state["students"][0]["answer_count"], 1)


if __name__ == "__main__":
    unittest.main()
