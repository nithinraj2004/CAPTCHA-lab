import json
import sqlite3
from datetime import datetime, timezone, timedelta
import pytest

from backend.database.db import init_db
from backend.captcha import (
    createCaptcha,
    generate_text_challenge,
    generate_slider_challenge,
    generate_image_select_challenge,
    generate_click_order_challenge,
    generate_rotate_challenge,
    generate_math_challenge,
    validate_captcha_submission
)

@pytest.fixture
def db_conn(tmp_path):
    dbFile = tmp_path / "test_challenges.db"
    conn = sqlite3.connect(str(dbFile))
    conn.row_factory = sqlite3.Row
    with conn:
        conn.execute("""
        CREATE TABLE sessions (
            session_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            user_agent TEXT,
            is_bot BOOLEAN DEFAULT 0,
            bot_profile TEXT,
            status TEXT DEFAULT 'in_progress',
            risk_score REAL DEFAULT 0,
            completion_time_ms REAL DEFAULT 0,
            passive_risk REAL DEFAULT 0,
            adaptive_decision TEXT DEFAULT 'pending'
        );
        """)
        conn.execute("""
        CREATE TABLE captchas (
            captcha_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            challenge_type TEXT DEFAULT 'text',
            answer_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            attempt_count INTEGER DEFAULT 0,
            solved BOOLEAN DEFAULT 0,
            invalidated BOOLEAN DEFAULT 0
        );
        """)
        conn.execute("INSERT INTO sessions (session_id, created_at) VALUES ('s1', '2026-01-01T00:00:00Z')")
    yield conn
    conn.close()

def _save_captcha(conn, cid, ctype, ahash, salt):
    now = datetime.now(timezone.utc)
    expiresAt = (now + timedelta(minutes=5)).isoformat()
    nowIso = now.isoformat()
    with conn:
        conn.execute(
            """
            INSERT INTO captchas (captcha_id, session_id, challenge_type, answer_hash, salt, created_at, expires_at)
            VALUES (?, 's1', ?, ?, ?, ?, ?)
            """,
            (cid, ctype, ahash, salt, nowIso, expiresAt)
        )

def test_image_select_solve_and_mismatch(db_conn):
    ansHash, salt, payload, solutionVal = generate_image_select_challenge()
    assert payload["total_tiles"] == 9
    assert len(payload["tiles"]) == 9
    assert "prompt" in payload
    _save_captcha(db_conn, "c_img", "image_select", ansHash, salt)

    indices = [int(x) for x in solutionVal.split(",")]
    reversedInput = ",".join(str(x) for x in reversed(indices))
    res = validate_captcha_submission(db_conn, "c_img", "s1", reversedInput)
    assert res["valid"] is True
    assert res["status"] == "SUCCESS"

def test_click_order_solve_and_mismatch(db_conn):
    ansHash, salt, payload, solutionJson = generate_click_order_challenge()
    assert len(payload["target_sequence"]) == 3
    _save_captcha(db_conn, "c_click", "click_order", ansHash, salt)

    targets = json.loads(solutionJson)
    res = validate_captcha_submission(db_conn, "c_click", "s1", json.dumps(targets))
    assert res["valid"] is True
    assert res["status"] == "SUCCESS"

def test_rotate_solve_and_mismatch(db_conn):
    ansHash, salt, payload, targetAngle = generate_rotate_challenge()
    _save_captcha(db_conn, "c_rot", "rotate", ansHash, salt)

    submittedAngle = (targetAngle + 5) % 360
    res = validate_captcha_submission(db_conn, "c_rot", "s1", str(submittedAngle))
    assert res["valid"] is True
    assert res["status"] == "SUCCESS"

    _save_captcha(db_conn, "c_rot_bad", "rotate", ansHash, salt)
    badAngle = (targetAngle + 120) % 360
    resBad = validate_captcha_submission(db_conn, "c_rot_bad", "s1", str(badAngle))
    assert resBad["valid"] is False
    assert resBad["status"] == "WRONG_ANSWER"

def test_math_solve_and_mismatch(db_conn):
    ansHash, salt, payload, solutionInt = generate_math_challenge()
    assert "prompt" in payload
    _save_captcha(db_conn, "c_math", "math", ansHash, salt)

    res = validate_captcha_submission(db_conn, "c_math", "s1", str(solutionInt))
    assert res["valid"] is True
    assert res["status"] == "SUCCESS"

def test_text_challenge_case_insensitivity(db_conn):
    ansHash, salt, dataUrl, text = generate_text_challenge()
    assert any(c.islower() for c in text), "Text challenge should contain small alphabets"
    assert any(c.isupper() for c in text), "Text challenge should contain capital alphabets"

    # Typing all small letters
    _save_captcha(db_conn, "c_text_lower", "text", ansHash, salt)
    resLower = validate_captcha_submission(db_conn, "c_text_lower", "s1", text.lower())
    assert resLower["valid"] is True
    assert resLower["status"] == "SUCCESS"

    # Typing all capital letters
    _save_captcha(db_conn, "c_text_upper", "text", ansHash, salt)
    resUpper = validate_captcha_submission(db_conn, "c_text_upper", "s1", text.upper())
    assert resUpper["valid"] is True
    assert resUpper["status"] == "SUCCESS"

    # Typing exact mixed case
    _save_captcha(db_conn, "c_text_exact", "text", ansHash, salt)
    resExact = validate_captcha_submission(db_conn, "c_text_exact", "s1", text)
    assert resExact["valid"] is True
    assert resExact["status"] == "SUCCESS"

