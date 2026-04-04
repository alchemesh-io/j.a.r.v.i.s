## Why

J.A.R.V.I.S currently requires manual entry for every task. Users already track work in JIRA and schedule meetings in Google Calendar — forcing them to re-type this information creates friction and slows down daily planning. By allowing direct import from JIRA tickets and Google Calendar events, task creation becomes a selection rather than a transcription.

## What Changes

- **JIRA integration**: Backend accepts JIRA configuration (project URL, API key, JQL filter) and exposes endpoints to list/fetch JIRA tickets with full details (key, summary, status, assignee, priority, description). Users can browse a searchable, filterable list, select one or multiple tickets, and create tasks. Tickets already referenced by a non-done task are filtered out. Tasks linked to JIRA show the official Jira logo icon linking to the ticket.
- **Google Calendar integration**: Backend supports two authentication modes:
  1. **Personal OAuth2** (`installed` client type with PKCE) — redirect flow with broad scopes for future extensibility.
  2. **Google Workspace (service account)** — domain-wide delegation, no interactive login needed.
  
  Once authenticated, endpoints list calendar events (timezone-aware) and fetch individual event details including description (HTML), attendees with RSVP status, and Drive file attachments. Users can browse a chronological timeline, select one or multiple events, and create tasks. Tasks linked to GCal show a calendar icon linking to the event.
- **Generic source tracking**: The Task model uses `source_type` (jira/gcal enum) + `source_id` instead of JIRA-specific `jira_ticket_id`, enabling the same pattern for any future source.
- **Multi-select batch creation**: Users can select multiple JIRA tickets or GCal events, confirm the selection, review all items in manual mode (with per-item type editing and shared dates), then batch-create all tasks at once.
- **Source details on task board**: Tasks with a source show an expand icon that fetches the original JIRA ticket or GCal event details and displays them in a fullscreen modal — the same view used during import.
- **Secrets management**: Sensitive config stored in a local gitignored K8s Secret manifest, applied via `kubectl apply` in the Makefile deploy targets.

## Capabilities

### New Capabilities

- `jira-integration`: JIRA API connectivity via `jira` library v3.10.5. Ticket listing with JQL filtering, duplicate detection, single ticket fetch. JIRA wiki markup rendering (headings, lists, bold, italic, code, links). Deep-link on task cards.
- `gcal-integration`: Google Calendar connectivity with two auth modes. PKCE OAuth2 flow with in-memory token storage and auto-refresh. Timezone-aware event listing. Event details with HTML descriptions, attendees, attachments. Deep-link on task cards via `eid` URL format.
- `multi-select-import`: Batch selection from any source with confirm→review→create workflow. Shared dates across all items. Manual mode also supports adding multiple tasks.

### Modified Capabilities

- `task-management-api`: Task model now uses generic `source_type`/`source_id` instead of `jira_ticket_id`. Alembic migration with data migration for existing rows.

## Impact

- **Backend**: New `JiraConfig`, `GoogleCalendarConfig` Pydantic models. New route modules for `/api/v1/jira/` and `/api/v1/gcal/`. New `SourceType` enum and Task model migration. Dependencies: `jira>=3.10.5`, `google-auth>=2.49.1`, `google-auth-oauthlib>=1.3.1`, `google-api-python-client>=2.193.0`.
- **Frontend**: Source selector with multi-select in task creation. JIRA search/filter/card UI with wiki markup parser. GCal timeline with HTML descriptions and attendee list. Batch creation flow. Source icons and expand-to-fullscreen on TaskCard.
- **Helm/Infra**: Backend ConfigMap updated with JIRA + Google fields. Secrets via local `secrets/backend-secret.yaml` + `kubectl apply`. Optional volume mount for service account key. `CLAUDE.md` rule to never read secret file.
- **MCP Server**: No changes required.
