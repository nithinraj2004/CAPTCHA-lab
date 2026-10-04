# 🛡️ Local CAPTCHA Research & Bot-Testing Laboratory

An authorized, local security research and educational platform inspired by the interaction models of **GeeTest Adaptive CAPTCHA** and **Google reCAPTCHA v2**.

> **⚠️ IMPORTANT RESEARCH & ETHICAL NOTICE**  
> This laboratory is designed exclusively for authorized local security education and defensive research. It does **not** attempt to bypass, defeat, or attack third-party commercial CAPTCHA services. It operates entirely on locally generated procedural challenges, secure salted hashes, and client-side behavioral telemetry.

---

## 1. Laboratory Overview & Objectives

Traditional CAPTCHA systems rely on visual distortion tasks that are increasingly trivial for modern computer vision models. Modern defensive systems (e.g., Google reCAPTCHA v2/v3, GeeTest Adaptive v4, Cloudflare Turnstile) emphasize **behavioral biometrics** and **interaction telemetry** to distinguish human motor control from synthetic automation.

This laboratory provides a complete testbed to:
1. Allow **human users** to interact with both Text challenges and GeeTest-style Slider puzzles.
2. Allow a **local Playwright automation agent** to attempt the exact same challenges across multiple automation profiles.
3. Record high-resolution interaction telemetry (pointer trajectory, velocity variance, acceleration fluctuations, keystroke cadence).
4. Compute an explainable **"automation-risk score" (0–100)** via a transparent rule-based risk engine.
5. Provide **interactive visual session replays** on an HTML5 Canvas with speed controls (0.5x, 1x, 2x, 4x) and event scrubbers.
6. Display a comparative **analytics dashboard** with empirical feature separation metrics.
7. Run automated **experiment suites** with one-click CSV and JSON data export.

---

## 2. System Architecture

```
                                  +------------------------------------+
                                  |         React + Vite (Web)         |
                                  |  - CaptchaWidget (Text / Slider)   |
                                  |  - Passive Sensor Collector        |
                                  |  - SessionReplay Canvas            |
                                  +-----------------+------------------+
                                                    |
                         HTTP / REST API (Telemetry & Token Validation)
                                                    |
                                                    v
+------------------------+        +-----------------+------------------+
| Playwright Test Agents | -----> |          FastAPI Backend           |
| - Fast Input           |        |  - /api/captcha/generate           |
| - Synthetic Mouse      |        |  - /api/captcha/verify             |
| - Regular Timing       |        |  - /api/captcha/passive-eval       |
| - Randomized Bezier    |        |  - /api/dashboard/stats            |
+------------------------+        +--------+------------------+--------+
                                           |                  |
                                           v                  v
                          +----------------+---+   +----------+---------+
                          |   Risk Engine      |   | SQLite Database    |
                          | - Velocity var.    |   | - sessions         |
                          | - Accel. var.      |   | - captchas         |
                          | - Cadence var.     |   | - telemetry_events |
                          | - Linearity ratio  |   | - bot_runs         |
                          +--------------------+   +--------------------+
```

### Directory Structure

