import time
from collections import defaultdict
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.database.db import initDb
from backend.api.routes import router as apiRouter

RATE_LIMIT_WINDOW = 10.0
RATE_LIMIT_MAX_REQUESTS = 120
ipRequestHistory = defaultdict(list)

@asynccontextmanager
async def lifespan(app: FastAPI):
    initDb()
    yield

app = FastAPI(
    title="CAPTCHA Research Laboratory API",
    description="Behavioral CAPTCHA research and bot detection workbench",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def securityAndRateLimit(request: Request, callNext):
    path = request.url.path
    if not (path.startswith("/api/export") or path.startswith("/api/session/")):
        clientIp = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        timestamps = ipRequestHistory[clientIp]
        ipRequestHistory[clientIp] = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]

        if len(ipRequestHistory[clientIp]) >= RATE_LIMIT_MAX_REQUESTS:
            return JSONResponse(
                status_code=429,
                content={"error": "Rate limit exceeded"}
            )
        ipRequestHistory[clientIp].append(now)

    response = await callNext(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

app.include_router(apiRouter)

@app.get("/health")
def healthCheck():
    return {"status": "healthy", "service": "captcha-research-lab"}

health_check = healthCheck

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
