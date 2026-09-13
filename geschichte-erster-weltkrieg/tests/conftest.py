import os
import sys
import tempfile

import pytest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

_tmpdir = tempfile.mkdtemp(prefix="weltkrieg-test-")
os.environ["DB_PATH"] = os.path.join(_tmpdir, "test.db")
os.environ["LEHRER_PASSWORD"] = "test-geheim"
os.environ["GEMINI_API_KEY"] = ""
os.environ["SOCKETIO_ASYNC_MODE"] = "threading"

import app as appmodule  # noqa: E402


@pytest.fixture()
def client():
    appmodule.clear_session_data()
    appmodule.app.config["TESTING"] = True
    return appmodule.app.test_client()


@pytest.fixture()
def student(client):
    resp = client.post("/login", data={"pseudonym": "Silberfuchs", "klasse": "9a", "privacy_ok": "on"})
    assert resp.status_code == 302
    return client


@pytest.fixture()
def teacher():
    c = appmodule.app.test_client()
    resp = c.post("/lehrer/login", data={"passwort": "test-geheim"})
    assert resp.status_code == 302
    return c
