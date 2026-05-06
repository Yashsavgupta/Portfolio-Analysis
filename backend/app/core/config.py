from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    API_PREFIX: str = '/api'

    # Zerodha API Configuration
    ZERODHA_API_KEY: str = ""
    ZERODHA_API_SECRET: str = ""

    class Config:
        env_file = str(Path(__file__).parent.parent.parent / '.env')
        env_file_encoding = 'utf-8'


settings = Settings()

