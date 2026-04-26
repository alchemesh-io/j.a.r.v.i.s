## Context

JARVIS workers pull skills from JAAR (AgentRegistry) at startup via `arctl skill pull --all`. A working skill (`planner__daily_wrap_up`) exists in `artifacts/skills/` with a `FROM scratch` Dockerfile (OCI metadata container), `SKILL.md` with name/description/allowed_tools, and supporting files. The current CI workflow (`artifacts-publish.yml`) only builds and publishes MCP servers — skills have no CI pipeline and no Makefile sync targets.

Workers currently pull **all** skills unconditionally. There is no mechanism to select which skills a worker receives. JAAR is the source of truth for skill metadata — skill browsing and management happens through the JAAR UI at `jaar.jarvis.io`.

## Goals / Non-Goals

**Goals:**
- Publish skills to GHCR via CI alongside MCP servers
- Sync skill images to JAAR via Makefile targets
- Allow selective skill assignment to workers (replace `--all` pull)
- Reference skills by their JAAR registry names — no local duplication of skill metadata

**Non-Goals:**
- Skill execution runtime — skills run inside Claude Code, not managed by JARVIS
- Local Skill model or CRUD API — JAAR is the source of truth, browsed via `jaar.jarvis.io`
- MCP tools for skill management — agents discover skills through JAAR's own API/tools
- Skill content editing — skills are authored in `artifacts/skills/`, not via any API
- Worker hot-reload of skills after startup

## Decisions

### 1. Workers store skill names as a JSON column, referencing JAAR

The `Worker` model gains a `skills` column (`sa.JSON`, default `[]`) storing a list of skill reference objects, each with `name` and `version` matching JAAR registry entries (e.g., `[{"name": "planner-daily-wrap-up", "version": "0.1.0"}]`). No separate `Skill` table or `worker_skill` association table.

**Why a JSON column over a M2M relationship:** Skills are managed entirely in JAAR — the backend doesn't need a local `Skill` entity. Storing skill references directly on the worker avoids duplicating JAAR metadata, eliminates sync drift, and removes the need for a CRUD API layer. The worker just needs to know *which* skills (and at which version) to pull.

**Alternative considered — local Skill model with M2M:** Rejected because it duplicates JAAR as source of truth, requires sync mechanisms to stay current, and adds a CRUD surface (model, migration, schemas, routes, MCP tools) for data that already lives in JAAR.

### 2. CI publishes skills using `arctl skill build --push`

Add a `publish-skills` job to `artifacts-publish.yml` with a matrix strategy over `artifacts/skills/*/`. Each skill directory with a `Dockerfile` gets built and pushed to GHCR as `ghcr.io/alchemesh-io/<skill-name>:<version>`. Version is extracted from `SKILL.md` YAML frontmatter (or defaults to `latest`).

**Why `arctl skill build` over plain `docker build`:** `arctl` handles OCI artifact metadata (labels, annotations) that JAAR expects for skill discovery. Plain Docker build would produce an image but JAAR wouldn't recognize it as a skill artifact.

### 3. Worker entrypoint switches from `--all` to named skill pull

The worker pod receives a `SKILLS` environment variable (comma-separated `name@version` pairs, e.g., `planner-daily-wrap-up@0.1.0,code-reviewer@latest`). The entrypoint replaces `arctl skill pull --all` with a loop that parses each entry and pulls by name and version: `arctl skill pull "$name" --version "$version" --registry "$JAAR_URL"`. If `SKILLS` is empty, no skills are pulled (explicit opt-in).

**Why `name@version` CSV over JSON or ConfigMap:** Follows the existing `REPOSITORIES` pattern (`git_url@branch,git_url@branch`). Simple, no parsing library needed in shell, consistent with how repo data reaches the worker.

### 4. Worker creation accepts skill names (strings) not IDs

`WorkerCreate` gains an optional `skills: list[SkillRef] = []` field where `SkillRef` is a Pydantic model with `name: str` and `version: str = "latest"`. The worker creation route stores these references on the `Worker.skills` JSON column and serializes them as `name@version` pairs in the `SKILLS` env var for the K8s pod. `WorkerResponse` exposes the `skills` field.

**Why name+version references over IDs:** Skills don't have local integer IDs — they're identified by name and version in JAAR. Passing references directly avoids a lookup layer and pins workers to specific skill versions for reproducibility.

### 5. Makefile gains `sync-artifacts-skills` target

Mirrors the existing `sync-artifacts-servers` pattern. Queries GHCR for all skill image tags, publishes each to JAAR via `arctl skill publish`. Wired into the existing `sync-artifacts` target.

### 6. Worker card renders skills as SVG-iconed rows with an amber accent

The Workers page renders each worker's skills below its repositories using the same row layout (`worker-card__repo` class) so the visual rhythm of the card stays consistent. The icon is a `SkillBoltIcon` SVG using `currentColor`, not the `⚡` emoji.

**Why an SVG over the `⚡` emoji:** Emojis render with platform-specific colored glyphs (typically yellow on macOS) and inconsistent sizing relative to the 14px monochrome SVGs used for repos. They cannot be styled via CSS `color`, breaking the design system's `currentColor` convention. An SVG using `currentColor` inherits the row color and lets us apply theming.

**Why an amber (`#f59e0b`) accent for skills:** Repositories already own the cyan accent (`var(--color-accent-cyan)`). Reusing cyan for skills would make the two artifact types visually indistinguishable. Amber preserves the spark/lightning metaphor of the original emoji while remaining theme-consistent and giving users a fast visual cue to differentiate skills from repos. The version badge uses monospace to match the worker ID in the card footer (both are immutable identifiers).

The Create Worker overlay's skill picker uses the same SVG for consistency between the picker and the rendered card.

## Risks / Trade-offs

**[Skill reference typos]** → Worker creation accepts any name/version pair with no validation against JAAR. A typo means `arctl skill pull` fails silently at worker startup. **Mitigation:** The worker entrypoint already logs pull failures as warnings. Future improvement: validate references against JAAR API at creation time.

**[Worker startup latency]** → Pulling individual skills sequentially is slower than `--all` for workers that need many skills. **Mitigation:** Acceptable for the current scale (<10 skills). Can batch-pull later if needed.

**[SKILL.md version parsing]** → CI needs to extract version from `SKILL.md` YAML frontmatter, which may not have a `version` field yet. **Mitigation:** Default to `latest` if no version found; document the expected frontmatter format.

## Migration Plan

1. **Phase 1 — CI + Makefile** (no breaking changes): Add `publish-skills` job and `sync-artifacts-skills` target. Existing skills get published on next push to main.
2. **Phase 2 — Backend** (additive): Add `skills` JSON column to Worker model via Alembic migration. Worker creation gains optional `skills` (name+version references) — existing workers unaffected (defaults to empty list).
3. **Phase 3 — Worker entrypoint**: Switch from `arctl skill pull --all` to named pull via `SKILLS` env var. **BREAKING** for existing workers — coordinate with worker image rebuild.

**Rollback:** Each phase is independently deployable. Phase 3 is the only breaking change; rollback by reverting the entrypoint change in the worker image.

## Open Questions

- Does `arctl skill build` support `--push` like `arctl mcp build --push`, or is the publish step separate?
- Should workers fall back to `--all` if `SKILLS` env var is empty, or should empty mean "no skills"? (Design assumes explicit opt-in — no skills if empty.)
