## ADDED Requirements

### Requirement: Artifacts directory structure
The repository SHALL include an `artifacts/` directory with one subdirectory per artifact type: `servers/`, `agents/`, `skills/`, `prompts/`. Each artifact SHALL reside in its own named subfolder containing a `manifest.yaml` and any associated source files.

#### Scenario: Directory structure exists
- **WHEN** the repository is cloned
- **THEN** the `artifacts/` directory contains `servers/`, `agents/`, `skills/`, and `prompts/` subdirectories

#### Scenario: Each artifact has a manifest
- **WHEN** an artifact subfolder is inspected (e.g., `artifacts/servers/jarvis-mcp/`)
- **THEN** it contains a `manifest.yaml` describing the artifact metadata

### Requirement: JARVIS MCP server relocated under artifacts
The existing MCP server at `mcp_server/` SHALL be relocated to `artifacts/servers/jarvis-mcp/`. The Helm chart Dockerfile path, CI workflow, and any references SHALL be updated to reflect the new location. The MCP server's functionality and API SHALL remain unchanged.

#### Scenario: MCP server sources at new location
- **WHEN** the repository is inspected after relocation
- **THEN** `artifacts/servers/jarvis-mcp/` contains the MCP server source code, Dockerfile, `pyproject.toml`, and `manifest.yaml`

#### Scenario: MCP server Docker image builds from new path
- **WHEN** `docker build -t jarvis-mcp ./artifacts/servers/jarvis-mcp` is executed
- **THEN** the build completes without errors and produces a runnable image

#### Scenario: MCP server tests pass from new location
- **WHEN** `uv run pytest tests/ -v` is executed in `artifacts/servers/jarvis-mcp/`
- **THEN** all existing MCP server tests pass

### Requirement: Initial artifact manifests
The repository SHALL include initial manifests for: `artifacts/servers/jarvis-mcp/manifest.yaml`, `artifacts/agents/jarvis-assistant/manifest.yaml`, `artifacts/skills/task-management/manifest.yaml`, `artifacts/prompts/daily-planning/manifest.yaml`.

#### Scenario: All initial manifests exist
- **WHEN** the repository is inspected
- **THEN** all four manifest files exist with valid YAML content describing each artifact's name, type, version, and description

### Requirement: GitHub Actions workflow for artifact publishing
A GitHub Actions workflow SHALL build artifacts on push to `main`, publish them to GHCR as Docker packages, and call the AgentRegistry API to register them.

#### Scenario: Workflow triggers on push to main
- **WHEN** a commit is pushed to `main` that modifies files under `artifacts/`
- **THEN** the artifact publishing workflow is triggered

#### Scenario: Artifacts published to GHCR
- **WHEN** the workflow runs successfully
- **THEN** artifact images are pushed to GHCR under the repository's package namespace

#### Scenario: Artifacts registered with AgentRegistry
- **WHEN** artifacts are published to GHCR
- **THEN** the workflow calls the AgentRegistry API to register or update the artifact entries
