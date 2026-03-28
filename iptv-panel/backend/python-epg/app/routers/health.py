from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import get_db, get_redis
import time

router = APIRouter()

@router.get("/health")
async def health_check(db: Session = Depends(get_db)):
    start = time.time()
    status = {"status": "ok", "timestamp": time.time()}

    # DB check
    try:
        db.execute(text("SELECT 1"))
        status["database"] = "connected"
    except Exception as e:
        status["database"] = f"error: {str(e)}"
        status["status"] = "degraded"

    # Redis check
    try:
        redis = await get_redis()
        await redis.ping()
        status["redis"] = "connected"
    except Exception as e:
        status["redis"] = f"error: {str(e)}"
        status["status"] = "degraded"

    status["response_time_ms"] = round((time.time() - start) * 1000, 2)
    return status
