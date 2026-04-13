## ADDED Requirements

### Requirement: jaw.jarvis.io hostname in Istio gateway
The Istio gateway SHALL accept traffic for `jaw.jarvis.io` on both the HTTP (:80) and HTTPS (:443) listeners, matching the existing `*.jarvis.io` wildcard pattern.

#### Scenario: HTTP request to jaw.jarvis.io accepted
- **WHEN** an HTTP request is sent to `jaw.jarvis.io` on port 80
- **THEN** the Istio gateway accepts and routes the request

#### Scenario: HTTPS request to jaw.jarvis.io accepted
- **WHEN** an HTTPS request is sent to `jaw.jarvis.io` on port 443
- **THEN** the Istio gateway terminates TLS using the `jarvis-io-tls` wildcard cert and routes the request

### Requirement: Dynamic HTTPRoute per worker
The backend SHALL create an HTTPRoute resource for each worker pod. The HTTPRoute SHALL match hostname `jaw.jarvis.io` with path prefix `/<worker_id>/` and route traffic to the worker's service (`jarvis-worker-<worker_id>`) on port 3000.

#### Scenario: HTTPRoute created with worker
- **WHEN** a worker pod is created
- **THEN** an HTTPRoute named `jarvis-worker-<worker_id>` is created in the `jarvis` namespace referencing the Istio gateway

#### Scenario: Path prefix stripped before forwarding
- **WHEN** a request arrives at `jaw.jarvis.io/<worker_id>/chat`
- **THEN** the worker UI receives the request with path `/chat` (prefix stripped)

#### Scenario: HTTPRoute deleted with worker
- **WHEN** a worker is deleted or archived
- **THEN** the corresponding HTTPRoute is deleted from the cluster

### Requirement: /etc/hosts documentation for jaw.jarvis.io
The project documentation and Makefile `jarvis-ui` target SHALL include `jaw.jarvis.io` in the list of hostnames to add to `/etc/hosts`.

#### Scenario: jaw.jarvis.io in Makefile output
- **WHEN** `make jarvis-ui` is executed
- **THEN** the output includes `jaw.jarvis.io` in the hosts entry instructions

### Requirement: Worker status endpoint not exposed via gateway
The worker status endpoint (port 8080) SHALL only be accessible within the cluster. It SHALL NOT be routed through the Istio gateway.

#### Scenario: Status endpoint only reachable in-cluster
- **WHEN** the backend queries `http://jarvis-worker-<worker_id>.jarvis.svc:8080/status`
- **THEN** the status response is returned

#### Scenario: Status endpoint not reachable externally
- **WHEN** an external request is sent to `jaw.jarvis.io/<worker_id>/status`
- **THEN** the request is routed to the worker UI (port 3000), not the status endpoint
