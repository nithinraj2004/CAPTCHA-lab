const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api';

export interface SessionInfo {
  session_id: string;
  created_at: string;
  is_bot: boolean;
  bot_profile?: string;
  status: string;
  risk_score: number;
  risk_category?: string;
  completion_time_ms: number;
  passive_risk?: number;
  adaptive_decision?: string;
  sessionId?: string;
  createdAt?: string;
  isBot?: boolean;
  botProfile?: string;
  riskScore?: number;
  completionTime?: number;
}

export interface TelemetryEvent {
  session_id: string;
  captcha_id?: string;
  timestamp: string;
  event_type: string;
  x?: number;
  y?: number;
  relative_x?: number;
  relative_y?: number;
  elapsed_ms: number;
  key_code?: string;
  target?: string;
  meta?: Record<string, any>;
  sessionId?: string;
  captchaId?: string;
  eventType?: string;
  elapsedMs?: number;
  keyCode?: string;
}

export type ChallengeType = 'text' | 'slider' | 'image_select' | 'click_order' | 'rotate' | 'math';

export interface ChallengeData {
  captcha_id: string;
  session_id: string;
  challenge_type: ChallengeType;
  expires_in_seconds: number;
  created_at?: string;
  prompt?: string;
  image_data?: string;
  bg_image?: string;
  piece_image?: string;
  target_y?: number;
  piece_width?: number;
  piece_height?: number;
  canvas_width?: number;
  canvas_height?: number;
  target_category?: string;
  tiles?: string[];
  grid_size?: number;
  total_tiles?: number;
  target_sequence?: string[];
  target_count?: number;
  canvas_size?: number;
  initial_angle?: number;
  captchaId?: string;
  sessionId?: string;
  challengeType?: ChallengeType;
}

export interface RiskReason {
  rule: string;
  points: number;
  detail: string;
}

export interface TelemetryMetrics {
  completion_time_ms: number;
  mouse_event_count: number;
  keyboard_event_count: number;
  avg_mouse_velocity: number;
  mouse_velocity_variance: number;
  mouse_accel_variance: number;
  keyboard_interval_variance: number;
  time_before_first_interaction_ms: number;
  trajectory_linearity: number;
  failed_attempts: number;
  refresh_count: number;
  total_events: number;
  completionTime?: number;
  mouseEvents?: number;
  keyboardEvents?: number;
}

export interface VerificationResult {
  success: boolean;
  decision: 'ALLOW' | 'REJECT_HIGH_RISK' | 'REJECT_FAILED_SOLVE';
  status: string;
  message: string;
  risk_score: number;
  risk_category: 'LOW RISK' | 'MEDIUM RISK' | 'HIGH RISK';
  reasons: RiskReason[];
  metrics: TelemetryMetrics;
  attempts_used: number;
  riskScore?: number;
  attemptsUsed?: number;
}

export interface SessionFilters {
  isBot?: boolean;
  is_bot?: boolean;
  botProfile?: string;
  bot_profile?: string;
  riskCategory?: string;
  risk_category?: string;
}

export const api = {
  async createSession(isBot = false, botProfile?: string): Promise<{ session_id: string; created_at: string; sessionId: string; createdAt: string }> {
    const res = await fetch(`${API_BASE}/session/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_bot: isBot, bot_profile: botProfile, user_agent: navigator.userAgent }),
    });
    if (!res.ok) throw new Error('Failed to create session');
    const data = await res.json();
    return {
      ...data,
      sessionId: data.session_id,
      createdAt: data.created_at,
    };
  },

  async sendTelemetryBatch(events: TelemetryEvent[]): Promise<void> {
    if (!events.length) return;
    try {
      await fetch(`${API_BASE}/telemetry/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
      });
    } catch (e) {
      console.warn('Telemetry send error', e);
    }
  },

  async passiveEval(sessionId: string, events: TelemetryEvent[]): Promise<any> {
    const res = await fetch(`${API_BASE}/captcha/passive-eval`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, events }),
    });
    return res.json();
  },

  async createCaptcha(sessionId: string, challengeType: ChallengeType = 'text'): Promise<ChallengeData> {
    const res = await fetch(`${API_BASE}/captcha/generate?session_id=${encodeURIComponent(sessionId)}&challenge_type=${challengeType}`);
    if (!res.ok) throw new Error('Failed to generate CAPTCHA');
    const data = await res.json();
    return {
      ...data,
      captchaId: data.captcha_id,
      sessionId: data.session_id,
      challengeType: data.challenge_type,
    };
  },

  async generateCaptcha(sessionId: string, challengeType: ChallengeType = 'text'): Promise<ChallengeData> {
    return this.createCaptcha(sessionId, challengeType);
  },

  async verifyCaptcha(
    sessionId: string,
    captchaId: string,
    answer: string,
    bufferedEvents: TelemetryEvent[] = []
  ): Promise<VerificationResult> {
    const res = await fetch(`${API_BASE}/captcha/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        captcha_id: captchaId,
        answer,
        events: bufferedEvents,
      }),
    });
    if (!res.ok) throw new Error('Failed to verify CAPTCHA');
    const data = await res.json();
    return {
      ...data,
      riskScore: data.risk_score,
      attemptsUsed: data.attempts_used,
    };
  },

  async getSessions(filters: SessionFilters = {}): Promise<SessionInfo[]> {
    const params = new URLSearchParams();
    const isBotVal = filters.isBot !== undefined ? filters.isBot : filters.is_bot;
    const botProfileVal = filters.botProfile || filters.bot_profile;
    const riskCatVal = filters.riskCategory || filters.risk_category;

    if (isBotVal !== undefined) params.append('is_bot', String(isBotVal));
    if (botProfileVal) params.append('bot_profile', botProfileVal);
    if (riskCatVal) params.append('risk_category', riskCatVal);

    const res = await fetch(`${API_BASE}/sessions?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch sessions');
    const data = await res.json();
    const rawSessions: SessionInfo[] = data.sessions || [];
    return rawSessions.map((s) => ({
      ...s,
      sessionId: s.session_id,
      createdAt: s.created_at,
      isBot: s.is_bot,
      botProfile: s.bot_profile,
      riskScore: s.risk_score,
      completionTime: s.completion_time_ms,
    }));
  },

  async getSessionDetails(sessionId: string): Promise<any> {
    const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}`);
    if (!res.ok) throw new Error('Failed to fetch session detail');
    return res.json();
  },

  async getSessionDetail(sessionId: string): Promise<any> {
    return this.getSessionDetails(sessionId);
  },

  async getSessionReplay(sessionId: string): Promise<{ session: SessionInfo; total_events: number; events: TelemetryEvent[] }> {
    const res = await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}/replay`);
    if (!res.ok) throw new Error('Failed to fetch session replay');
    return res.json();
  },

  async getDashboardStats(): Promise<any> {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    if (!res.ok) throw new Error('Failed to fetch dashboard stats');
    return res.json();
  },

  async triggerBotRun(profile: string, challengeType: string = 'text', count: number = 1): Promise<any> {
    const res = await fetch(`${API_BASE}/bot/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot_profile: profile, challenge_type: challengeType, count, headless: true }),
    });
    if (!res.ok) throw new Error('Bot run request failed');
    return res.json();
  },

  getExportCsvUrl(): string {
    return `${API_BASE}/export/csv`;
  },

  getExportJsonUrl(): string {
    return `${API_BASE}/export/json`;
  },
};
