from pydantic_settings import BaseSettings
from typing import List
import os

class Settings(BaseSettings):
    # Database
    db_host: str = "mysql"
    db_port: int = 3306
    db_user: str = "iptv_user"
    db_password: str = ""
    db_name: str = "iptv_panel"

    # Redis
    redis_host: str = "redis"
    redis_port: int = 6379
    redis_password: str = ""
    redis_db: int = 0

    # Service
    port: int = 8001
    host: str = "0.0.0.0"
    debug: bool = False
    log_level: str = "INFO"

    # Internal API
    node_api_url: str = "http://node-api:8080"
    internal_api_key: str = ""

    # CORS
    cors_origins: List[str] = ["http://localhost:3000", "http://localhost:8080"]

    # EPG
    epg_max_age_days: int = 7
    epg_batch_size: int = 1000
    epg_max_file_size_mb: int = 200
    epg_download_timeout: int = 120

    @property
    def database_url(self) -> str:
        return f"mysql+pymysql://{self.db_user}:{self.db_password}@{self.db_host}:{self.db_port}/{self.db_name}?charset=utf8mb4"

    @property
    def redis_url(self) -> str:
        if self.redis_password:
            return f"redis://:{self.redis_password}@{self.redis_host}:{self.redis_port}/{self.redis_db}"
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
