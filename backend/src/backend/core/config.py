from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "EcoUrba API"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: list[str] = [
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ]

    NASA_APPEEARS_API_URL: str = "https://appeears.earthdatacloud.nasa.gov/api"
    NASA_EARTHDATA_USERNAME: str = ""
    NASA_EARTHDATA_PASSWORD: SecretStr = SecretStr("")

    GAMC_API_KEY: SecretStr = SecretStr("")
    GAMC_SERVICE_ID: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )


settings = Settings()
