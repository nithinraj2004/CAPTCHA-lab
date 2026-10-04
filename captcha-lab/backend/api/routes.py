import csv
import io
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse

from backend.database.db import get_db_connection
from backend.captcha import (
    createCaptcha as createChallenge,
    verifyCaptcha as checkCaptchaAnswer,
    createTextChallenge,
    createSliderChallenge,
    createImageSelectChallenge,
    createClickOrderChallenge,
    createRotateChallenge,
    createMathChallenge
)
from backend.risk import calculateRisk
from backend.sessions import (
    createSession as initSessionRecord,
    recordEvents as insertTelemetryBatch,
    getSessions as fetchSessionList,
    getSessionDetails as fetchSessionDetails,
    getSessionReplay as fetchSessionReplay,
    getDashboardStats as fetchDashboardStats
)
from backend.models.schemas import (
    CreateSessionRequest,
    CreateSessionResponse,
    BatchTelemetryRequest,
    VerifyCaptchaRequest,
    PassiveEvalRequest,
    BotRunRequest
)
from backend.integrations.recaptcha import verify_recaptcha_token, get_recaptcha_site_key
from backend.integrations.geetest import verify_geetest_token, get_geetest_id

router = APIRouter(prefix="/api")

_testSolutions: Dict[str, Any] = {}

@router.post("/session/create", response_model=CreateSessionResponse)
def createSession(req: CreateSessionRequest):
    conn = get_db_connection()
    sessionData = initSessionRecord(conn, req.user_agent, req.is_bot, req.bot_profile)
    conn.close()
    return CreateSessionResponse(**sessionData)

create_session = createSession

@router.post("/telemetry/batch")
def recordEvents(req: BatchTelemetryRequest):
    if not req.events:
        return {"status": "ok", "inserted": 0}
    conn = get_db_connection()
    count = insertTelemetryBatch(conn, req.events)
    conn.close()
    return {"status": "ok", "inserted": count}

record_telemetry_batch = recordEvents

@router.post("/captcha/passive-eval")
def evaluatePassiveTelemetry(req: PassiveEvalRequest):
    eventsData = [e.model_dump() for e in req.events]
    riskResult = calculateRisk(eventsData, failedAttempts=0, refreshCount=0)
    riskScore = riskResult["risk_score"]

    hasNaturalMouse = (
        riskResult["metrics"]["mouse_event_count"] >= 15
        and riskResult["metrics"]["mouse_velocity_variance"] > 0.005
    )
    decision = "AUTO_ALLOW" if (riskScore < 20 and hasNaturalMouse) else "CHALLENGE_REQUIRED"

    conn = get_db_connection()
    with conn:
        conn.execute(
            "UPDATE sessions SET passive_risk = ?, adaptive_decision = ? WHERE session_id = ?",
            (riskScore, decision, req.session_id)
        )
    conn.close()

    return {
        "decision": decision,
        "passive_risk_score": riskScore,
        "risk_category": riskResult["risk_category"],
        "reasons": riskResult["reasons"],
        "metrics": riskResult["metrics"]
    }

evaluate_passive_telemetry = evaluatePassiveTelemetry

@router.get("/test/challenge-solution/{captcha_id}")
def getTestChallengeSolution(captcha_id: str):
    solution = _testSolutions.get(captcha_id)
    if not solution:
        raise HTTPException(status_code=404, detail="Test solution not found or expired")
    return {"captcha_id": captcha_id, "solution": solution}

get_test_challenge_solution = getTestChallengeSolution

