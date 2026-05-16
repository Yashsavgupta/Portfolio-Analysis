from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    API_PREFIX: str = '/api'

    # Zerodha API Configuration
    ZERODHA_API_KEY: str = ""
    ZERODHA_API_SECRET: str = ""

    # CORS — space-separated list of allowed origins, or "*" for all
    CORS_ORIGINS: str = (
        "http://localhost:3000 http://localhost:3001 http://localhost:3002 http://localhost:3003 "
        "http://127.0.0.1:3000 http://127.0.0.1:3001 http://127.0.0.1:3002 http://127.0.0.1:3003"
    )

    @property
    def cors_origins_list(self) -> List[str]:
        if self.CORS_ORIGINS == "*":
            return ["*"]
        return [o.strip() for o in self.CORS_ORIGINS.split() if o.strip()]

    class Config:
        env_file = str(Path(__file__).parent.parent.parent / '.env')
        env_file_encoding = 'utf-8'


settings = Settings()

