## 1. Backend — Configuration & Dependencies

- [x] 1.1 Add `jira>=3.10.5`, `google-auth>=2.49.1`, `google-auth-oauthlib>=1.3.1`, `google-api-python-client>=2.193.0` to `pyproject.toml` and run `uv sync`
- [x] 1.2 Create dedicated `JiraConfig` and `GoogleCalendarConfig` Pydantic BaseModel classes with `configured` properties
- [x] 1.3 Extend `Settings` with JIRA fields (`jira_project_url`, `jira_api_key`, `jira_user_email`, `jira_jql`) — all optional, empty defaults
- [x] 1.4 Extend `Settings` with Google Calendar fields (`google_auth_mode`, `google_project_id`, `google_client_id`, `google_client_secret`, `google_auth_uri`, `google_token_uri`, `google_auth_provider_x509_cert_url`, `google_redirect_uri`, `google_calendar_email`, `google_service_account_key_path`, `google_delegated_user_email`) — all optional
- [x] 1.5 Add `client_config` property to `GoogleCalendarConfig` returning `installed` client type dict with `redirect_uris`

## 2. Backend — Task Model Refactor

- [x] 2.1 Add `SourceType` enum (`jira`, `gcal`) to `app/models/enums.py`
- [x] 2.2 Replace `jira_ticket_id` with `source_type` (SourceType, nullable) and `source_id` (String(255), nullable) on `Task` model
- [x] 2.3 Update `TaskCreate`, `TaskUpdate`, `TaskResponse` schemas to use `source_type`/`source_id`
- [x] 2.4 Create Alembic migration with data migration (existing `jira_ticket_id` → `source_type='jira'` + `source_id`)

## 3. Backend — JIRA Integration

- [x] 3.1 Create `app/services/jira_client.py` — `JiraClient` and `JiraTicket` BaseModels; `search_tickets()` and `get_ticket(key)` methods returning tickets with `key`, `summary`, `status`, `assignee`, `priority`, `description`, `url`
- [x] 3.2 Create `app/routes/jira.py` with `GET /jira/config`, `GET /jira/tickets` (filtered), `GET /jira/ticket?key=` (single) endpoints
- [x] 3.3 Duplicate filtering: query `source_type='jira'` + non-done tasks, exclude matching `source_id` values
- [x] 3.4 Register JIRA router in `main.py` under `/api/v1`
- [x] 3.5 Write tests for JIRA routes (configured/unconfigured, duplicate filtering, done task re-import, API error)

## 4. Backend — Google Calendar Integration

- [x] 4.1 Create `app/services/gcal_client.py` — `GCalClient` BaseModel with `PrivateAttr` for credentials and flow
- [x] 4.2 Implement PKCE-compatible OAuth2 flow: reuse same `Flow` instance between `get_auth_url()` and `handle_callback()`, broad scopes
- [x] 4.3 Implement service account flow with domain-wide delegation
- [x] 4.4 Implement `is_authenticated()` with auto-refresh for expired tokens
- [x] 4.5 Implement `list_events(date, view)` — timezone-aware via user's primary calendar, events include `description`, `location`, `attendees`, `attachments`, `html_link`
- [x] 4.6 Implement `get_event(event_id)` — search across all calendars
- [x] 4.7 Create `app/routes/gcal.py` with auth/status (incl. `calendarEmail`), auth/login, auth/callback (with error detail in redirect), auth/debug, events list, event single endpoints
- [x] 4.8 Register Google Calendar router in `main.py` under `/api/v1`
- [x] 4.9 Write tests for Google Calendar routes (both auth modes, not configured, not authenticated, event listing)

## 5. Frontend — API Client

- [x] 5.1 Add `SourceType` type, update `Task` interface to use `source_type`/`source_id`
- [x] 5.2 Add `getJiraConfig()`, `listJiraTickets()`, `getJiraTicket(key)` functions
- [x] 5.3 Add `getGcalAuthStatus()` (with `calendarEmail`), `getGcalAuthLoginUrl()`, `listGcalEvents()`, `getGcalEvent(eventId)` functions
- [x] 5.4 Add TypeScript interfaces: `JiraTicket` (with assignee/priority/description), `CalendarEvent` (with description/location/attendees/attachments/html_link), `EventAttendee`, `EventAttachment`, `GCalAuthStatus`, `CalendarGroup`