@router.get("/captcha/generate")
def createCaptcha(
    session_id: str = Query(..., description="Active session ID"),
    challenge_type: str = Query("text", description="Challenge type: text, slider, image_select, click_order, rotate, math")
):
    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("SELECT session_id FROM sessions WHERE session_id = ?", (session_id,))
    if not cur.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Session not found")

    cur.execute("UPDATE captchas SET invalidated = 1 WHERE session_id = ? AND solved = 0", (session_id,))

    captchaId = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expiresAt = (now + timedelta(minutes=5)).isoformat()
    nowIso = now.isoformat()

    responsePayload: Dict[str, Any] = {
        "captcha_id": captchaId,
        "session_id": session_id,
        "challenge_type": challenge_type,
        "expires_in_seconds": 300,
        "created_at": nowIso
    }

    ansHash, salt, payload, solutionVal = createChallenge(challenge_type)
    responsePayload.update(payload)
    _testSolutions[captchaId] = str(solutionVal)

    cur.execute(
        """
        INSERT INTO captchas (captcha_id, session_id, challenge_type, answer_hash, salt, created_at, expires_at, attempt_count, solved, invalidated)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0)
        """,
        (captchaId, session_id, challenge_type, ansHash, salt, nowIso, expiresAt)
    )
    conn.commit()
    conn.close()

    return responsePayload

generate_captcha = createCaptcha

@router.post("/captcha/verify")
def verifyCaptcha(req: VerifyCaptchaRequest):
    conn = get_db_connection()
    cur = conn.cursor()

    if req.events:
        insertTelemetryBatch(conn, req.events, fallbackSessionId=req.session_id, fallbackCaptchaId=req.captcha_id)

    cur.execute(
        """
        SELECT event_type, x, y, relative_x, relative_y, elapsed_ms, key_code, target, meta_json
        FROM telemetry_events
        WHERE session_id = ?
        ORDER BY elapsed_ms ASC
        """,
        (req.session_id,)
    )
    rawEvents = cur.fetchall()
    eventsList = []
    refreshCount = 0
    for r in rawEvents:
        meta = json.loads(r["meta_json"]) if r["meta_json"] else {}
        if r["event_type"] == "captcha_refresh":
            refreshCount += 1
        eventsList.append({
            "event_type": r["event_type"],
            "x": r["x"],
            "y": r["y"],
            "relative_x": r["relative_x"],
            "relative_y": r["relative_y"],
            "elapsed_ms": r["elapsed_ms"],
            "key_code": r["key_code"],
            "target": r["target"],
            "meta": meta
        })

    cur.execute("SELECT SUM(attempt_count) as total_attempts FROM captchas WHERE session_id = ?", (req.session_id,))
    attRow = cur.fetchone()
    failedAttempts = max(0, (attRow["total_attempts"] or 0) - 1)

    valResult = checkCaptchaAnswer(
        conn=conn,
        captchaId=req.captcha_id,
        sessionId=req.session_id,
        userAnswer=req.answer
    )

    cur.execute("SELECT challenge_type FROM captchas WHERE captcha_id = ?", (req.captcha_id,))
    cRow = cur.fetchone()
    ctype = cRow["challenge_type"] if cRow else "text"

    riskResult = calculateRisk(
        events=eventsList,
        failedAttempts=failedAttempts,
        refreshCount=refreshCount,
        challengeType=ctype
    )

    riskScore = riskResult["risk_score"]
    metrics = riskResult["metrics"]
    completionTime = metrics["completion_time_ms"]

    if valResult["valid"]:
        if riskScore > 70:
            decision = "REJECT_HIGH_RISK"
            sessionStatus = "flagged_risk"
            message = "Automated interaction detected"
            success = False
        else:
            decision = "ALLOW"
            sessionStatus = "solved"
            message = "Verification successful"
            success = True
    else:
        decision = "REJECT_FAILED_SOLVE"
        sessionStatus = "failed"
        message = valResult.get("message", "Invalid captcha")
        success = False

    conn.execute(
        """
        UPDATE sessions 
        SET status = ?, risk_score = ?, completion_time_ms = ?, adaptive_decision = ?
        WHERE session_id = ?
        """,
        (sessionStatus, riskScore, completionTime, decision, req.session_id)
    )
    conn.commit()
    conn.close()

    return {
        "success": success,
        "decision": decision,
        "status": sessionStatus,
        "message": message,
        "validation": valResult,
        "risk_score": riskScore,
        "risk_category": riskResult["risk_category"],
        "reasons": riskResult["reasons"],
        "metrics": metrics,
        "attempts_used": valResult.get("attempts", 1)
    }

