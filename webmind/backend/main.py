"""
main.py
────────────────────────────────────────────────────────────────────────────
WebMind FastAPI application entry point.

Run with:
    uvicorn main:app --reload --port 8000
"""

# ── Windows event-loop fix (must come before any asyncio usage) ───────────────
import sys
if sys.platform == "win32":
    import asyncio
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from api.routes import router

# ── Env & Logging ─────────────────────────────────────────────────────────────
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="WebMind API",
    description=(
        "Agentic web scraper + RAG pipeline. "
        "Scrape any website (static or JS-rendered / dynamic), "
        "index its content, and ask questions with Gemini Flash."
    ),
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Middleware ────────────────────────────────────────────────────────────────
origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000")
origins = [o.strip() for o in origins_raw.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(router)


@app.get("/", tags=["Root"])
async def root():
    return {
        "name":    "WebMind API",
        "version": "2.0.0",
        "docs":    "/docs",
        "status":  "/api/status",
    }


# ── Dev run ───────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", 8000)),
        reload=True,
    )