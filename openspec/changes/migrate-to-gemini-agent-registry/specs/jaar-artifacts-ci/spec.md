## MODIFIED Requirements

### Requirement: GitHub Actions workflow for artifact publishing
A GitHub Actions workflow SHALL build MCP server artifacts on push to `main` (when `artifacts/servers/**` changes) and publish them to GHCR using `arctl`, and SHALL sync skill artifacts on push to `main` (when `artifacts/skills/**` changes) directly to the skills GCS bucket. The workflow uses a matrix strategy per server and per skill. Agent (Gemini Enterprise Agent Registry) registration for servers is handled via GKE auto-discovery (see `agent-platform-registration`), not via `arctl` publish.

#### Scenario: Workflow triggers on push to main
- **WHEN** a commit is pushed to `main` that modifies files under `artifacts/`
- **THEN** the artifact publishing workflow is triggered

#### Scenario: Server images published to GHCR
- **WHEN** the workflow runs successfully
- **THEN** server images are pushed to GHCR with manifest version tag and `latest` tag

#### Scenario: Skill files synced to GCS
- **WHEN** the workflow runs successfully and skill directories contain a `SKILL.md`
- **THEN** skill files are uploaded to the skills GCS bucket under `<name>/<version>/`, with no Docker image built

### Requirement: Makefile target for artifact sync
The Makefile SHALL include `sync-artifacts`, `sync-artifacts-servers`, and `sync-artifacts-skills` targets. `sync-artifacts-servers` SHALL publish all GHCR server image tags plus local images (registration with Gemini Enterprise Agent Registry happens via GKE auto-discovery, not this target). `sync-artifacts-skills` SHALL upload skill files to the skills GCS bucket.

#### Scenario: Sync publishes server images
- **WHEN** `make sync-artifacts` is executed
- **THEN** all remote GHCR server image tags and the local git SHA version are published, and all skill directories are uploaded to the skills GCS bucket
