from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any

class CreateSessionRequest(BaseModel):
    is_bot: bool = False
    bot_profile: Optional[str] = None
    user_agent: Optional[str] = None

class CreateSessionResponse(BaseModel):
    session_id: str
    created_at: str

class TelemetryEventSchema(BaseModel):
    session_id: str
    captcha_id: Optional[str] = None
    timestamp: str
    event_type: str
    x: Optional[float] = None
    y: Optional[float] = None
    relative_x: Optional[float] = None
    relative_y: Optional[float] = None
    elapsed_ms: float
    key_code: Optional[str] = None
    target: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None

class BatchTelemetryRequest(BaseModel):
    events: List[TelemetryEventSchema]

class VerifyCaptchaRequest(BaseModel):
    session_id: str
    captcha_id: str
    answer: str
    events: Optional[List[TelemetryEventSchema]] = None

class PassiveEvalRequest(BaseModel):
    session_id: str
    events: List[TelemetryEventSchema]

class BotRunRequest(BaseModel):
    bot_profile: str = Field(default="fast", description="fast, synthetic, regular, or randomized")
    challenge_type: str = Field(default="text", description="text or slider")
    headless: bool = True
    count: int = 1
