import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { SessionInfo, TelemetryEvent } from '../services/api';
import { SessionReplay } from '../components/SessionReplay';

interface SessionDetailsProps {
  sessionId: string;
  onBack: () => void;
}

export const SessionDetails: React.FC<SessionDetailsProps> = ({ sessionId, onBack }) => {
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getSessionDetails = async () => {
      setLoading(true);
      try {
        const [detailData, replayData] = await Promise.all([
          api.getSessionDetails(sessionId),
          api.getSessionReplay(sessionId),
        ]);
        setSession(detailData.session);
        setEvents(replayData.events);
      } catch (e) {
        console.error('Failed to load session details', e);
      } finally {
        setLoading(false);
      }
    };

    getSessionDetails();
  }, [sessionId]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        Retrieving session telemetry and replay events...
      </div>
    );
  }

  if (!session) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--color-danger)', marginBottom: '16px' }}>Session not found.</p>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
          ← Back to Sessions
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onBack}>
            ← Back
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: '20px', marginBottom: 0 }}>
              Session Investigation
            </h1>
            <span className="mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {session.session_id}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span className={`badge ${session.is_bot ? 'badge-high' : 'badge-low'}`}>
            {session.is_bot ? `BOT (${session.bot_profile || 'automated'})` : 'HUMAN'}
          </span>
          <span className="badge badge-neutral mono">
            RISK: {session.risk_score} / 100
          </span>
        </div>
      </div>

      <div className="section-divider" style={{ margin: '0 0 20px' }} />

      <SessionReplay session={session} events={events} />
    </div>
  );
};
