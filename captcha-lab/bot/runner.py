import argparse
import asyncio
import sys
from typing import List, Dict, Any

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

from bot.automated_test import runSingleBotSession

async def runBotTest(
    profile: str = "fast",
    challenge_type: str = "text",
    headless: bool = True,
    count: int = 1
) -> List[Dict[str, Any]]:
    results = []
    print(f"\n[BOT] Starting runner: Profile='{profile}', Count={count}, Challenge='{challenge_type}', Headless={headless}")

    for i in range(1, count + 1):
        print(f"[{i}/{count}] Launching {profile} bot...")
        try:
            res = await runSingleBotSession(
                profile=profile,
                challenge_type=challenge_type,
                headless=headless
            )
            results.append(res)
            print(f"  Result: {res['result']}, Risk: {res['risk_score']}/100, Time: {res['completion_time_ms']}ms")
            if res.get("error"):
                print(f"  Error: {res['error']}")
        except Exception as e:
            print(f"  Execution error: {e}")
            results.append({"status": "failed", "error": str(e), "profile": profile})

    return results

run_bot_test = runBotTest

def main():
    parser = argparse.ArgumentParser(description="CAPTCHA Bot Runner")
    parser.add_argument("--profile", choices=["fast", "synthetic", "regular", "randomized", "all"], default="fast")
    parser.add_argument("--challenge", choices=["text", "slider"], default="text")
    parser.add_argument("--count", type=int, default=1)
    parser.add_argument("--headless", action="store_true", default=True)
    parser.add_argument("--no-headless", dest="headless", action="store_false")

    args = parser.parse_args()

    if args.profile == "all":
        profiles = ["fast", "synthetic", "regular", "randomized"]
        async def runAll():
            for p in profiles:
                await runBotTest(profile=p, challenge_type=args.challenge, headless=args.headless, count=args.count)
        asyncio.run(runAll())
    else:
        asyncio.run(runBotTest(
            profile=args.profile,
            challenge_type=args.challenge,
            headless=args.headless,
            count=args.count
        ))

if __name__ == "__main__":
    main()