```
captcha-lab/
├── frontend/                     # React 19 + TypeScript + Vite + Vanilla CSS
│   ├── src/
│   │   ├── components/
│   │   │   ├── CaptchaWidget.tsx # Text & Slider interactive challenge + telemetry
│   │   │   ├── RiskIndicator.tsx # 0-100 risk dial + explainable reason points
│   │   │   ├── EventTimeline.tsx # Chronological event stream viewer
│   │   │   └── SessionReplay.tsx # Interactive canvas cursor & click replay
│   │   ├── pages/
│   │   │   ├── CaptchaTest.tsx   # Human testing & bot simulation workbench
│   │   │   ├── Dashboard.tsx     # KPI cards, histograms, and session filters
│   │   │   ├── SessionDetails.tsx# Forensic session inspector
│   │   │   └── Analysis.tsx      # Empirical distribution & separation matrix
│   │   └── services/
│   │       └── api.ts            # Typed REST API service
│
├── backend/                      # Python FastAPI application
│   ├── main.py                   # App entrypoint, CORS, security & rate limiting
│   ├── captcha/
│   │   ├── generator.py          # Procedural Text & GeeTest Slider generator
│   │   ├── validator.py          # Server-side hash verification & lifecycle
│   │   └── risk_engine.py        # Transparent rule-based automation risk engine
│   ├── database/
│   │   └── db.py                 # SQLite WAL schema & connection manager
│   ├── models/
│   │   └── schemas.py            # Pydantic validation models
│   ├── api/
│   │   └── routes.py             # REST API routes
│   └── integrations/
│       ├── recaptcha.py          # Google reCAPTCHA v2 adapter (official test keys)
│       └── geetest.py            # GeeTest v4 HMAC-SHA256 signature adapter
│
├── bot/                          # Playwright Chromium automation suite
│   ├── human_simulation.py       # Linear, Bezier, and keystroke generators
│   ├── automated_test.py         # Test execution engine with telemetry recording
│   └── runner.py                 # CLI multi-profile bot runner
│
├── tests/
│   ├── test_security.py          # 13 comprehensive security & lifecycle unit tests
│   └── test_risk_engine.py       # Behavioral scoring & feature extraction tests
│
├── docker-compose.yml            # Multi-container orchestration (API, Web, Redis)
├── run_experiment.py             # Master experiment runner CLI
└── README.md                     # Technical documentation
```

---

## 3. CAPTCHA Lifecycle & Security Controls

The laboratory enforces strict server-side cryptographic and lifecycle guarantees:

```
[Client Session Created]
         |
         v
[GET /api/captcha/generate]
         |
         +---> Server generates random alphanumeric characters (e.g. 7KPX4)
         +---> Server generates 32-byte cryptographically secure random salt
         +---> Computes SHA-256(salt + ":" + answer.upper())
         +---> Stores hash & salt in SQLite captchas table
         +---> Renders PNG with noise, lines, rotations, wave distortion
         +---> Returns Base64 PNG data URL to client (NEVER plaintext)
         |
         v
[User / Bot Solves Challenge]
         |
         v
[POST /api/captcha/verify]
         |
         +---> 1. Session Isolation: Checks captcha.session_id == req.session_id
         +---> 2. Replay Prevention: If captcha.solved == 1 or invalidated == 1 -> REJECT
         +---> 3. Expiration Check: If now > expires_at (5-minute TTL) -> REJECT
         +---> 4. Attempt Throttling: If attempt_count >= 5 -> INVALIDATE & REJECT
         +---> 5. Constant-time HMAC: hmac.compare_digest(computed_hash, stored_hash)
         +---> 6. Behavioral Evaluation: Risk Engine scores telemetry
         +---> 7. Immediate Invalidation: Challenge marked solved = 1, invalidated = 1
```

### Security Guarantees:
- **No Plaintext Answers Over the Wire**: The correct solution is never transmitted in API responses.
- **Replay Attack Resistance**: Solved or invalidated challenges cannot be submitted a second time.
- **Enumeration Resistance**: Random non-existent UUIDs return `NOT_FOUND` without leaking server state.
- **Session Isolation**: A challenge generated in session A cannot be verified under session B.
- **Constant-Time Comparison**: Mitigates timing attacks using `hmac.compare_digest`.
- **Adaptive Auto-Invalidation**: Generating a new challenge automatically marks any unverified challenge for that session as invalidated.

---

## 4. Behavioral Telemetry Model

The client-side collector captures only the minimal behavioral features required for research:

