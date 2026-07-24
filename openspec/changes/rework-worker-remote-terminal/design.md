# Design: rework-worker-remote-terminal

## Context

JAW workers run Claude Code headless in a single privileged `docker:dind`-based container: the entrypoint clones repos, pulls skills via an on-demand dockerd, backgrounds a status server, then pipes an unwired FIFO into `claude --print --input-format stream-json`. The task prompt never reaches Claude, and `--resume <uuid-derived-from-worker-id>` targets a session that does not exist on first boot. Interactive access is only possible through VSCode Dev Containers.

doctolib/remote-claude demonstrates the target model: `claude` runs interactively as the container's main process (`tty: true`, `stdin: true`, bootstrap ends with `exec claude`), a manager attaches via the Kubernetes `Attach`/`Exec` APIs, and a WebSocket bridge fans the PTY out to browser xterm.js clients with a replayed ring buffer. Its manager is a Node process outside the cluster; JARVIS instead has an in-cluster FastAPI backend, SQLite (single replica), Istio Gateway API routing, and ArgoCD-driven deployment — those stay.

Deployment is currently minikube-bound: both ArgoCD Application variants sync from `file:///mnt/jarvis-repo` (a `minikube mount` + repo-server hostPath patch), and SQLite persistence rides a second mount into a hostPath PV.

## Goals / Non-Goals

**Goals:**

- Claude Code runs interactively in worker pods; the task prompt is delivered on first boot and conversations resume across pod recreation.
- A browser terminal (Claude session + ad-hoc shell) in the JARVIS UI, bridged by the backend over WebSockets, with scrollback replay on reconnect.
- Worker pods run unprivileged unless skills require dockerd.
- The GHCR-variant ArgoCD applications deploy from Git, with no minikube-mount dependency.
- Preserve everything JARVIS has that remote-claude lacks: task linkage, 7-state machine with `effective_state` projection, push-based status reporting, ephemeral/stateful modes with stop/restart, JAAR skills, MCP registration, GitOps deployment.

**Non-Goals:**

- Authentication/authorization, session sharing, API tokens (JARVIS has no auth story yet — see Risks).
- Full de-privilege of skill pulling (oras/crane replacement for dockerd) — follow-up.
- PostgreSQL migration, multi-replica backend, secret redaction, over-use monitoring, precompiled images, image paste, local attach CLI.
- Real DNS / cert-manager / external-secrets for remote clusters (documented as prerequisites, not implemented here).

## Decisions

### D1 — Bridge lives in the FastAPI backend (no Node manager)

remote-claude's manager is Node + `@kubernetes/client-node`. Porting JARVIS to that model would fork the backend. Instead the bridge is a new `app/services/terminal.py` using the existing `kubernetes` Python client's WebSocket streams (`connect_get_namespaced_pod_attach` / `..._exec` with `_preload_content=False` → `WSClient`) and Starlette WebSockets (already bundled with FastAPI).

Threading model: the sync `WSClient` is pumped by a dedicated reader thread per attachment that pushes chunks onto an `asyncio` queue via `loop.call_soon_threadsafe`; writes go through `WSClient.write_stdin` (thread-safe enough for single-writer use — all client inputs are serialized through the bridge). Resize uses the K8s resize channel (channel 4, `{"Width": cols, "Height": rows}`). Alternative considered: `kubernetes_asyncio` — rejected to avoid a second K8s client dependency and config duplication with `app/services/k8s.py`.

Attach state (handles, ring buffers, client sets) is in-process memory. The backend is already pinned to one replica by SQLite, so this adds no new constraint; noted for the future Postgres/multi-replica work (WS would then need sticky routing).

### D2 — Two-container pod: `worker` (Claude, attach target) + `status` sidecar