## 6. Frontend — Task Creation Import Flow

- [x] 6.1 Add source selector tabs (Manual / JIRA / Google Calendar) — conditionally visible based on config/auth status
- [x] 6.2 JIRA import mode: search bar, project dropdown filter, ticket cards sorted by project→status→priority, done/closed filtered out
- [x] 6.3 JIRA ticket cards: clickable key, colored status badge, colored priority badge, title, assignee, toolbar (details/fullscreen/select icons)
- [x] 6.4 JIRA wiki markup parser: headings, bullet/ordered lists (nested), bold, italic, inline code, code blocks, links
- [x] 6.5 Google Calendar import mode: timeline view with date headers, events sorted chronologically, calendar color bars
- [x] 6.6 GCal event cards: time range, calendar name, title, location, toolbar (details/fullscreen/select icons)
- [x] 6.7 GCal HTML descriptions rendered directly with styled links/bold
- [x] 6.8 GCal expandable details: attendees with RSVP status colors, file attachments with Drive icons
- [x] 6.9 Multi-select: checkmark icon toggles selection (cyan filled state), "Confirm selection" bar below list
- [x] 6.10 On confirm → manual mode with pending items list (editable task type per item, removable), shared dates, "Create N tasks" batch button
- [x] 6.11 Manual mode supports adding multiple tasks via "+ Add to list" without import
- [x] 6.12 Fullscreen modal for both JIRA tickets and GCal events (with import button and source link)
- [x] 6.13 OAuth2 login: "Login with Google" button when not authenticated

## 7. Frontend — Source Icons on TaskCard

- [x] 7.1 Official Jira logo SVG (20x20) — clickable, links to `{projectUrl}/browse/{sourceId}`
- [x] 7.2 Multi-color Google Calendar icon (20x20) — clickable, links to `https://www.google.com/calendar/event?eid=base64(sourceId + " " + calendarEmail)`
- [x] 7.3 Expand icon (≡) in card footer for tasks with source — fetches details on demand, opens fullscreen modal
- [x] 7.4 GCal expand: checks auth first, redirects to Google login if not authenticated
- [x] 7.5 Edit form: label adapts to source type ("Event ID" for GCal, "JIRA Ticket" for JIRA), GCal field disabled

## 8. Helm & Infrastructure

- [x] 8.1 Add JIRA config fields to `backend-configmap.yaml` (project URL, user email, JQL)
- [x] 8.2 Add Google Calendar config fields to `backend-configmap.yaml` (auth mode, redirect URI, calendar email, service account path, delegated user)
- [x] 8.3 Secrets managed via `secrets/backend-secret.yaml` (gitignored) with `kubectl apply` in Makefile
- [x] 8.4 `secrets/backend-secret.example.yaml` template with JIRA_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_PROJECT_ID, GOOGLE_AUTH_URI, GOOGLE_TOKEN_URI, GOOGLE_AUTH_PROVIDER_X509_CERT_URL
- [x] 8.5 Update `values.yaml` with all new config entries
- [x] 8.6 Optional volume mount for Google service account key file in `backend-deployment.yaml`
- [x] 8.7 Backend secret ref set to `optional: true` in deployment
- [x] 8.8 CLAUDE.md: forbidden files rule for `secrets/backend-secret.yaml`

## 9. Testing & Validation

- [x] 9.1 Backend unit tests: JIRA routes (6 tests) — config, tickets, duplicate filtering, done re-import, API error
- [x] 9.2 Backend unit tests: GCal routes (9 tests) — auth status, login, events
- [x] 9.3 Backend integration tests: JIRA duplicate filtering end-to-end, GCal event listing both modes
- [x] 9.4 Frontend component tests: TaskCard with source types, JIRA deep-link, GCal badge (81 tests passing)
- [x] 9.5 E2E tests: JIRA import flow and GCal import flow with mocked APIs