```json
{
  "session_id": "946e855c-8841-4e70-a9c4-bba4591d1701",
  "captcha_id": "54c66d77-f6ef-452b-9245-4f30f047ff20",
  "timestamp": "2026-10-03T18:00:15.240Z",
  "event_type": "mousemove",
  "x": 412,
  "y": 286,
  "relative_x": 0.458,
  "relative_y": 0.521,
  "elapsed_ms": 1145.2,
  "key_code": null,
  "target": "input#captcha-input",
  "meta": {
    "webdriver": false,
    "automated": false
  }
}
```

### Monitored Event Types:
- `mousemove`: Pointer coordinate stream sampled at ~80Hz with container-relative coordinates.
- `mousedown` / `mouseup` / `click`: Physical coordinate and target element mapping.
- `keydown` / `keyup`: Key timing intervals and `key_code` (e.g. `KeyA`). **Input content and passwords are never recorded.**
- `focus` / `blur`: Focus dwell and target elements.
- `captcha_loaded` / `captcha_refresh` / `captcha_submit`: Lifecycle timestamps.

---

## 5. Transparent Rule-Based Risk Engine

Rather than an unexplainable black box, the Risk Engine computes an **"automation-risk score" from 0 to 100** with explicit point attribution:

| Risk Category | Score Range | Adaptive Action |
| :--- | :---: | :--- |
| **LOW RISK** | 0 – 30 | Frictionless Pass / Allow |
| **MEDIUM RISK** | 31 – 70 | Interactive Challenge Required |
| **HIGH RISK** | 71 – 100 | Flagged / High-Risk Rejection |

### Feature Attribution Breakdown:
- **Completion Time ($T_{comp}$)**:
  - $< 600\text{ ms}$: `+25 points` (Inhumanly fast completion)
  - $< 1200\text{ ms}$: `+15 points` (Suspicious script velocity)
- **Mouse Movement Event Count ($N_{mouse}$)**:
  - $N = 0$: `+30 points` (Zero pointer trajectory / direct programmatic injection)
  - $N < 10$: `+20 points` (Extremely sparse pointer samples)
  - $N < 25$: `+10 points` (Low pointer interaction)
- **Mouse Velocity Variance ($\sigma^2_v$)**:
  - $\sigma^2_v < 0.005\text{ px}^2/\text{ms}^2$: `+20 points` (Robotic uniform velocity)
- **Mouse Acceleration Variance ($\sigma^2_a$)**:
  - $\sigma^2_a < 0.0001$: `+15 points` (Synthetic linear interpolation)
- **Trajectory Linearity Ratio ($\mathcal{L}$)**:
  - $\frac{\text{Euclidean Distance}}{\text{Path Distance}} > 0.985$: `+15 points` (Perfect straight line)
- **Keystroke Interval Variance ($\sigma^2_{key}$)**:
  - Keys typed without keydown events: `+25 points` (Direct DOM value injection)
  - $\sigma^2_{key} < 15.0\text{ ms}^2$: `+20 points` (Unusually regular typing cadence / robotic fixed delay)
- **Visual Reaction Latency ($T_{first}$)**:
  - $< 50\text{ ms}$: `+15 points` (Immediate interaction without human reading delay)
- **Browser Environment Integrity**:
  - `navigator.webdriver === true`: `+35 points` (Browser automation runtime detected)

---

## 6. Automation Profiles (Playwright)

The local Playwright bot implements 4 distinct interaction profiles:

| Profile | Mouse Trajectory | Keyboard Cadence | Typical Risk Score | Result |
| :--- | :--- | :--- | :---: | :--- |
| **PROFILE 1: Fast Automated** | Zero mouse movement | Direct DOM / 5ms bursts | **90 – 100** | High Risk Flagged |
| **PROFILE 2: Synthetic Mouse** | Linear interpolation ($x_0 + t \cdot \Delta x$) | Fixed 50ms interval | **60 – 75** | Medium / Elevated |
| **PROFILE 3: Regular Timing** | Uniform 25ms steps | Exact 120ms cadence | **85 – 95** | High Risk Flagged |
| **PROFILE 4: Randomized Bezier** | Cubic Bezier splines | Gaussian distribution (80–220ms) | **40 – 65** | Medium Risk |

