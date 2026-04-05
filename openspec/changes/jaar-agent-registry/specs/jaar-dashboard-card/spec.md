## ADDED Requirements

### Requirement: Agent Registry card on Dashboard
The Dashboard page SHALL display an "Agent Registry" card showing artifact counts grouped by kind: MCP Servers, Agents, Skills, and Prompts. The card SHALL participate in the existing drag-and-drop layout system.

#### Scenario: Card renders with artifact counts
- **WHEN** the dashboard page loads and the JAAR API is reachable
- **THEN** the Agent Registry card displays four rows with artifact type labels and their counts

#### Scenario: Card participates in drag-and-drop
- **WHEN** the user drags the Agent Registry card to a new position
- **THEN** the layout order updates and persists to localStorage

### Requirement: Frontend fetches artifact counts from JAAR API
The frontend SHALL fetch artifact counts directly from the JAAR API through the gateway: `GET /jaar/v0/servers`, `GET /jaar/v0/agents`, `GET /jaar/v0/skills`, `GET /jaar/v0/prompts`. Fetching SHALL use TanStack Query for caching.

#### Scenario: Counts fetched from all four endpoints
- **WHEN** the dashboard mounts the Agent Registry card
- **THEN** four API calls are made to `/jaar/v0/servers`, `/jaar/v0/agents`, `/jaar/v0/skills`, `/jaar/v0/prompts`

#### Scenario: Counts cached via TanStack Query
- **WHEN** the user navigates away from and back to the dashboard
- **THEN** cached counts are displayed immediately while revalidation occurs in the background

### Requirement: JAAR API client module
The frontend SHALL include a dedicated API client at `frontend/src/api/jaar.ts` with typed functions for fetching each artifact type from the JAAR API.

#### Scenario: API client exports typed fetch functions
- **WHEN** `jaar.ts` is imported
- **THEN** it exports functions for fetching servers, agents, skills, and prompts with typed responses

### Requirement: Open Registry link
The Agent Registry card SHALL include an "Open Registry" link that navigates to `/jaar` (the AgentRegistry Next.js UI).

#### Scenario: Link navigates to AgentRegistry UI
- **WHEN** the user clicks "Open Registry" on the Agent Registry card
- **THEN** the browser navigates to `/jaar`
