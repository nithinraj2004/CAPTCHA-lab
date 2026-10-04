import os
import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

TEST_DB_FILE = os.path.join(os.path.dirname(__file__), "test_captcha.db")
os.environ["CAPTCHA_DB_PATH"] = TEST_DB_FILE

from backend.main import app
from backend.database.db import getDbConnection, initDb
from backend.captcha import (
    generateSalt,
    hashAnswer,
    verifyCaptcha,
    MAX_ATTEMPTS
)

@pytest.fixture(autouse=True)
def setup_test_db():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass
    initDb()
    yield
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass

@pytest.fixture
def client():
    return TestClient(app)

def test_correct_answer_solves_and_invalidates():
    conn = getDbConnection()
    sessionId = str(uuid.uuid4())
    captchaId = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expiresAt = (now + timedelta(minutes=5)).isoformat()

    salt = generateSalt()
    ans = "TEST9"
    ansHash = hashAnswer(salt, ans)

    conn.execute(
        "INSERT INTO sessions (session_id, created_at, status) VALUES (?, ?, 'in_progress')",
        (sessionId, now.isoformat())
    )
    conn.execute(
        """
        INSERT INTO captchas (captcha_id, session_id, challenge_type, answer_hash, salt, created_at, expires_at, attempt_count, solved, invalidated)
        VALUES (?, ?, 'text', ?, ?, ?, ?, 0, 0, 0)
        """,
        (captchaId, sessionId, ansHash, salt, now.isoformat(), expiresAt)
    )
    conn.commit()

    res1 = verifyCaptcha(conn, captchaId, sessionId, ans, now=now)
    assert res1["valid"] is True
    assert res1["status"] == "SUCCESS"

    cur = conn.cursor()
    cur.execute("SELECT solved, invalidated, attempt_count FROM captchas WHERE captcha_id = ?", (captchaId,))
    row = cur.fetchone()
    assert row["solved"] == 1
    assert row["invalidated"] == 1
    assert row["attempt_count"] == 1

def test_captcha_replay_attack_prevented():
    conn = getDbConnection()
    sessionId = str(uuid.uuid4())
    captchaId = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expiresAt = (now + timedelta(minutes=5)).isoformat()

    salt = generateSalt()
    ans = "REPLAY1"
    ansHash = hashAnswer(salt, ans)

    conn.execute("INSERT INTO sessions (session_id, created_at) VALUES (?, ?)", (sessionId, now.isoformat()))
    conn.execute(
        """
        INSERT INTO captchas (captcha_id, session_id, challenge_type, answer_hash, salt, created_at, expires_at, attempt_count, solved, invalidated)
        VALUES (?, ?, 'text', ?, ?, ?, ?, 0, 0, 0)
        """,
        (captchaId, sessionId, ansHash, salt, now.isoformat(), expiresAt)
    )
    conn.commit()

    res1 = verifyCaptcha(conn, captchaId, sessionId, ans, now=now)
    assert res1["valid"] is True

    res2 = verifyCaptcha(conn, captchaId, sessionId, ans, now=now)
    assert res2["valid"] is False
    assert res2["status"] == "INVALIDATED"
    assert "Replay" in res2["message"]

def test_expired_captcha_rejected():
    conn = getDbConnection()
    sessionId = str(uuid.uuid4())
    captchaId = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expiresAt = (now - timedelta(minutes=1)).isoformat()

    salt = generateSalt()
    ans = "EXPIR4"
    ansHash = hashAnswer(salt, ans)

    conn.execute("INSERT INTO sessions (session_id, created_at) VALUES (?, ?)", (sessionId, now.isoformat()))
    conn.execute(
        """
        INSERT INTO captchas (captcha_id, session_id, challenge_type, answer_hash, salt, created_at, expires_at, attempt_count, solved, invalidated)
        VALUES (?, ?, 'text', ?, ?, ?, ?, 0, 0, 0)
        """,
        (captchaId, sessionId, ansHash, salt, (now - timedelta(minutes=6)).isoformat(), expiresAt)
    )
    conn.commit()

    res = verifyCaptcha(conn, captchaId, sessionId, ans, now=now)
    assert res["valid"] is False
    assert res["status"] == "EXPIRED"

