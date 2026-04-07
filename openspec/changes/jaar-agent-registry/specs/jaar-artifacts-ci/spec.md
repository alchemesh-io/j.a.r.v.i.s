## ADDED Requirements

### Requirement: Artifacts directory structure
The repository SHALL include an `artifacts/` directory with one subdirectory per artifact type: `servers/`, `agents/`, `skills/`, `prompts/`. Each MCP server artifact SHALL reside in its own named subfolder scaffolded via `arctl mcp init python`, containing a `mcp.yaml` metadata file, `src/` directory, `Dockerfile`, and `pyproject.toml`. Empty type directories use `.gitkeep`.

#### Scenario: Directory structure exists
- **WHEN** the repository is cloned
- **THEN** the `artifacts/` directory contains `servers/`, `agents/`, `skills/`, and `prompts/` subdirectories

#### Scenario: Each server artifact has an mcp.yaml
- **WHEN** a server subfolder is inspected (e.g., `artifacts/servers/jarvis/`)
- **THEN** it contains an `mcp.yaml` describing the artifact metadata (name, version, description)

### Requirement: JARVIS MCP server rewritten under artifacts
The existing MCP server at `mcp_server/` SHALL be replaced with a new server at `artifacts/servers/jarvis/` scaffolded via `arctl mcp init python`. The server SHALL use FastMCP with dynamic tool loading from `src/tools/`. Tool modules cover task, daily, and weekly management — backend-managed data only (no JIRA/GCal proxy). The API client SHALL be aligned to current backend models (`source_type`/`source_id`).

#### Scenario: MCP server sources at new location
- **WHEN** the repository is inspected
- **THEN** `artifacts/servers/jarvis/` contains `src/main.py`, `src/core/api_client.py`, `src/tools/{tasks,dailies,weeklies}.py`, `mcp.yaml`, `Dockerfile`, and `pyproject.toml`

#### Scenario: MCP server Docker image builds from new path
- **WHEN** `docker build -t jarvis ./artifacts/servers/jarvis` is executed
- **THEN** the build completes without errors and produces a runnable image

#### Scenario: MCP server tests pass
- **WHEN** `uv run pytest tests/ -v` is executed in `artifacts/servers/jarvis/`
- **THEN** all 33 tests pass (API client, tool loading, discovery, server)

#### Scenario: Old mcp_server/ removed
- **WHEN** the repository is inspected
- **THEN** the `mcp_server/` directory no longer exists

### Requirement: GitHub Actions workflow for artifact publishing
A GitHub Actions workflow SHALL build MCP server artifacts on push to `main` (when `artifacts/**` changes), and publish them to GHCR using `arctl mcp build --push`. The workflow uses a matrix strategy per server. Agent Registry registration is handled separately via `make sync-artifacts`.

#### Scenario: Workflow triggers on push to main
- **WHEN** a commit is pushed to `main` that modifies files under `artifacts/`
- **THEN** the artifact publishing workflow is triggered

#### Scenario: Server images published to GHCR
- **WHEN** the workflow runs successfully
- **THEN** server images are pushed to GHCR with manifest version tag and `latest` tag

### Requirement: Makefile target for artifact sync
The Makefile SHALL include `sync-artifacts` and `sync-artifacts-servers` targets that publish all GHCR image tags plus local images to the Agent Registry via `arctl mcp publish`.

#### Scenario: Sync publishes all versions
- **WHEN** `make sync-artifacts` is executed with JAAR running
- **THEN** all remote GHCR tags and the local git SHA version are published to the Agent Registry
