## MODIFIED Requirements

### Requirement: Agent Registry card on Dashboard
The Dashboard page SHALL display an "Agent Registry" card showing artifact counts grouped by kind: MCP Servers, Agents, Skills, and Prompts. The Skills count SHALL be sourced from the GCS skills bucket; MCP Servers, Agents, and Prompts counts SHALL be shown as "—" (unavailable) until Gemini Enterprise Agent Registry read access from the JARVIS backend is confirmed. The card SHALL participate in the existing drag-and-drop orbital HUD layout system.

#### Scenario: Card renders with skills count available
- **WHEN** the dashboard page loads and the backend's skills-count endpoint is reachable
- **THEN** the Agent Registry card displays a Skills row with the unique skill count, and "—" for MCP Servers, Agents, and Prompts

#### Scenario: Card participates in drag-and-drop
- **WHEN** the user drags the Agent Registry card to a new position
- **THEN** the layout order updates and persists to localStorage

### Requirement: Frontend fetches skill count via backend proxy
The frontend SHALL fetch the unique skill count via a backend endpoint that lists the skills GCS bucket, rather than calling GCS or any registry API directly. Fetching SHALL use TanStack Query for caching. The count SHALL be deduplicated by skill name (a bucket may contain multiple versions per skill).

#### Scenario: Skill count fetched via backend
- **WHEN** the dashboard mounts the Agent Registry card
- **THEN** one API call is made to the backend's skills-count endpoint

#### Scenario: Count reflects unique skills
- **WHEN** the backend reports multiple versions of the same skill in the bucket
- **THEN** the displayed count reflects 1 unique skill, not the number of versions

#### Scenario: Count cached via TanStack Query
- **WHEN** the user navigates away from and back to the dashboard
- **THEN** the cached count is displayed immediately while revalidation occurs in the background

### Requirement: Registry API client module
The frontend SHALL include an API client with a typed function for fetching the unique skill count from the backend's skills-count endpoint, replacing the previous direct-to-JAAR client at `frontend/src/api/jaar.ts`.

#### Scenario: API client exports typed fetch function
- **WHEN** the registry API client module is imported
- **THEN** it exports a `fetchSkillCount` function; it does not export `fetchServerCount`, `fetchAgentCount`, or `fetchPromptCount` (unavailable pending Gemini Enterprise Agent Registry read access)

### Requirement: Open Registry link
The Agent Registry card SHALL include an "Open Registry" link. The link SHALL open the Google Cloud Console's Agent Registry page for the configured project when a console URL is configured via an environment variable, and SHALL be hidden when no such URL is configured.

#### Scenario: Link opens Cloud Console Agent Registry page when configured
- **WHEN** the console URL environment variable is set and the user clicks "Open Registry"
- **THEN** a new tab opens at the configured Google Cloud Console Agent Registry URL

#### Scenario: Link hidden when not configured
- **WHEN** the console URL environment variable is not set
- **THEN** the "Open Registry" link is not rendered
