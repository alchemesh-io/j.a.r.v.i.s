## Context

J.A.R.V.I.S already has a task creation flow: an inline overlay form in `TaskBoard.tsx` that accepts a title, task type, and dates. The backend `Task` model uses generic `source_type` and `source_id` fields to track where a task was imported from. Configuration lives in `Settings` (Pydantic BaseSettings, env-driven) with dedicated `JiraConfig` and `GoogleCalendarConfig` models. Helm values expose `backend.config` / `backend.secrets`, and secrets are managed via a local gitignored file applied with `kubectl apply`.

This design adds two external integrations (JIRA REST API, Google Calendar API) so users can **browse and select** items rather than manually typing them. It also supports **batch selection** — picking multiple items at once and creating them as separate tasks with shared dates.

## Goals / Non-Goals

**Goals:**

- Let users import tasks from JIRA tickets by browsing a filtered, searchable list
- Let users import tasks from Google Calendar events by browsing a timeline view
- Support two Google auth modes: personal OAuth2 (`installed` client type) and Google Workspace service account
- Filter out JIRA tickets that already have a non-done task referencing them
- Show clickable JIRA and Google Calendar icons on tasks linked to external sources
- Support multi-select: pick multiple JIRA tickets or GCal events, confirm selection, review in manual mode with shared dates, batch-create
- Show source details (JIRA description, GCal attendees/attachments) via fullscreen modal from both import form and task board
- Broad Google OAuth2 scopes for future extensibility (calendar, drive, sheets, docs, gmail, presentations, cloud-platform)

**Non-Goals:**

- Bi-directional sync (updating JIRA ticket status when a J.A.R.V.I.S task moves to done)
- Google Calendar event creation from J.A.R.V.I.S
- Caching or persisting external data — every browse hits the live API
- Supporting multiple JIRA projects or multiple Google accounts simultaneously

## Decisions

### D1 — Backend-mediated integration (no direct frontend-to-external calls)

The frontend calls J.A.R.V.I.S backend endpoints, which proxy requests to JIRA and Google Calendar. This keeps API keys and tokens server-side, avoids CORS issues, and gives a single place for filtering logic.

### D2 — JIRA integration via the `jira` Python library (v3.10.5)

Use the `jira` library for JIRA Cloud REST API. Ticket responses include `key`, `summary`, `status`, `assignee`, `priority`, `description`, and `url`.

### D3 — Google Calendar auth mode selected at deploy time (not runtime)

A `GOOGLE_AUTH_MODE` setting (`oauth2` or `service_account`) determines which flow is active. Only one mode is active per deployment.

- **`oauth2` mode** (client type `installed`): Uses `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, plus `GOOGLE_PROJECT_ID`, `GOOGLE_AUTH_URI`, `GOOGLE_TOKEN_URI`, `GOOGLE_AUTH_PROVIDER_X509_CERT_URL` from the downloaded client secret JSON. Tokens stored in-memory via PKCE flow (same `Flow` instance reused between auth URL generation and callback to preserve `code_verifier`).
- **`service_account` mode**: Uses `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` and `GOOGLE_DELEGATED_USER_EMAIL`.
- **`GOOGLE_CALENDAR_EMAIL`**: The user's Google Calendar email, used by the frontend to construct `eid`-based Google Calendar event URLs (`https://www.google.com/calendar/event?eid=base64(eventId + " " + calendarEmail)`).

### D4 — Generic source tracking on Task model

Instead of JIRA-specific `jira_ticket_id`, the Task model uses:
- `source_type` — enum: `jira` or `gcal`
- `source_id` — the external identifier (JIRA ticket key or Google Calendar event ID)

This allows the same task-linking pattern for any future source.

### D5 — API endpoints use query params for IDs with special characters

Single-item fetch endpoints use query params instead of path params to avoid issues with colons and other special characters in JIRA keys and GCal event IDs:
- `GET /api/v1/jira/ticket?key=JAR-42`
- `GET /api/v1/gcal/event?event_id=abc123`

### D6 — Route modules under `/api/v1/jira/` and `/api/v1/gcal/`

