from pydantic import BaseModel
from jira import JIRA

from app.config import JiraConfig


class JiraTicket(BaseModel):
    key: str
    summary: str
    status: str
    url: str


class JiraClient(BaseModel):
    config: JiraConfig
    _client: JIRA | None = None

    model_config = {"arbitrary_types_allowed": True}

    @property
    def client(self) -> JIRA:
        if self._client is None:
            self._client = JIRA(
                server=self.config.project_url,
                basic_auth=(self.config.user_email, self.config.api_key),
            )
        return self._client

    def search_tickets(self) -> list[JiraTicket]:
        issues = self.client.search_issues(self.config.jql, maxResults=50)
        return [
            JiraTicket(
                key=issue.key,
                summary=issue.fields.summary,
                status=str(issue.fields.status),
                url=f"{self.config.project_url}/browse/{issue.key}",
            )
            for issue in issues
        ]
