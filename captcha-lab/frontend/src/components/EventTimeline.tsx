import React, { useState } from 'react';
import type { TelemetryEvent } from '../services/api';
import { MousePointer, Keyboard, Eye, CheckCircle2, XCircle, RefreshCw, Send, Layers } from 'lucide-react';

interface EventTimelineProps {
  events: TelemetryEvent[];
}

export const EventTimeline: React.FC<EventTimelineProps> = ({ events }) => {
  const [filterType, setFilterType] = useState<string>('all');

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'mousemove':
        return <MousePointer style={{ width: 14, height: 14, color: 'var(--accent-cyan)' }} />;
      case 'mousedown':
      case 'mouseup':
      case 'click':
        return <MousePointer style={{ width: 14, height: 14, color: 'var(--accent-indigo)' }} />;
      case 'keydown':
      case 'keyup':
        return <Keyboard style={{ width: 14, height: 14, color: 'var(--accent-violet)' }} />;
      case 'focus':
      case 'blur':
        return <Eye style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />;
      case 'captcha_loaded':
      case 'captcha_refresh':
        return <RefreshCw style={{ width: 14, height: 14, color: 'var(--accent-cyan)' }} />;
      case 'captcha_submit':
        return <Send style={{ width: 14, height: 14, color: 'var(--color-med-risk)' }} />;
      case 'captcha_success':
        return <CheckCircle2 style={{ width: 14, height: 14, color: 'var(--color-low-risk)' }} />;
      case 'captcha_failure':
        return <XCircle style={{ width: 14, height: 14, color: 'var(--color-high-risk)' }} />;
      default:
        return <Layers style={{ width: 14, height: 14, color: 'var(--text-dim)' }} />;
    }
  };

  const filteredEvents = events.filter((e) => {
    const type = e.eventType || e.event_type;
    if (filterType === 'all') return true;
    if (filterType === 'mouse') return ['mousemove', 'mousedown', 'mouseup', 'click'].includes(type);
    if (filterType === 'keyboard') return ['keydown', 'keyup'].includes(type);
    if (filterType === 'system') return ['captcha_loaded', 'captcha_refresh', 'captcha_submit', 'captcha_success', 'captcha_failure'].includes(type);
    return true;
  });

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', width: '100%' }}>
      {/* Header & Filter Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Layers style={{ color: 'var(--accent-cyan)', width: 20, height: 20 }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Telemetry Event Log</h3>
          <span className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
            {events.length} captured
          </span>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', gap: '0.35rem', background: 'rgba(0,0,0,0.3)', padding: 3, borderRadius: 8 }}>
          {['all', 'mouse', 'keyboard', 'system'].map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              style={{
                background: filterType === f ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: filterType === f ? '#fff' : 'var(--text-muted)',
                border: 'none',
                padding: '0.2rem 0.6rem',
                borderRadius: 6,
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Events Scroll Area */}
      <div
        style={{
          maxHeight: '260px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          paddingRight: '0.4rem',
        }}
      >
        {filteredEvents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No telemetry events recorded yet.
          </div>
        ) : (
          filteredEvents.map((ev, index) => (
            <div
              key={index}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.4rem 0.75rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 8,
                fontSize: '0.8rem',
                borderLeft: '2px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                {getEventIcon(ev.eventType || ev.event_type)}
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 600,
                    color: '#fff',
                  }}
                >
                  {ev.eventType || ev.event_type}
                </span>
                {(ev.keyCode || ev.key_code) && (
                  <span
                    style={{
                      background: 'rgba(139, 92, 246, 0.2)',
                      color: '#c084fc',
                      padding: '0.1rem 0.4rem',
                      borderRadius: 4,
                      fontSize: '0.7rem',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    KEY: {ev.keyCode || ev.key_code}
                  </span>
                )}
                {ev.target && (
                  <span style={{ color: 'var(--text-dim)', fontSize: '0.72rem' }}>
                    {ev.target}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {ev.x !== undefined && ev.y !== undefined && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.72rem',
                      color: 'var(--text-muted)',
                    }}
                  >
                    ({ev.x}, {ev.y})
                  </span>
                )}
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.72rem',
                    color: 'var(--accent-cyan)',
                  }}
                >
                  +{Math.round(ev.elapsedMs ?? ev.elapsed_ms)}ms
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