`Attach` connects to the container's main process, so `claude` must be PID 1 of the `worker` container: the entrypoint keeps its provisioning steps (config copy, repo clone, skill pull) and ends with `exec claude ...`. The status server moves to a `status` sidecar container (same image, `command: node /opt/jarvis-worker/status-server/index.js`). Both containers share an `emptyDir` mounted at `/worker-state`; hooks write `working` / `waiting_for_human` to `$STATE_FILE` (`/worker-state/claude-state`), which the sidecar reads and PATCHes to the backend every 3 s (unchanged push model — remote-claude's EFS-file polling is not adopted; JARVIS's push design is better for an in-cluster backend).

Alternative considered: single container with `status-server &` before `exec claude` — rejected: orphaned child gets re-parented to Claude (no zombie reaping), and a status-server crash would be invisible. A plain second container (not a native sidecar initContainer) is enough: startup order doesn't matter because the status server tolerates a missing state file, and pod teardown kills both.

The `worker` container gets `tty: true, stdin: true, stdinOnce: false`. The vestigial port 3000/`ui` is dropped; the Service keeps exposing only 8080 (now served by the sidecar).

### D3 — Prompt injection and resume probe

`TASK_PROMPT` env (task title + description, built by the backend at pod creation) replaces the FIFO. Launch logic in the entrypoint:

- Probe `~/.claude/projects/**/*.jsonl`; if any exist (stateful restart), `exec claude --dangerously-skip-permissions --resume <session-id-of-most-recent-jsonl>`.
- Otherwise `exec claude --dangerously-skip-permissions "$TASK_PROMPT"` (interactive with the prompt submitted as the first turn).

This mirrors remote-claude's `claudeLaunchLines()` probe and removes the derived-UUID `--resume` that fails on first boot. Ephemeral workers always take the fresh path; stateful workers resume their conversation after stop/restart because `~/.claude` lives on the PVC.

### D4 — Wire protocol and endpoints (remote-claude compatible)

- `WS /api/v1/workers/{id}/terminal` — attach to the Claude PTY. One `Attachment` per worker (created lazily on first client), fanned out to N WebSocket clients. On connect: replay ring buffer (in-memory `deque`, 500 KB cap); if empty, pre-populate from `read_namespaced_pod_log(tail_lines=500)`. If the pod is not yet Ready, send `{type:"status",status:"starting"}` and poll up to 120 s before attaching; on pod-gone/timeout, stream pod phase/reason + last 100 log lines into the terminal, send `status: "error"`, close.
- `WS /api/v1/workers/{id}/shell` — independent `Exec` of `/bin/bash` per connection in the `worker` container; no buffer, no fan-out.
- Frames: **binary = raw PTY bytes** both directions; **text = JSON** — client sends `{"type":"resize","cols":N,"rows":N}`, server sends `{"type":"status","status":...}` mapped onto JARVIS's `effective_state` vocabulary (`starting`, `running`, `stopped`, `error`).
- `GET /api/v1/workers/{id}/logs?tail=500` — plain-text pod log tail (debugging surface; also linked from the UI).

