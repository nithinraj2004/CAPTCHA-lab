import os
import sqlite3

DB_PATH = os.environ.get("CAPTCHA_DB_PATH", os.path.join(os.path.dirname(os.path.dirname(__file__)), "captcha_lab.db"))

def getDbConnection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=20.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    return conn

get_db_connection = getDbConnection

def initDb():
    conn = getDbConnection()
    with conn:
        conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id TEXT PRIMARY KEY,
            created_at TEXT NOT NULL,
            user_agent TEXT,
            is_bot BOOLEAN DEFAULT 0,
            bot_profile TEXT,
            status TEXT DEFAULT 'in_progress',
            risk_score REAL DEFAULT 0,
            completion_time_ms REAL DEFAULT 0,
            passive_risk REAL DEFAULT 0,
            adaptive_decision TEXT DEFAULT 'pending'
        );
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS captchas (
            captcha_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            challenge_type TEXT DEFAULT 'text',
            answer_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            attempt_count INTEGER DEFAULT 0,
            solved BOOLEAN DEFAULT 0,
            invalidated BOOLEAN DEFAULT 0,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        );
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS telemetry_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            captcha_id TEXT,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            x REAL,
            y REAL,
            relative_x REAL,
            relative_y REAL,
            elapsed_ms REAL,
            key_code TEXT,
            target TEXT,
            meta_json TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        );
        """)

        conn.execute("""
        CREATE TABLE IF NOT EXISTS bot_runs (
            run_id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            bot_profile TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            result TEXT,
            risk_score REAL,
            captcha_attempts INTEGER DEFAULT 1,
            completion_time_ms REAL,
            error_message TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
        );
        """)

        conn.execute("CREATE INDEX IF NOT EXISTS idx_telemetry_session ON telemetry_events(session_id, elapsed_ms);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_captchas_session ON captchas(session_id);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_bot ON sessions(is_bot, bot_profile);")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bot_runs_time ON bot_runs(start_time DESC);")
    conn.close()

init_db = initDb

if __name__ == "__main__":
    initDb()
