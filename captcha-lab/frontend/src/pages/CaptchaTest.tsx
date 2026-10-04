import React, { useState, useEffect } from 'react';
import { User, Bot, Play, RefreshCw, Eye, Sparkles, Terminal } from 'lucide-react';
import { api } from '../services/api';
import type { VerificationResult, TelemetryEvent } from '../services/api';
import { CaptchaWidget } from '../components/CaptchaWidget';
import { RiskPanel } from '../components/RiskPanel';
import { EventTimeline } from '../components/EventTimeline';
import { SessionReplay } from '../components/SessionReplay';

export const CaptchaTest: React.FC = () => {
  const [testMode, setTestMode] = useState<'human' | 'bot'>('human');
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  const [selectedBotProfile, setSelectedBotProfile] = useState<'fast' | 'synthetic' | 'regular' | 'randomized'>('fast');
  const [selectedChallengeType, setSelectedChallengeType] = useState<'text' | 'slider'>('text');
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [botRunResult, setBotRunResult] = useState<any>(null);

  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [recordedEvents, setRecordedEvents] = useState<TelemetryEvent[]>([]);
  const [showReplay, setShowReplay] = useState(false);
  const [isDirectBot, setIsDirectBot] = useState(false);

  const initHumanSession = async () => {
    setIsLoadingSession(true);
    setVerificationResult(null);
    setRecordedEvents([]);
    setShowReplay(false);
    try {
      const s = await api.createSession(false);
      setSessionId(s.sessionId || s.session_id);
    } catch (e) {
      console.error('Session init error', e);
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isBot = params.get('bot') === 'true';
    const profileParam = (params.get('profile') as any) || 'fast';
    const challengeParam = (params.get('challenge') as any) || 'text';

    if (isBot) {
      setIsDirectBot(true);
      setSelectedBotProfile(profileParam);
      setSelectedChallengeType(challengeParam);
      setIsLoadingSession(true);
      api.createSession(true, profileParam).then((s) => {
        setSessionId(s.sessionId || s.session_id);
        setIsLoadingSession(false);
      }).catch((e) => {
        console.error('Bot session init error', e);
        setIsLoadingSession(false);
      });
    } else {
      initHumanSession();
    }
  }, []);

  const handleVerified = (res: VerificationResult, events: TelemetryEvent[]) => {
    setVerificationResult(res);
    setRecordedEvents(events);
  };

  const handleRunBotTest = async () => {
    setIsBotRunning(true);
    setBotRunResult(null);
    setVerificationResult(null);
    try {
      const data = await api.triggerBotRun(selectedBotProfile, selectedChallengeType, 1);
      const run = data.results && data.results[0];
      setBotRunResult(run);

      if (run && run.session_id) {
        setSessionId(run.session_id);
        const replayData = await api.getSessionReplay(run.session_id);
        setRecordedEvents(replayData.events);
      }
    } catch (err: any) {
      console.error('Bot execution failed', err);
      setBotRunResult({ error: err.message || 'Automation failed' });
    } finally {
      setIsBotRunning(false);
    }
  };

  return (
    <div className="main-container animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>
            Behavioral CAPTCHA Testing Laboratory
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Study human vs bot interaction telemetry and observe real-time automation risk assessment
          </p>
        </div>

        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => {
              setTestMode('human');
              initHumanSession();
            }}
            className={`nav-tab-btn ${testMode === 'human' ? 'active' : ''}`}
          >
            <User style={{ width: 16, height: 16 }} /> Human Test Mode
          </button>
          <button
            type="button"
            onClick={() => setTestMode('bot')}
            className={`nav-tab-btn ${testMode === 'bot' ? 'active' : ''}`}
          >
            <Bot style={{ width: 16, height: 16 }} /> Bot Simulation Mode
          </button>
        </div>
      </div>

      {isDirectBot ? (
        <div style={{ maxWidth: '460px', margin: '2rem auto' }}>
          {sessionId ? (
            <CaptchaWidget
              sessionId={sessionId}
              isBotSession={true}
              botProfile={selectedBotProfile}
              preferredType={selectedChallengeType}
              onVerified={handleVerified}
            />
          ) : (
            <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
              <RefreshCw className="animate-spin" style={{ width: 24, height: 24, color: 'var(--accent-cyan)', margin: '0 auto 0.5rem' }} />
              <div>Initializing automated agent target...</div>
            </div>
          )}
        </div>
      ) : testMode === 'human' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 440px) 1fr', gap: '2rem', alignItems: 'start' }}>
          <div>
            {isLoadingSession ? (
              <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                <RefreshCw className="animate-spin" style={{ width: 28, height: 28, color: 'var(--accent-cyan)', margin: '0 auto 1rem' }} />
                <p style={{ color: 'var(--text-muted)' }}>Initializing secure session telemetry...</p>
              </div>
            ) : sessionId ? (
              <div>
                <CaptchaWidget
                  sessionId={sessionId}
                  isBotSession={false}
                  preferredType="text"
                  onVerified={handleVerified}
                />

                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={initHumanSession}
                    style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}
                  >
                    <RefreshCw style={{ width: 14, height: 14 }} /> Start Fresh Human Session
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {verificationResult ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-human">TEST OUTCOME EVALUATED</span>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setShowReplay(!showReplay)}
                    style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  >
                    <Eye style={{ width: 15, height: 15 }} /> {showReplay ? 'Hide Replay' : 'Replay This Attempt'}
                  </button>
                </div>

                {showReplay && <SessionReplay events={recordedEvents} />}

                <RiskPanel
                  score={verificationResult.riskScore !== undefined ? verificationResult.riskScore : verificationResult.risk_score}
                  category={verificationResult.risk_category}
                  reasons={verificationResult.reasons}
                  metrics={verificationResult.metrics}
                />

                <EventTimeline events={recordedEvents} />
              </>
            ) : (
              <div
                className="glass-panel"
                style={{
                  padding: '3rem 2rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '340px',
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    background: 'rgba(99, 102, 241, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <Sparkles style={{ width: 28, height: 28, color: 'var(--accent-indigo)' }} />
                </div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                  Awaiting Interaction Telemetry
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '440px', lineHeight: 1.5 }}>
                  Interact with the CAPTCHA on the left. The sensor pipeline will sample pointer velocity,
                  acceleration, keystroke timing variances, and reaction dwell to compute an explainable
                  automation-risk score.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 480px) 1fr', gap: '2rem', alignItems: 'start' }}>
          <div className="glass-panel" style={{ padding: '1.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <Bot style={{ color: 'var(--accent-violet)', width: 24, height: 24 }} />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Local Playwright Bot Agent</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Authorized Chromium automation test runner
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '0.75rem' }}>
                Select Automation Profile
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {[
                  {
                    id: 'fast',
                    title: 'PROFILE 1: Fast Automated Input',
                    desc: 'Instant DOM value fill, immediate submit button dispatch. Zero mousemove telemetry, completion < 200ms.',
                    badge: 'HIGH RISK EXPECTED',
                    color: 'var(--color-high-risk)',
                  },
                  {
                    id: 'synthetic',
                    title: 'PROFILE 2: Synthetic Mouse Movement',
                    desc: 'Rigid linear interpolation between coordinates (x0 + t*dx). Uniform speed produces near-zero velocity variance.',
                    badge: 'SIGNATURE LEAK',
                    color: 'var(--color-med-risk)',
                  },
                  {
                    id: 'regular',
                    title: 'PROFILE 3: Regular Timing',
                    desc: 'Constant keyboard intervals (exactly 120ms between keys) and fixed step delays. Zero keystroke variance.',
                    badge: 'ROBOTIC CADENCE',
                    color: 'var(--color-high-risk)',
                  },
                  {
                    id: 'randomized',
                    title: 'PROFILE 4: Randomized Timing',
                    desc: 'Cubic Bezier curve mouse paths and Gaussian inter-keystroke intervals (80-220ms). Mimics human variations.',
                    badge: 'ADVANCED ADAPTIVE',
                    color: 'var(--color-low-risk)',
                  },
                ].map((prof) => (
                  <div
                    key={prof.id}
                    onClick={() => setSelectedBotProfile(prof.id as any)}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 10,
                      background: selectedBotProfile === prof.id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                      border: `1px solid ${selectedBotProfile === prof.id ? 'var(--accent-indigo)' : 'var(--border-color)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem', color: selectedBotProfile === prof.id ? '#fff' : 'var(--text-main)' }}>
                        {prof.title}
                      </span>
                      <span className="badge" style={{ background: 'rgba(0,0,0,0.3)', color: prof.color, fontSize: '0.65rem' }}>
                        {prof.badge}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{prof.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>
                Challenge Target
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {['text', 'slider'].map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setSelectedChallengeType(ct as any)}
                    style={{
                      flex: 1,
                      padding: '0.55rem',
                      borderRadius: 8,
                      background: selectedChallengeType === ct ? 'var(--accent-indigo)' : 'rgba(255,255,255,0.04)',
                      color: selectedChallengeType === ct ? '#fff' : 'var(--text-muted)',
                      border: '1px solid var(--border-color)',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                    }}
                  >
                    {ct === 'text' ? 'Text CAPTCHA' : 'Slider Puzzle'}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={handleRunBotTest}
              disabled={isBotRunning}
              style={{ width: '100%', justifyContent: 'center', padding: '0.9rem' }}
            >
              {isBotRunning ? (
                <>
                  <RefreshCw className="animate-spin" style={{ width: 18, height: 18 }} />
                  Executing Playwright Chromium Agent...
                </>
              ) : (
                <>
                  <Play style={{ width: 18, height: 18 }} /> Launch {selectedBotProfile.toUpperCase()} Bot Test
                </>
              )}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {botRunResult ? (
              <>
                <div
                  className="glass-panel"
                  style={{
                    padding: '1.5rem',
                    borderLeft: `4px solid ${
                      botRunResult.result === 'ALLOW'
                        ? 'var(--color-low-risk)'
                        : botRunResult.result === 'REJECT_HIGH_RISK'
                        ? 'var(--color-high-risk)'
                        : 'var(--color-med-risk)'
                    }`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Terminal style={{ width: 20, height: 20, color: 'var(--accent-cyan)' }} />
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Automated Run Result</h3>
                    </div>
                    <span className="badge badge-bot">{botRunResult.bot_profile?.toUpperCase()} BOT</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>System Decision</div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', color: botRunResult.result === 'ALLOW' ? 'var(--color-low-risk)' : 'var(--color-high-risk)', marginTop: 2 }}>
                        {botRunResult.result}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Automation Risk</div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', marginTop: 2 }}>
                        {botRunResult.risk_score} / 100
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completion Time</div>
                      <div style={{ fontWeight: 800, fontSize: '1rem', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                        {botRunResult.completion_time_ms} ms
                      </div>
                    </div>
                  </div>
                </div>

                {recordedEvents.length > 0 && (
                  <>
                    <SessionReplay events={recordedEvents} />
                    <EventTimeline events={recordedEvents} />
                  </>
                )}
              </>
            ) : (
              <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center', minHeight: '340px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <Bot style={{ width: 42, height: 42, color: 'var(--accent-violet)', marginBottom: '1rem', opacity: 0.7 }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '0.5rem' }}>Ready for Automation Profiling</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', maxWidth: '420px', lineHeight: 1.5 }}>
                  Click "Launch Bot Test" on the left to spawn the local Playwright browser automation agent.
                  The agent will navigate to the laboratory, execute the chosen motor/timing profile, and stream
                  the telemetry into the risk engine for analysis.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
