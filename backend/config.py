from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # silently ignore unknown env vars (e.g. SCHEDULER_POLL_INTERVAL)
    )

    database_url: str
    gemini_api_key: str = ""
    upload_dir: str = "./uploads"
    scrape_delay_seconds: int = 2


settings = Settings()
