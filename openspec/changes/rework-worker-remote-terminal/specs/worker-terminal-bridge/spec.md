# Spec: worker-terminal-bridge

## ADDED Requirements

### Requirement: Terminal WebSocket endpoint attaches to the worker's Claude PTY

The backend SHALL expose `WS /api/v1/workers/{worker_id}/terminal`. On connection it SHALL attach to the worker pod's `worker` container via the Kubernetes `Attach` API (one shared attachment per worker, created lazily on the first client) and bridge PTY bytes to the WebSocket. Multiple concurrent clients SHALL share the same attachment (fan-out). The endpoint SHALL return WebSocket close code 1008 for unknown workers and for workers in `archived` state.

#### Scenario: Client connects to a running worker

- **WHEN** a WebSocket client connects to `/api/v1/workers/{id}/terminal` for a worker whose pod is Ready
- **THEN** it receives the buffered scrollback followed by live PTY output, and its binary frames are written to the Claude PTY

#### Scenario: Two clients share one PTY

- **WHEN** a second client connects while the first is attached
- **THEN** both receive the same output stream and no second pod attachment is created

#### Scenario: Unknown worker rejected

- **WHEN** a client connects for a worker ID that does not exist
- **THEN** the WebSocket is closed with code 1008

### Requirement: Wire protocol uses binary PTY frames and JSON control frames

Terminal and shell WebSockets SHALL use: binary frames for raw PTY bytes in both directions; text frames for JSON control messages. Client→server: `{"type": "resize", "cols": <int>, "rows": <int>}` forwarded to the Kubernetes resize channel. Server→client: `{"type": "status", "status": "starting" | "running" | "stopped" | "error"}`. Malformed JSON text frames SHALL be ignored.

#### Scenario: Resize propagates to the PTY

- **WHEN** a client sends `{"type":"resize","cols":120,"rows":40}`
- **THEN** the pod PTY is resized to 120×40

#### Scenario: Malformed control frame ignored

- **WHEN** a client sends a text frame that is not valid JSON
- **THEN** the connection stays open and the frame is discarded

### Requirement: Ring buffer with replay and log pre-population

The bridge SHALL keep a per-worker in-memory ring buffer (capped at 500 KB) of PTY output and replay it to every newly connected terminal client before live data. When the buffer is empty at attachment creation, the bridge SHALL pre-populate it from the pod's recent logs (up to 500 lines). The buffer SHALL be discarded when the attachment ends.

#### Scenario: Reconnect restores scrollback

- **WHEN** a client disconnects and reconnects while the worker keeps producing output
- **THEN** the reconnected client receives the buffered output covering the gap before live data resumes

#### Scenario: First attach shows recent history

- **WHEN** the first client ever attaches to a worker that has already been running
- **THEN** the terminal shows the pod's recent log tail instead of starting blank

### Requirement: Starting and failure states are surfaced in-terminal

When the worker pod exists but is not yet Ready, the bridge SHALL send `{"type":"status","status":"starting"}` and poll pod readiness for up to 120 seconds before attaching. On pod-gone, non-zero termination, readiness timeout, or attach failure, the bridge SHALL stream a failure banner with the pod phase/reason and the last 100 log lines as terminal output, send `{"type":"status","status":"error"}` (or `"stopped"` when the pod was deliberately removed), and close the WebSocket.

#### Scenario: Pending pod shows starting then attaches

- **WHEN** a client connects while the worker pod is `Pending`
- **THEN** it receives a `starting` status frame, and once the pod is Ready it receives a `running` status frame followed by PTY output

#### Scenario: Failed pod shows failure context

- **WHEN** a client connects for a worker whose pod terminated with a non-zero exit
- **THEN** the terminal displays the pod phase and recent log tail, a status frame is sent, and the socket closes

### Requirement: Shell WebSocket endpoint execs an independent bash

The backend SHALL expose `WS /api/v1/workers/{worker_id}/shell`, which SHALL start an independent `/bin/bash` in the `worker` container via the Kubernetes `Exec` API for each connection (no sharing, no ring buffer) using the same wire protocol. The endpoint SHALL close with code 1008 when the worker's pod is not running.

#### Scenario: Shell tab gets its own process

- **WHEN** two clients connect to `/api/v1/workers/{id}/shell`
- **THEN** each gets an independent bash process; closing one does not affect the other or the Claude session

#### Scenario: Shell refused when pod is gone

- **WHEN** a client connects to the shell endpoint for a stopped worker
- **THEN** the WebSocket is closed with code 1008

### Requirement: Worker pod logs endpoint

The backend SHALL expose `GET /api/v1/workers/{worker_id}/logs?tail=<n>` returning the worker pod's recent log tail as `text/plain` (default tail 500). It SHALL return 404 for unknown workers and for workers without a pod.

#### Scenario: Logs returned for a live worker

- **WHEN** a client requests `/api/v1/workers/{id}/logs?tail=100`
- **THEN** the last 100 log lines of the `worker` container are returned as plain text

#### Scenario: 404 without a pod

- **WHEN** logs are requested for a worker whose pod does not exist
- **THEN** the endpoint returns 404

### Requirement: Bridge cleanup on worker lifecycle operations

Stop, restart, delete, and archive operations on a worker SHALL tear down any active bridge attachment for that worker: connected clients are closed, the pod attachment is closed, and the reader thread terminates. Client disconnects SHALL never leak attachment threads: the attachment closes when its last client disconnects.

#### Scenario: Stop closes connected terminals

- **WHEN** `POST /api/v1/workers/{id}/stop` is called while terminal clients are connected
- **THEN** each client receives a `stopped` status frame and its WebSocket is closed, and the pod attachment is released

#### Scenario: Last client disconnect releases the attachment

- **WHEN** the only connected terminal client disconnects
- **THEN** the pod attachment and its reader thread are closed
