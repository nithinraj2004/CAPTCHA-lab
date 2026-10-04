import random
import pytest
from backend.risk import calculateRisk, evaluate_telemetry_risk

def test_risk_engine_empty_telemetry():
    res = calculateRisk([])
    assert res["risk_score"] >= 75
    assert res["risk_category"] == "HIGH RISK"
    assert any("headless" in r["detail"].lower() or "direct" in r["detail"].lower() for r in res["reasons"])

def test_risk_engine_fast_completion():
    events = [
        {"event_type": "captcha_loaded", "elapsed_ms": 0},
        {"event_type": "keydown", "elapsed_ms": 100},
        {"event_type": "keydown", "elapsed_ms": 150},
        {"event_type": "captcha_submit", "elapsed_ms": 250}
    ]
    res = calculateRisk(events)
    assert res["risk_score"] > 30
    assert any(r["rule"] == "completion_time_inhumanly_fast" for r in res["reasons"])

def test_risk_engine_robotic_regular_typing():
    events = [
        {"event_type": "captcha_loaded", "elapsed_ms": 0},
        {"event_type": "mousemove", "x": 100, "y": 100, "elapsed_ms": 500},
        {"event_type": "mousemove", "x": 150, "y": 120, "elapsed_ms": 800},
        {"event_type": "keydown", "elapsed_ms": 1000},
        {"event_type": "keydown", "elapsed_ms": 1100},
        {"event_type": "keydown", "elapsed_ms": 1200},
        {"event_type": "keydown", "elapsed_ms": 1300},
        {"event_type": "captcha_submit", "elapsed_ms": 1800}
    ]
    res = calculateRisk(events)
    assert any("regular" in r["rule"] for r in res["reasons"])

def test_risk_engine_human_like_interaction():
    events = [{"event_type": "captcha_loaded", "elapsed_ms": 0}]

    cx, cy = 100.0, 100.0
    t = 800.0
    for _ in range(35):
        t += random.uniform(20, 60)
        cx += random.uniform(-10, 18)
        cy += random.uniform(-5, 12)
        events.append({
            "event_type": "mousemove",
            "x": cx,
            "y": cy,
            "elapsed_ms": t
        })

    keyDelays = [140, 95, 230, 110, 180]
    for kd in keyDelays:
        t += kd
        events.append({"event_type": "keydown", "elapsed_ms": t})

    t += 350
    events.append({"event_type": "captcha_submit", "elapsed_ms": t})

    res = calculateRisk(events)
    assert res["risk_score"] <= 30
    assert res["risk_category"] == "LOW RISK"
