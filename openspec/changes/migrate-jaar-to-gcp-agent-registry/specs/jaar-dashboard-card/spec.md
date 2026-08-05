## MODIFIED Requirements

### Requirement: Agent Registry card on Dashboard
The Dashboard page SHALL display an "Agent Registry" card showing a Skills count and placeholders ("—") for MCP Servers, Agents, and Prompts counts (unavailable until a registry read API for those is confirmed reachable from JARVIS's backend). The card SHALL participate in the existing drag-and-drop orbital HUD layout system.

#### Scenario: Card renders with skills count
- **WHEN** the dashboard page loads and the backend skills endpoint is reachable
- **THEN** the Agent Registry card displays a Skills row with its unique count, and "—" for MCP Servers, Agents, and Prompts

#### Scenario: Card participates in drag-and-drop
- **WHEN** the user drags the Agent Registry card to a new position
- **THEN** the layout order updates and persists to localStorage

### Requirement: Frontend fetches skill counts from the backend, not JAAR
The frontend SHALL fetch the skills count via the existing `listSkills()` client function (`frontend/src/api/client.ts`), which calls the backend's `GET /api/v1/skills` endpoint — now backed by the GCP Agent Registry Skills API instead of proxying JAAR. There is no dedicated JAAR API client; `frontend/src/api/jaar.ts` is removed. Fetching SHALL use TanStack Query for caching. The count SHALL be deduplicated by skill name (the endpoint may return multiple revisions per skill).

#### Scenario: Skills count fetched from the backend
- **WHEN** the dashboard mounts the Agent Registry card
- **THEN** it calls `listSkills()` against `GET /api/v1/skills`, not any JAAR endpoint

#### Scenario: Count reflects unique skills
- **WHEN** the backend returns multiple revisions of the same skill
- **THEN** the displayed count reflects 1 unique skill, not the number of revisions

#### Scenario: Count cached via TanStack Query
- **WHEN** the user navigates away from and back to the dashboard
- **THEN** the cached skills count is displayed immediately while revalidation occurs in the background

### Requirement: Open Registry link is conditional
The Agent Registry card SHALL include an "Open Registry" link only when a registry console URL is configured via `VITE_AGENT_REGISTRY_CONSOLE_URL`; the link is omitted entirely otherwise (there is no local `jaar.jarvis.io` UI to link to anymore).

#### Scenario: Link renders when console URL is configured
- **WHEN** `VITE_AGENT_REGISTRY_CONSOLE_URL` is set to a GCP console URL
- **THEN** the "Open Registry" link opens that URL in a new browser tab

#### Scenario: Link omitted when unconfigured
- **WHEN** `VITE_AGENT_REGISTRY_CONSOLE_URL` is unset
- **THEN** the Agent Registry card renders without an "Open Registry" link

## REMOVED Requirements

### Requirement: JAAR API client module
**Reason**: JAAR is removed entirely; there is no longer a JAAR HTTP API to build a client against. The dashboard's skills count now goes through the backend's existing `GET /api/v1/skills` endpoint via the existing `listSkills()` client function.
**Migration**: Delete `frontend/src/api/jaar.ts`. Any code importing from it switches to `listSkills()` in `frontend/src/api/client.ts`.
