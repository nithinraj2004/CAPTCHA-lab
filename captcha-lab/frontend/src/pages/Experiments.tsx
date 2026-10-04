import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

export const Experiments: React.FC = () => {
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>('Ready for batch execution');
  const [stats, setStats] = useState<any>(null);

  const loadStats = () => {
    api.getDashboardStats().then(setStats).catch(console.warn);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const startExperiment = async () => {
    setIsRunningAll(true);
    setStatusMsg('Running batch across all 4 automation profiles (Fast, Synthetic, Regular, Randomized)...');

    try {
      const profiles = ['fast', 'synthetic', 'regular', 'randomized'];
      for (const p of profiles) {
        setStatusMsg(`Executing profile: ${p}...`);
        await api.triggerBotRun(p, 'text', 2);
      }
      setStatusMsg('Batch experiment complete. Data recorded in database.');
      loadStats();
    } catch (err: any) {
      setStatusMsg(`Experiment error: ${err.message || 'Unknown error'}`);
    } finally {
      setIsRunningAll(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Experiments</h1>
          <div className="page-subtitle">
            Controlled batch execution of automation profiles against local verification challenges.
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={startExperiment}
          disabled={isRunningAll}
        >
          {isRunningAll ? 'Running Batch...' : 'Run Master Batch (8 Runs)'}
        </button>
      </div>

      <div className="section-divider" style={{ margin: '0 0 24px' }} />

      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <h3>Experiment Engine</h3>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Recorded Sessions: {stats?.summary?.total_sessions ?? 0}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="mono" style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            {statusMsg}
          </div>
          {isRunningAll && (
            <span className="badge badge-medium">RUNNING</span>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <h3>Evaluated Profiles</h3>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Profile</th>
              <th>Kinematic Model</th>
              <th>Timing Model</th>
              <th>Expected Detection</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ fontWeight: 600 }}>Fast Automation</td>
              <td>Direct DOM dispatch, zero coordinates</td>
              <td>Zero dwell time (&lt; 20ms)</td>
              <td><span className="badge badge-high">100% REJECTED</span></td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Synthetic Linear</td>
              <td>Uniform velocity straight vector</td>
              <td>Constant speed interpolation</td>
              <td><span className="badge badge-high">100% REJECTED</span></td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Regular Timing</td>
              <td>Synthetic linear movement</td>
              <td>Fixed 80ms keystroke interval</td>
              <td><span className="badge badge-high">100% REJECTED</span></td>
            </tr>
            <tr>
              <td style={{ fontWeight: 600 }}>Randomized Bezier</td>
              <td>Cubic Bezier curve with randomized control points</td>
              <td>Gaussian jittered typing delays</td>
              <td><span className="badge badge-medium">PARTIAL DETECTION</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Export Experiment Data</h3>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Download captured telemetry events, ground-truth labels, and calculated risk factors for academic analysis.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <a href={api.getExportCsvUrl()} download="experiment_telemetry.csv" className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
            Export CSV
          </a>
          <a href={api.getExportJsonUrl()} download="experiment_telemetry.json" className="btn btn-primary btn-sm" style={{ textDecoration: 'none' }}>
            Export JSON
          </a>
        </div>
      </div>
    </div>
  );
};