@router.get("/sessions")
def getSessions(
    is_bot: Optional[bool] = None,
    bot_profile: Optional[str] = None,
    risk_category: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    conn = get_db_connection()
    result = fetchSessionList(conn, is_bot, bot_profile, risk_category, status, limit, offset)
    conn.close()
    return result

list_sessions = getSessions

@router.get("/session/{session_id}")
def getSessionDetails(session_id: str):
    conn = get_db_connection()
    details = fetchSessionDetails(conn, session_id)
    conn.close()
    if not details:
        raise HTTPException(status_code=404, detail="Session not found")
    return details

get_session_detail = getSessionDetails

@router.get("/session/{session_id}/replay")
def getSessionReplay(session_id: str):
    conn = get_db_connection()
    replay = fetchSessionReplay(conn, session_id)
    conn.close()
    if not replay:
        raise HTTPException(status_code=404, detail="Session not found")
    return replay

get_session_replay = getSessionReplay

@router.get("/dashboard/stats")
def getDashboardStats():
    conn = get_db_connection()
    stats = fetchDashboardStats(conn)
    conn.close()
    return stats

get_dashboard_stats = getDashboardStats

@router.get("/export/csv")
def exportCsv():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM sessions ORDER BY created_at DESC")
    rows = cur.fetchall()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "session_id", "created_at", "is_bot", "bot_profile", "status",
        "risk_score", "completion_time_ms", "passive_risk", "adaptive_decision"
    ])
    for r in rows:
        writer.writerow([
            r["session_id"], r["created_at"], r["is_bot"], r["bot_profile"] or "human",
            r["status"], r["risk_score"], r["completion_time_ms"], r["passive_risk"], r["adaptive_decision"]
        ])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=captcha_lab_sessions.csv"}
    )

export_csv = exportCsv

@router.get("/export/json")
def exportJson():
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM sessions ORDER BY created_at DESC")
    sessions = [dict(r) for r in cur.fetchall()]

    cur.execute("SELECT * FROM bot_runs ORDER BY start_time DESC")
    botRuns = [dict(r) for r in cur.fetchall()]
    conn.close()

    data = {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "sessions": sessions,
        "bot_runs": botRuns
    }
    return Response(
        content=json.dumps(data, indent=2),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=captcha_lab_data.json"}
    )

export_json = exportJson

@router.post("/bot/run")
async def triggerBotRun(req: BotRunRequest):
    from bot.runner import run_bot_test
    try:
        results = await run_bot_test(
            profile=req.bot_profile,
            challenge_type=req.challenge_type,
            headless=req.headless,
            count=req.count
        )
        return {"status": "completed", "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Bot execution failed: {str(e)}")

trigger_bot_run = triggerBotRun

@router.get("/bot/runs")
def listBotRuns(limit: int = 50):
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM bot_runs ORDER BY start_time DESC LIMIT ?", (limit,))
    runs = [dict(r) for r in cur.fetchall()]
    conn.close()
    return {"bot_runs": runs}

list_bot_runs = listBotRuns

@router.get("/integrations/recaptcha/config")
def getRecaptchaConfig():
    return {"site_key": get_recaptcha_site_key(), "enabled": True}

get_recaptcha_config = getRecaptchaConfig

@router.post("/integrations/recaptcha/verify")
async def verifyRecaptcha(request: Request):
    body = await request.json()
    token = body.get("token", "")
    return await verify_recaptcha_token(token)

handle_recaptcha_verification = verifyRecaptcha

@router.get("/integrations/geetest/config")
def getGeetestConfig():
    return {"captcha_id": get_geetest_id(), "enabled": True}

get_geetest_config = getGeetestConfig

@router.post("/integrations/geetest/verify")
async def verifyGeetest(request: Request):
    body = await request.json()
    return await verify_geetest_token(
        lot_number=body.get("lot_number", ""),
        pass_token=body.get("pass_token", ""),
        gen_time=body.get("gen_time", ""),
        captcha_output=body.get("captcha_output", "")
    )

handle_geetest_verification = verifyGeetest
