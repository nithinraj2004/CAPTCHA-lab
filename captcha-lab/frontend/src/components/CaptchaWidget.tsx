import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';
import type { ChallengeData, ChallengeType, TelemetryEvent, VerificationResult } from '../services/api';

interface CaptchaWidgetProps {
  sessionId: string;
  isBotSession?: boolean;
  botProfile?: string;
  onVerified?: (result: VerificationResult, events: TelemetryEvent[]) => void;
  onRefresh?: () => void;
  preferredType?: ChallengeType;
}

export const CaptchaWidget: React.FC<CaptchaWidgetProps> = ({
  sessionId,
  isBotSession = false,
  botProfile,
  onVerified,
  onRefresh,
  preferredType = 'text',
}) => {
  const [challengeType, setChallengeType] = useState<ChallengeType>(preferredType);
  const [challenge, setChallenge] = useState<ChallengeData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<VerificationResult | null>(null);

  const [textInput, setTextInput] = useState('');
  const [sliderOffset, setSliderOffset] = useState(0);
  const [selectedTiles, setSelectedTiles] = useState<number[]>([]);
  const [clickedPoints, setClickedPoints] = useState<Array<{ x: number; y: number }>>([]);
  const [rotationAngle, setRotationAngle] = useState(0);

  const [eventCount, setEventCount] = useState(0);
  const [mouseCount, setMouseCount] = useState(0);
  const [keyCount, setKeyCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState('00.00s');
  const [liveLog, setLiveLog] = useState<Array<{ time: string; type: string; meta: string }>>([]);

  const eventsRef = useRef<TelemetryEvent[]>([]);
  const challengeRef = useRef<ChallengeData | null>(null);
  const loadTimeRef = useRef<number>(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const clickCanvasRef = useRef<HTMLDivElement>(null);

  const formatTimestamp = (d: Date) => {
    const pad = (n: number, z = 2) => String(n).padStart(z, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
  };

  const getElapsedMs = useCallback(() => {
    return Math.max(0, Date.now() - loadTimeRef.current);
  }, []);

  const recordEvent = useCallback(
    (
      eventType: string,
      x?: number,
      y?: number,
      keyCode?: string,
      targetName?: string,
      extraMeta?: Record<string, any>
    ) => {
      let relX: number | undefined;
      let relY: number | undefined;

      if (x !== undefined && y !== undefined && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        relX = Math.round(((x - rect.left) / rect.width) * 1000) / 1000;
        relY = Math.round(((y - rect.top) / rect.height) * 1000) / 1000;
      }

      const now = new Date();
      const elapsed = getElapsedMs();
      const ev: TelemetryEvent = {
        session_id: sessionId,
        captcha_id: challengeRef.current?.captcha_id,
        timestamp: now.toISOString(),
        event_type: eventType,
        x: x !== undefined ? Math.round(x) : undefined,
        y: y !== undefined ? Math.round(y) : undefined,
        relative_x: relX,
        relative_y: relY,
        elapsed_ms: elapsed,
        key_code: keyCode,
        target: targetName,
        meta: {
          webdriver: (navigator as any).webdriver === true,
          automated: isBotSession,
          profile: botProfile,
          ...extraMeta,
        },
      };

      eventsRef.current.push(ev);

      setEventCount((c) => c + 1);
      if (eventType.startsWith('mouse') || eventType === 'click') {
        setMouseCount((c) => c + 1);
      }
      if (eventType.startsWith('key')) {
        setKeyCount((c) => c + 1);
      }

      let metaStr = '';
      if (x !== undefined && y !== undefined) metaStr = `x=${Math.round(x)} y=${Math.round(y)}`;
      else if (keyCode) metaStr = `code=${keyCode}`;
      else if (targetName) metaStr = `target=${targetName}`;

      setLiveLog((prev) => [
        { time: formatTimestamp(now), type: eventType, meta: metaStr },
        ...prev.slice(0, 19),
      ]);
    },
    [sessionId, getElapsedMs, isBotSession, botProfile]
  );

  useEffect(() => {
    const timer = setInterval(() => {
      const ms = Date.now() - loadTimeRef.current;
      setElapsedSec(`${(ms / 1000).toFixed(2).padStart(5, '0')}s`);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const loadChallenge = useCallback(
    async (typeToLoad: ChallengeType) => {
      if (!sessionId) return;
      setIsLoading(true);
      setTextInput('');
      setSliderOffset(0);
      setSelectedTiles([]);
      setClickedPoints([]);
      setRotationAngle(0);
      setLastResult(null);

      try {
        const data = await api.createCaptcha(sessionId, typeToLoad);
        challengeRef.current = data;
        setChallenge(data);
        loadTimeRef.current = Date.now();
        recordEvent('captcha_loaded', undefined, undefined, undefined, 'canvas', {
          challenge_type: typeToLoad,
        });
      } catch (err) {
        console.error('Failed to load CAPTCHA challenge', err);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, recordEvent]
  );

  useEffect(() => {
    if (preferredType && preferredType !== challengeType) {
      setChallengeType(preferredType);
    }
  }, [preferredType]);

  const loadedKeyRef = useRef<string>('');
  useEffect(() => {
    const key = `${sessionId}:${challengeType}`;
    if (sessionId && loadedKeyRef.current !== key) {
      loadedKeyRef.current = key;
      loadChallenge(challengeType);
    }
  }, [sessionId, challengeType, loadChallenge]);

  useEffect(() => {
    let lastMoveTime = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastMoveTime > 15) {
        lastMoveTime = now;
        recordEvent('mousemove', e.clientX, e.clientY);
      }
    };
    const handleMouseDown = (e: MouseEvent) => {
      recordEvent('mousedown', e.clientX, e.clientY, undefined, (e.target as HTMLElement)?.id || (e.target as HTMLElement)?.tagName);
    };
    const handleMouseUp = (e: MouseEvent) => {
      recordEvent('mouseup', e.clientX, e.clientY, undefined, (e.target as HTMLElement)?.id || (e.target as HTMLElement)?.tagName);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mousedown', handleMouseDown);
      container.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mousedown', handleMouseDown);
        container.removeEventListener('mouseup', handleMouseUp);
      }
    };
  }, [recordEvent]);

  const handleSubmit = async (overrideAnswer?: string) => {
    if (!challenge || isSubmitting) return;

    let answer = '';
    if (overrideAnswer !== undefined) {
      answer = overrideAnswer;
    } else if (challengeType === 'text') {
      const inputEl = document.getElementById('captcha-input') as HTMLInputElement | null;
      answer = (textInput || inputEl?.value || '').trim();
    } else if (challengeType === 'slider') {
      const sliderEl = document.getElementById('slider-input') as HTMLInputElement | null;
      answer = String(sliderEl ? sliderEl.value : sliderOffset);
    } else if (challengeType === 'image_select') {
      answer = selectedTiles.sort((a, b) => a - b).join(',');
    } else if (challengeType === 'click_order') {
      answer = JSON.stringify(clickedPoints);
    } else if (challengeType === 'rotate') {
      answer = String(rotationAngle);
    } else if (challengeType === 'math') {
      const inputEl = document.getElementById('captcha-input') as HTMLInputElement | null;
      answer = (textInput || inputEl?.value || '').trim();
    }

    if (!answer && (challengeType === 'text' || challengeType === 'math')) return;

    setIsSubmitting(true);
    recordEvent('captcha_submit', undefined, undefined, undefined, '#captcha-submit-btn', {
      challenge_type: challengeType,
    });

    try {
      const result = await api.verifyCaptcha(
        sessionId,
        challenge.captcha_id,
        answer,
        eventsRef.current
      );
      setLastResult(result);
      if (onVerified) {
        onVerified(result, [...eventsRef.current]);
      }
    } catch (err) {
      console.error('Failed to verify challenge', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (challengeType !== 'click_order' || !clickCanvasRef.current) return;
    const rect = clickCanvasRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    const maxTargets = challenge?.target_count || 3;
    if (clickedPoints.length >= maxTargets) return;

    const newPoints = [...clickedPoints, { x, y }];
    setClickedPoints(newPoints);
    recordEvent('click', e.clientX, e.clientY, undefined, `click_target_${newPoints.length}`, { target_x: x, target_y: y });
  };

  const toggleTile = (idx: number) => {
    setSelectedTiles((prev) => {
      const exists = prev.includes(idx);
      const updated = exists ? prev.filter((i) => i !== idx) : [...prev, idx];
      recordEvent('click', undefined, undefined, undefined, `tile_${idx}`, { selected: !exists });
      return updated;
    });
  };

  return (
    <div
      ref={containerRef}
      id="captcha-container"
      data-session-id={sessionId}
      data-captcha-id={challenge?.captcha_id}
      style={{ width: '100%', maxWidth: '780px' }}
    >
      <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', letterSpacing: '0.04em' }}>
          Challenge Specification
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {[
            { id: 'text', label: 'Text Distortion' },
            { id: 'slider', label: 'Puzzle Slider' },
            { id: 'image_select', label: '3×3 Image Grid' },
            { id: 'click_order', label: 'Click in Order' },
            { id: 'rotate', label: 'Orientation Rotate' },
            { id: 'math', label: 'Arithmetic Math' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              id={`tab-btn-${item.id}`}
              className={`btn btn-sm ${challengeType === item.id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setChallengeType(item.id as ChallengeType);
                loadChallenge(item.id as ChallengeType);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '24px' }}>
        <div className="panel-header">
          <div>
            <h3>Challenge</h3>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {challenge?.prompt || (challengeType === 'text' ? 'Enter characters shown in distorted canvas' : 'Complete interaction to verify')}
            </div>
          </div>
          <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            TTL: 300s
          </span>
        </div>

        {isLoading && (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
            Generating security challenge...
          </div>
        )}

        {!isLoading && challenge && (
          <div>
            {challengeType === 'text' && (
              <div>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                  <img
                    id="captcha-img"
                    src={challenge.image_data}
                    alt="CAPTCHA Challenge"
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      background: '#FFFFFF',
                      width: '260px',
                      height: '90px',
                      display: 'block',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', maxWidth: '380px', margin: '0 auto 8px' }}>
                  <input
                    id="captcha-input"
                    type="text"
                    className="input-text mono"
                    style={{ flex: 1, letterSpacing: '0.15em', fontSize: '16px' }}
                    placeholder="Enter code"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      recordEvent('keydown', undefined, undefined, e.code, 'input#captcha-input');
                      if (e.key === 'Enter') handleSubmit();
                    }}
                    onKeyUp={(e) => recordEvent('keyup', undefined, undefined, e.code, 'input#captcha-input')}
                    autoComplete="off"
                    autoFocus
                  />
                  <button
                    type="button"
                    id="captcha-submit-btn"
                    className="btn btn-primary"
                    disabled={isSubmitting || !textInput.trim()}
                    onClick={() => handleSubmit()}
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginBottom: '16px' }}>
                  Case-insensitive: you can type in capital or small letters.
                </div>
              </div>
            )}

            {challengeType === 'slider' && (
              <div>
                <div
                  style={{
                    position: 'relative',
                    width: '320px',
                    height: '160px',
                    margin: '0 auto 16px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    backgroundColor: '#1E293B',
                  }}
                >
                  {challenge.bg_image && (
                    <img
                      src={challenge.bg_image}
                      alt="Background"
                      style={{ width: '320px', height: '160px', display: 'block' }}
                    />
                  )}
                  {challenge.piece_image && (
                    <img
                      src={challenge.piece_image}
                      alt="Puzzle Piece"
                      style={{
                        position: 'absolute',
                        top: `${challenge.target_y || 40}px`,
                        left: `${sliderOffset}px`,
                        width: `${challenge.piece_width || 46}px`,
                        height: `${challenge.piece_height || 46}px`,
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                </div>
                <div style={{ maxWidth: '320px', margin: '0 auto 16px' }}>
                  <div
                    id="slider-track"
                    style={{
                      position: 'relative',
                      height: '40px',
                      backgroundColor: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ position: 'absolute', left: '50px', fontSize: '12px', color: 'var(--text-muted)', pointerEvents: 'none' }}>
                      Drag slider to align puzzle
                    </div>
                    <div
                      id="slider-handle"
                      style={{
                        position: 'absolute',
                        left: `${sliderOffset}px`,
                        top: '3px',
                        width: '40px',
                        height: '32px',
                        backgroundColor: 'var(--accent-primary)',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#FFFFFF',
                        fontWeight: 700,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        pointerEvents: 'none',
                      }}
                    >
                      →
                    </div>
                    <input
                      type="range"
                      id="slider-input"
                      min="0"
                      max={320 - (challenge.piece_width || 46)}
                      value={sliderOffset}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSliderOffset(val);
                        recordEvent('mousemove', undefined, undefined, undefined, '#slider-handle', { offset: val });
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'grab',
                        margin: 0,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>Horizontal Target Position</span>
                    <span className="mono">{sliderOffset}px</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <button
                    type="button"
                    id="captcha-submit-btn"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit()}
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify Position'}
                  </button>
                </div>
              </div>
            )}

            {challengeType === 'image_select' && (
              <div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 110px)',
                    gap: '6px',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  {challenge.tiles?.map((tileUrl, idx) => {
                    const isSelected = selectedTiles.includes(idx);
                    return (
                      <div
                        key={idx}
                        id={`tile-${idx}`}
                        onClick={() => toggleTile(idx)}
                        style={{
                          width: '110px',
                          height: '110px',
                          border: isSelected ? '3px solid var(--accent-primary)' : '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          position: 'relative',
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <img src={tileUrl} alt={`Tile ${idx}`} style={{ width: '100%', height: '100%', display: 'block' }} />
                        {isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: '4px',
                              right: '4px',
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              backgroundColor: 'var(--accent-primary)',
                              color: '#FFFFFF',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                            }}
                          >
                            ✓
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginRight: '16px' }}>
                    {selectedTiles.length} tile(s) selected
                  </span>
                  <button
                    type="button"
                    id="captcha-submit-btn"
                    className="btn btn-primary"
                    disabled={isSubmitting || selectedTiles.length === 0}
                    onClick={() => handleSubmit()}
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify Selection'}
                  </button>
                </div>
              </div>
            )}

            {challengeType === 'click_order' && (
              <div>
                <div
                  ref={clickCanvasRef}
                  onClick={handleCanvasClick}
                  style={{
                    position: 'relative',
                    width: '340px',
                    height: '180px',
                    margin: '0 auto 16px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    cursor: 'crosshair',
                  }}
                >
                  {challenge.image_data && (
                    <img
                      src={challenge.image_data}
                      alt="Click in order canvas"
                      style={{ width: '340px', height: '180px', display: 'block', userSelect: 'none' }}
                    />
                  )}
                  {clickedPoints.map((pt, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'absolute',
                        left: `${pt.x - 12}px`,
                        top: `${pt.y - 12}px`,
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-primary)',
                        color: '#FFFFFF',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '2px solid #FFFFFF',
                        pointerEvents: 'none',
                      }}
                    >
                      {idx + 1}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setClickedPoints([])}
                    disabled={clickedPoints.length === 0}
                  >
                    Clear Clicks
                  </button>
                  <button
                    type="button"
                    id="captcha-submit-btn"
                    className="btn btn-primary"
                    disabled={isSubmitting || clickedPoints.length === 0}
                    onClick={() => handleSubmit()}
                  >
                    {isSubmitting ? 'Verifying...' : `Verify (${clickedPoints.length}/${challenge.target_count || 3})`}
                  </button>
                </div>
              </div>
            )}

            {challengeType === 'rotate' && (
              <div>
                <div
                  style={{
                    width: '200px',
                    height: '200px',
                    margin: '0 auto 16px',
                    borderRadius: '50%',
                    border: '1px solid var(--border-subtle)',
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {challenge.image_data && (
                    <img
                      src={challenge.image_data}
                      alt="Rotate object"
                      style={{
                        width: '200px',
                        height: '200px',
                        transform: `rotate(${rotationAngle}deg)`,
                        transition: 'transform 0.05s linear',
                      }}
                    />
                  )}
                </div>
                <div style={{ maxWidth: '280px', margin: '0 auto 16px' }}>
                  <input
                    type="range"
                    min="0"
                    max="360"
                    value={rotationAngle}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setRotationAngle(val);
                      recordEvent('mousemove', undefined, undefined, undefined, 'rotate_slider', { angle: val });
                    }}
                    style={{ width: '100%', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>Rotate until upright</span>
                    <span className="mono">{rotationAngle}°</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <button
                    type="button"
                    id="captcha-submit-btn"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                    onClick={() => handleSubmit()}
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify Orientation'}
                  </button>
                </div>
              </div>
            )}

            {challengeType === 'math' && (
              <div>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                  <img
                    id="captcha-img"
                    src={challenge.image_data}
                    alt="Math Equation"
                    style={{
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      background: '#FFFFFF',
                      width: '260px',
                      height: '90px',
                      display: 'block',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', maxWidth: '320px', margin: '0 auto 16px' }}>
                  <input
                    id="captcha-input"
                    type="number"
                    className="input-text mono"
                    style={{ flex: 1, fontSize: '16px' }}
                    placeholder="RESULT"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => {
                      recordEvent('keydown', undefined, undefined, e.code, 'input#captcha-input');
                      if (e.key === 'Enter') handleSubmit();
                    }}
                    onKeyUp={(e) => recordEvent('keyup', undefined, undefined, e.code, 'input#captcha-input')}
                    autoFocus
                  />
                  <button
                    type="button"
                    id="captcha-submit-btn"
                    className="btn btn-primary"
                    disabled={isSubmitting || !textInput.trim()}
                    onClick={() => handleSubmit()}
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify'}
                  </button>
                </div>
              </div>
            )}

            <div style={{ textAlign: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  recordEvent('captcha_refresh', undefined, undefined, undefined, 'btn_refresh');
                  loadChallenge(challengeType);
                  if (onRefresh) onRefresh();
                }}
              >
                Refresh challenge
              </button>
            </div>
          </div>
        )}

        {lastResult && (
          <div
            className="verification-result-badge"
            data-result={lastResult.decision}
            style={{
              marginTop: '16px',
              padding: '12px',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${
                lastResult.decision === 'ALLOW'
                  ? 'var(--color-success)'
                  : 'var(--color-danger)'
              }`,
              backgroundColor:
                lastResult.decision === 'ALLOW'
                  ? 'var(--color-success-bg)'
                  : 'var(--color-danger-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: lastResult.decision === 'ALLOW' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                {lastResult.decision === 'ALLOW' ? 'VERIFICATION PASSED' : 'VERIFICATION REJECTED'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {lastResult.message}
              </div>
            </div>
            <div className="mono" style={{ fontSize: '12px', fontWeight: 600 }}>
              Risk: {lastResult.risk_score} / 100 ({lastResult.risk_category})
            </div>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Live Telemetry</h3>
          <span className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            80 Hz Sampling
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '12px',
            marginBottom: '16px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '12px',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Events</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700 }}>{eventCount}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Elapsed</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700 }}>{elapsedSec}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mouse events</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700 }}>{mouseCount}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Keyboard events</div>
            <div className="mono" style={{ fontSize: '18px', fontWeight: 700 }}>{keyCount}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Risk assessment</div>
            <div style={{ marginTop: '2px' }}>
              <span className={`badge ${lastResult ? (lastResult.risk_score > 70 ? 'badge-high' : lastResult.risk_score > 30 ? 'badge-medium' : 'badge-low') : 'badge-low'}`}>
                {lastResult?.risk_category ? lastResult.risk_category.replace(' RISK', '') : 'LOW'}
              </span>
            </div>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
            Live Events Stream
          </div>
          <div className="telemetry-stream-box">
            {liveLog.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                Awaiting user interactions...
              </div>
            ) : (
              liveLog.map((log, idx) => (
                <div key={idx} className="telemetry-line">
                  <span className="telemetry-time">{log.time}</span>
                  <span className="telemetry-type">{log.type}</span>
                  <span className="telemetry-meta">{log.meta}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
