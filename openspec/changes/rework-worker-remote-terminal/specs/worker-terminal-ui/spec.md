# Spec: worker-terminal-ui

## ADDED Requirements

### Requirement: Worker terminal page renders an xterm.js terminal

The frontend SHALL provide a route `/workers/:id/terminal` rendering the worker's Claude session in an xterm.js terminal connected to `WS /api/v1/workers/{id}/terminal`, and `/workers/:id/terminal?mode=shell` connecting to the shell endpoint instead. The terminal SHALL send keystrokes as binary frames, render binary frames as output, auto-fit to its container (fit addon plus resize observer, emitting resize control frames), and make URLs clickable via the web-links addon (opening only `http(s)` links in a new tab). The page SHALL follow the J.A.D.S dark theme and keep the document title `"J.A.R.V.I.S"`.

#### Scenario: Terminal shows the live Claude session

- **WHEN** the user opens `/workers/{id}/terminal` for a running worker
- **THEN** the current Claude Code screen is rendered and typing in the terminal reaches the session

#### Scenario: Window resize propagates

- **WHEN** the user resizes the browser window
- **THEN** the terminal refits and a resize control frame is sent so the PTY matches the new dimensions

### Requirement: Connection status is visible and reconnection is automatic

The terminal page SHALL display the connection/worker status (from server `status` frames and WebSocket state) in a header badge. On unexpected WebSocket closure while the worker is expected to be live, the client SHALL automatically reconnect with backoff; buffered replay from the bridge covers the gap. When the server reports `stopped` or `error`, the page SHALL show that state and SHALL NOT reconnect automatically.

#### Scenario: Transient drop recovers silently

- **WHEN** the WebSocket drops while the worker is still running
- **THEN** the client reconnects automatically and the scrollback is restored from the replay buffer

#### Scenario: Stopped worker shows terminal state

- **WHEN** the bridge sends `{"type":"status","status":"stopped"}`
- **THEN** the badge shows the stopped state and no reconnect loop starts

### Requirement: Worker cards expose a terminal action row

Each worker card on the Workers page SHALL display an action row with: **Terminal** and **Shell** (enabled only for workers whose pod is live: `working`, `waiting_for_human`, `initialized`), **VSCode** (existing Dev Containers URI behavior), and **Logs** (opens the worker logs endpoint; always enabled while a pod exists). Clicking the WorkerBrain SHALL open the Terminal instead of launching VSCode. Existing Stop/Restart/Delete controls are unchanged.

#### Scenario: Terminal opens from a live worker card

- **WHEN** the user clicks Terminal on a worker in `working` state
- **THEN** the app navigates to `/workers/{id}/terminal` and connects

#### Scenario: Terminal disabled for stopped worker

- **WHEN** a worker is in `stopped` state
- **THEN** the Terminal and Shell actions are disabled while VSCode/Logs behavior follows pod availability

#### Scenario: Brain click opens terminal

- **WHEN** the user clicks the WorkerBrain of a live worker
- **THEN** the terminal page opens (VSCode remains available via its dedicated action)
