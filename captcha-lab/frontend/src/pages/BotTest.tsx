import React, { useState, useRef, useEffect } from 'react';
import { api } from '../services/api';
import type { ChallengeType } from '../services/api';

interface BotTestProps {
  onSelectReplaySession?: (sessionId: string) => void;
}

export const BotTest: React.FC<BotTestProps> = ({ onSelectReplaySession }) => {
  const [profile, setProfile] = useState<'fast' | 'synthetic' | 'regular' | 'randomized'>('fast');
  const [challengeType, setChallengeType] = useState<ChallengeType>('text');
  const [iterations, setIterations] = useState<number>(5);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentState, setCurrentState] = useState<'IDLE' | 'STARTING' | 'EXECUTING' | 'VERIFYING' | 'COMPLETED' | 'ERROR'>('IDLE');
  const [currentIteration, setCurrentIteration] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<string>('00:00');
  const [latestResult, setLatestResult] = useState<{
    sessionId?: string;
    riskScore?: number;
    result?: string;
    completionTimeSec?: string;
  } | null>(null);

  const [history, setHistory] = useState<Array<{
    iteration: number;
    sessionId: string;
    riskScore: number;
    result: string;
    completionSec: string;
  }>>([]);

  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    let timer: any;
    if (isRunning) {
      startTimeRef.current = Date.now();
      timer = setInterval(() => {
        const diff = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const mm = String(Math.floor(diff / 60)).padStart(2, '0');
        const ss = String(diff % 60).padStart(2, '0');
        setElapsedSeconds(`${mm}:${ss}`);
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isRunning]);

  const startExperiment = async () => {
    setIsRunning(true);
    setCurrentState('STARTING');
    setCurrentIteration(0);
    setHistory([]);
    setLatestResult(null);

    const targetRuns = iterations;
    for (let i = 1; i <= targetRuns; i++) {
      setCurrentIteration(i);
      setCurrentState('EXECUTING');

      try {
        setCurrentState('VERIFYING');
        const data = await api.triggerBotRun(profile, challengeType, 1);
        const run = data.results && data.results[0];

        if (run) {
          const compSec = run.completion_time_ms ? (run.completion_time_ms / 1000).toFixed(2) + 's' : 'N/A';
          const rObj = {
            iteration: i,
            sessionId: run.session_id,
            riskScore: run.risk_score,
            result: run.result === 'ALLOW' ? 'PASSED' : 'REJECTED',
            completionSec: compSec,
          };
          setLatestResult({
            sessionId: run.session_id,
            riskScore: run.risk_score,
            result: rObj.result,
            completionTimeSec: compSec,
          });
          setHistory((prev) => [rObj, ...prev]);
        }
      } catch (err) {
        console.error('Bot iteration execution failed', err);
      }
    }

    setCurrentState('COMPLETED');
    setIsRunning(false);
  };

  return (
    <div style={{ maxWidth: '840px' }}>
      <h1 className="page-title">Bot Experiment</h1>
      <div className="page-subtitle">
        Automated mechanical agent testing against local CAPTCHA challenges.
      </div>

      <div className="section-divider" style={{ margin: '16px 0 24px' }} />

      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <h3>Experiment Parameters</h3>
          <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Playwright Automation Suite
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Target
            </label>
            <div className="mono input-text" style={{ display: 'flex', alignItems: 'center', backgroundColor: 'var(--bg-subtle)' }}>
              Local CAPTCHA Instance (127.0.0.1:8000)
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Automation Profile
            </label>
            <select
              className="input-select"
              style={{ width: '100%' }}
              value={profile}
              onChange={(e) => setProfile(e.target.value as any)}
              disabled={isRunning}
            >
              <option value="fast">Fast Automation (Instantaneous input, no dwell)</option>
              <option value="synthetic">Synthetic Linear (Constant velocity vectors)</option>
              <option value="regular">Regular Timing (Robotic fixed-interval keystrokes)</option>
              <option value="randomized">Randomized Bezier (Curved trajectory attempts)</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Challenge Type
            </label>
            <select
              className="input-select"
              style={{ width: '100%' }}
              value={challengeType}
              onChange={(e) => setChallengeType(e.target.value as any)}
              disabled={isRunning}
            >
              <option value="text">Text Distortion</option>
              <option value="slider">Puzzle Slider</option>
              <option value="image_select">3×3 Image Grid</option>
              <option value="click_order">Click in Order</option>
              <option value="rotate">Orientation Rotate</option>
              <option value="math">Arithmetic Math</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Iterations
            </label>
            <input
              type="number"
              min="1"
              max="50"
              className="input-text mono"
              style={{ width: '100%' }}
              value={iterations}
              onChange={(e) => setIterations(Math.max(1, Math.min(50, Number(e.target.value))))}
              disabled={isRunning}
            />
          </div>
        </div>

        <div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={startExperiment}
            disabled={isRunning}
          >
            {isRunning ? 'Running Experiment...' : 'Start Experiment'}
          </button>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <h3>Run Status</h3>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Iteration</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>
              {String(currentIteration).padStart(2, '0')} / {String(iterations).padStart(2, '0')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current state</div>
            <div style={{ marginTop: '4px' }}>
              <span className={`badge ${currentState === 'VERIFYING' || currentState === 'EXECUTING' ? 'badge-medium' : currentState === 'COMPLETED' ? 'badge-low' : 'badge-neutral'}`}>
                {currentState}
              </span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Elapsed</div>
            <div className="mono" style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>
              {elapsedSeconds}
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <h3>Latest Result</h3>
          {latestResult?.sessionId && onSelectReplaySession && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onSelectReplaySession(latestResult.sessionId!)}
            >
              Inspect Replay
            </button>
          )}
        </div>
        {latestResult ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Risk score</div>
              <div className="mono" style={{ fontSize: '24px', fontWeight: 700, marginTop: '2px', color: (latestResult.riskScore || 0) > 70 ? 'var(--color-danger)' : 'var(--color-success)' }}>
                {latestResult.riskScore}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Result</div>
              <div style={{ marginTop: '4px' }}>
                <span className={`badge ${latestResult.result === 'PASSED' ? 'badge-low' : 'badge-high'}`}>
                  {latestResult.result}
                </span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completion</div>
              <div className="mono" style={{ fontSize: '20px', fontWeight: 700, marginTop: '2px' }}>
                {latestResult.completionTimeSec}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', padding: '8px 0' }}>
            No iterations executed yet.
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="panel">
          <div className="panel-header">
            <h3>Iteration History</h3>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {history.length} completed
            </span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '10%' }}>#</th>
                <th style={{ width: '35%' }}>Session ID</th>
                <th style={{ width: '15%' }}>Risk</th>
                <th style={{ width: '20%' }}>Result</th>
                <th style={{ width: '20%' }}>Completion</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.iteration}>
                  <td className="mono">{h.iteration}</td>
                  <td className="mono" style={{ fontSize: '12px' }}>
                    {h.sessionId ? h.sessionId.slice(0, 12) + '...' : 'N/A'}
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>{h.riskScore}</td>
                  <td>
                    <span className={`badge ${h.result === 'PASSED' ? 'badge-low' : 'badge-high'}`}>
                      {h.result}
                    </span>
                  </td>
                  <td className="mono">{h.completionSec}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
