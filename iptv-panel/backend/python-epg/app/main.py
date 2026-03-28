from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from contextlib import asynccontextmanager
import asyncio
from loguru import logger

from app.config import settings
from app.database import engine, Base, get_db
from app.routers import epg, m3u, health
from app.services.scheduler import start_scheduler, stop_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting IPTV EPG Microservice")
    await start_scheduler()
    yield
    logger.info("Shutting down EPG Microservice")
    await stop_scheduler()

app = FastAPI(
    title="IPTV EPG Microservice",
    description="EPG processing and M3U parsing service",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(epg.router, prefix="/api/epg", tags=["EPG"])
app.include_router(m3u.router, prefix="/api/m3u", tags=["M3U"])
app.include_router(health.router, tags=["Health"])

@app.get("/")
async def root():
    return {"service": "IPTV EPG Microservice", "version": "1.0.0", "status": "running"}