Routing: WS upgrades ride the existing `main.jarvis.io` `/api` HTTPRoute — Istio handles WebSocket upgrade on plain HTTPRoutes, so no per-worker HTTPRoutes (CLAUDE.md's claim that these exist is removed).

### D5 — Conditional pod privilege

`privileged: true` exists solely so `arctl skill pull` can start rootless dockerd. The backend knows at creation time whether skills were requested, so `k8s.py` sets `privileged: skills_present` on the `worker` container. The stateful-mode `chown` fallback keeps working unprivileged (passwordless sudo grants in-container root, which suffices for chown; dockerd is what needs the privileged flag). The `status` sidecar is always unprivileged. Full de-privilege (OCI pull via oras/crane instead of dockerd) is a follow-up spike.

### D6 — Idempotent pod creation and Helm-sourced resources

`create_worker_pod` deletes any leftover pod (ignore-404) before creating, making restart robust against ungarbage-collected pods (remote-claude `createSessionPod` pattern). Worker resource requests/limits move from hardcoded values in `k8s.py` to env vars (`WORKER_CPU_REQUEST` etc.) sourced from `helm/jarvis/values.yaml` via the backend ConfigMap — fixing the current divergence (code says 1Gi/4Gi, values say 256Mi/1Gi; values win).

### D7 — Frontend terminal

New route `/workers/:id/terminal` (query `?mode=shell` for the shell variant) rendering an xterm.js terminal styled with JADS tokens: `@xterm/xterm` + `@xterm/addon-fit` + `@xterm/addon-web-links`. `term.onData` → binary frames; binary messages → `term.write`; `FitAddon` + `ResizeObserver` → resize JSON; status frames drive a header badge. Auto-reconnect with backoff (replay covers the gap). The worker card's brain-click-opens-VSCode is replaced by an explicit action row: **Terminal** (live pods), **Shell** (live pods), **VSCode** (kept), **Logs** (always). WS URL derives from `window.location` (`ws(s)://<host>/api/v1/workers/<id>/terminal`), matching the existing same-origin API client.

### D8 — Portable deployment

`argocd/jarvis-app.yaml` and `argocd/jaar-app.yaml` switch to `repoURL: https://github.com/alchemesh-io/j.a.r.v.i.s.git`, `targetRevision: main` (values confirmed at implementation time from `git remote`); the `-local` variants keep `file:///mnt/jarvis-repo` + `targetRevision: HEAD`. Consequence: GHCR-variant syncs pick up committed changes only. The Makefile's mount startup moves under the local-deploy path; `make cluster-status` still reports mount health but `make deploy` no longer requires the repo mount (the `.data/` mount remains required only when `persistence.hostPath` is set, which stays the local default). Storage classes for SQLite and worker PVCs are already values-driven; the change documents the per-environment override contract and keeps hostPath as the explicit local-only branch.

## Risks / Trade-offs

- **[No auth on terminal WS]** Anyone who can reach `main.jarvis.io` gets a root-equivalent shell in worker pods. Acceptable on a laptop cluster; a hard blocker for remote deployment → documented as a prerequisite in CLAUDE.md's limitations table; auth is an explicit non-goal tracked for a follow-up change.
- **[Sync WSClient under asyncio]** Thread-per-attachment pumping could leak threads on abrupt disconnects → every attachment owns a `close()` that closes the WSClient (unblocking the reader thread) and is invoked from WS disconnect handlers and worker stop/delete/archive paths; covered by unit tests with a fake stream.
- **[Interactive TUI vs state hooks]** Hooks (`PreToolUse`/`Stop`/`Notification`) behave the same in interactive mode, but the `waiting_for_human` signal now genuinely means "answer in the terminal" → UI copy updated; terminal is the primary affordance.
- **[Breaking image/runtime change]** Existing workers (headless pods) can't be attached to → workers must be recreated after upgrade; REST API and DB schema are unchanged so no migration is needed. Rollback = revert image tag + chart.
- **[Istio idle timeouts on WS]** Long-idle terminals may be dropped by the mesh → client auto-reconnect + buffer replay makes drops cosmetic; keepalive pings from the bridge every 30 s.
- **[GHCR variant no longer syncs uncommitted charts]** Devs relying on `make deploy` + uncommitted Helm edits lose that flow → use `make deploy-local`, which keeps HEAD-via-mount semantics; called out in Makefile help and CLAUDE.md.

## Migration Plan

1. Land backend + Helm + frontend changes (inert until a new worker image exists).
2. Build/push the new worker image (CI on merge); `make deploy` or `make deploy-local`.
3. Recreate existing workers (archive old, create new). Stateful PVC contents remain compatible (`~/.claude` layout unchanged); the resume probe picks up existing sessions.
4. Rollback: revert the image tag and chart revision; the previous headless flow returns (terminal endpoints then fail with pod-not-attachable, which the UI surfaces as an error status).

## Open Questions

- Exact Git `repoURL`/`targetRevision` for the GHCR variants — confirm the canonical GitHub remote at implementation time.
- `arctl` non-docker pull support (would unlock unconditional de-privilege) — spike separately.
- Whether `waiting_for_human` should also fire a PushNotification/UI toast now that a human can respond in-app — UX follow-up.
