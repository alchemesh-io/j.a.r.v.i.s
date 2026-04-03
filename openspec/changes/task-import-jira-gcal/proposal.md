## Why

J.A.R.V.I.S currently requires manual entry for every task. Users already track work in JIRA and schedule meetings in Google Calendar — forcing them to re-type this information creates friction and slows down daily planning. By allowing direct import from JIRA tickets and Google Calendar events, task creation becomes a selection rather than a transcription.

## What Changes

- **JIRA integration**: Backend accepts JIRA configuration (project URL, API key, JQL filter) and exposes an endpoint to list matching JIRA tickets. Users can select a ticket to auto-create a task with the correct title and `jira_ticket_id`. Tickets already referenced by a non-done task are filtered out. The frontend shows a clickable JIRA icon on tasks that have a linked ticket.
- **Google Calendar integration**: Backend supports two authentication modes for Google Calendar:
  1. **Personal OAuth2** — "Login with Google" redirect flow for individual Google accounts.
  2. **Google Workspace (service account)** — a service account with domain-wide delegation connects on behalf of a Workspace user, requiring no interactive login. Configured via a service account JSON key and target user email.
  
  Once authenticated (either mode), an endpoint lists upcoming calendar events. Users can select an event to auto-create a task (without a JIRA link).
- **Task creation UI**: The "new task" flow gains an import mode where users choose a source (JIRA or Google Calendar), browse available items, and select one to populate the task form.

## Capabilities

### New Capabilities

- `jira-integration`: JIRA API connectivity, ticket listing with JQL filtering, duplicate detection against existing non-done tasks, and JIRA deep-link on task cards.
- `gcal-integration`: Google Calendar connectivity with two auth modes (personal OAuth2 and Google Workspace service account), calendar event listing, and event-to-task mapping.

### Modified Capabilities

_(none — the existing `task-management-api` spec is not changing its requirements; the new integrations feed into the existing task creation flow)_

## Impact

- **Backend**: New configuration fields in `Settings` (JIRA URL, API key, JQL; Google OAuth client ID/secret; Google service account key path and impersonated user email). New route modules for `/api/v1/jira/` and `/api/v1/gcal/`. New dependencies: `jira` Python library, `google-auth-oauthlib` + `google-api-python-client` + `google-auth`.
- **Frontend**: New import-from-source UI in the task creation flow. New API client functions for JIRA and Google Calendar endpoints. JIRA icon component on `TaskCard`.
- **Helm/Infra**: Backend ConfigMap and Secret updated with JIRA credentials, Google OAuth credentials, and optionally a Google service account key (mounted as a Secret volume). Possible new callback route for OAuth2 redirect.
- **MCP Server**: No changes required — MCP creates tasks via the existing REST API, which remains unchanged.
