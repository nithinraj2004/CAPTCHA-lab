# CAPTCHA Lab Workbench

This directory contains the application code, tests, and experiment runner.

For full architecture details, risk model descriptions, and configuration options, see the root [README.md](../README.md).

## Quick Start

### Backend

```bash
pip install -r requirements.txt
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Tests

```bash
python -m pytest
```

### Bot Profiles and Experiments

```bash
# Run a specific bot profile
python -m bot.runner --profile fast
python -m bot.runner --profile synthetic
python -m bot.runner --profile regular
python -m bot.runner --profile randomized

# Run experiment suite
python run_experiment.py --count 3 --challenge text
```
