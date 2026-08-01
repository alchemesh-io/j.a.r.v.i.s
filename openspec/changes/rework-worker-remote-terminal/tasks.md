# Tasks: rework-worker-remote-terminal

## 1. Worker interactive runtime (image)

- [x] 1.1 Rework `worker/entrypoint.sh`: drop the FIFO/headless launch and the backgrounded status server; add the session probe (`~/.claude/projects/**/*.jsonl` → `--resume <id>`) and end with `exec claude --dangerously-skip-permissions` (with `"$TASK_PROMPT"` on the fresh path)
- [x] 1.2 Update `worker/setup-claude.sh`: hooks write to `$STATE_FILE` (default `/worker-state/claude-state`) instead of `/tmp/claude-state`
- [x] 1.3 Update `worker/status-server/index.js`: read state from `$STATE_FILE`, tolerate missing file (report `initialized`), keep 3s push loop and `/status` + `/health`
- [x] 1.4 Update `worker/Dockerfile` if needed (no new binaries required; keep `/opt/jarvis-worker` layout; document sidecar usage)

## 2. Worker pod spec (backend k8s service)

- [x] 2.1 `app/services/k8s.py`: two-container pod — `worker` (entrypoint, `tty/stdin/stdinOnce`, `TASK_PROMPT`, `STATE_FILE`, conditional `privileged` on skills) and `status` sidecar (node status-server, never privileged); shared `emptyDir` at `/worker-state`; remove port 3000
- [x] 2.2 `app/services/k8s.py`: idempotent `create_worker_pod` (delete-ignore-404 before create); worker resources from env vars instead of hardcoded constants
- [x] 2.3 `app/routes/workers.py`: pass task prompt (title + description) into pod creation
- [x] 2.4 Backend tests for pod spec changes (conditional privilege, sidecar, TASK_PROMPT, idempotent create)

## 3. Terminal bridge (backend)

- [x] 3.1 New `app/services/terminal.py`: `RingBuffer` (500 KB), `Attachment` (WSClient reader thread → asyncio fan-out, write/resize/close), `TerminalBridge` (per-worker attachments, lazy create, log pre-population, readiness wait + failure context, cleanup API)
- [x] 3.2 WS routes: `WS /api/v1/workers/{id}/terminal` (shared attach) and `WS /api/v1/workers/{id}/shell` (per-connection exec), wire protocol (binary PTY / JSON resize+status), close codes
- [x] 3.3 `GET /api/v1/workers/{id}/logs?tail=` plain-text endpoint
- [x] 3.4 Hook bridge cleanup into stop/restart/delete/archive paths in `app/routes/workers.py`
- [x] 3.5 Backend tests: ring buffer, protocol handling with a fake attach handle, WS routes via TestClient with mocked k8s, logs endpoint

## 4. Terminal UI (frontend)

- [x] 4.1 Add `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links`; typed WS helper in `src/api/client.ts` (terminal/shell URL builders, `getWorkerLogsUrl`)
- [x] 4.2 New `src/pages/Workers/WorkerTerminal.tsx` (+ CSS): xterm wiring, resize observer, status badge, auto-reconnect with backoff, `?mode=shell`; route `/workers/:id/terminal` in `App.tsx`
- [x] 4.3 Workers page: action row (Terminal/Shell/VSCode/Logs) on worker cards; brain click → terminal; keep Stop/Restart/Delete
- [x] 4.4 Frontend checks: `tsc`, build, and component test for action-row gating

## 5. Portable deployment

- [x] 5.1 `argocd/jarvis-app.yaml` + `argocd/jaar-app.yaml`: Git `repoURL` + `targetRevision: main`; verify `-local` variants unchanged
- [x] 5.2 Helm: plumb `worker.resources` through `backend-configmap.yaml`; verify storage-class values contract (`persistence.hostPath` local-only)
- [x] 5.3 Makefile: `deploy` no longer requires the repo mount; help text and `cluster-status` wording updated

## 6. Docs & verification

- [x] 6.1 Update `CLAUDE.md`: interactive runtime, terminal endpoints/UI, sidecar, conditional privilege, Git-sourced ArgoCD, remove per-worker HTTPRoute claims, limitations (no auth on terminal, single-replica bridge)
- [x] 6.2 Run backend pytest, frontend build/tests; fix regressions
