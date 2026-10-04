import math
from typing import List, Dict, Any, Tuple

def computeStatistics(values: List[float]) -> Tuple[float, float]:
    if not values:
        return 0.0, 0.0
    n = len(values)
    mean = sum(values) / n
    if n < 2:
        return mean, 0.0
    variance = sum((x - mean) ** 2 for x in values) / (n - 1)
    return mean, variance

compute_statistics = computeStatistics

def calculateRisk(
    events: List[Dict[str, Any]],
    failedAttempts: int = 0,
    refreshCount: int = 0,
    challengeType: str = "text"
) -> Dict[str, Any]:
    reasons: List[Dict[str, Any]] = []
    points = 0

    if not events:
        return {
            "risk_score": 95,
            "risk_category": "HIGH RISK",
            "reasons": [{
                "rule": "no_telemetry_events",
                "points": 95,
                "detail": "No interaction telemetry recorded before submission (headless/direct POST)"
            }],
            "metrics": {
                "completion_time_ms": 0,
                "mouse_event_count": 0,
                "keyboard_event_count": 0,
                "avg_mouse_velocity": 0,
                "mouse_velocity_variance": 0,
                "mouse_accel_variance": 0,
                "keyboard_interval_variance": 0,
                "time_before_first_interaction_ms": 0,
                "trajectory_linearity": 0
            }
        }

    sortedEvents = sorted(events, key=lambda e: e.get("elapsed_ms", 0.0))
    loadEvent = next((e for e in sortedEvents if e.get("event_type") == "captcha_loaded"), sortedEvents[0])
    submitEvent = next((e for e in reversed(sortedEvents) if e.get("event_type") in ("captcha_submit", "click")), sortedEvents[-1])

    completionTime = max(0.0, float(submitEvent.get("elapsed_ms", 0.0)) - float(loadEvent.get("elapsed_ms", 0.0)))
    if completionTime == 0.0 and len(sortedEvents) > 1:
        completionTime = float(sortedEvents[-1].get("elapsed_ms", 0.0)) - float(sortedEvents[0].get("elapsed_ms", 0.0))

    mouseEvents = [e for e in sortedEvents if e.get("event_type") in ("mousemove", "mousedown", "mouseup", "click")]
    mouseMoves = [e for e in sortedEvents if e.get("event_type") == "mousemove" and e.get("x") is not None and e.get("y") is not None]
    mouseCount = len(mouseMoves)

    keyboardEvents = [e for e in sortedEvents if e.get("event_type") == "keydown"]
    keyCount = len(keyboardEvents)

    firstInteractive = next((e for e in sortedEvents if e.get("event_type") in ("mousemove", "keydown", "mousedown")), None)
    timeToFirst = 0.0
    if firstInteractive:
        timeToFirst = max(0.0, float(firstInteractive.get("elapsed_ms", 0.0)) - float(loadEvent.get("elapsed_ms", 0.0)))

    automatedDetected = False
    for ev in sortedEvents:
        meta = ev.get("meta") or {}
        if meta.get("webdriver") is True or meta.get("automated") is True:
            automatedDetected = True
            break

    if completionTime < 600:
        points += 25
        reasons.append({
            "rule": "completion_time_inhumanly_fast",
            "points": 25,
            "detail": f"Extremely fast completion ({int(completionTime)}ms < 600ms)"
        })
    elif completionTime < 1200:
        points += 15
        reasons.append({
            "rule": "completion_time_suspiciously_fast",
            "points": 15,
            "detail": f"Suspiciously fast completion ({int(completionTime)}ms < 1200ms)"
        })

    if mouseCount == 0:
        points += 30
        reasons.append({
            "rule": "zero_mouse_movements",
            "points": 30,
            "detail": "Zero mouse pointer movements detected prior to submission"
        })
    elif mouseCount < 10:
        points += 20
        reasons.append({
            "rule": "sparse_mouse_movements",
            "points": 20,
            "detail": f"Unusually low mouse movement count ({mouseCount} events)"
        })
    elif mouseCount < 25:
        points += 10
        reasons.append({
            "rule": "low_mouse_movements",
            "points": 10,
            "detail": f"Low mouse movement count ({mouseCount} events)"
        })

    velocities: List[float] = []
    accelerations: List[float] = []
    totalDistance = 0.0

    for i in range(1, len(mouseMoves)):
        prevEv = mouseMoves[i - 1]
        currEv = mouseMoves[i]
        dt = float(currEv.get("elapsed_ms") or 0.0) - float(prevEv.get("elapsed_ms") or 0.0)
        if dt > 0:
            dx = float(currEv.get("x") or 0.0) - float(prevEv.get("x") or 0.0)
            dy = float(currEv.get("y") or 0.0) - float(prevEv.get("y") or 0.0)
            dist = math.hypot(dx, dy)
            totalDistance += dist
            v = dist / dt
            velocities.append(v)
            if len(velocities) > 1:
                dv = velocities[-1] - velocities[-2]
                accelerations.append(dv / dt)

    avgVelocity, velVariance = computeStatistics(velocities)
    avgAccel, accelVariance = computeStatistics(accelerations)

    if mouseCount >= 8:
        if velVariance < 0.005 and avgVelocity > 0:
            points += 20
            reasons.append({
                "rule": "robotic_mouse_velocity_variance",
                "points": 20,
                "detail": f"Very low mouse velocity variance ({velVariance:.5f}), indicative of synthetic interpolation"
            })

        if accelVariance < 0.0001:
            points += 15
            reasons.append({
                "rule": "robotic_mouse_acceleration_variance",
                "points": 15,
                "detail": f"Near-zero mouse acceleration variance ({accelVariance:.6f})"
            })

    trajectoryLinearity = 0.0
    if mouseCount >= 8 and totalDistance > 10:
        startPt = (float(mouseMoves[0].get("x", 0.0)), float(mouseMoves[0].get("y", 0.0)))
        endPt = (float(mouseMoves[-1].get("x", 0.0)), float(mouseMoves[-1].get("y", 0.0)))
        straightDist = math.hypot(endPt[0] - startPt[0], endPt[1] - startPt[1])
        trajectoryLinearity = straightDist / totalDistance if totalDistance > 0 else 0.0

        if trajectoryLinearity > 0.985:
            points += 15
            reasons.append({
                "rule": "synthetic_linear_trajectory",
                "points": 15,
                "detail": f"Pointer moved in an almost perfect straight line (linearity {trajectoryLinearity:.3f})"
            })

    keyIntervals: List[float] = []
    for i in range(1, len(keyboardEvents)):
        dtKey = float(keyboardEvents[i].get("elapsed_ms", 0.0)) - float(keyboardEvents[i - 1].get("elapsed_ms", 0.0))
        if dtKey > 0:
            keyIntervals.append(dtKey)

    _, keyVariance = computeStatistics(keyIntervals)

    if challengeType == "text":
        if keyCount == 0:
            points += 25
            reasons.append({
                "rule": "input_filled_without_keystrokes",
                "points": 25,
                "detail": "Text answer was filled without keydown events (direct DOM value injection)"
            })
        elif keyCount >= 3 and keyVariance < 15.0:
            points += 20
            reasons.append({
                "rule": "unusually_regular_typing_cadence",
                "points": 20,
                "detail": f"Unusually regular interaction timing (keystroke variance {keyVariance:.1f}ms²)"
            })

    if timeToFirst < 50 and (mouseCount > 0 or keyCount > 0):
        points += 15
        reasons.append({
            "rule": "immediate_first_interaction",
            "points": 15,
            "detail": f"Immediate interaction ({int(timeToFirst)}ms < 50ms) without human reading latency"
        })

    if failedAttempts > 0:
        penalty = min(20, failedAttempts * 10)
        points += penalty
        reasons.append({
            "rule": "repeated_failed_attempts",
            "points": penalty,
            "detail": f"{failedAttempts} prior failed attempts recorded in session"
        })

    if refreshCount > 2:
        penalty = min(15, (refreshCount - 2) * 5)
        points += penalty
        reasons.append({
            "rule": "excessive_captcha_refreshes",
            "points": penalty,
            "detail": f"Repeated challenge refreshes ({refreshCount} times)"
        })

    if automatedDetected:
        points += 35
        reasons.append({
            "rule": "browser_automation_flag_present",
            "points": 35,
            "detail": "Automation indicator detected in browser runtime (navigator.webdriver)"
        })

    riskScore = min(100, max(0, points))

    if riskScore <= 30:
        category = "LOW RISK"
    elif riskScore <= 70:
        category = "MEDIUM RISK"
    else:
        category = "HIGH RISK"

    metrics = {
        "completion_time_ms": round(completionTime, 2),
        "mouse_event_count": mouseCount,
        "keyboard_event_count": keyCount,
        "avg_mouse_velocity": round(avgVelocity, 4),
        "mouse_velocity_variance": round(velVariance, 6),
        "mouse_accel_variance": round(accelVariance, 8),
        "keyboard_interval_variance": round(keyVariance, 2),
        "time_before_first_interaction_ms": round(timeToFirst, 2),
        "trajectory_linearity": round(trajectoryLinearity, 4),
        "failed_attempts": failedAttempts,
        "refresh_count": refreshCount,
        "total_events": len(sortedEvents)
    }

    return {
        "risk_score": riskScore,
        "risk_category": category,
        "reasons": reasons,
        "metrics": metrics
    }

evaluate_telemetry_risk = calculateRisk
