## ADDED Requirements

### Requirement: Agent Registry card on Dashboard
The Dashboard page SHALL display an "Agent Registry" card showing unique artifact counts grouped by kind: MCP Servers, Agents, Skills, and Prompts. The card SHALL participate in the existing drag-and-drop orbital HUD layout system.

#### Scenario: Card renders with artifact counts
- **WHEN** the dashboard page loads and the JAAR API is reachable
- **THEN** the Agent Registry card displays four rows with artifact type labels and their unique counts

#### Scenario: Card participates in drag-and-drop
- **WHEN** the user drags the Agent Registry card to a new position
- **THEN** the layout order updates and persists to localStorage

### Requirement: Frontend fetches artifact counts from JAAR API
The frontend SHALL fetch unique artifact counts from the JAAR API via host-based routing: `GET jaar.jarvis.io/v0/servers`, `GET jaar.jarvis.io/v0/agents`, `GET jaar.jarvis.io/v0/skills`, `GET jaar.jarvis.io/v0/prompts`. The JAAR hostname SHALL be configurable via `VITE_JAAR_HOST` env var. Fetching SHALL use TanStack Query for caching. Counts SHALL be deduplicated by artifact name (the API returns multiple versions per artifact).

#### Scenario: Counts fetched from all four endpoints
- **WHEN** the dashboard mounts the Agent Registry card
- **THEN** four API calls are made to `jaar.jarvis.io/v0/{servers,agents,skills,prompts}`

#### Scenario: Counts reflect unique artifacts
- **WHEN** the JAAR API returns multiple versions of the same server
- **THEN** the count reflects 1 unique server, not the number of versions

#### Scenario: Counts cached via TanStack Query
- **WHEN** the user navigates away from and back to the dashboard
- **THEN** cached counts are displayed immediately while revalidation occurs in the background

### Requirement: JAAR API client module
The frontend SHALL include a dedicated API client at `frontend/src/api/jaar.ts` with typed functions for fetching unique artifact counts from each JAAR API endpoint. The response format is `{<type>: [{<type_singular>: {name, ...}, _meta: ...}], metadata: {count}}`. The client SHALL deduplicate by name and return the count of unique artifacts.

#### Scenario: API client exports typed fetch functions
- **WHEN** `jaar.ts` is imported
- **THEN** it exports `fetchServerCount`, `fetchAgentCount`, `fetchSkillCount`, and `fetchPromptCount`

### Requirement: Open Registry link
The Agent Registry card SHALL include an "Open Registry" link that opens `jaar.jarvis.io` in a new browser tab.

#### Scenario: Link opens AgentRegistry UI
- **WHEN** the user clicks "Open Registry" on the Agent Registry card
- **THEN** a new tab opens at `jaar.jarvis.io`
