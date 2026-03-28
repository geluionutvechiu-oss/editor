"""
EPG processing service - handles download, parse and DB storage
"""
from typing import List, Dict, Optional
from datetime import datetime, timezone
from sqlalchemy import text
from sqlalchemy.orm import Session
from loguru import logger
import asyncio

from app.database import SessionLocal, get_redis
from app.services.epg_parser import download_epg, parse_xmltv_streaming
from app.config import settings


async def refresh_epg_source(source_id: int) -> Dict:
    """
    Download and process a single EPG source
    Returns stats dict
    """
    db = SessionLocal()
    try:
        source = db.execute(
            text("SELECT * FROM epg_sources WHERE id = :id"),
            {"id": source_id}
        ).fetchone()

        if not source:
            raise ValueError(f"EPG source {source_id} not found")

        logger.info(f"Starting EPG refresh for source {source_id}: {source.url}")

        # Download
        try:
            content = await download_epg(source.url)
        except Exception as e:
            logger.error(f"Failed to download EPG source {source_id}: {e}")
            db.execute(
                text("UPDATE epg_sources SET last_updated = :now WHERE id = :id"),
                {"now": datetime.now(timezone.utc), "id": source_id}
            )
            db.commit()
            raise

        # Parse
        channels, programmes = parse_xmltv_streaming(
            content,
            source_id,
            max_age_days=settings.epg_max_age_days
        )

        # Store in DB
        await store_epg_data(db, source_id, channels, programmes)

        # Invalidate Redis cache
        redis = await get_redis()
        keys = await redis.keys("xmltv:*")
        keys += await redis.keys("epg:*")
        if keys:
            await redis.delete(*keys)

        stats = {
            "source_id": source_id,
            "channels": len(channels),
            "programmes": len(programmes),
            "refreshed_at": datetime.now(timezone.utc).isoformat()
        }

        logger.info(f"EPG source {source_id} refreshed: {stats}")
        return stats

    finally:
        db.close()


async def store_epg_data(db: Session, source_id: int, channels: List[Dict], programmes: List[Dict]):
    """Store channels and programmes in database using batch inserts"""
    try:
        # Delete old data for this source
        db.execute(text("DELETE FROM epg_channels WHERE source_id = :sid"), {"sid": source_id})
        db.execute(text("DELETE FROM epg_data WHERE source_id = :sid"), {"sid": source_id})

        # Batch insert channels
        batch_size = settings.epg_batch_size
        for i in range(0, len(channels), batch_size):
            batch = channels[i:i + batch_size]
            if batch:
                db.execute(
                    text("""
                        INSERT IGNORE INTO epg_channels (source_id, channel_id, display_name, icon, lang)
                        VALUES (:source_id, :channel_id, :display_name, :icon, :lang)
                    """),
                    batch
                )

        # Batch insert programmes
        for i in range(0, len(programmes), batch_size):
            batch = programmes[i:i + batch_size]
            if batch:
                db.execute(
                    text("""
                        INSERT IGNORE INTO epg_data
                          (channel_id, epg_id, start, end, title, lang, description, icon, category, episode_num, source_id)
                        VALUES
                          (:channel_id, :epg_id, :start, :end, :title, :lang, :description, :icon, :category, :episode_num, :source_id)
                    """),
                    batch
                )

        # Update source metadata
        db.execute(
            text("""
                UPDATE epg_sources
                SET last_updated = :now, channel_count = :cc, event_count = :ec
                WHERE id = :id
            """),
            {
                "now": datetime.now(timezone.utc),
                "cc": len(channels),
                "ec": len(programmes),
                "id": source_id
            }
        )
        db.commit()
        logger.info(f"Stored {len(channels)} channels and {len(programmes)} programmes for source {source_id}")

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to store EPG data for source {source_id}: {e}")
        raise


async def refresh_all_epg_sources() -> Dict:
    """Refresh all active EPG sources"""
    db = SessionLocal()
    try:
        sources = db.execute(
            text("SELECT id, name, url FROM epg_sources WHERE is_active = 1")
        ).fetchall()
    finally:
        db.close()

    logger.info(f"Refreshing {len(sources)} EPG sources")

    total_channels = 0
    total_programmes = 0
    errors = []

    for source in sources:
        try:
            result = await refresh_epg_source(source.id)
            total_channels += result["channels"]
            total_programmes += result["programmes"]
        except Exception as e:
            errors.append({"source_id": source.id, "name": source.name, "error": str(e)})

    return {
        "processed": len(sources),
        "errors": len(errors),
        "total_channels": total_channels,
        "total_programmes": total_programmes,
        "error_details": errors
    }


def get_current_programmes(db: Session, channel_ids: List[str]) -> Dict[str, Dict]:
    """Get currently airing programme for each channel"""
    if not channel_ids:
        return {}

    placeholders = ", ".join([f":ch_{i}" for i in range(len(channel_ids))])
    params = {f"ch_{i}": cid for i, cid in enumerate(channel_ids)}
    params["now"] = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')

    rows = db.execute(
        text(f"""
            SELECT e1.channel_id, e1.title, e1.description, e1.start, e1.end,
                   e1.category, e1.episode_num, e1.icon
            FROM epg_data e1
            WHERE e1.channel_id IN ({placeholders})
              AND e1.start <= :now
              AND e1.end >= :now
            ORDER BY e1.start DESC
        """),
        params
    ).fetchall()

    result = {}
    for row in rows:
        if row.channel_id not in result:
            result[row.channel_id] = dict(row._mapping)
    return result
