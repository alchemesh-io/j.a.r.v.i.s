## ADDED Requirements

### Requirement: Agent Registry metric block on Dashboard
The Dashboard SHALL display an "Agent Registry" card alongside the existing metric blocks (Workers, Daily Tasks, Weekly Tasks). The card SHALL show four artifact counts: MCP Servers, Agents, Skills, and Prompts, fetched from the JAAR API. The card SHALL participate in the existing drag-and-drop layout and compact mode systems.

#### Scenario: Agent Registry card rendered on dashboard
- **WHEN** the dashboard page loads
- **THEN** the Agent Registry card is displayed with four artifact type rows and their counts

#### Scenario: Card works in compact mode
- **WHEN** the user toggles compact mode
- **THEN** the Agent Registry card reduces its vertical space consistently with other metric blocks

#### Scenario: Card draggable with other blocks
- **WHEN** the user drags the Agent Registry card to a new position among the other blocks
- **THEN** the layout order updates and persists to localStorage

#### Scenario: Card handles JAAR API unavailability
- **WHEN** the dashboard loads but the JAAR API is unreachable
- **THEN** the Agent Registry card displays gracefully with zero counts or a loading/error state, without breaking the rest of the dashboard
