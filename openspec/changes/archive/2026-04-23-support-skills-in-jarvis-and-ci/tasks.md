## 1. CI/CD Pipeline — Skill Publishing

- [x] 1.1 Add `publish-skills` job to `.github/workflows/artifacts-publish.yml` with matrix strategy over `artifacts/skills/*/`, using `arctl skill build --push` to build and push to GHCR
- [x] 1.2 Add version extraction step that reads the `version` field from `SKILL.md` YAML frontmatter, defaulting to `latest` if absent
- [x] 1.3 Add skill name conversion logic (double-underscore directory names → hyphenated image names, e.g., `planner__daily_wrap_up` → `planner-daily-wrap-up`)
- [x] 1.4 Add `sync-artifacts-skills` Makefile target that publishes skill images from GHCR to JAAR via `arctl skill publish`
- [x] 1.5 Wire `sync-artifacts-skills` into the existing `sync-artifacts` target alongside `sync-artifacts-servers`
- [x] 1.6 Verify CI pipeline by checking that `planner__daily_wrap_up` skill builds and publishes correctly

## 2. Backend — Worker Skill References

- [x] 2.1 Create `SkillRef` Pydantic model (`name: str`, `version: str = "latest"`) in `backend/app/schemas/worker.py`
- [x] 2.2 Add `skills` JSON column to `Worker` model (`sa.JSON`, default `[]`) storing list of `{name, version}` objects
- [x] 2.3 Generate Alembic migration to add `skills` column to `worker` table
- [x] 2.4 Add optional `skills: list[SkillRef] = []` field to `WorkerCreate` schema
- [x] 2.5 Add `skills` field to `WorkerResponse` schema
- [x] 2.6 Update worker creation route to store skill references on the worker's `skills` JSON column
- [x] 2.7 Update `k8s.create_worker_pod` to serialize skills as `SKILLS` env var (`name@version` comma-separated pairs)
- [x] 2.8 Write backend tests for worker creation with skill references and K8s env var serialization

## 3. Worker Entrypoint — Selective Skill Pull

- [x] 3.1 Update `worker/entrypoint.sh` to parse `SKILLS` env var (split on `,` then `@` to get name and version)
- [x] 3.2 Replace `arctl skill pull --all` with a loop: `arctl skill pull "$name" --version "$version" --registry "$JAAR_URL"` for each entry
- [x] 3.3 Handle empty `SKILLS` env var: skip skill pulling entirely (explicit opt-in)
- [x] 3.4 Test worker startup with versioned skills and without `SKILLS` env var

## 4. Frontend — Worker Card Skill Rendering

- [x] 4.1 Add a `SkillBoltIcon` SVG component in `frontend/src/pages/Workers/Workers.tsx` (monochrome, `currentColor`)
- [x] 4.2 Replace the `⚡` emoji in worker card skill rows with `<SkillBoltIcon />`
- [x] 4.3 Replace the `⚡` emoji in the Create Worker overlay skill picker with `<SkillBoltIcon />`
- [x] 4.4 Add `worker-card__skill-icon` and `worker-card__skill-version` CSS classes with amber (`#f59e0b`) accent and monospace version font in `Workers.css`
- [x] 4.5 Replace the `⚡` emoji in `TaskBoard.tsx` worker-create skill picker with `<SkillBoltIcon />` and add `task-board__worker-skill-icon` (amber) CSS class for consistency with the Workers page
