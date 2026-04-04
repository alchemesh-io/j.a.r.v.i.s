## ADDED Requirements

### Requirement: JIRA backend configuration

The backend SHALL accept the following environment-based configuration for JIRA connectivity:
- `JIRA_PROJECT_URL` — base URL of the JIRA instance (e.g., `https://myorg.atlassian.net`)
- `JIRA_API_KEY` — API token for authentication (stored in secrets)
- `JIRA_USER_EMAIL` — email of the JIRA user associated with the API key
- `JIRA_JQL` — JQL query string used to pre-filter tickets

Configuration is modeled via dedicated `JiraConfig` Pydantic BaseModel with a `configured` property. All fields are optional. When any required field is missing, the JIRA integration SHALL be disabled.

#### Scenario: JIRA fully configured
- **WHEN** `JIRA_PROJECT_URL`, `JIRA_API_KEY`, `JIRA_USER_EMAIL`, and `JIRA_JQL` are all set
- **THEN** the JIRA integration is enabled and all JIRA endpoints are operational

#### Scenario: JIRA partially configured
- **WHEN** one or more JIRA configuration fields are missing
- **THEN** JIRA endpoints return `503` with body `{ "detail": "JIRA integration is not configured" }`

### Requirement: List JIRA tickets

The system SHALL expose `GET /api/v1/jira/tickets` which returns JIRA tickets matching the configured JQL query. The backend uses the `jira` Python library (v3.10.5) via a `JiraClient` Pydantic BaseModel. Each ticket in the response SHALL include: `key`, `summary`, `status`, `assignee`, `priority`, `description`, and `url`.

#### Scenario: Successful ticket listing
- **WHEN** a user calls `GET /api/v1/jira/tickets` and JIRA is configured
- **THEN** the backend returns a JSON array of matching tickets with all fields

#### Scenario: JIRA API error
- **WHEN** the JIRA API returns an error
- **THEN** the endpoint returns `502 Bad Gateway` with a descriptive error message

### Requirement: Get single JIRA ticket

The system SHALL expose `GET /api/v1/jira/ticket?key=JAR-42` which returns a single ticket's details. Uses query param instead of path param to handle special characters in ticket keys.

### Requirement: Duplicate ticket filtering

When listing JIRA tickets, the backend SHALL exclude any ticket whose key matches the `source_id` of an existing task where `source_type = 'jira'` and `status != 'done'`. The frontend additionally filters out tickets with status "done" or "closed".

#### Scenario: Ticket already linked to a non-done task
- **WHEN** a JIRA ticket with key `JAR-42` is returned by the JQL query
- **AND** a task exists with `source_type = "jira"`, `source_id = "JAR-42"`, and `status != "done"`
- **THEN** `JAR-42` SHALL NOT appear in the response

#### Scenario: Ticket linked to a done task
- **WHEN** a task exists with `source_type = "jira"`, `source_id = "JAR-42"`, and `status = "done"`
- **THEN** `JAR-42` SHALL appear in the response (re-import is allowed)

### Requirement: JIRA configuration endpoint

The system SHALL expose `GET /api/v1/jira/config` returning `{ configured, projectUrl }`.

### Requirement: JIRA deep-link on task cards

When a task has `source_type = "jira"` and a non-null `source_id`, the `TaskCard` component SHALL render the official Jira logo SVG (20x20) that links to `{JIRA_PROJECT_URL}/browse/{source_id}` in a new tab. The project URL is fetched from `GET /api/v1/jira/config`.

### Requirement: JIRA import in task creation UI

The task creation form SHALL include a source selector with "Manual", "JIRA", and "Google Calendar" tabs. When JIRA is selected:

- A **search bar** filters tickets by key, summary, or assignee
- A **project dropdown** filters by JIRA project prefix (with "All projects" default)
- Tickets render as **cards** sorted by project → status → priority (highest first), with:
  - Clickable ticket key, colored status badge, colored priority badge
  - Title, assignee
  - Toolbar: details icon (inline description expand), fullscreen icon, checkmark select icon
- **JIRA wiki markup** is parsed to HTML: headings (`h1.`–`h6.`), bullet lists (`*`), ordered lists (`#`, `##`), bold, italic, inline code (`{{...}}`), code blocks (`{code}`/`{noformat}`), links (`[label|url]`)
- **Multi-select**: checkmark toggles selection, "Confirm selection" bar appears below list, redirects to manual mode with pending items
- **Fullscreen modal**: shows full ticket details with rendered description

### Requirement: Expand source details from task board

When a task on the board has a `source_type`, an expand icon (≡) appears in the card footer. Clicking it fetches the source details via `GET /api/v1/jira/ticket?key=` and opens the same fullscreen modal used in the import form.
