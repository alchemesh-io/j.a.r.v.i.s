## ADDED Requirements

### Requirement: Google Calendar auth mode configuration

The backend SHALL support a `GOOGLE_AUTH_MODE` setting with two values: `oauth2` and `service_account`. Only one mode is active per deployment.

**OAuth2 mode** requires:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

**Service account mode** requires:
- `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` — path to the service account JSON key file
- `GOOGLE_DELEGATED_USER_EMAIL` — the Workspace user email to impersonate

When `GOOGLE_AUTH_MODE` is unset or required fields for the selected mode are missing, the Google Calendar integration SHALL be disabled.

#### Scenario: OAuth2 mode fully configured
- **WHEN** `GOOGLE_AUTH_MODE = "oauth2"` and `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` are all set
- **THEN** the Google Calendar integration is enabled in OAuth2 mode

#### Scenario: Service account mode fully configured
- **WHEN** `GOOGLE_AUTH_MODE = "service_account"` and `GOOGLE_SERVICE_ACCOUNT_KEY_PATH`, `GOOGLE_DELEGATED_USER_EMAIL` are set
- **THEN** the Google Calendar integration is enabled in service account mode

#### Scenario: Google Calendar not configured
- **WHEN** `GOOGLE_AUTH_MODE` is unset or required fields are missing
- **THEN** Google Calendar endpoints SHALL return `503` with body `{ "detail": "Google Calendar integration is not configured" }`

### Requirement: OAuth2 authentication flow

When running in `oauth2` mode, the backend SHALL implement the Google OAuth2 consent flow:
- `GET /api/v1/gcal/auth/login` SHALL redirect the user to Google's consent screen requesting `calendar.readonly` scope.
- `GET /api/v1/gcal/auth/callback` SHALL handle the OAuth2 callback, exchange the authorization code for access and refresh tokens, and store them in-memory.

#### Scenario: User initiates OAuth2 login
- **WHEN** the user calls `GET /api/v1/gcal/auth/login` in `oauth2` mode
- **THEN** the backend redirects to Google's authorization URL with `calendar.readonly` scope

#### Scenario: OAuth2 callback success
- **WHEN** Google redirects back to `/api/v1/gcal/auth/callback` with a valid authorization code
- **THEN** the backend exchanges the code for tokens, stores them in-memory, and redirects the user back to the frontend

#### Scenario: OAuth2 callback failure
- **WHEN** the callback receives an error parameter or the code exchange fails
- **THEN** the backend redirects the user to the frontend with an error indicator

#### Scenario: Login endpoint called in service_account mode
- **WHEN** `GET /api/v1/gcal/auth/login` is called in `service_account` mode
- **THEN** the endpoint returns `400` with body `{ "detail": "OAuth2 login not available in service_account mode" }`

### Requirement: Google Calendar auth status

The system SHALL expose `GET /api/v1/gcal/auth/status` which returns the current authentication state.

#### Scenario: OAuth2 mode — authenticated
- **WHEN** running in `oauth2` mode and valid tokens are stored
- **THEN** response SHALL be `{ "configured": true, "authenticated": true, "mode": "oauth2" }`

#### Scenario: OAuth2 mode — not authenticated
- **WHEN** running in `oauth2` mode but no tokens are stored
- **THEN** response SHALL be `{ "configured": true, "authenticated": false, "mode": "oauth2" }`

#### Scenario: Service account mode
- **WHEN** running in `service_account` mode with valid configuration
- **THEN** response SHALL be `{ "configured": true, "authenticated": true, "mode": "service_account" }`

#### Scenario: Not configured
- **WHEN** Google Calendar integration is disabled
- **THEN** response SHALL be `{ "configured": false, "authenticated": false, "mode": null }`

### Requirement: List calendar events

The system SHALL expose `GET /api/v1/gcal/events` which returns calendar events from all accessible calendars. The endpoint accepts the following query parameters:
- `date` (required) — the reference date (ISO 8601 format)
- `view` (optional, default `daily`) — either `daily` or `weekly`

When `view=daily`, the endpoint returns events for the specified date. When `view=weekly`, it returns events for the full week containing the specified date. Events SHALL be grouped by calendar, and each calendar group SHALL include the calendar name and color. Each event SHALL include at minimum: `id`, `summary`, `start`, `end`, `calendar_name`, and `calendar_color`.

#### Scenario: Daily view
- **WHEN** a user calls `GET /api/v1/gcal/events?date=2026-04-03&view=daily`
- **THEN** the backend returns events from all calendars for 2026-04-03, grouped by calendar with color metadata

#### Scenario: Weekly view
- **WHEN** a user calls `GET /api/v1/gcal/events?date=2026-04-03&view=weekly`
- **THEN** the backend returns events from all calendars for the full week containing 2026-04-03

#### Scenario: Not authenticated
- **WHEN** the endpoint is called but Google Calendar is not authenticated (OAuth2 mode, no tokens)
- **THEN** the endpoint returns `401` with body `{ "detail": "Google Calendar authentication required" }`

#### Scenario: Google API error
- **WHEN** the Google Calendar API returns an error
- **THEN** the endpoint returns `502 Bad Gateway` with a descriptive error message

### Requirement: Google Calendar agenda browser in task creation UI

The task creation form's source selector SHALL include a "Google Calendar" option (when the integration is configured and authenticated). When selected, the form SHALL display an agenda view showing events from all calendars. The agenda view SHALL support:
- A **daily / weekly** view toggle
- A **date navigator** allowing the user to browse to any date

Selecting an event SHALL pre-fill the task title with the event summary and pre-select the event's date in the dates picker. The `jira_ticket_id` SHALL remain null. The user SHALL still be able to modify type and dates before submitting.

#### Scenario: User selects a calendar event to import
- **WHEN** the user switches to Google Calendar mode in the create form
- **AND** selects an event with summary "Sprint Planning" on 2026-04-03
- **THEN** the title field is pre-filled with "Sprint Planning"
- **AND** 2026-04-03 is pre-selected in the dates picker
- **AND** `jira_ticket_id` remains null
- **AND** the user can still edit type and dates before creating the task

#### Scenario: User navigates dates in agenda
- **WHEN** the user is in Google Calendar mode
- **AND** changes the date via the date navigator
- **THEN** the agenda view refreshes to show events for the new date (or week, depending on view toggle)

#### Scenario: Google Calendar not configured — mode hidden
- **WHEN** `GET /api/v1/gcal/auth/status` returns `{ "configured": false }`
- **THEN** the Google Calendar option SHALL NOT appear in the source selector

#### Scenario: Google Calendar not authenticated — login prompt
- **WHEN** `GET /api/v1/gcal/auth/status` returns `{ "configured": true, "authenticated": false, "mode": "oauth2" }`
- **AND** the user selects the Google Calendar source
- **THEN** the form SHALL display a "Login with Google" button instead of the agenda view
