## Context

J.A.R.V.I.S already has a task creation flow: an inline overlay form in `TaskBoard.tsx` that accepts a title, optional JIRA ticket ID (manually typed), task type, and dates. The backend `Task` model already stores `jira_ticket_id`. Configuration lives in `Settings` (Pydantic BaseSettings, env-driven) and Helm values expose `backend.config` / `backend.secrets`.

This design adds two external integrations (JIRA REST API, Google Calendar API) so users can **browse and select** items rather than manually typing them.

## Goals / Non-Goals

**Goals:**

- Let users import a task from a JIRA ticket by browsing a pre-filtered list
- Let users import a task from a Google Calendar event by browsing upcoming events
- Support two Google auth modes: personal OAuth2 and Google Workspace service account
- Filter out JIRA tickets that already have a non-done task referencing them
- Show a clickable JIRA icon on tasks that have a linked ticket

**Non-Goals:**

- Bi-directional sync (updating JIRA ticket status when a J.A.R.V.I.S task moves to done)
- Google Calendar event creation from J.A.R.V.I.S
- Caching or persisting external data — every browse hits the live API
- Supporting multiple JIRA projects or multiple Google accounts simultaneously

## Decisions

### D1 — Backend-mediated integration (no direct frontend-to-external calls)

The frontend calls J.A.R.V.I.S backend endpoints, which proxy requests to JIRA and Google Calendar. This keeps API keys and tokens server-side, avoids CORS issues, and gives a single place for filtering logic.

**Alternative considered:** Frontend calling JIRA/Google APIs directly. Rejected because it exposes credentials and duplicates filtering logic.

### D2 — JIRA integration via the `jira` Python library

Use the [`jira`](https://pypi.org/project/jira/) library, which provides a mature, well-tested client for the JIRA Cloud REST API. It handles authentication, pagination, and field mapping out of the box — no need to hand-roll REST calls, parse responses, or manage edge cases.

**Alternative considered:** Raw `httpx` calls to `/rest/api/3/search`. Rejected — would require reimplementing pagination, error handling, and field normalization that `jira` already provides.

### D3 — Google Calendar auth mode selected at deploy time (not runtime)

A `GOOGLE_AUTH_MODE` setting (`oauth2` or `service_account`) determines which flow is active. Only one mode is active per deployment. This simplifies the backend — no need to manage both flows simultaneously.

- **`oauth2` mode**: Requires `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`. The frontend triggers a redirect to Google's consent screen; the backend handles the callback and stores tokens in-memory (single-user system).
- **`service_account` mode**: Requires `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` and `GOOGLE_DELEGATED_USER_EMAIL`. No interactive login needed — the backend uses domain-wide delegation to access the user's calendar.

**Alternative considered:** Runtime switching between modes. Rejected — adds UI complexity for no practical gain since a deployment targets one user/org.

### D4 — New route modules under `/api/v1/jira/` and `/api/v1/gcal/`

```
/api/v1/jira/tickets          GET   → list matching JIRA tickets (filtered)
/api/v1/jira/config            GET   → returns { configured: bool, projectUrl: string }

/api/v1/gcal/auth/status       GET   → { authenticated: bool, mode: "oauth2"|"service_account" }
/api/v1/gcal/auth/login        GET   → redirect to Google consent (oauth2 mode only)
/api/v1/gcal/auth/callback     GET   → OAuth2 callback (oauth2 mode only)
/api/v1/gcal/events            GET   → list upcoming calendar events
```

These are read-only browse endpoints. The actual task creation still uses the existing `POST /api/v1/tasks` — the frontend just pre-fills the form from the selected item.

### D5 — JIRA duplicate filtering happens server-side

When listing JIRA tickets, the backend queries existing non-done tasks that have a `jira_ticket_id`, collects those IDs, and excludes them from the JIRA response. This keeps the filtering logic in one place and avoids shipping the full task list to the frontend.

### D6 — Frontend import flow as a tab/mode in the existing create form

The existing create overlay gains a source selector (Manual / JIRA / Google Calendar) at the top. Selecting JIRA or Google Calendar shows a searchable list; selecting an item pre-fills the task title and (for JIRA) the ticket ID. The user can still adjust type and dates before creating.

**Alternative considered:** Separate modal for import. Rejected — the create form already has all the needed fields; adding a source toggle is simpler and avoids duplicate UI.

### D7 — JIRA deep-link icon on TaskCard

When `jira_ticket_id` is set on a task, the `TaskCard` component renders a small JIRA icon (SVG) that links to `{JIRA_PROJECT_URL}/browse/{jira_ticket_id}`. The JIRA project URL is exposed via a new `GET /api/v1/jira/config` endpoint so the frontend doesn't need to know the URL at build time.

### D8 — Google Calendar agenda browser and event-to-task mapping

The Google Calendar import mode renders an agenda view (similar to Google Calendar's own agenda) showing events from all calendars. The user can:
- Toggle between **daily** and **weekly** view
- Navigate to any date via a date picker

Selecting an event maps it to a task:
- `title` ← event summary
- `type` ← defaults to `refinement` (meetings are typically refinement/review), user can change
- `jira_ticket_id` ← `null` (no JIRA link)
- The event's date is pre-selected in the dates picker

The `/api/v1/gcal/events` endpoint accepts `date`, `view` (`daily` | `weekly`) query params and returns events from all accessible calendars, grouped by calendar with color metadata.

## Risks / Trade-offs

**[JIRA API rate limits]** → The JIRA Cloud REST API has rate limits. Mitigation: each browse triggers a single search call; no polling or batch operations. For heavy JQL queries, the admin-configured JQL filter keeps result sets small.

**[OAuth2 token storage in-memory]** → In `oauth2` mode, the Google access/refresh token is stored in-memory. A backend restart loses it, requiring re-login. → Acceptable for a single-user local/dev deployment. If persistence is needed later, tokens can be stored in the SQLite DB.

**[Service account requires domain-wide delegation setup]** → Google Workspace mode requires a GCP admin to configure domain-wide delegation for the service account. → Document the setup steps clearly. This is a one-time admin action.

**[Single Google auth mode per deployment]** → Users can't switch between personal and Workspace accounts without redeploying. → Acceptable trade-off for simplicity. The target user knows their auth mode at deploy time.

## Migration Plan

1. **Backend**: Add new Settings fields with empty defaults (all integrations disabled when unconfigured). Add new route modules. Run `alembic upgrade` — no schema changes needed (Task model already has `jira_ticket_id`).
2. **Frontend**: Add source selector to create form, JIRA icon to TaskCard, Google auth status indicator.
3. **Helm**: Add new config/secret values for JIRA and Google. Existing deployments continue working — all new fields are optional.
4. **Rollback**: Remove the new route modules and frontend components. No database migration needed.

## Open Questions

- ~~Should the Google Calendar event list show all calendars or only the primary one?~~ **Resolved:** Show all calendars (like Google's own agenda). The event browser renders as an agenda view with daily and weekly toggle, and a date navigator so the user can browse to any date — not just "upcoming events".
- Should we add a TaskType value for "meeting" to distinguish calendar-imported tasks? (Deferred — current types suffice for now.)
