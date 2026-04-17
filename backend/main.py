"""
backend/main.py
FastAPI application entry point.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.jobs import router as jobs_router

app = FastAPI(
    title="Clutches and More — Image Generator API",
    version="1.0.0",
    description="Generate realistic model photos from product images using Leonardo AI.",
)

# ── CORS (allow all origins in development) ────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ─────────────────────────────────────────────────────────────────────
app.include_router(jobs_router, prefix="")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "Clutches and More API"}
