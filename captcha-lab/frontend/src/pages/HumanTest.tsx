import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import type { VerificationResult } from '../services/api';
import { CaptchaWidget } from '../components/CaptchaWidget';
import { RiskPanel } from '../components/RiskPanel';

interface HumanTestProps {
  onSessionCreated?: (sessionId: string) => void;
}

export const HumanTest: React.FC<HumanTestProps> = ({ onSessionCreated }) => {
  const [sessionId, setSessionId] = useState<string>('');
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

  const getUrlParams = () => new URLSearchParams(window.location.search);
  const [isBot, setIsBot] = useState(() => getUrlParams().get('bot') === 'true');
  const [botProfile, setBotProfile] = useState<string | undefined>(() => getUrlParams().get('profile') || undefined);
  const [prefType, setPrefType] = useState<any>(() => getUrlParams().get('challenge') || 'text');

  const createSession = async () => {
    setIsLoadingSession(true);
    setVerificationResult(null);

    const params = getUrlParams();
    const botParam = params.get('bot') === 'true';
    const profileParam = params.get('profile') || undefined;
    const challengeParam = params.get('challenge') || 'text';

    setIsBot(botParam);
    setBotProfile(profileParam);
    setPrefType(challengeParam);

    try {
      const res = await api.createSession(botParam, profileParam);
      setSessionId(res.sessionId || res.session_id);
      if (onSessionCreated) onSessionCreated(res.sessionId || res.session_id);
    } catch (err) {
      console.error('Failed to create session', err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    createSession();
  }, []);

  const handleVerified = (res: VerificationResult) => {
    setVerificationResult(res);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">CAPTCHA Test</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Session:</span>
            <span className="mono session-badge">
              {isLoadingSession ? 'Initializing...' : sessionId ? sessionId.slice(0, 8).toUpperCase() : 'N/A'}
            </span>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              ({sessionId})
            </span>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={createSession}
          disabled={isLoadingSession}
        >
          New Session
        </button>
      </div>

      <div className="section-divider" style={{ margin: '16px 0 24px' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: '24px', alignItems: 'start' }}>
        <div>
          {sessionId ? (
            <CaptchaWidget
              sessionId={sessionId}
              isBotSession={isBot}
              botProfile={botProfile}
              preferredType={prefType}
              onVerified={handleVerified}
            />
          ) : (
            <div className="panel" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              Session loading...
            </div>
          )}
        </div>

        <div>
          {verificationResult ? (
            <RiskPanel
              score={verificationResult.riskScore !== undefined ? verificationResult.riskScore : verificationResult.risk_score}
              category={verificationResult.risk_category}
              reasons={verificationResult.reasons}
              metrics={verificationResult.metrics}
            />
          ) : (
            <div className="panel">
              <div className="panel-header">
                <h3>Automation Risk</h3>
                <span className="badge badge-neutral">PENDING</span>
              </div>
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Complete challenge verification on the left to compute behavioral automation risk metrics.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
