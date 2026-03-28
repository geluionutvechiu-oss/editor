from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, HttpUrl
from typing import List, Optional
from loguru import logger

from app.database import get_db
from app.services.epg_service import refresh_epg_source, refresh_all_epg_sources, get_current_programmes

router = APIRouter()


class EPGSourceCreate(BaseModel):
    name: str
    url: str
    update_frequency_hours: int = 12
    encoding: str = "UTF-8"


class EPGRefreshResponse(BaseModel):
    source_id: int
    channels: int
    programmes: int
    refreshed_at: str


@router.get("/sources")
async def list_epg_sources(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM epg_sources ORDER BY name ASC")).fetchall()
    return [dict(r._mapping) for r in rows]


@router.post("/sources")
async def create_epg_source(source: EPGSourceCreate, db: Session = Depends(get_db)):
    result = db.execute(
        text("INSERT INTO epg_sources (name, url, update_frequency_hours, encoding) VALUES (:name, :url, :freq, :enc)"),
        {"name": source.name, "url": source.url, "freq": source.update_frequency_hours, "enc": source.encoding}
    )
    db.commit()
    return {"id": result.lastrowid, "message": "EPG source created"}


@router.post("/sources/{source_id}/refresh")
async def refresh_source(source_id: int, background_tasks: BackgroundTasks):
    """Trigger EPG refresh for a single source (background)"""
    background_tasks.add_task(refresh_epg_source, source_id)
    return {"message": f"EPG refresh started for source {source_id}"}


@router.post("/refresh-all")
async def refresh_all(background_tasks: BackgroundTasks):
    """Trigger EPG refresh for all active sources (background)"""
    background_tasks.add_task(refresh_all_epg_sources)
    return {"message": "EPG refresh started for all sources"}


@router.get("/now")
async def get_now_playing(
    channel_ids: str = Query(..., description="Comma-separated channel IDs"),
    db: Session = Depends(get_db)
):
    """Get currently playing programme for multiple channels"""
    ids = [c.strip() for c in channel_ids.split(",") if c.strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="No channel IDs provided")
    if len(ids) > 100:
        raise HTTPException(status_code=400, detail="Too many channels (max 100)")

    result = get_current_programmes(db, ids)
    return result


@router.get("/guide/{channel_id}")
async def get_epg_guide(
    channel_id: str,
    days_back: int = Query(1, ge=0, le=3),
    days_forward: int = Query(3, ge=1, le=7),
    db: Session = Depends(get_db)
):
    """Get EPG programme guide for a channel"""
    rows = db.execute(
        text("""
            SELECT channel_id, title, description, start, end, category, episode_num, icon, lang
            FROM epg_data
            WHERE channel_id = :cid
              AND start >= DATE_SUB(NOW(), INTERVAL :back DAY)
              AND start <= DATE_ADD(NOW(), INTERVAL :fwd DAY)
            ORDER BY start ASC
            LIMIT 500
        """),
        {"cid": channel_id, "back": days_back, "fwd": days_forward}
    ).fetchall()

    return [dict(r._mapping) for r in rows]


@router.get("/channels")
async def list_epg_channels(
    search: str = Query("", max_length=100),
    source_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    offset = (page - 1) * limit
    where = "1=1"
    params = {"limit": limit, "offset": offset}

    if search:
        where += " AND (ec.channel_id LIKE :search OR ec.display_name LIKE :search)"
        params["search"] = f"%{search}%"

    if source_id:
        where += " AND ec.source_id = :source_id"
        params["source_id"] = source_id

    total = db.execute(
        text(f"SELECT COUNT(*) FROM epg_channels ec WHERE {where}"),
        params
    ).scalar()

    rows = db.execute(
        text(f"""
            SELECT ec.*, es.name as source_name
            FROM epg_channels ec
            JOIN epg_sources es ON es.id = ec.source_id
            WHERE {where}
            ORDER BY ec.display_name ASC
            LIMIT :limit OFFSET :offset
        """),
        params
    ).fetchall()

    return {
        "data": [dict(r._mapping) for r in rows],
        "pagination": {"page": page, "limit": limit, "total": total}
    }