def test_wrong_answer_and_excessive_attempts():
    conn = getDbConnection()
    sessionId = str(uuid.uuid4())
    captchaId = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expiresAt = (now + timedelta(minutes=5)).isoformat()

    salt = generateSalt()
    ans = "RIGHT8"
    ansHash = hashAnswer(salt, ans)

    conn.execute("INSERT INTO sessions (session_id, created_at) VALUES (?, ?)", (sessionId, now.isoformat()))
    conn.execute(
        """
        INSERT INTO captchas (captcha_id, session_id, challenge_type, answer_hash, salt, created_at, expires_at, attempt_count, solved, invalidated)
        VALUES (?, ?, 'text', ?, ?, ?, ?, 0, 0, 0)
        """,
        (captchaId, sessionId, ansHash, salt, now.isoformat(), expiresAt)
    )
    conn.commit()

    for attempt in range(1, 5):
        res = verifyCaptcha(conn, captchaId, sessionId, f"WRONG{attempt}", now=now)
        assert res["valid"] is False
        assert res["status"] == "WRONG_ANSWER"
        assert res["attempts"] == attempt

    res5 = verifyCaptcha(conn, captchaId, sessionId, "WRONG5", now=now)
    assert res5["valid"] is False
    assert res5["status"] == "MAX_ATTEMPTS_EXCEEDED"

    res6 = verifyCaptcha(conn, captchaId, sessionId, ans, now=now)
    assert res6["valid"] is False
    assert res6["status"] in ("MAX_ATTEMPTS_EXCEEDED", "INVALIDATED")

def test_captcha_id_enumeration_resistance():
    conn = getDbConnection()
    bogusId = str(uuid.uuid4())
    res = verifyCaptcha(conn, bogusId, "session_xyz", "ANYTHING")
    assert res["valid"] is False
    assert res["status"] == "NOT_FOUND"

def test_session_isolation_enforcement():
    conn = getDbConnection()
    sessionOwner = str(uuid.uuid4())
    sessionAttacker = str(uuid.uuid4())
    captchaId = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expiresAt = (now + timedelta(minutes=5)).isoformat()

    salt = generateSalt()
    ans = "ISOL8"
    ansHash = hashAnswer(salt, ans)

    conn.execute("INSERT INTO sessions (session_id, created_at) VALUES (?, ?)", (sessionOwner, now.isoformat()))
    conn.execute("INSERT INTO sessions (session_id, created_at) VALUES (?, ?)", (sessionAttacker, now.isoformat()))
    conn.execute(
        """
        INSERT INTO captchas (captcha_id, session_id, challenge_type, answer_hash, salt, created_at, expires_at, attempt_count, solved, invalidated)
        VALUES (?, ?, 'text', ?, ?, ?, ?, 0, 0, 0)
        """,
        (captchaId, sessionOwner, ansHash, salt, now.isoformat(), expiresAt)
    )
    conn.commit()

    res = verifyCaptcha(conn, captchaId, sessionAttacker, ans, now=now)
    assert res["valid"] is False
    assert res["status"] == "SESSION_MISMATCH"

def test_answer_hash_storage_integrity(client):
    sResp = client.post("/api/session/create", json={"is_bot": False})
    sessionId = sResp.json()["session_id"]

    gResp = client.get(f"/api/captcha/generate?session_id={sessionId}&challenge_type=text")
    assert gResp.status_code == 200
    data = gResp.json()
    assert "captcha_id" in data
    assert "image_data" in data
    assert "solution" not in data
    assert "answer" not in data

    captchaId = data["captcha_id"]

    conn = getDbConnection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM captchas WHERE captcha_id = ?", (captchaId,))
    row = dict(cur.fetchone())
    conn.close()

    assert "answer_hash" in row
    assert "salt" in row
    assert len(row["answer_hash"]) == 64

def test_captcha_refresh_invalidates_previous(client):
    sResp = client.post("/api/session/create", json={})
    sessionId = sResp.json()["session_id"]

    g1 = client.get(f"/api/captcha/generate?session_id={sessionId}&challenge_type=text").json()
    c1Id = g1["captcha_id"]

    g2 = client.get(f"/api/captcha/generate?session_id={sessionId}&challenge_type=text").json()
    c2Id = g2["captcha_id"]
    assert c1Id != c2Id

    conn = getDbConnection()
    cur = conn.cursor()
    cur.execute("SELECT invalidated FROM captchas WHERE captcha_id = ?", (c1Id,))
    row = cur.fetchone()
    assert row["invalidated"] == 1
    conn.close()

def test_rate_limiting_middleware(client):
    blocked = False
    for _ in range(150):
        resp = client.get("/health")
        if resp.status_code == 429:
            blocked = True
            break
    assert blocked is True
