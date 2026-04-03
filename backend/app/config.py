from typing import Literal

from pydantic import BaseModel
from pydantic_settings import BaseSettings


class JiraConfig(BaseModel):
    project_url: str = ""
    api_key: str = ""
    user_email: str = ""
    jql: str = ""

    @property
    def configured(self) -> bool:
        return all([self.project_url, self.api_key, self.user_email, self.jql])


class GoogleCalendarConfig(BaseModel):
    auth_mode: Literal["oauth2", "service_account"] | None = None
    # OAuth2 mode
    project_id: str = ""
    client_id: str = ""
    client_secret: str = ""
    auth_uri: str = "https://accounts.google.com/o/oauth2/auth"
    token_uri: str = "https://oauth2.googleapis.com/token"
    auth_provider_x509_cert_url: str = "https://www.googleapis.com/oauth2/v1/certs"
    redirect_uri: str = ""
    calendar_email: str = ""
    # Service account mode
    service_account_key_path: str = ""
    delegated_user_email: str = ""

    @property
    def configured(self) -> bool:
        if self.auth_mode == "oauth2":
            return all([self.client_id, self.client_secret, self.redirect_uri])
        if self.auth_mode == "service_account":
            return all([self.service_account_key_path, self.delegated_user_email])
        return False

    @property
    def client_config(self) -> dict:
        return {
            "installed": {
                "project_id": self.project_id,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "auth_uri": self.auth_uri,
                "token_uri": self.token_uri,
                "auth_provider_x509_cert_url": self.auth_provider_x509_cert_url,
                "redirect_uris": [self.redirect_uri] if self.redirect_uri else [],
            }
        }


class Settings(BaseSettings):
    database_url: str = "sqlite:////data/jarvis.db"
    app_title: str = "J.A.R.V.I.S"
    debug: bool = False

    # JIRA integration
    jira_project_url: str = ""
    jira_api_key: str = ""
    jira_user_email: str = ""
    jira_jql: str = ""

    # Google Calendar integration
    google_auth_mode: Literal["oauth2", "service_account"] | None = None
    google_project_id: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    google_auth_uri: str = "https://accounts.google.com/o/oauth2/auth"
    google_token_uri: str = "https://oauth2.googleapis.com/token"
    google_auth_provider_x509_cert_url: str = "https://www.googleapis.com/oauth2/v1/certs"
    google_redirect_uri: str = ""
    google_calendar_email: str = ""
    google_service_account_key_path: str = ""
    google_delegated_user_email: str = ""

    model_config = {"env_prefix": "", "case_sensitive": False}

    @property
    def jira(self) -> JiraConfig:
        return JiraConfig(
            project_url=self.jira_project_url,
            api_key=self.jira_api_key,
            user_email=self.jira_user_email,
            jql=self.jira_jql,
        )

    @property
    def gcal(self) -> GoogleCalendarConfig:
        return GoogleCalendarConfig(
            auth_mode=self.google_auth_mode,
            project_id=self.google_project_id,
            client_id=self.google_client_id,
            client_secret=self.google_client_secret,
            auth_uri=self.google_auth_uri,
            token_uri=self.google_token_uri,
            auth_provider_x509_cert_url=self.google_auth_provider_x509_cert_url,
            redirect_uri=self.google_redirect_uri,
            calendar_email=self.google_calendar_email,
            service_account_key_path=self.google_service_account_key_path,
            delegated_user_email=self.google_delegated_user_email,
        )


settings = Settings()
