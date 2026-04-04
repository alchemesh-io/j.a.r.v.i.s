## ADDED Requirements

### Requirement: Google Calendar auth mode configuration

The backend SHALL support a `GOOGLE_AUTH_MODE` setting with two values: `oauth2` and `service_account`. Configuration is modeled via dedicated `GoogleCalendarConfig` Pydantic BaseModel with a `configured` property.

**OAuth2 mode** (`installed` client type) requires:
- `GOOGLE_CLIENT_ID` (stored in secrets)
- `GOOGLE_CLIENT_SECRET` (stored in secrets)
- `GOOGLE_PROJECT_ID` (stored in secrets)
- `GOOGLE_AUTH_URI` (default: `https://accounts.google.com/o/oauth2/auth`)
- `GOOGLE_TOKEN_URI` (default: `https://oauth2.googleapis.com/token`)
- `GOOGLE_AUTH_PROVIDER_X509_CERT_URL` (default: `https://www.googleapis.com/oauth2/v1/certs`)
- `GOOGLE_REDIRECT_URI`
- `GOOGLE_CALENDAR_EMAIL` — user's calendar email for constructing event deep-links

**Service account mode** requires:
- `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`
- `GOOGLE_DELEGATED_USER_EMAIL`

**OAuth2 scopes** requested:
- `calendar.readonly`, `drive.readonly`, `spreadsheets.readonly`, `documents.readonly`, `gmail.readonly`, `presentations.readonly`, `cloud-platform`

#### Scenario: OAuth2 mode fully configured
- **WHEN** `GOOGLE_AUTH_MODE = "oauth2"` and `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` are all set
- **THEN** the Google Calendar integration is enabled in OAuth2 mode

#### Scenario: Not configured
- **WHEN** `GOOGLE_AUTH_MODE` is unset or required fields are missing
- **THEN** Google Calendar endpoints SHALL return `503`

### Requirement: OAuth2 authentication flow (PKCE)

The `GCalClient` uses the `installed` client type with PKCE. The same `Flow` instance is preserved (via Pydantic `PrivateAttr`) between `get_auth_url()` and `handle_callback()` to maintain the `code_verifier`. Credentials stored in-memory with auto-refresh support.

- `GET /api/v1/gcal/auth/login` → redirects to Google consent screen
- `GET /api/v1/gcal/auth/callback` → exchanges code for tokens, logs errors with detail in redirect URL on failure

#### Scenario: Token exchange failure
- **WHEN** the callback fails
- **THEN** redirects to `/?gcal_error=token_exchange_failed&detail=<error message>`

### Requirement: Google Calendar auth status

`GET /api/v1/gcal/auth/status` returns `{ configured, authenticated, mode, calendarEmail }`.

The `calendarEmail` field is populated from `GOOGLE_CALENDAR_EMAIL` config and used by the frontend to construct Google Calendar event deep-links.

### Requirement: Debug endpoint

`GET /api/v1/gcal/auth/debug` returns non-secret config state for troubleshooting (has_client_id, has_client_secret, has_redirect_uri, redirect_uri, configured, etc.).

### Requirement: List calendar events (timezone-aware)

`GET /api/v1/gcal/events?date=2026-04-03&view=daily|weekly` returns events from all accessible calendars, grouped by calendar with color metadata.

The endpoint queries the user's primary calendar to determine their timezone and constructs `timeMin`/`timeMax` with the correct timezone offset (not UTC) to ensure daily view only returns events for the selected calendar day.

Each event includes: `id`, `summary`, `start`, `end`, `description`, `location`, `attendees` (with `email`, `display_name`, `response_status`), `attachments` (with `title`, `file_url`, `icon_link`, `mime_type`), `html_link`, `calendar_name`, `calendar_color`.

### Requirement: Get single calendar event

`GET /api/v1/gcal/event?event_id=<id>` returns a single event's details. Searches across all calendars to find the event. Uses query param to handle special characters in event IDs.

### Requirement: Google Calendar agenda browser in task creation UI

The Google Calendar import mode renders a **chronological timeline** with:
- Date headers for day boundaries
- Events sorted by start time with calendar color bar, time range, calendar name
- Toolbar per event: details icon (expandable HTML description, guests, attachments), fullscreen icon, checkmark select icon
- **HTML descriptions** rendered directly (Google Calendar returns HTML, not wiki markup)
- **Attendee list** with RSVP status (accepted=green, declined=red, tentative=orange, needsAction=gray)
- **File attachments** with Drive icons
- **Multi-select** with "Confirm selection" bar, redirects to manual mode with event dates auto-added

#### Scenario: Not authenticated — login redirect
- **WHEN** the user selects Google Calendar and is not authenticated
- **THEN** a "Login with Google" button is shown (import form) or the user is redirected to login (board expand)

### Requirement: Google Calendar deep-link on task cards

When a task has `source_type = "gcal"`, the `TaskCard` renders a multi-color Google Calendar icon (20x20) that links to `https://www.google.com/calendar/event?eid=base64(sourceId + " " + calendarEmail)`. The `calendarEmail` is obtained from `GET /api/v1/gcal/auth/status`.

### Requirement: Edit form adapts to source type

When editing a GCal-sourced task, the "JIRA Ticket" field label changes to "Event ID" and is disabled (read-only).

### Requirement: Expand source details from task board

When clicking the expand icon on a GCal-sourced task on the board:
1. Check authentication status via `GET /api/v1/gcal/auth/status`
2. If not authenticated, redirect to Google login
3. If authenticated, fetch event details via `GET /api/v1/gcal/event?event_id=` and open fullscreen modal