---

## 7. Installation & Quick Start

### Prerequisites
- **Python 3.10+** (tested on Python 3.14)
- **Node.js 18+** & **npm**

### Step 1: Install Python Dependencies & Playwright
```bash
cd captcha-lab
pip install -r requirements.txt
python -m playwright install chromium
```

### Step 2: Install Frontend Dependencies
```bash
cd frontend
npm install
npm run build
cd ..
```

### Step 3: Run the Security Unit Tests
```bash
python -m pytest tests -v
```
All 13 security and risk engine unit tests should pass with 100% green status.

---

## 8. Running the Application

### Option A: Standard Dev Servers (Local)

**Terminal 1 (FastAPI Backend):**
```bash
cd captcha-lab
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 (React Frontend):**
```bash
cd captcha-lab/frontend
npm run dev -- --host 127.0.0.1 --port 5173
```
Open **`http://127.0.0.1:5173`** in your browser.

### Option B: Docker Compose
```bash
docker-compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

---

## 9. Running Bot Automation & Experiments

### Run Individual Bot Profiles
```bash
# Profile 1: Fast Automated Input
python -m bot.runner --profile fast

# Profile 2: Synthetic Linear Mouse
python -m bot.runner --profile synthetic

# Profile 3: Regular Robotic Timing
python -m bot.runner --profile regular

# Profile 4: Randomized Bezier Curves
python -m bot.runner --profile randomized

# Execute all profiles with 3 iterations each:
python -m bot.runner --profile all --count 3
```

### Run the Master Experiment Suite
```bash
python run_experiment.py --count 3
```
This command automatically executes the authorized bot agents, computes cross-profile statistical separation, exports `experiment_results.csv` and `experiment_results.json`, and prints a summary matrix to the terminal.

---

## 10. Interpreting Research Results

```
======================================================================
📋 OBSERVED SEPARATION & RESEARCH METRICS SUMMARY
======================================================================
Metric                         | Human Sessions   | Bot Sessions    
----------------------------------------------------------------------
Total Sessions Recorded        | 12               | 24              
Avg Completion Time (ms)       | 7420.5           | 1980.2          
Avg Automation-Risk Score      | 18.4             | 78.5            
Solved Attempts                | 12               | 16
Flagged / Rejected Attempts    | 0                | 8
======================================================================
```

### Why Simple Bots Leak Automated Signatures:
1. **The Biological Acceleration Invariant**: Human limbs possess mass, inertia, and neuromotor noise. Even when attempting to move in a straight line, real mouse movements exhibit continuous non-zero acceleration variance. Linear bots have $\sigma^2_a \approx 0$.
2. **Keystroke Isochrony**: Scripts that use fixed delay parameters (e.g. `time.sleep(0.1)`) create unnatural cadence peaks in frequency spectra.
3. **Cognitive Reading Dwell**: Humans require 400–1200ms to visually parse a distorted challenge before initiating hand movement.

---

## 11. Security Limitations & Privacy Considerations

### Security Limitations:
- **Transparent Heuristics**: This laboratory implements explainable rule-based heuristics for educational study. It does not replicate proprietary closed-source machine learning models (e.g., Google reCAPTCHA v3 enterprise risk models).
- **Adversarial Adaptation**: A sophisticated adversary with access to this risk engine's source code could tune Bezier curvature and Gaussian delays to mimic human distributions.

### Privacy Considerations:
- **No Keylogging**: Only timing intervals ($\Delta t$) and generic key codes are sampled. Plaintext characters or passwords are **never** logged or stored.
- **No Third-Party Tracking**: The local laboratory does not collect browser history, external cookies, canvas fingerprinting, or hardware serials.
- **Local Isolation**: All telemetry resides locally in SQLite and is never transmitted to external services.

---

## 12. License
MIT License. Created for authorized local security research and educational benchmarking.
#   C A P T C H A - l a b  
 