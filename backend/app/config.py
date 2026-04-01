from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "sqlite:////data/jarvis.db"
    app_title: str = "J.A.R.V.I.S"
    debug: bool = False

    model_config = {"env_prefix": "", "case_sensitive": False}


settings = Settings()
