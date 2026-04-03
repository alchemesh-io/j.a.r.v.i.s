## ADDED Requirements

### Requirement: JIRA backend configuration

The backend SHALL accept the following environment-based configuration for JIRA connectivity:
- `JIRA_PROJECT_URL` — base URL of the JIRA instance (e.g., `https://myorg.atlassian.net`)
- `JIRA_API_KEY` — API token for authentication
- `JIRA_USER_EMAIL` — email of the JIRA user associated with the API key
- `JIRA_JQL` — JQL query string used to pre-filter tickets

All fields are optional. When any required field is missing, the JIRA integration SHALL be disabled and JIRA-related endpoints SHALL return a `503 Service Unavailable` response indicating the integration is not configured.

#### Scenario: JIRA fully configured
- **WHEN** `JIRA_PROJECT_URL`, `JIRA_API_KEY`, `JIRA_USER_EMAIL`, and `JIRA_JQL` are all set
- **THEN** the JIRA integration is enabled and all JIRA endpoints are operational

#### Scenario: JIRA partially configured
- **WHEN** one or more JIRA configuration fields are missing
- **THEN** JIRA endpoints return `503` with body `{ "detail": "JIRA integration is not configured" }`

### Requirement: List JIRA tickets

The system SHALL expose `GET /api/v1/jira/tickets` which returns JIRA tickets matching the configured JQL query. The backend uses the `jira` Python library to execute the search. Each ticket in the response SHALL include at minimum: `key` (e.g., `JAR-42`), `summary`, `status`, and `url` (direct link to the ticket).

#### Scenario: Successful ticket listing
- **WHEN** a user calls `GET /api/v1/jira/tickets` and JIRA is configured
- **THEN** the backend executes the configured JQL query via the `jira` library and returns a JSON array of matching tickets with `key`, `summary`, `status`, and `url` fields

#### Scenario: JIRA API error
- **WHEN** the JIRA API returns an error (auth failure, network issue)
- **THEN** the endpoint returns `502 Bad Gateway` with a descriptive error message

### Requirement: Duplicate ticket filtering

When listing JIRA tickets, the backend SHALL exclude any ticket whose key matches the `jira_ticket_id` of an existing task that is not in `done` status. This prevents users from creating duplicate tasks for the same JIRA ticket.

#### Scenario: Ticket already linked to a non-done task
- **WHEN** a JIRA ticket with key `JAR-42` is returned by the JQL query
- **AND** a task exists with `jira_ticket_id = "JAR-42"` and `status != "done"`
- **THEN** `JAR-42` SHALL NOT appear in the `GET /api/v1/jira/tickets` response

#### Scenario: Ticket linked to a done task
- **WHEN** a JIRA ticket with key `JAR-42` is returned by the JQL query
- **AND** a task exists with `jira_ticket_id = "JAR-42"` and `status = "done"`
- **THEN** `JAR-42` SHALL appear in the response (re-import is allowed)

#### Scenario: Ticket not linked to any task
- **WHEN** a JIRA ticket with key `JAR-99` is returned by the JQL query
- **AND** no task exists with `jira_ticket_id = "JAR-99"`
- **THEN** `JAR-99` SHALL appear in the response

### Requirement: JIRA configuration endpoint

The system SHALL expose `GET /api/v1/jira/config` which returns the configuration status and project URL. This allows the frontend to know whether JIRA is available and construct deep links.

#### Scenario: JIRA configured
- **WHEN** a user calls `GET /api/v1/jira/config` and JIRA is fully configured
- **THEN** the response SHALL be `{ "configured": true, "projectUrl": "<JIRA_PROJECT_URL>" }`

#### Scenario: JIRA not configured
- **WHEN** a user calls `GET /api/v1/jira/config` and JIRA is not configured
- **THEN** the response SHALL be `{ "configured": false, "projectUrl": null }`

### Requirement: JIRA deep-link on task cards

When a task has a non-null `jira_ticket_id`, the `TaskCard` component SHALL render a clickable JIRA icon that opens `{JIRA_PROJECT_URL}/browse/{jira_ticket_id}` in a new browser tab. The JIRA project URL SHALL be fetched from `GET /api/v1/jira/config`.

#### Scenario: Task with JIRA ticket ID
- **WHEN** a task with `jira_ticket_id = "JAR-42"` is displayed
- **AND** JIRA config returns `projectUrl = "https://myorg.atlassian.net"`
- **THEN** the TaskCard renders a clickable JIRA icon linking to `https://myorg.atlassian.net/browse/JAR-42`

#### Scenario: Task without JIRA ticket ID
- **WHEN** a task with `jira_ticket_id = null` is displayed
- **THEN** no JIRA icon is rendered on the TaskCard

### Requirement: JIRA import in task creation UI

The task creation form SHALL include a source selector with at least "Manual" and "JIRA" options. When the user selects JIRA mode, the form SHALL display the list of available JIRA tickets (from `GET /api/v1/jira/tickets`). Selecting a ticket SHALL pre-fill the task title with the ticket summary and set `jira_ticket_id` to the ticket key. The user SHALL still be able to modify the task type and dates before submitting.

#### Scenario: User selects a JIRA ticket to import
- **WHEN** the user switches to JIRA mode in the create form
- **AND** selects a ticket with key `JAR-42` and summary "Fix login bug"
- **THEN** the title field is pre-filled with "Fix login bug"
- **AND** `jira_ticket_id` is set to "JAR-42"
- **AND** the user can still edit type and dates before creating the task

#### Scenario: JIRA not configured — mode hidden
- **WHEN** `GET /api/v1/jira/config` returns `{ "configured": false }`
- **THEN** the JIRA option SHALL NOT appear in the source selector
