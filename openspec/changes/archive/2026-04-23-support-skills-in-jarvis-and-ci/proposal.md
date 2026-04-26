## Why

JARVIS workers already pull skills from JAAR at startup via `arctl skill pull --all`, and a working skill example (`planner__daily_wrap_up`) exists in `artifacts/skills/`. However, there is no CI pipeline to publish skills to GHCR, no Makefile target to sync them into JAAR, and the backend/frontend have no API or UI for managing which skills a worker uses. Skills are a first-class artifact type in AgentRegistry but are second-class citizens in the JARVIS CI/CD and platform — only MCP servers are published today.

## What Changes

- Add a `publish-skills` job to the `artifacts-publish.yml` GitHub Actions workflow that builds and pushes skill Docker images to GHCR on changes to `artifacts/skills/`
- Add `sync-artifacts-skills` Makefile target (and wire it into the existing `sync-artifacts`) to publish skill images to JAAR via `arctl`
- Wire skill selection into worker creation — workers specify skill names (referencing JAAR registry) to pull instead of always pulling all

## Capabilities

### New Capabilities
- `skill-ci-publishing`: CI/CD pipeline and Makefile targets for building, publishing, and syncing skill artifacts to GHCR and JAAR
- `skill-worker-integration`: Worker model stores skill references (name + version from JAAR), passes them to pods via `SKILLS` env var for selective pulling

### Modified Capabilities
- `jaar-artifacts-ci`: Extend the existing artifacts CI workflow and Makefile sync targets to cover skills (currently only handles MCP servers)
- `docker-publish`: Extend the Docker publish workflow path triggers to include skill Dockerfiles if needed

## Impact

- **CI/CD**: `.github/workflows/artifacts-publish.yml` gains a new job; `Makefile` gains new sync targets
- **Backend**: Worker model gains a `skills` JSON column (list of `{name, version}` refs from JAAR); worker creation accepts skill references; K8s pod creation passes `SKILLS` env var as `name@version` pairs
- **Database**: Alembic migration to add `skills` column to `worker` table
- **Helm**: Worker pods may need `JAAR_URL` exposed consistently; skill pull behavior becomes configurable
