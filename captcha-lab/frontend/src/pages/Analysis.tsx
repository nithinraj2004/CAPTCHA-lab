import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const Analysis: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [subTab, setSubTab] = useState<'separation' | 'adapters'>('separation');

  useEffect(() => {
    api.getDashboardStats().then((data) => setStats(data)).catch((e) => console.warn(e));
  }, []);

  const summary = stats?.summary || {};

  return (
    <div style={{ maxWidth: '1000px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Separation Analysis</h1>
          <div className="page-subtitle">
            Empirical evaluation of behavioral telemetry features across human and bot profiles.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn btn-sm ${subTab === 'separation' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubTab('separation')}
          >
            Feature Separation
          </button>
          <button
            type="button"
            className={`btn btn-sm ${subTab === 'adapters' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSubTab('adapters')}
          >
            External Adapters
          </button>
        </div>
      </div>

      <div className="section-divider" style={{ margin: '0 0 24px' }} />

      {subTab === 'separation' && (
        <div>
          <div className="panel" style={{ marginBottom: '24px' }}>
            <div className="panel-header">
              <h3>Empirical Feature Separation Matrix</h3>
              <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                4 Profiles Evaluated
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Comparison of observable telemetry indicators between natural human operators and automated agents.
            </p>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Telemetry Feature</th>
                  <th>Human Operator</th>
                  <th>Fast Bot</th>
                  <th>Synthetic Linear</th>
                  <th>Randomized Bezier</th>
                  <th>Separation Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ fontWeight: 600 }}>Avg Completion Time</td>
                  <td className="mono" style={{ color: 'var(--color-success)' }}>
                    {summary.human_avg_time_ms ? `${(summary.human_avg_time_ms / 1000).toFixed(1)}s` : '5.2s – 12.0s'}
                  </td>
                  <td className="mono">0.15s – 0.35s</td>
                  <td className="mono">0.8s – 1.4s</td>
                  <td className="mono">2.2s – 4.5s</td>
                  <td><span className="badge badge-high">VERY HIGH</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Mouse Event Count</td>
                  <td className="mono" style={{ color: 'var(--color-success)' }}>80 – 350 events</td>
                  <td className="mono">0 – 2 events</td>
                  <td className="mono">25 – 40 events</td>
                  <td className="mono">45 – 90 events</td>
                  <td><span className="badge badge-high">VERY HIGH</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Velocity Variance</td>
                  <td className="mono" style={{ color: 'var(--color-success)' }}>0.015 – 0.085</td>
                  <td className="mono">0.000</td>
                  <td className="mono">0.000 (Constant)</td>
                  <td className="mono">0.008 – 0.022</td>
                  <td><span className="badge badge-high">HIGH</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Trajectory Linearity</td>
                  <td className="mono" style={{ color: 'var(--color-success)' }}>0.55 – 0.78</td>
                  <td className="mono">1.00</td>
                  <td className="mono">0.97 – 0.99</td>
                  <td className="mono">0.84 – 0.92</td>
                  <td><span className="badge badge-medium">MODERATE</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Keystroke Interval Variance</td>
                  <td className="mono" style={{ color: 'var(--color-success)' }}>0.020 – 0.065</td>
                  <td className="mono">N/A (Instant)</td>
                  <td className="mono">0.000 (Fixed 80ms)</td>
                  <td className="mono">0.005 – 0.012</td>
                  <td><span className="badge badge-high">HIGH</span></td>
                </tr>
                <tr>
                  <td style={{ fontWeight: 600 }}>Initial Dwell Time</td>
                  <td className="mono" style={{ color: 'var(--color-success)' }}>400ms – 1800ms</td>
                  <td className="mono">&lt; 20ms</td>
                  <td className="mono">&lt; 80ms</td>
                  <td className="mono">200ms – 400ms</td>
                  <td><span className="badge badge-high">HIGH</span></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h3>Research Observations</h3>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <p style={{ marginBottom: '8px' }}>
                1. <strong>Kinematic Jitter:</strong> Biological human pointer movements exhibit micro-tremors and natural acceleration/deceleration curves. Straight-line interpolation produces variance values below 0.001.
              </p>
              <p style={{ marginBottom: '8px' }}>
                2. <strong>Temporal Rhythm:</strong> Robotic typing with programmatic timers generates near-zero standard deviation in inter-key dwell intervals, easily distinguished from human typing variance.
              </p>
              <p>
                3. <strong>Dwell Latency:</strong> Automated test agents typically interact with form inputs immediately upon DOM insertion, lacking cognitive processing latency.
              </p>
            </div>
          </div>
        </div>
      )}

      {subTab === 'adapters' && (
        <div className="panel">
          <div className="panel-header">
            <h3>External CAPTCHA Adapters</h3>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Integration stubs for third-party CAPTCHA validation testing using official test credentials.
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Mode</th>
                <th>Site Key</th>
                <th>Endpoint</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Google reCAPTCHA v2</td>
                <td>Official Test Key</td>
                <td className="mono" style={{ fontSize: '12px' }}>6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI</td>
                <td className="mono" style={{ fontSize: '12px' }}>/api/recaptcha/verify</td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>GeeTest Adaptive</td>
                <td>Demo Harness</td>
                <td className="mono" style={{ fontSize: '12px' }}>geetest_demo_id_local</td>
                <td className="mono" style={{ fontSize: '12px' }}>/api/geetest/verify</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
