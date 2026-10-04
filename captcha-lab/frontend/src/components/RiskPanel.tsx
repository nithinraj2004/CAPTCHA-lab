import React from 'react';
import type { RiskReason, TelemetryMetrics } from '../services/api';

export interface RiskPanelProps {
  score: number;
  category: 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK' | string;
  reasons?: RiskReason[];
  metrics?: TelemetryMetrics;
}

export const RiskPanel: React.FC<RiskPanelProps> = ({
  score,
  category,
  reasons = [],
  metrics,
}) => {
  const getCategoryClass = () => {
    if (score <= 30) return 'badge-low';
    if (score <= 70) return 'badge-medium';
    return 'badge-high';
  };

  const getScoreColor = () => {
    if (score <= 30) return 'var(--color-success)';
    if (score <= 70) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  const formatVariance = (val?: number) => {
    if (val === undefined) return 'N/A';
    if (val === 0) return 'Zero (Robotic)';
    if (val < 0.005) return 'Very Low';
    if (val < 0.05) return 'Normal';
    return 'High';
  };

  const formatKeystrokeVariance = (val?: number) => {
    if (val === undefined || (metrics?.keyboard_event_count || 0) < 2) return 'N/A';
    if (val < 0.005) return 'Fixed Interval (Synthetic)';
    return 'Normal (Human-like)';
  };

  return (
    <div className="panel" style={{ width: '100%' }}>
      <div className="panel-header">
        <h3>Automation Risk</h3>
        <span className={`badge ${getCategoryClass()}`}>
          {category || (score <= 30 ? 'LOW' : score <= 70 ? 'MEDIUM' : 'HIGH')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
        <span
          className="mono"
          style={{
            fontSize: '36px',
            fontWeight: 700,
            lineHeight: 1,
            color: getScoreColor(),
          }}
        >
          {score}
        </span>
        <span className="mono" style={{ fontSize: '15px', color: 'var(--text-muted)' }}>
          / 100
        </span>
      </div>

      <div style={{ marginBottom: reasons.length > 0 ? '16px' : '0' }}>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '55%' }}>Feature</th>
              <th>Observation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ color: 'var(--text-secondary)' }}>Completion time</td>
              <td className="mono">
                {metrics ? `${(metrics.completion_time_ms / 1000).toFixed(2)}s` : 'N/A'}
              </td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text-secondary)' }}>Mouse event variance</td>
              <td>{formatVariance(metrics?.mouse_velocity_variance)}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text-secondary)' }}>Keyboard timing variance</td>
              <td>{formatKeystrokeVariance(metrics?.keyboard_interval_variance)}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text-secondary)' }}>Trajectory linearity</td>
              <td className="mono">
                {metrics?.trajectory_linearity !== undefined
                  ? metrics.trajectory_linearity > 0.96
                    ? `${metrics.trajectory_linearity.toFixed(2)} (Direct Vector)`
                    : `${metrics.trajectory_linearity.toFixed(2)} (Curved)`
                  : 'N/A'}
              </td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text-secondary)' }}>Failed attempts</td>
              <td className="mono">{metrics?.failed_attempts ?? 0}</td>
            </tr>
            <tr>
              <td style={{ color: 'var(--text-secondary)' }}>Interaction count</td>
              <td className="mono">{metrics?.total_events ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {reasons.length > 0 && (
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.04em' }}>
            Risk Rule Violations
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Rule</th>
                <th>Points</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {reasons.map((r, idx) => (
                <tr key={idx}>
                  <td className="mono" style={{ fontSize: '12px', color: 'var(--color-danger)' }}>
                    {r.rule}
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>
                    +{r.points}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export const RiskIndicator = RiskPanel;
