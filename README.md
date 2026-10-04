# CAPTCHA Research Lab

A local research environment for studying CAPTCHA verification, behavioral telemetry, automation risk, and human-vs-bot interaction patterns.

## Features

- Local CAPTCHA challenges (procedural text and puzzle sliders)
- Human testing workbench
- Playwright bot testing with multiple interaction profiles
- Behavioral telemetry collection (mouse velocity, acceleration, keystroke intervals)
- Rule-based risk scoring engine (0 - 100 explainable score)
- Visual session replay on HTML5 canvas
- Automated experiment runner
- Feature separation and statistical analysis
- CSV and JSON report export

## Overview

Traditional CAPTCHAs rely primarily on image distortion tasks that automated vision models can often solve. Modern defenses combine challenge solving with behavioral telemetry to separate human users from automated scripts.

This project implements:
- Procedural text challenges with mixed-case distortion and puzzle sliders.
- Sensor collection for mouse trajectories, velocity variance, acceleration, and keystroke intervals.
- A rule-based risk engine that computes an explainable automation score from 0 to 100.
- Interactive HTML5 canvas session replay to review recorded cursor movements.
- Playwright-based bot profiles that simulate different automation behaviors.
- Automated experiment runs with CSV and JSON reporting.

## Architecture

```
                          +-----------------------------------+
                          |        React + Vite Frontend      |
                          |  - Challenge widget (Text/Slider) |
                          |  - Telemetry collector            |
                          |  - Canvas session replay          |
                          +-----------------+-----------------+
                                            |
                                  REST API (Telemetry & Solves)
                                            |
                                            v
+------------------------+        +-----------------+-----------------+
| Playwright Test Bots   | -----> |         FastAPI Backend           |
| - Fast DOM input       |        |  - Challenge generation           |
| - Synthetic linear     |        |  - Server-side validation         |
| - Regular timing       |        |  - Passive risk scoring           |
| - Randomized Bezier    |        |  - Session management             |
+------------------------+        +--------+-----------------+--------+
                                           |                 |
                                           v                 v
                          +----------------+--+   +----------+--------+
                          |   Risk Engine     |   | SQLite Database   |
                          | - Velocity var    |   | - sessions        |
                          | - Accel variance  |   | - captchas        |
                          | - Keystroke delta |   | - telemetry       |
                          | - Linearity ratio |   | - bot runs        |
                          +-------------------+   +-------------------+
```

### Project Layout

```
CAPTCHA-lab/
|-- captcha-lab/
|   |-- backend/          # FastAPI app, challenge generators, risk engine
|   |-- frontend/         # React, TypeScript, Vite app
|   |-- bot/              # Playwright automation scripts and profiles
|   |-- tests/            # Pytest test suite
|   |-- run_experiment.py # Experiment runner script
|   `-- requirements.txt  # Python dependencies
|-- docker-compose.yml    # Container orchestration
|-- package.json          # Root scripts
`-- README.md
```

## Security Design

The challenge lifecycle uses server-side cryptographic validation:
- Challenge answers are never sent in API responses.
- Answers are salted and hashed with SHA-256 before storing.
- Challenge solutions use constant-time comparisons (`hmac.compare_digest`) to resist timing attacks.
- Solved or expired challenges are immediately invalidated to prevent replay attacks.
- Text challenges support case-insensitive verification so users can type in capital or lowercase letters.
- Rate limiting and session isolation prevent brute force and cross-session submission.

## Risk Engine

The risk engine assigns point values based on observable differences between human interaction and programmatic automation:

| Category | Score Range | Action |
| --- | --- | --- |
| Low Risk | 0 - 30 | Allow |
| Medium Risk | 31 - 70 | Secondary verification |
| High Risk | 71 - 100 | Flag / Reject |

Evaluated telemetry metrics include:
- Completion time: extremely fast completion indicates programmatic script submission.
- Mouse event density: zero or very few events indicate direct DOM manipulation.
- Velocity and acceleration variance: human movement includes natural jitter and deceleration curves, whereas linear bots have near-zero acceleration variance.
- Trajectory linearity: straight lines between points suggest synthetic interpolation.
- Keystroke timing variance: fixed delay timers create unnaturally uniform intervals.
- Initial dwell time: human reading latency before first action.

## Automation Profiles

The Playwright test suite includes four reference profiles:

1. Fast Automated: Direct value injection with zero mouse movement and instant submission.
2. Synthetic Mouse: Linear interpolation between start and target coordinates at fixed intervals.
3. Regular Timing: Step-wise pointer movement with fixed keystroke cadences.
4. Randomized Bezier: Cubic Bezier curves with randomized timing and deceleration.

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm

### Installation

1. Install backend dependencies and Playwright browser:

```bash
cd captcha-lab
pip install -r requirements.txt
python -m playwright install chromium
```

2. Install frontend dependencies:

```bash
cd frontend
npm install
npm run build
cd ../..
```

### Running Locally

Start the backend and frontend in separate terminals:

Terminal 1 (Backend):
```bash
cd captcha-lab
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2 (Frontend):
```bash
cd captcha-lab/frontend
npm run dev
```

Open `http://127.0.0.1:5173` in your browser.
API documentation is available at `http://127.0.0.1:8000/docs`.

### Running with Docker

```bash
docker-compose up --build
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

## Tests and Automation

### Unit Tests

Run the full pytest suite:

```bash
cd captcha-lab
python -m pytest
```

### Bot Simulation

Run individual bot profiles against the local server:

```bash
cd captcha-lab

# Profile 1: Fast injection
python -m bot.runner --profile fast

# Profile 2: Synthetic linear
python -m bot.runner --profile synthetic

# Profile 3: Regular timing
python -m bot.runner --profile regular

# Profile 4: Randomized Bezier
python -m bot.runner --profile randomized

# All profiles
python -m bot.runner --profile all --count 3
```

### Running Experiments

To run batch benchmarks and export results to CSV and JSON:

```bash
cd captcha-lab
python run_experiment.py --count 3 --challenge text
```

## Privacy and Ethics

- This project is designed for defensive security research, testing, and education. It does not target or bypass external commercial services.
- Keystroke logging records timing intervals and key codes only. Character content and password inputs are never stored.
- All telemetry data remains local in SQLite and is not sent to any third party.

## License

MIT License.
