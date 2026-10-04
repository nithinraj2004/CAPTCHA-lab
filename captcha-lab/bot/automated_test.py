import asyncio
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import httpx
from playwright.async_api import async_playwright

from backend.database.db import get_db_connection
from bot.human_simulation import (
    simulate_fast_bot,
    simulate_synthetic_mouse,
    simulate_regular_timing,
    simulate_randomized_timing,
    simulate_slider_bot
)

API_BASE_URL = os.environ.get("LAB_API_URL", "http://127.0.0.1:8000")
FRONTEND_BASE_URL = os.environ.get("LAB_FRONTEND_URL", "http://127.0.0.1:5173")

async def runSingleBotSession(
    profile: str = "fast",
    challenge_type: str = "text",
    headless: bool = True,
    target_url: Optional[str] = None
) -> Dict[str, Any]:
    if target_url is None:
        target_url = f"{FRONTEND_BASE_URL}?bot=true&profile={profile}&challenge={challenge_type}"

    runId = str(uuid.uuid4())
    startTime = datetime.now(timezone.utc).isoformat()
    sessionId = None
    result = "ERROR"
    riskScore = 0.0
    completionTime = 0.0
    errorMsg = None

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            user_agent=f"CaptchaLabBot/1.0 ({profile}-profile; Playwright-Automation)"
        )
        page = await context.new_page()

        try:
            await page.goto(target_url, wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_selector("#captcha-container", timeout=12000)
            await page.wait_for_function('() => Boolean(document.querySelector("#captcha-container")?.getAttribute("data-captcha-id"))', timeout=12000)

            container = page.locator("#captcha-container")
            sessionId = await container.get_attribute("data-session-id")
            captchaId = await container.get_attribute("data-captcha-id")

            async with httpx.AsyncClient() as client:
                resp = await client.get(f"{API_BASE_URL}/api/test/challenge-solution/{captchaId}", timeout=5.0)
                if resp.status_code != 200:
                    raise RuntimeError("Could not retrieve test challenge solution")
                solution = resp.json()["solution"]

            tStart = time.perf_counter()

            if challenge_type == "slider":
                await simulate_slider_bot(page, profile, float(solution))
            else:
                inputSel = "#captcha-input"
                submitSel = "#captcha-submit-btn"

                if profile == "fast":
                    await simulate_fast_bot(page, inputSel, submitSel, solution)
                elif profile == "synthetic":
                    await simulate_synthetic_mouse(page, inputSel, submitSel, solution)
                elif profile == "regular":
                    await simulate_regular_timing(page, inputSel, submitSel, solution)
                elif profile == "randomized":
                    await simulate_randomized_timing(page, inputSel, submitSel, solution)
                else:
                    await simulate_fast_bot(page, inputSel, submitSel, solution)

            await page.wait_for_selector(".verification-result-badge", timeout=8000)
            tEnd = time.perf_counter()
            completionTime = round((tEnd - tStart) * 1000.0, 2)

            badge = page.locator(".verification-result-badge")
            result = await badge.get_attribute("data-result") or "COMPLETED"

            if sessionId:
                async with httpx.AsyncClient() as client:
                    sResp = await client.get(f"{API_BASE_URL}/api/session/{sessionId}")
                    if sResp.status_code == 200:
                        sData = sResp.json()["session"]
                        riskScore = sData.get("risk_score", 0.0)

        except Exception as e:
            errorMsg = str(e)
            result = "FAILED"
        finally:
            await browser.close()

    endTime = datetime.now(timezone.utc).isoformat()

    if sessionId:
        conn = get_db_connection()
        with conn:
            conn.execute(
                """
                INSERT INTO bot_runs 
                (run_id, session_id, bot_profile, start_time, end_time, result, risk_score, captcha_attempts, completion_time_ms, error_message)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
                """,
                (runId, sessionId, profile, startTime, endTime, result, riskScore, completionTime, errorMsg)
            )
        conn.close()

    return {
        "run_id": runId,
        "session_id": sessionId,
        "bot_profile": profile,
        "challenge_type": challenge_type,
        "result": result,
        "risk_score": riskScore,
        "completion_time_ms": completionTime,
        "start_time": startTime,
        "end_time": endTime,
        "error": errorMsg
    }

run_single_bot_session = runSingleBotSession
