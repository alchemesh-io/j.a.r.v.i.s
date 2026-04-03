import datetime

from google.auth.transport.requests import Request
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from pydantic import BaseModel, PrivateAttr

from app.config import GoogleCalendarConfig

SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/presentations.readonly",
    "https://www.googleapis.com/auth/cloud-platform",
]


class EventAttendee(BaseModel):
    email: str
    display_name: str | None = None
    response_status: str | None = None


class EventAttachment(BaseModel):
    title: str
    file_url: str
    icon_link: str | None = None
    mime_type: str | None = None


class CalendarEvent(BaseModel):
    id: str
    summary: str
    start: str
    end: str
    description: str | None = None
    location: str | None = None
    attendees: list[EventAttendee] = []
    attachments: list[EventAttachment] = []
    html_link: str | None = None
    calendar_name: str
    calendar_color: str


class CalendarGroup(BaseModel):
    calendar_name: str
    calendar_color: str
    events: list[CalendarEvent]


class GCalClient(BaseModel):
    config: GoogleCalendarConfig
    _credentials: Credentials | None = PrivateAttr(default=None)
    _flow: Flow | None = PrivateAttr(default=None)

    model_config = {"arbitrary_types_allowed": True}

    # --- OAuth2 flow ---

    def _get_or_create_flow(self) -> Flow:
        if self._flow is None:
            self._flow = Flow.from_client_config(
                self.config.client_config,
                scopes=SCOPES,
                redirect_uri=self.config.redirect_uri,
            )
        return self._flow

    def get_auth_url(self) -> str:
        flow = self._get_or_create_flow()
        url, _ = flow.authorization_url(prompt="consent", access_type="offline")
        return url

    def handle_callback(self, code: str) -> None:
        flow = self._get_or_create_flow()
        flow.fetch_token(code=code)
        self._credentials = flow.credentials
        self._flow = None

    def is_authenticated(self) -> bool:
        if self.config.auth_mode == "service_account":
            return True
        if self._credentials is None:
            return False
        # Valid token or has a refresh token to obtain a new one
        if self._credentials.valid:
            return True
        if self._credentials.expired and self._credentials.refresh_token:
            self._credentials.refresh(Request())
            return self._credentials.valid
        return False

    # --- Service account flow ---

    def _build_service_account_credentials(self) -> Credentials:
        creds = service_account.Credentials.from_service_account_file(
            self.config.service_account_key_path,
            scopes=SCOPES,
        )
        return creds.with_subject(self.config.delegated_user_email)

    # --- Calendar API ---

    def _get_service(self):
        if self.config.auth_mode == "service_account":
            creds = self._build_service_account_credentials()
        else:
            if self._credentials and self._credentials.expired and self._credentials.refresh_token:
                self._credentials.refresh(Request())
            creds = self._credentials
        return build("calendar", "v3", credentials=creds)

    def list_events(self, date: datetime.date, view: str = "daily") -> list[CalendarGroup]:
        service = self._get_service()

        if view == "weekly":
            days_since_monday = date.weekday()
            start_date = date - datetime.timedelta(days=days_since_monday)
            end_date = start_date + datetime.timedelta(days=7)
        else:
            start_date = date
            end_date = date + datetime.timedelta(days=1)

        # Get user's timezone from primary calendar to avoid UTC offset issues
        primary = service.calendars().get(calendarId="primary").execute()
        tz_name = primary.get("timeZone", "UTC")

        from zoneinfo import ZoneInfo
        tz = ZoneInfo(tz_name)
        time_min = datetime.datetime.combine(start_date, datetime.time.min, tzinfo=tz).isoformat()
        time_max = datetime.datetime.combine(end_date, datetime.time.min, tzinfo=tz).isoformat()

        calendars_result = service.calendarList().list().execute()
        calendars = calendars_result.get("items", [])

        groups: list[CalendarGroup] = []
        for cal in calendars:
            cal_id = cal["id"]
            cal_name = cal.get("summary", cal_id)
            cal_color = cal.get("backgroundColor", "#4285f4")

            events_result = (
                service.events()
                .list(
                    calendarId=cal_id,
                    timeMin=time_min,
                    timeMax=time_max,
                    singleEvents=True,
                    orderBy="startTime",
                )
                .execute()
            )
            raw_events = events_result.get("items", [])
            if not raw_events:
                continue

            events = []
            for ev in raw_events:
                attendees = [
                    EventAttendee(
                        email=a.get("email", ""),
                        display_name=a.get("displayName"),
                        response_status=a.get("responseStatus"),
                    )
                    for a in ev.get("attendees", [])
                ]
                attachments = [
                    EventAttachment(
                        title=att.get("title", ""),
                        file_url=att.get("fileUrl", ""),
                        icon_link=att.get("iconLink"),
                        mime_type=att.get("mimeType"),
                    )
                    for att in ev.get("attachments", [])
                ]
                events.append(CalendarEvent(
                    id=ev["id"],
                    summary=ev.get("summary", "(No title)"),
                    start=ev["start"].get("dateTime", ev["start"].get("date", "")),
                    end=ev["end"].get("dateTime", ev["end"].get("date", "")),
                    description=ev.get("description"),
                    location=ev.get("location"),
                    attendees=attendees,
                    attachments=attachments,
                    html_link=ev.get("htmlLink"),
                    calendar_name=cal_name,
                    calendar_color=cal_color,
                ))
            groups.append(CalendarGroup(calendar_name=cal_name, calendar_color=cal_color, events=events))

        return groups
