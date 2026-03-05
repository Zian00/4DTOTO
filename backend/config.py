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
    # Comma-separated list. Use "*" only for local prototyping.
    cors_allow_origins: str = (
        "http://localhost:3000,"
        "http://127.0.0.1:3000,"
        "http://localhost:8081,"
        "http://127.0.0.1:8081,"
        "http://localhost:19006,"
        "http://127.0.0.1:19006"
    )
    # Keep OCR raw text out of logs by default (ticket text may contain sensitive info).
    log_ocr_raw_text: bool = False
    # Allowed MIME types for uploaded ticket images (comma-separated).
    allowed_image_mime_types: str = "image/jpeg,image/png,image/webp,image/heic,image/heif"

    @property
    def cors_origins_list(self) -> list[str]:
        raw = (self.cors_allow_origins or "").strip()
        if not raw:
            return []
        if raw == "*":
            return ["*"]
        return [origin.strip() for origin in raw.split(",") if origin.strip()]

    @property
    def allowed_image_mime_types_set(self) -> set[str]:
        return {
            token.strip().lower()
            for token in (self.allowed_image_mime_types or "").split(",")
            if token.strip()
        }


settings = Settings()
