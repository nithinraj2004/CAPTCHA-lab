import hashlib
import hmac
import json
import math
import sqlite3
from datetime import datetime, timezone
from typing import Any, Dict, Optional

MAX_ATTEMPTS = 5

def hashAnswer(salt: str, answer: str) -> str:
    clean = answer.strip().upper()
    return hashlib.sha256(f"{salt}:{clean}".encode("utf-8")).hexdigest()

hash_answer = hashAnswer

def verifyCaptcha(
    conn: sqlite3.Connection,
    captchaId: str,
    sessionId: str,
    userAnswer: Any,
    now: Optional[datetime] = None
) -> Dict[str, Any]:
    if now is None:
        now = datetime.now(timezone.utc)

    cur = conn.cursor()
    cur.execute(
        """
        SELECT captcha_id, session_id, challenge_type, answer_hash, salt, 
               created_at, expires_at, attempt_count, solved, invalidated
        FROM captchas
        WHERE captcha_id = ?
        """,
        (captchaId,)
    )
    row = cur.fetchone()

    if not row:
        return {
            "valid": False,
            "status": "NOT_FOUND",
            "message": "Invalid captcha",
            "attempts": 0
        }

    if row["session_id"] != sessionId:
        return {
            "valid": False,
            "status": "SESSION_MISMATCH",
            "message": "Session mismatch",
            "attempts": row["attempt_count"]
        }

    if row["solved"] or row["invalidated"]:
        return {
            "valid": False,
            "status": "INVALIDATED",
            "message": "Replay attempt blocked",
            "attempts": row["attempt_count"]
        }

    expiresAt = datetime.fromisoformat(row["expires_at"])
    if expiresAt.tzinfo is None:
        expiresAt = expiresAt.replace(tzinfo=timezone.utc)

    if now > expiresAt:
        cur.execute("UPDATE captchas SET invalidated = 1 WHERE captcha_id = ?", (captchaId,))
        conn.commit()
        return {
            "valid": False,
            "status": "EXPIRED",
            "message": "Captcha expired",
            "attempts": row["attempt_count"]
        }

    attemptCount = row["attempt_count"]
    if attemptCount >= MAX_ATTEMPTS:
        cur.execute("UPDATE captchas SET invalidated = 1 WHERE captcha_id = ?", (captchaId,))
        conn.commit()
        return {
            "valid": False,
            "status": "MAX_ATTEMPTS_EXCEEDED",
            "message": "Too many attempts",
            "attempts": attemptCount
        }

    newAttempts = attemptCount + 1
    salt = row["salt"]
    storedHash = row["answer_hash"]
    challengeType = row["challenge_type"]

    isMatch = False
    if challengeType == "slider":
        try:
            val = int(round(float(userAnswer)))
            for cand in range(val - 5, val + 6):
                candHash = hashAnswer(salt, str(cand))
                if hmac.compare_digest(candHash, storedHash):
                    isMatch = True
                    break
        except (ValueError, TypeError):
            isMatch = False

    elif challengeType == "image_select":
        try:
            if isinstance(userAnswer, str):
                if userAnswer.strip().startswith("["):
                    indices = json.loads(userAnswer)
                else:
                    indices = [int(x.strip()) for x in userAnswer.split(",") if x.strip() != ""]
            else:
                indices = list(userAnswer)
            canonical = ",".join(str(i) for i in sorted(indices))
            computedHash = hashAnswer(salt, canonical)
            isMatch = hmac.compare_digest(computedHash, storedHash)
        except Exception:
            isMatch = False

    elif challengeType == "click_order":
        try:
            targets = json.loads(salt.split("|", 1)[1]) if "|" in salt else []
            clicks = json.loads(userAnswer) if isinstance(userAnswer, str) else userAnswer
            if isinstance(clicks, list) and len(clicks) == len(targets) and len(targets) > 0:
                allHit = True
                for u, t in zip(clicks, targets):
                    ux, uy = float(u.get("x", 0)), float(u.get("y", 0))
                    tx, ty = float(t.get("x", 0)), float(t.get("y", 0))
                    if math.hypot(ux - tx, uy - ty) > 34.0:
                        allHit = False
                        break
                isMatch = allHit
            else:
                isMatch = False
        except Exception:
            isMatch = False

    elif challengeType == "rotate":
        try:
            targetAngle = float(salt.split("|", 1)[1]) if "|" in salt else 0.0
            userAngle = float(userAnswer)
            diff = abs(userAngle - targetAngle) % 360
            if diff > 180:
                diff = 360 - diff
            isMatch = (diff <= 16.0)
        except Exception:
            isMatch = False

    elif challengeType == "math":
        try:
            cleanVal = str(int(str(userAnswer).strip()))
            computedHash = hashAnswer(salt, cleanVal)
            isMatch = hmac.compare_digest(computedHash, storedHash)
        except Exception:
            isMatch = False

    else:
        computedHash = hashAnswer(salt, str(userAnswer))
        isMatch = hmac.compare_digest(computedHash, storedHash)

    if isMatch:
        cur.execute(
            "UPDATE captchas SET attempt_count = ?, solved = 1, invalidated = 1 WHERE captcha_id = ?",
            (newAttempts, captchaId)
        )
        conn.commit()
        return {
            "valid": True,
            "status": "SUCCESS",
            "message": "Captcha solved",
            "attempts": newAttempts
        }

    shouldInvalidate = 1 if newAttempts >= MAX_ATTEMPTS else 0
    cur.execute(
        "UPDATE captchas SET attempt_count = ?, invalidated = ? WHERE captcha_id = ?",
        (newAttempts, shouldInvalidate, captchaId)
    )
    conn.commit()

    if newAttempts >= MAX_ATTEMPTS:
        return {
            "valid": False,
            "status": "MAX_ATTEMPTS_EXCEEDED",
            "message": "Too many attempts",
            "attempts": newAttempts
        }

    return {
        "valid": False,
        "status": "WRONG_ANSWER",
        "message": f"Incorrect answer. {MAX_ATTEMPTS - newAttempts} attempts remaining.",
        "attempts": newAttempts
    }

validate_captcha_submission = verifyCaptcha
