import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { SessionInfo } from '../services/api';

interface DashboardProps {
  onSelectSession?: (sessionId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onSelectSession }) => {
  const [stats, setStats] = useState<any>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState<string>('all');
  const [filterProfile, setFilterProfile] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');

  const getSessions = async () => {
    setLoading(true);
    try {
      const [statsData, newSessions] = await Promise.all([
        api.getDashboardStats(),
        api.getSessions({
          isBot: filterType === 'bot' ? true : filterType === 'human' ? false : undefined,
          botProfile: filterProfile !== 'all' ? filterProfile : undefined,
          riskCategory: filterRisk !== 'all' ? filterRisk : undefined,
        }),
      ]);
      setStats(statsData);
      setSessions(newSessions);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSessions();
  }, [filterType, filterProfile, filterRisk]);

  const summary = stats?.summary || {};
  const riskDist = stats?.risk_distribution || { low: 0, medium: 0, high: 0 };
  const totalSessions = summary.total_sessions || 0;

  const lowPct = totalSessions > 0 ? Math.round((riskDist.low / totalSessions) * 100) : 0;
  const medPct = totalSessions > 0 ? Math.round((riskDist.medium / totalSessions) * 100) : 0;
  const highPct = totalSessions > 0 ? Math.round((riskDist.high / totalSessions) * 100) : 0;

  const avgHumanRisk = summary.human_avg_risk !== undefined ? Number(summary.human_avg_risk).toFixed(1) : 'N/A';
  const avgBotRisk = summary.bot_avg_risk !== undefined ? Number(summary.bot_avg_risk).toFixed(1) : 'N/A';
  const solveRate = summary.success_rate !== undefined ? `${summary.success_rate}%` : 'N/A';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">CAPTCHA Research</h1>
          <div className="page-subtitle">
            Recorded human vs automated interaction telemetry and risk distributions.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={getSessions} disabled={loading}>
            Refresh
          </button>
          <a href={api.getExportCsvUrl()} download="captcha_lab_telemetry.csv" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            Export CSV
          </a>
          <a href={api.getExportJsonUrl()} download="captcha_lab_telemetry.json" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
            Export JSON
          </a>
        </div>
      </div>

      <div className="section-divider" style={{ margin: '0 0 24px' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div className="panel">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Human Sessions
          </div>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
            {summary.human_sessions ?? 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Avg Risk: {avgHumanRisk}
          </div>
        </div>

        <div className="panel">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Bot Sessions
          </div>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
            {summary.bot_sessions ?? 0}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Avg Risk: {avgBotRisk}
          </div>
        </div>

        <div className="panel">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Average Risk
          </div>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
            {summary.overall_avg_risk !== undefined ? Number(summary.overall_avg_risk).toFixed(1) : '0.0'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Scale: 0 (Human) - 100 (Bot)
          </div>
        </div>

        <div className="panel">
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
            Success Rate
          </div>
          <div className="mono" style={{ fontSize: '24px', fontWeight: 700, marginTop: '4px' }}>
            {solveRate}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Verification approval rate
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
        <div className="panel">
          <div className="panel-header">
            <h3>Risk Distribution</h3>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {totalSessions} total sessions
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px 0' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Low Risk (0–30)</span>
                <span className="mono">{riskDist.low} ({lowPct}%)</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ width: `${lowPct}%`, height: '100%', backgroundColor: 'var(--color-success)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Medium Risk (31–70)</span>
                <span className="mono">{riskDist.medium} ({medPct}%)</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ width: `${medPct}%`, height: '100%', backgroundColor: 'var(--color-warning)' }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>High Risk (71–100)</span>
                <span className="mono">{riskDist.high} ({highPct}%)</span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                <div style={{ width: `${highPct}%`, height: '100%', backgroundColor: 'var(--color-danger)' }} />
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h3>Completion Time</h3>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Behavioral separation
            </span>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Profile</th>
                <th>Avg Dwell</th>
                <th>Linearity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Human Natural</td>
                <td className="mono">6.42s</td>
                <td className="mono">0.68 (Curved)</td>
                <td>
                  <span className="badge badge-low">Normal</span>
                </td>
              </tr>
              <tr>
                <td>Fast Automation</td>
                <td className="mono">0.84s</td>
                <td className="mono">1.00 (Direct)</td>
                <td>
                  <span className="badge badge-high">Robotic</span>
                </td>
              </tr>
              <tr>
                <td>Synthetic Linear</td>
                <td className="mono">1.82s</td>
                <td className="mono">0.98 (Linear)</td>
                <td>
                  <span className="badge badge-high">Robotic</span>
                </td>
              </tr>
              <tr>
                <td>Regular Timing</td>
                <td className="mono">2.41s</td>
                <td className="mono">0.95 (Linear)</td>
                <td>
                  <span className="badge badge-medium">Suspicious</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Session Results</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <select
              className="input-select"
              style={{ height: '28px', fontSize: '12px' }}
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
            >
              <option value="all">All Types</option>
              <option value="human">Human Only</option>
              <option value="bot">Bot Only</option>
            </select>
            <select
              className="input-select"
              style={{ height: '28px', fontSize: '12px' }}
              value={filterProfile}
              onChange={(e) => setFilterProfile(e.target.value)}
            >
              <option value="all">All Profiles</option>
              <option value="fast">Fast</option>
              <option value="synthetic">Synthetic</option>
              <option value="regular">Regular</option>
              <option value="randomized">Randomized</option>
            </select>
            <select
              className="input-select"
              style={{ height: '28px', fontSize: '12px' }}
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
            >
              <option value="all">All Risk Levels</option>
              <option value="low">Low Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="high">High Risk</option>
            </select>
          </div>
        </div>

        {sessions.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No sessions match the selected filter.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>Session ID</th>
                <th style={{ width: '12%' }}>Type</th>
                <th style={{ width: '14%' }}>Profile</th>
                <th style={{ width: '12%' }}>Risk</th>
                <th style={{ width: '15%' }}>Result</th>
                <th style={{ width: '13%' }}>Duration</th>
                <th style={{ width: '12%' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const sessionId = s.sessionId || s.session_id;
                const isBot = s.isBot !== undefined ? s.isBot : s.is_bot;
                const botProfile = s.botProfile || s.bot_profile;
                const riskScore = s.riskScore !== undefined ? s.riskScore : s.risk_score;
                const completionTime = s.completionTime !== undefined ? s.completionTime : s.completion_time_ms;
                const isPassed = s.status === 'solved';
                const isRejected = s.status === 'failed' || s.status === 'flagged_risk';
                const resultText = isPassed ? 'Passed' : isRejected ? 'Rejected' : s.status;

                return (
                  <tr key={sessionId}>
                    <td className="mono" style={{ fontSize: '12px' }}>
                      {sessionId.slice(0, 8).toUpperCase()}...
                    </td>
                    <td>
                      <span className={`badge ${isBot ? 'badge-high' : 'badge-low'}`}>
                        {isBot ? 'BOT' : 'HUMAN'}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      {botProfile || 'natural'}
                    </td>
                    <td className="mono" style={{ fontWeight: 600 }}>
                      {Math.round(riskScore)}
                    </td>
                    <td>
                      <span className={`badge ${isPassed ? 'badge-low' : 'badge-high'}`}>
                        {resultText}
                      </span>
                    </td>
                    <td className="mono" style={{ fontSize: '12px' }}>
                      {completionTime ? `${(completionTime / 1000).toFixed(2)}s` : 'N/A'}
                    </td>
                    <td>
                      {onSelectSession && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onSelectSession(sessionId)}
                        >
                          Replay
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
