import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import sqlite3

def createSession(
    conn: sqlite3.Connection,
    userAgent: Optional[str] = None,
    isBot: bool = False,
    botProfile: Optional[str] = None
) -> Dict[str, str]:
    sessionId = str(uuid.uuid4())
    createdAt = datetime.now(timezone.utc).isoformat()
    with conn:
        conn.execute(
            """
            INSERT INTO sessions (session_id, created_at, user_agent, is_bot, bot_profile, status)
            VALUES (?, ?, ?, ?, ?, 'in_progress')
            """,
            (sessionId, createdAt, userAgent, 1 if isBot else 0, botProfile)
        )
    return {"session_id": sessionId, "created_at": createdAt}

def recordEvents(conn: sqlite3.Connection, events: List[Any], fallbackSessionId: str = "", fallbackCaptchaId: str = "") -> int:
    if not events:
        return 0
    with conn:
        for ev in events:
            evData = ev.model_dump() if hasattr(ev, "model_dump") else ev
            sId = evData.get("session_id") or fallbackSessionId
            cId = evData.get("captcha_id") or fallbackCaptchaId
            metaVal = evData.get("meta")
            conn.execute(
                """
                INSERT INTO telemetry_events 
                (session_id, captcha_id, timestamp, event_type, x, y, relative_x, relative_y, elapsed_ms, key_code, target, meta_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sId,
                    cId,
                    evData.get("timestamp") or datetime.now(timezone.utc).isoformat(),
                    evData.get("event_type", ""),
                    evData.get("x"),
                    evData.get("y"),
                    evData.get("relative_x"),
                    evData.get("relative_y"),
                    evData.get("elapsed_ms", 0.0),
                    evData.get("key_code"),
                    evData.get("target"),
                    json.dumps(metaVal) if metaVal else None
                )
            )
    return len(events)

def getSessions(
    conn: sqlite3.Connection,
    isBot: Optional[bool] = None,
    botProfile: Optional[str] = None,
    riskCategory: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
) -> Dict[str, Any]:
    cur = conn.cursor()
    query = "SELECT * FROM sessions WHERE 1=1"
    params: List[Any] = []

    if isBot is not None:
        query += " AND is_bot = ?"
        params.append(1 if isBot else 0)
    if botProfile:
        query += " AND bot_profile = ?"
        params.append(botProfile)
    if status:
        query += " AND status = ?"
        params.append(status)
    if riskCategory:
        cat = riskCategory.upper()
        if cat == "LOW":
            query += " AND risk_score <= 30"
        elif cat == "MEDIUM":
            query += " AND risk_score > 30 AND risk_score <= 70"
        elif cat == "HIGH":
            query += " AND risk_score > 70"

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    cur.execute(query, params)
    rows = cur.fetchall()

    newSessions = []
    for r in rows:
        cat = "LOW" if r["risk_score"] <= 30 else ("MEDIUM" if r["risk_score"] <= 70 else "HIGH")
        newSessions.append({
            "session_id": r["session_id"],
            "created_at": r["created_at"],
            "is_bot": bool(r["is_bot"]),
            "bot_profile": r["bot_profile"],
            "status": r["status"],
            "risk_score": r["risk_score"],
            "risk_category": cat,
            "completion_time_ms": r["completion_time_ms"],
            "adaptive_decision": r["adaptive_decision"]
        })
    return {"sessions": newSessions, "count": len(newSessions)}

def getSessionDetails(conn: sqlite3.Connection, sessionId: str) -> Optional[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute("SELECT * FROM sessions WHERE session_id = ?", (sessionId,))
    sessionRow = cur.fetchone()
    if not sessionRow:
        return None

    cur.execute(
        """
        SELECT captcha_id, challenge_type, created_at, expires_at, attempt_count, solved, invalidated 
        FROM captchas WHERE session_id = ?
        """,
        (sessionId,)
    )
    captchas = [dict(c) for c in cur.fetchall()]

    cur.execute("SELECT COUNT(*) as ev_count FROM telemetry_events WHERE session_id = ?", (sessionId,))
    evCount = cur.fetchone()["ev_count"]

    cur.execute("SELECT * FROM bot_runs WHERE session_id = ?", (sessionId,))
    botRun = cur.fetchone()

    return {
        "session": dict(sessionRow),
        "captchas": captchas,
        "event_count": evCount,
        "bot_run": dict(botRun) if botRun else None
    }

def getSessionReplay(conn: sqlite3.Connection, sessionId: str) -> Optional[Dict[str, Any]]:
    cur = conn.cursor()
    cur.execute("SELECT * FROM sessions WHERE session_id = ?", (sessionId,))
    sessionRow = cur.fetchone()
    if not sessionRow:
        return None

    cur.execute(
        """
        SELECT event_type, x, y, relative_x, relative_y, elapsed_ms, key_code, target, meta_json
        FROM telemetry_events
        WHERE session_id = ?
        ORDER BY elapsed_ms ASC
        """,
        (sessionId,)
    )
    events = []
    for r in cur.fetchall():
        events.append({
            "event_type": r["event_type"],
            "x": r["x"],
            "y": r["y"],
            "relative_x": r["relative_x"],
            "relative_y": r["relative_y"],
            "elapsed_ms": r["elapsed_ms"],
            "key_code": r["key_code"],
            "target": r["target"],
            "meta": json.loads(r["meta_json"]) if r["meta_json"] else {}
        })

    return {
        "session": dict(sessionRow),
        "total_events": len(events),
        "events": events
    }

def getDashboardStats(conn: sqlite3.Connection) -> Dict[str, Any]:
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) as total FROM sessions")
    totalSessions = cur.fetchone()["total"]

    cur.execute(
        """
        SELECT COUNT(*) as human_count, AVG(completion_time_ms) as avg_time, AVG(risk_score) as avg_risk 
        FROM sessions WHERE is_bot = 0 AND status != 'in_progress'
        """
    )
    hRow = cur.fetchone()

    cur.execute(
        """
        SELECT COUNT(*) as bot_count, AVG(completion_time_ms) as avg_time, AVG(risk_score) as avg_risk 
        FROM sessions WHERE is_bot = 1 AND status != 'in_progress'
        """
    )
    bRow = cur.fetchone()

    cur.execute("SELECT COUNT(*) as solved FROM sessions WHERE status = 'solved'")
    solvedCount = cur.fetchone()["solved"]

    cur.execute("SELECT COUNT(*) as failed FROM sessions WHERE status IN ('failed', 'flagged_risk')")
    failedCount = cur.fetchone()["failed"]

    cur.execute(
        """
        SELECT bot_profile, COUNT(*) as count, AVG(risk_score) as avg_risk, AVG(completion_time_ms) as avg_time 
        FROM sessions WHERE is_bot = 1 GROUP BY bot_profile
        """
    )
    botProfiles = [dict(r) for r in cur.fetchall()]

    cur.execute("SELECT COUNT(*) as count FROM sessions WHERE risk_score <= 30 AND status != 'in_progress'")
    lowRisk = cur.fetchone()["count"]
    cur.execute("SELECT COUNT(*) as count FROM sessions WHERE risk_score > 30 AND risk_score <= 70 AND status != 'in_progress'")
    medRisk = cur.fetchone()["count"]
    cur.execute("SELECT COUNT(*) as count FROM sessions WHERE risk_score > 70 AND status != 'in_progress'")
    highRisk = cur.fetchone()["count"]

    cur.execute(
        """
        SELECT session_id, is_bot, bot_profile, risk_score, completion_time_ms, status
        FROM sessions
        WHERE status != 'in_progress'
        ORDER BY created_at DESC LIMIT 200
        """
    )
    samples = [dict(r) for r in cur.fetchall()]

    return {
        "summary": {
            "total_sessions": totalSessions,
            "human_sessions": hRow["human_count"] or 0,
            "bot_sessions": bRow["bot_count"] or 0,
            "solved_sessions": solvedCount,
            "failed_sessions": failedCount,
            "human_avg_time_ms": round(hRow["avg_time"] or 0, 1),
            "human_avg_risk": round(hRow["avg_risk"] or 0, 1),
            "bot_avg_time_ms": round(bRow["avg_time"] or 0, 1),
            "bot_avg_risk": round(bRow["avg_risk"] or 0, 1)
        },
        "risk_distribution": {
            "low": lowRisk,
            "medium": medRisk,
            "high": highRisk
        },
        "bot_profiles": botProfiles,
        "samples": samples
    }
