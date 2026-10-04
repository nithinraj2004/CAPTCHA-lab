import argparse
import asyncio
import os
import subprocess
import sys
import time
from typing import Any, Dict, List
import httpx

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

API_BASE_URL = os.environ.get("LAB_API_URL", "http://127.0.0.1:8000")

def ensureBackendRunning():
    try:
        res = httpx.get(f"{API_BASE_URL}/health", timeout=2.0)
        if res.status_code == 200:
            print("[OK] Backend active at", API_BASE_URL)
            return None
    except Exception:
        pass

    print("[*] Starting backend server...")
    backendProc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=os.path.dirname(os.path.abspath(__file__)),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )

    for _ in range(30):
        time.sleep(0.3)
        try:
            res = httpx.get(f"{API_BASE_URL}/health", timeout=1.0)
            if res.status_code == 200:
                print(f"[OK] Backend started (PID: {backendProc.pid})")
                return backendProc
        except Exception:
            continue

    return backendProc

ensure_backend_running = ensureBackendRunning

async def startExperiment(countPerProfile: int = 5, challengeType: str = "text", headless: bool = True):
    from bot.runner import run_bot_test

    profiles = ["fast", "synthetic", "regular", "randomized"]
    suiteResults: Dict[str, List[Dict[str, Any]]] = {}

    for profile in profiles:
        print(f"\nExecuting profile: {profile} ({countPerProfile} runs)...")
        res = await run_bot_test(
            profile=profile,
            challenge_type=challengeType,
            headless=headless,
            count=countPerProfile
        )
        suiteResults[profile] = res

    async with httpx.AsyncClient() as client:
        statsResp = await client.get(f"{API_BASE_URL}/api/dashboard/stats")
        stats = statsResp.json() if statsResp.status_code == 200 else {}

        csvResp = await client.get(f"{API_BASE_URL}/api/export/csv")
        csvPath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "experiment_results.csv")
        with open(csvPath, "wb") as f:
            f.write(csvResp.content)
        print(f"\nExported CSV: {csvPath}")

        jsonResp = await client.get(f"{API_BASE_URL}/api/export/json")
        jsonPath = os.path.join(os.path.dirname(os.path.abspath(__file__)), "experiment_results.json")
        with open(jsonPath, "wb") as f:
            f.write(jsonResp.content)
        print(f"Exported JSON: {jsonPath}")

    summary = stats.get("summary", {})
    print("\n" + "=" * 65)
    print(f"{'Metric':<28} | {'Human':<14} | {'Bot':<14}")
    print("-" * 65)
    print(f"{'Total Sessions':<28} | {summary.get('human_sessions', 0):<14} | {summary.get('bot_sessions', 0):<14}")
    print(f"{'Avg Completion Time (ms)':<28} | {summary.get('human_avg_time_ms', 0):<14} | {summary.get('bot_avg_time_ms', 0):<14}")
    print(f"{'Avg Risk Score':<28} | {summary.get('human_avg_risk', 0):<14} | {summary.get('bot_avg_risk', 0):<14}")
    print("=" * 65 + "\n")

run_experiment_suite = startExperiment

def main():
    parser = argparse.ArgumentParser(description="Run CAPTCHA laboratory experiment suite")
    parser.add_argument("--count", type=int, default=3, help="Number of runs per bot profile")
    parser.add_argument("--challenge", choices=["text", "slider"], default="text", help="Challenge type")
    parser.add_argument("--no-headless", action="store_true", help="Show browser window during runs")
    args = parser.parse_args()

    proc = ensureBackendRunning()
    try:
        asyncio.run(startExperiment(
            countPerProfile=args.count,
            challengeType=args.challenge,
            headless=not args.no_headless
        ))
    finally:
        if proc:
            proc.terminate()

if __name__ == "__main__":
    main()
