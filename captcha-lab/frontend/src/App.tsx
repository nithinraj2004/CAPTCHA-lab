import React, { useState } from 'react';
import { HumanTest } from './pages/HumanTest';
import { BotTest } from './pages/BotTest';
import { Experiments } from './pages/Experiments';
import { Dashboard } from './pages/Dashboard';
import { SessionDetails } from './pages/SessionDetails';
import { Analysis } from './pages/Analysis';

type NavTab = 'human_test' | 'bot_test' | 'experiments' | 'sessions' | 'replay' | 'analysis';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('human_test');
  const [activeSessionId, setActiveSessionId] = useState<string>('8F3A2C91');
  const [replaySessionId, setReplaySessionId] = useState<string | null>(null);

  const handleSelectReplaySession = (id: string) => {
    setReplaySessionId(id);
    setActiveTab('replay');
  };

  return (
    <div className="app-container">
      {/* Top Application Bar */}
      <header className="top-bar">
        <div className="top-bar-left">
          <span className="lab-title">CAPTCHA LAB</span>
          <div className="top-bar-divider" />
          <span className="lab-meta">Security Research & Telemetry Workbench</span>
        </div>

        <div className="top-bar-right">
          <div className="session-indicator">
            <span>Session:</span>
            <span className="mono session-badge">
              {activeSessionId ? activeSessionId.slice(0, 5).toUpperCase() : '8F3A2'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Body: Narrow Sidebar + Workspace */}
      <div className="app-body">
        {/* Narrow Left Navigation */}
        <aside className="app-sidebar">
          <div className="nav-group">
            <div className="nav-group-title">Test</div>
            <button
              type="button"
              className={`nav-link ${activeTab === 'human_test' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('human_test');
                setReplaySessionId(null);
              }}
            >
              Human Test
            </button>
            <button
              type="button"
              className={`nav-link ${activeTab === 'bot_test' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('bot_test');
                setReplaySessionId(null);
              }}
            >
              Bot Test
            </button>
            <button
              type="button"
              className={`nav-link ${activeTab === 'experiments' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('experiments');
                setReplaySessionId(null);
              }}
            >
              Experiments
            </button>
            <button
              type="button"
              className={`nav-link ${activeTab === 'sessions' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('sessions');
                setReplaySessionId(null);
              }}
            >
              Sessions
            </button>
            <button
              type="button"
              className={`nav-link ${activeTab === 'replay' ? 'active' : ''}`}
              onClick={() => setActiveTab('replay')}
            >
              Replay
            </button>
          </div>

          <div className="nav-group">
            <div className="nav-group-title">Settings</div>
            <button
              type="button"
              className={`nav-link ${activeTab === 'analysis' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('analysis');
                setReplaySessionId(null);
              }}
            >
              Separation Analysis
            </button>
          </div>
        </aside>

        {/* Main Workspace */}
        <main className="main-workspace">
          {activeTab === 'human_test' && (
            <HumanTest onSessionCreated={(id) => setActiveSessionId(id)} />
          )}

          {activeTab === 'bot_test' && (
            <BotTest onSelectReplaySession={handleSelectReplaySession} />
          )}

          {activeTab === 'experiments' && (
            <Experiments />
          )}

          {activeTab === 'sessions' && (
            <Dashboard onSelectSession={handleSelectReplaySession} />
          )}

          {activeTab === 'replay' && (
            <div>
              {replaySessionId ? (
                <SessionDetails
                  sessionId={replaySessionId}
                  onBack={() => setReplaySessionId(null)}
                />
              ) : (
                <div className="panel" style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <h3 style={{ marginBottom: '8px' }}>Session Replay Investigation</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
                    Select a recorded session from the Sessions list or run a bot test to inspect pointer movement and event replay.
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('sessions')}
                  >
                    View Recorded Sessions
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analysis' && (
            <Analysis />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
