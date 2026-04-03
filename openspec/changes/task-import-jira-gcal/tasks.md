## 1. Backend — Configuration & Dependencies

- [ ] 1.1 Add `jira`, `google-auth-oauthlib`, `google-api-python-client`, `google-auth` to `pyproject.toml` and run `uv sync`
- [ ] 1.2 Extend `Settings` in `config.py` with JIRA fields (`jira_project_url`, `jira_api_key`, `jira_user_email`, `jira_jql`) — all optional, empty defaults
- [ ] 1.3 Extend `Settings` with Google Calendar fields (`google_auth_mode`, `google_client_id`, `google_client_secret`, `google_redirect_uri`, `google_service_account_key_path`, `google_delegated_user_email`) — all optional

## 2. Backend — JIRA Integration

- [ ] 2.1 Create `app/services/jira_client.py` — wrapper around the `jira` library: init from Settings, `search_tickets(jql)` method returning normalized ticket dicts (`key`, `summary`, `status`, `url`)
- [ ] 2.2 Create `app/routes/jira.py` with `GET /jira/config` endpoint returning `{ configured, projectUrl }`
- [ ] 2.3 Add `GET /jira/tickets` endpoint — calls jira_client search, queries DB for non-done tasks with `jira_ticket_id`, filters out duplicates, returns filtered list
- [ ] 2.4 Register JIRA router in `main.py` under `/api/v1`
- [ ] 2.5 Write tests for JIRA routes (configured/unconfigured, duplicate filtering, API error handling)

## 3. Backend — Google Calendar Integration

- [ ] 3.1 Create `app/services/gcal_client.py` — factory that returns an OAuth2 or service-account backed Google Calendar API client based on `GOOGLE_AUTH_MODE`
- [ ] 3.2 Implement OAuth2 flow: `get_auth_url()`, `handle_callback(code)` storing tokens in-memory, `is_authenticated()` check
- [ ] 3.3 Implement service account flow: build credentials with domain-wide delegation from key file and delegated user email
- [ ] 3.4 Implement `list_events(date, view)` — queries all calendars, returns events grouped by calendar with `id`, `summary`, `start`, `end`, `calendar_name`, `calendar_color`
- [ ] 3.5 Create `app/routes/gcal.py` with `GET /gcal/auth/status`, `GET /gcal/auth/login`, `GET /gcal/auth/callback`, `GET /gcal/events` endpoints
- [ ] 3.6 Register Google Calendar router in `main.py` under `/api/v1`
- [ ] 3.7 Write tests for Google Calendar routes (both auth modes, not configured, not authenticated, event listing)

## 4. Frontend — API Client

- [ ] 4.1 Add `getJiraConfig()`, `listJiraTickets()` functions to `api/client.ts`
- [ ] 4.2 Add `getGcalAuthStatus()`, `getGcalAuthLoginUrl()`, `listGcalEvents(date, view)` functions to `api/client.ts`
- [ ] 4.3 Add TypeScript interfaces for JIRA ticket and Google Calendar event response shapes

## 5. Frontend — Task Creation Import Flow

- [ ] 5.1 Add source selector (Manual / JIRA / Google Calendar) to the create task overlay in `TaskBoard.tsx`
- [ ] 5.2 Conditionally show/hide JIRA and Google Calendar options based on their config/auth status (fetch on mount)
- [ ] 5.3 Implement JIRA import mode — fetch and display ticket list, on select pre-fill title and `jira_ticket_id`
- [ ] 5.4 Implement Google Calendar import mode — agenda view with daily/weekly toggle and date navigator
- [ ] 5.5 On event select, pre-fill title with event summary and pre-select event date in dates picker
- [ ] 5.6 For OAuth2 mode when not authenticated, show "Login with Google" button that opens the login redirect

## 6. Frontend — JIRA Deep-Link on TaskCard

- [ ] 6.1 Create a JIRA icon SVG component
- [ ] 6.2 In `TaskCard`, render the clickable JIRA icon when `jira_ticket_id` is set — links to `{projectUrl}/browse/{jira_ticket_id}`, opens in new tab
- [ ] 6.3 Fetch JIRA config once (TanStack Query with long stale time) to get `projectUrl` for deep links

## 7. Helm & Infrastructure

- [ ] 7.1 Add JIRA config fields to `backend-configmap.yaml` and JIRA API key to `backend-secret.yaml`
- [ ] 7.2 Add Google Calendar config fields to `backend-configmap.yaml` and secrets (OAuth client secret, service account key) to `backend-secret.yaml`
- [ ] 7.3 Update `values.yaml` with new `backend.config` and `backend.secrets` entries for all JIRA and Google fields
- [ ] 7.4 Add optional volume mount for Google service account key file in `backend-deployment.yaml`
- [ ] 7.5 Add `/api/v1/gcal/auth/callback` route to the HTTPRoute if needed for OAuth2 redirect

## 8. Testing & Validation

- [ ] 8.1 Backend integration tests: JIRA ticket listing with duplicate filtering end-to-end
- [ ] 8.2 Backend integration tests: Google Calendar event listing for both auth modes
- [ ] 8.3 Frontend component tests: source selector visibility, JIRA import pre-fill, Google Calendar agenda navigation
- [ ] 8.4 E2E test: create a task from JIRA import flow (mocked JIRA API)
- [ ] 8.5 E2E test: create a task from Google Calendar import flow (mocked Google API)