```
/api/v1/jira/config            GET   → { configured, projectUrl }
/api/v1/jira/tickets           GET   → list matching JIRA tickets (filtered, with assignee/priority/description)
/api/v1/jira/ticket?key=       GET   → single ticket details

/api/v1/gcal/auth/status       GET   → { configured, authenticated, mode, calendarEmail }
/api/v1/gcal/auth/login        GET   → redirect to Google consent (oauth2 mode only)
/api/v1/gcal/auth/callback     GET   → OAuth2 callback (oauth2 mode only)
/api/v1/gcal/auth/debug        GET   → debug config state (non-secret fields)
/api/v1/gcal/events            GET   → list calendar events (timezone-aware via user's primary calendar)
/api/v1/gcal/event?event_id=   GET   → single event details
```

### D7 — JIRA duplicate filtering happens server-side

When listing JIRA tickets, the backend queries existing non-done tasks where `source_type = 'jira'`, collects those `source_id` values, and excludes them from the response. Done/closed tickets are also filtered out in the frontend.

### D8 — Frontend import flow with multi-select and batch creation

The create overlay gains a source selector (Manual / JIRA / Google Calendar). Import modes support:

- **Search and filter**: JIRA list has a search bar and project dropdown filter
- **Multi-select**: Checkmark icon on each item toggles selection (fills cyan when selected). "Confirm selection" bar appears below the list.
- **Manual mode with batch**: On confirm, selected items appear as editable pending items. Each item's task type can be changed via dropdown. Items can be removed individually. "Add to list" button allows adding more manual tasks. Dates are shared across all pending items. "Create N tasks" button batch-creates everything.
- **Single select**: Clicking details→fullscreen→import or direct checkmark on a single item also works.

### D9 — JIRA ticket card rendering

Each JIRA ticket in the import list renders as a card with:
- Ticket key (clickable link to JIRA), colored status badge, colored priority badge
- Title, assignee
- Toolbar: details icon (expandable description), fullscreen icon, select/checkmark icon
- JIRA wiki markup parser for descriptions (headings, bullet/ordered lists, bold, italic, inline code, code blocks, links)

### D10 — Google Calendar timeline rendering

GCal events render in a chronological timeline with:
- Date headers for day boundaries
- Color bar per calendar, time range, calendar name
- Toolbar: details icon, fullscreen icon, select/checkmark icon
- Expandable details: HTML description, guest list with RSVP status, file attachments with icons
- Timezone-aware queries using the user's primary calendar timezone

### D11 — Source icons on TaskCard

- **JIRA**: Official Jira logo SVG (20x20), clickable → `{projectUrl}/browse/{sourceId}`
- **Google Calendar**: Multi-color calendar icon (20x20), clickable → `https://www.google.com/calendar/event?eid=base64(sourceId + " " + calendarEmail)`
- **Expand icon** (≡) in footer: fetches source details on demand and opens fullscreen modal; for GCal, redirects to Google login if not authenticated

### D12 — Secrets management

Secrets stored in `secrets/backend-secret.yaml` (gitignored, with `.example.yaml` template). Applied via `kubectl apply` in `make deploy`/`deploy-local`. Includes `JIRA_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_PROJECT_ID`, `GOOGLE_AUTH_URI`, `GOOGLE_TOKEN_URI`, `GOOGLE_AUTH_PROVIDER_X509_CERT_URL`. `CLAUDE.md` has explicit rule to never read the secret file.

## Risks / Trade-offs

**[OAuth2 token storage in-memory]** → In `oauth2` mode, the Google access/refresh token is stored in-memory. A backend restart loses it, requiring re-login. → Acceptable for a single-user local/dev deployment.

**[PKCE flow requires same Flow instance]** → The `installed` client type uses PKCE. The `code_verifier` generated during `authorization_url()` must be available during `fetch_token()`. Solved by persisting the `Flow` instance on `GCalClient` via Pydantic `PrivateAttr`.

**[Single Google auth mode per deployment]** → Users can't switch between personal and Workspace accounts without redeploying. → Acceptable trade-off for simplicity.

## Migration Plan

1. **Backend**: Alembic migration replaces `jira_ticket_id` with `source_type` + `source_id` (with data migration for existing rows). New Settings fields with empty defaults (all integrations disabled when unconfigured).
2. **Frontend**: Source selector, multi-select flow, batch creation, source icons on TaskCard.
3. **Helm**: ConfigMap and values updated with JIRA + Google fields. Secrets via local file + `kubectl apply`.
4. **Rollback**: Remove new route modules and frontend components. Run downgrade migration to restore `jira_ticket_id`.
