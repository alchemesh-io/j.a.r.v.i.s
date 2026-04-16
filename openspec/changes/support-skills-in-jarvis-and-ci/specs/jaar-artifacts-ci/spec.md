# Spec: jaar-artifacts-ci (delta)

## Purpose

Extends the existing artifacts CI/CD spec to cover skill artifact publishing and syncing alongside MCP servers.

## MODIFIED Requirements

### Requirement: GitHub Actions workflow for artifact publishing
A GitHub Actions workflow SHALL build MCP server artifacts and skill artifacts on push to `main` (when `artifacts/**` changes), and publish them to GHCR using `arctl`. The workflow uses a matrix strategy per server and per skill. Agent Registry registration is handled separately via `make sync-artifacts`.

#### Scenario: Workflow triggers on push to main
- **WHEN** a commit is pushed to `main` that modifies files under `artifacts/`
- **THEN** the artifact publishing workflow is triggered

#### Scenario: Server images published to GHCR
- **WHEN** the workflow runs successfully
- **THEN** server images are pushed to GHCR with manifest version tag and `latest` tag

#### Scenario: Skill images published to GHCR
- **WHEN** the workflow runs successfully and skill directories contain a Dockerfile
- **THEN** skill images are pushed to GHCR with version tag and `latest` tag using `arctl skill build --push`

### Requirement: Makefile target for artifact sync
The Makefile SHALL include `sync-artifacts`, `sync-artifacts-servers`, and `sync-artifacts-skills` targets that publish all GHCR image tags plus local images to the Agent Registry via `arctl`.

#### Scenario: Sync publishes all versions
- **WHEN** `make sync-artifacts` is executed with JAAR running
- **THEN** all remote GHCR tags and the local git SHA version are published to the Agent Registry for both servers and skills
