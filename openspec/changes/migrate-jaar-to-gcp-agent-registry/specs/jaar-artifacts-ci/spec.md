## MODIFIED Requirements

### Requirement: GitHub Actions workflow for artifact publishing
A GitHub Actions workflow SHALL build MCP server artifacts on push to `main` (when `artifacts/servers/**` changes) and publish skill artifacts to the GCP Agent Registry Skills API on push to `main` (when `artifacts/skills/**` changes). The workflow uses a matrix strategy per server and per skill. MCP server registration with the Agent Registry happens via GKE auto-discovery (see `agent-platform-registration`), not a manual publish step.

#### Scenario: Workflow triggers on push to main
- **WHEN** a commit is pushed to `main` that modifies files under `artifacts/`
- **THEN** the artifact publishing workflow is triggered

#### Scenario: Server images published to GHCR
- **WHEN** the workflow runs successfully
- **THEN** server images are pushed to GHCR with manifest version tag and `latest` tag

#### Scenario: Skill revisions published to the Agent Registry
- **WHEN** the workflow runs successfully and a skill directory under `artifacts/skills/` changed
- **THEN** a new `Skill`/`SkillRevision` is published to the GCP Agent Registry Skills API — no Docker image is built or pushed for skills

### Requirement: Makefile target for artifact sync
The Makefile SHALL include `sync-artifacts` and `sync-artifacts-skills` targets. `sync-artifacts-skills` publishes all skill directories under `artifacts/skills/` to the GCP Agent Registry Skills API. `sync-artifacts-servers` is a no-op informational target (MCP server registration is automatic via GKE auto-discovery once deployed, not a manual publish step). `sync-artifacts` SHALL invoke both.

#### Scenario: Sync publishes skill artifacts
- **WHEN** `make sync-artifacts` is executed with valid GCP credentials configured
- **THEN** all skill directories under `artifacts/skills/` are published to the Agent Registry Skills API, and `sync-artifacts-servers` prints an informational message that server registration is automatic
