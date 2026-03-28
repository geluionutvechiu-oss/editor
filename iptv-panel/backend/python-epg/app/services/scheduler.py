from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from loguru import logger
from app.services.epg_service import refresh_all_epg_sources

scheduler = AsyncIOScheduler(timezone="UTC")

async def start_scheduler():
    """Start background job scheduler"""
    # EPG refresh twice daily
    scheduler.add_job(
        refresh_all_epg_sources,
        CronTrigger(hour="2,14", minute="0"),
        id="epg_refresh",
        name="Refresh all EPG sources",
        replace_existing=True,
        max_instances=1,
        misfire_grace_time=300
    )

    scheduler.start()
    logger.info("APScheduler started with EPG refresh jobs")

async def stop_scheduler():
    """Stop scheduler gracefully"""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler stopped")
