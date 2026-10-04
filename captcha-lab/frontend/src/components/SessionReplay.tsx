import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { TelemetryEvent, SessionInfo } from '../services/api';

interface SessionReplayProps {
  session?: SessionInfo;
  events: TelemetryEvent[];
}

export const SessionReplay: React.FC<SessionReplayProps> = ({ session, events }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentTimeMs, setCurrentTimeMs] = useState(0);

  const animationFrameRef = useRef<number | null>(null);
  const lastWallTimeRef = useRef<number>(Date.now());

  // Duration
  const totalDurationMs = Math.max(
    1000,
    events.length > 0 ? Math.max(...events.map((e) => e.elapsedMs ?? e.elapsed_ms)) : 2000
  );

  // Filter mouse events
  const mouseEvents = events.filter(
    (e) => ['mousemove', 'mousedown', 'mouseup', 'click'].includes(e.eventType || e.event_type) && e.x !== undefined && e.y !== undefined
  );

  const handlePlay = () => {
    if (currentTimeMs >= totalDurationMs) {
      setCurrentTimeMs(0);
    }
    lastWallTimeRef.current = performance.now();
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };

  const handleReset = () => {
    setIsPlaying(false);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    setCurrentTimeMs(0);
  };

  // Playback loop
  useEffect(() => {
    if (!isPlaying) return;

    const tick = () => {
      const now = performance.now();
      const dt = (now - lastWallTimeRef.current) * playbackSpeed;
      lastWallTimeRef.current = now;

      setCurrentTimeMs((prev) => {
        const next = prev + dt;
        if (next >= totalDurationMs) {
          setIsPlaying(false);
          return totalDurationMs;
        }
        return next;
      });

      animationFrameRef.current = requestAnimationFrame(tick);
    };

    lastWallTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, totalDurationMs]);

  // Canvas Drawing Routine (Utilitarian aesthetic)
  const drawReplay = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Background: clean light surface
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Subtle 20px grid
    ctx.strokeStyle = '#EDEDE8';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (mouseEvents.length === 0) {
      ctx.fillStyle = '#8A8A84';
      ctx.font = '13px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No cursor motion telemetry captured in this session.', width / 2, height / 2);
      return;
    }

    // Determine scale from events bounding box
    const minX = Math.min(...mouseEvents.map((e) => e.x!));
    const maxX = Math.max(...mouseEvents.map((e) => e.x!));
    const minY = Math.min(...mouseEvents.map((e) => e.y!));
    const maxY = Math.max(...mouseEvents.map((e) => e.y!));

    const spanX = Math.max(maxX - minX, 100);
    const spanY = Math.max(maxY - minY, 100);

    const pad = 40;
    const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);

    const project = (x: number, y: number) => ({
      px: pad + (x - minX) * scale + ((width - pad * 2) - spanX * scale) / 2,
      py: pad + (y - minY) * scale + ((height - pad * 2) - spanY * scale) / 2,
    });

    // 1. Draw full historical trajectory (muted grey)
    ctx.beginPath();
    ctx.strokeStyle = '#D9D9D4';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < mouseEvents.length; i++) {
      const pt = project(mouseEvents[i].x!, mouseEvents[i].y!);
      if (i === 0) ctx.moveTo(pt.px, pt.py);
      else ctx.lineTo(pt.px, pt.py);
    }
    ctx.stroke();

    // 2. Draw elapsed trajectory up to currentTimeMs
    const elapsedEvents = mouseEvents.filter((e) => (e.elapsedMs ?? e.elapsed_ms) <= currentTimeMs);
    if (elapsedEvents.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = '#1F5EFF';
      ctx.lineWidth = 2;
      for (let i = 0; i < elapsedEvents.length; i++) {
        const pt = project(elapsedEvents[i].x!, elapsedEvents[i].y!);
        if (i === 0) ctx.moveTo(pt.px, pt.py);
        else ctx.lineTo(pt.px, pt.py);
      }
      ctx.stroke();

      // Draw click markers
      for (const ev of elapsedEvents) {
        const type = ev.eventType || ev.event_type;
        if (type === 'click' || type === 'mousedown') {
          const pt = project(ev.x!, ev.y!);
          ctx.beginPath();
          ctx.arc(pt.px, pt.py, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#B42318';
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // Draw active cursor dot
      const last = elapsedEvents[elapsedEvents.length - 1];
      const cur = project(last.x!, last.y!);

      ctx.beginPath();
      ctx.arc(cur.px, cur.py, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#1F5EFF';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [mouseEvents, currentTimeMs]);

  useEffect(() => {
    drawReplay();
  }, [drawReplay]);

  // Scroll active event into view in right timeline
  useEffect(() => {
    if (!timelineRef.current) return;
    const activeEl = timelineRef.current.querySelector('.active-timeline-row');
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [currentTimeMs]);

  return (
    <div style={{ width: '100%' }}>
      {/* 3-Column Investigation Layout */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '260px 1fr 280px',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        {/* Left: CAPTCHA Session Parameters */}
        <div className="panel" style={{ height: '440px', overflowY: 'auto' }}>
          <div className="panel-header">
            <h3>Session Info</h3>
          </div>
          <table className="data-table">
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Session ID</td>
                <td className="mono" style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                  {session?.sessionId || session?.session_id || 'N/A'}
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Agent Type</td>
                <td>
                  <span className={`badge ${(session?.isBot ?? session?.is_bot) ? 'badge-high' : 'badge-low'}`}>
                    {(session?.isBot ?? session?.is_bot) ? 'BOT' : 'HUMAN'}
                  </span>
                </td>
              </tr>
              {(session?.botProfile || session?.bot_profile) && (
                <tr>
                  <td style={{ color: 'var(--text-secondary)' }}>Profile</td>
                  <td className="mono">{session?.botProfile || session?.bot_profile}</td>
                </tr>
              )}
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Risk Score</td>
                <td className="mono" style={{ fontWeight: 600 }}>
                  {session?.riskScore ?? session?.risk_score ?? 0} / 100
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Status</td>
                <td className="mono">{session?.status || 'recorded'}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Duration</td>
                <td className="mono">{(totalDurationMs / 1000).toFixed(2)}s</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Total Events</td>
                <td className="mono">{events.length}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Mouse Moves</td>
                <td className="mono">{mouseEvents.length}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Keystrokes</td>
                <td className="mono">
                  {events.filter((e) => (e.eventType || e.event_type || '').startsWith('key')).length}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Center: Visual Replay Canvas */}
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', height: '440px', padding: '16px' }}>
          <div className="panel-header" style={{ marginBottom: '8px' }}>
            <h3>Visual Replay Canvas</h3>
            <span className="mono" style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {(currentTimeMs / 1000).toFixed(2)}s / {(totalDurationMs / 1000).toFixed(2)}s
            </span>
          </div>
          <div style={{ flex: 1, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
            <canvas ref={canvasRef} width={620} height={350} style={{ width: '100%', height: '100%', display: 'block' }} />
          </div>
        </div>

        {/* Right: Event Timeline */}
        <div className="panel" style={{ height: '440px', display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <h3>Event Timeline</h3>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {events.length} events
            </span>
          </div>
          <div ref={timelineRef} style={{ flex: 1, overflowY: 'auto' }}>
            <table className="data-table" style={{ fontSize: '11px' }}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => {
                  const elapsedMs = ev.elapsedMs ?? ev.elapsed_ms;
                  const eventType = ev.eventType || ev.event_type;
                  const isActive = Math.abs(elapsedMs - currentTimeMs) < 60 * playbackSpeed;
                  return (
                    <tr
                      key={i}
                      className={isActive ? 'active-timeline-row' : ''}
                      style={{
                        backgroundColor: isActive ? 'var(--accent-subtle)' : undefined,
                        fontWeight: isActive ? 600 : undefined,
                      }}
                    >
                      <td className="mono" style={{ color: 'var(--text-muted)', width: '60px' }}>
                        {(elapsedMs / 1000).toFixed(2)}s
                      </td>
                      <td className="mono" style={{ color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                        {eventType}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Bottom: Replay Controls Bar */}
      <div className="panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px 20px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isPlaying ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={handlePause}>
              Pause
            </button>
          ) : (
            <button type="button" className="btn btn-primary btn-sm" onClick={handlePlay}>
              Play
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleReset}>
            Reset
          </button>
        </div>

        {/* Progress scrub bar */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="range"
            min="0"
            max={totalDurationMs}
            value={currentTimeMs}
            onChange={(e) => {
              handlePause();
              setCurrentTimeMs(Number(e.target.value));
            }}
            style={{ flex: 1, cursor: 'pointer', height: '6px' }}
          />
          <span className="mono" style={{ fontSize: '12px', minWidth: '95px', textAlign: 'right' }}>
            {(currentTimeMs / 1000).toFixed(2)}s / {(totalDurationMs / 1000).toFixed(2)}s
          </span>
        </div>

        {/* Speed Controls: 0.5x, 1x, 2x, 4x */}
        <div style={{ display: 'flex', gap: '4px', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '12px' }}>
          {[0.5, 1.0, 2.0, 4.0].map((spd) => (
            <button
              key={spd}
              type="button"
              className={`btn btn-sm ${playbackSpeed === spd ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPlaybackSpeed(spd)}
              style={{ minWidth: '42px', padding: '0 6px' }}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
