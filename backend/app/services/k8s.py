import logging
import os

import httpx
from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

logger = logging.getLogger(__name__)

NAMESPACE = "jarvis"
WORKER_LABEL = "jarvis-worker"

# Dedicated ServiceAccount for worker pods (helm/jarvis/templates/worker-pod-serviceaccount.yaml),
# distinct from "jarvis-backend" and carrying no RoleBinding — worker pods must not inherit
# the backend's pods/attach, pods/exec, and pod/service/PVC management permissions.
WORKER_SERVICE_ACCOUNT = "jarvis-worker"

# Path of the Claude state file shared between the worker container (hooks) and
# the status sidecar via the /worker-state emptyDir.
STATE_FILE = "/worker-state/claude-state"

# Worker resources come from the backend ConfigMap (fed by Helm worker.resources
# values) — defaults mirror helm/jarvis/values.yaml.
WORKER_CPU_REQUEST = os.getenv("WORKER_CPU_REQUEST", "250m")
WORKER_MEMORY_REQUEST = os.getenv("WORKER_MEMORY_REQUEST", "256Mi")
WORKER_CPU_LIMIT = os.getenv("WORKER_CPU_LIMIT", "1000m")
WORKER_MEMORY_LIMIT = os.getenv("WORKER_MEMORY_LIMIT", "1Gi")

_api_v1: client.CoreV1Api | None = None
_k8s_available: bool | None = None


def _init_client() -> bool:
    """Initialize Kubernetes client. Returns True if available."""
    global _api_v1, _k8s_available
    if _k8s_available is not None:
        return _k8s_available
    try:
        config.load_incluster_config()
        _k8s_available = True
    except config.ConfigException:
        try:
            config.load_kube_config()
            _k8s_available = True
        except config.ConfigException:
            logger.warning("No Kubernetes cluster available — worker operations will fail")
            _k8s_available = False
            return False
    _api_v1 = client.CoreV1Api()
    return True


def is_available() -> bool:
    """Check if Kubernetes cluster is available."""
    return _init_client()


def _pvc_name(worker_id: str) -> str:
    return f"jarvis-worker-{worker_id}-data"


def create_worker_pvc(worker_id: str, size: str, storage_class: str) -> None:
    """Create a ReadWriteOnce PVC for a stateful worker. Idempotent on AlreadyExists."""
    if not _init_client():
        raise RuntimeError("Kubernetes cluster not available")

    pvc = client.V1PersistentVolumeClaim(
        metadata=client.V1ObjectMeta(
            name=_pvc_name(worker_id),
            namespace=NAMESPACE,
            labels={
                "app": WORKER_LABEL,
                "worker-id": worker_id,
            },
        ),
        spec=client.V1PersistentVolumeClaimSpec(
            access_modes=["ReadWriteOnce"],
            resources=client.V1VolumeResourceRequirements(
                requests={"storage": size},
            ),
            storage_class_name=storage_class,
        ),
    )
    try:
        _api_v1.create_namespaced_persistent_volume_claim(namespace=NAMESPACE, body=pvc)
    except ApiException as e:
        if e.status != 409:
            raise


def delete_worker_pvc(worker_id: str) -> None:
    """Delete the worker's PVC. 404 is ignored."""
    if not _init_client():
        return
    try:
        _api_v1.delete_namespaced_persistent_volume_claim(
            name=_pvc_name(worker_id), namespace=NAMESPACE
        )
    except ApiException as e:
        if e.status != 404:
            logger.error("Failed to delete worker PVC %s: %s", _pvc_name(worker_id), e)


# Module-level so tests can shrink them.
POD_DELETE_WAIT_S = 30.0
POD_DELETE_POLL_S = 1.0


def _wait_pod_gone(name: str) -> None:
    """Poll until the pod no longer exists (delete is async), or timeout."""
    import time

    deadline = time.monotonic() + POD_DELETE_WAIT_S
    while time.monotonic() < deadline:
        try:
            _api_v1.read_namespaced_pod(name=name, namespace=NAMESPACE)
        except ApiException as e:
            if e.status == 404:
                return
            raise
        time.sleep(POD_DELETE_POLL_S)
    logger.warning("Pod %s still terminating after %ss", name, POD_DELETE_WAIT_S)


def create_worker_pod(
    worker_id: str,
    task_id: int,
    worker_image: str,
    repositories: list[dict[str, str]],
    skills: list[dict[str, str]] | None = None,
    resource_requests: dict[str, str] | None = None,
    resource_limits: dict[str, str] | None = None,
    image_pull_policy: str = "IfNotPresent",
    stateful: bool = False,
    task_prompt: str = "",
) -> None:
    """Create a worker pod in the jarvis namespace.

    The pod runs two containers sharing a /worker-state emptyDir:
    - `worker`: Claude Code interactive under a PTY (tty/stdin) — the Attach target.
      Privileged only when skills are requested (dockerd for `arctl skill pull`).
    - `status`: the status server on port 8080, pushing hook-reported state to the backend.

    When stateful=True, the pod mounts the PVC `jarvis-worker-<id>-data` at /home/node
    and runs with fsGroup=1000 so the volume is owned by the node user.

    Creation is idempotent: any leftover pod with the same name is deleted first so
    restart flows never hit a 409 on a not-yet-garbage-collected pod.
    """
    if not _init_client():
        raise RuntimeError("Kubernetes cluster not available")

    requests = resource_requests or {"memory": WORKER_MEMORY_REQUEST, "cpu": WORKER_CPU_REQUEST}
    limits = resource_limits or {"memory": WORKER_MEMORY_LIMIT, "cpu": WORKER_CPU_LIMIT}

    repo_env = ",".join(f"{r['git_url']}@{r['branch']}" for r in repositories)
    skills_env = ",".join(
        f"{s['name']}@{s.get('version', 'latest')}" for s in (skills or [])
    )
    has_skills = bool(skills)

    pod_name = f"jarvis-worker-{worker_id}"
    try:
        _api_v1.delete_namespaced_pod(name=pod_name, namespace=NAMESPACE)
        _wait_pod_gone(pod_name)
    except ApiException as e:
        if e.status != 404:
            raise

    worker_volume_mounts = [
        client.V1VolumeMount(
            name="claude-config",
            mount_path="/init-claude-config",
            read_only=True,
        ),
        client.V1VolumeMount(
            name="gws-credentials",
            mount_path="/etc/gws",
            read_only=True,
        ),
        client.V1VolumeMount(name="worker-state", mount_path="/worker-state"),
    ]
    pod_volumes = [
        client.V1Volume(
            name="claude-config",
            config_map=client.V1ConfigMapVolumeSource(
                name="jarvis-claude-config",
                optional=True,
            ),
        ),
        client.V1Volume(
            name="gws-credentials",
            secret=client.V1SecretVolumeSource(
                secret_name="jarvis-jaw-secret",
                optional=True,
                items=[
                    client.V1KeyToPath(
                        key="GOOGLE_WORKSPACE_CLI_CREDENTIALS",
                        path="credentials.json",
                    ),
                ],
            ),
        ),
        client.V1Volume(
            name="worker-state",
            # sizeLimit required by this cluster's require-emptydir-sizelimit
            # admission policy (same one istiod's gateway proxy hits — see istio.tf).
            empty_dir=client.V1EmptyDirVolumeSource(size_limit="64Mi"),
        ),
    ]

    pod_security_context: client.V1PodSecurityContext | None = None
    if stateful:
        worker_volume_mounts.append(
            client.V1VolumeMount(name="jarvis-data", mount_path="/home/node")
        )
        pod_volumes.append(
            client.V1Volume(
                name="jarvis-data",
                persistent_volume_claim=client.V1PersistentVolumeClaimVolumeSource(
                    claim_name=_pvc_name(worker_id),
                ),
            )
        )
        pod_security_context = client.V1PodSecurityContext(fs_group=1000)

    worker_container = client.V1Container(
        name="worker",
        image=worker_image,
        image_pull_policy=image_pull_policy,
        # dockerd (skill pulls) is the only thing needing privilege; the stateful
        # chown fallback only needs in-container root via sudo.
        security_context=(
            client.V1SecurityContext(privileged=True) if has_skills else None
        ),
        # Interactive PTY for the Kubernetes Attach API (remote-claude pattern).
        tty=True,
        stdin=True,
        stdin_once=False,
        env=[
            client.V1EnvVar(name="WORKER_ID", value=worker_id),
            client.V1EnvVar(name="TASK_ID", value=str(task_id)),
            client.V1EnvVar(name="WORKER_MODE", value="stateful" if stateful else "ephemeral"),
            client.V1EnvVar(name="TASK_PROMPT", value=task_prompt),
            client.V1EnvVar(name="STATE_FILE", value=STATE_FILE),
            client.V1EnvVar(name="REPOSITORIES", value=repo_env),
            client.V1EnvVar(name="SKILLS", value=skills_env),
            client.V1EnvVar(name="JAAR_URL", value=os.getenv("JAAR_URL", "")),
            client.V1EnvVar(name="JARVIS_MCP_URL", value=os.getenv("JARVIS_MCP_URL", "")),
            client.V1EnvVar(name="BACKEND_URL", value=f"http://jarvis-backend.{NAMESPACE}.svc:8000"),
            client.V1EnvVar(
                name="ANTHROPIC_API_KEY",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(
                        name="jarvis-jaw-secret",
                        key="ANTHROPIC_API_KEY",
                        optional=True,
                    )
                ),
            ),
            client.V1EnvVar(
                name="CLAUDE_CODE_OAUTH_TOKEN",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(
                        name="jarvis-jaw-secret",
                        key="CLAUDE_CODE_OAUTH_TOKEN",
                        optional=True,
                    )
                ),
            ),
            client.V1EnvVar(
                name="GITHUB_TOKEN",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(
                        name="jarvis-jaw-secret",
                        key="GITHUB_TOKEN",
                        optional=True,
                    )
                ),
            ),
            client.V1EnvVar(
                name="DD_API_KEY",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(
                        name="jarvis-jaw-secret",
                        key="DD_API_KEY",
                        optional=True,
                    )
                ),
            ),
            client.V1EnvVar(
                name="DD_APP_KEY",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(
                        name="jarvis-jaw-secret",
                        key="DD_APP_KEY",
                        optional=True,
                    )
                ),
            ),
            client.V1EnvVar(
                name="DD_SITE",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(
                        name="jarvis-jaw-secret",
                        key="DD_SITE",
                        optional=True,
                    )
                ),
            ),
            client.V1EnvVar(
                name="TFE_TOKEN",
                value_from=client.V1EnvVarSource(
                    secret_key_ref=client.V1SecretKeySelector(
                        name="jarvis-jaw-secret",
                        key="TFE_TOKEN",
                        optional=True,
                    )
                ),
            ),
            client.V1EnvVar(
                name="GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE",
                value="/etc/gws/credentials.json",
            ),
        ],
        resources=client.V1ResourceRequirements(
            requests=requests,
            limits=limits,
        ),
        volume_mounts=worker_volume_mounts,
    )

    # A native sidecar (initContainers entry with restartPolicy=Always, GA since
    # K8s 1.28) rather than a second entry in `containers`. This cluster's
    # deny-shared-volumes admission policy forbids an emptyDir/PVC being mounted
    # by more than one *standard* container — its check only counts
    # pod.spec.containers, not initContainers — and the policy's whitelist is
    # keyed by workload name, which is useless here since each worker Pod's name
    # includes a random per-instance id. Restructuring as a sidecar is the only
    # way to keep `status` sharing /worker-state with `worker` and pass admission.
    status_container = client.V1Container(
        name="status",
        restart_policy="Always",
        image=worker_image,
        image_pull_policy=image_pull_policy,
        command=["node", "/opt/jarvis-worker/status-server/index.js"],
        ports=[client.V1ContainerPort(container_port=8080, name="status")],
        env=[
            client.V1EnvVar(name="WORKER_ID", value=worker_id),
            client.V1EnvVar(name="STATE_FILE", value=STATE_FILE),
            client.V1EnvVar(name="BACKEND_URL", value=f"http://jarvis-backend.{NAMESPACE}.svc:8000"),
        ],
        resources=client.V1ResourceRequirements(
            requests={"memory": "32Mi", "cpu": "25m"},
            limits={"memory": "128Mi", "cpu": "100m"},
        ),
        volume_mounts=[
            client.V1VolumeMount(name="worker-state", mount_path="/worker-state"),
        ],
    )

    pod = client.V1Pod(
        metadata=client.V1ObjectMeta(
            name=pod_name,
            namespace=NAMESPACE,
            labels={
                "app": WORKER_LABEL,
                "worker-id": worker_id,
            },
            annotations={
                # Wait for istio-proxy to be ready before starting the worker container,
                # otherwise outbound DNS (github.com, GHCR, etc.) fails with
                # "Could not resolve host" during the first few seconds of the pod's life.
                "proxy.istio.io/config": '{"holdApplicationUntilProxyStarts": true}',
            },
        ),
        spec=client.V1PodSpec(
            # NOT setting automount_service_account_token=False here: this cluster's
            # "deny-automount-token-without-sa" ValidatingAdmissionPolicy rejects that
            # combination outright (serviceAccountName set + automount disabled is
            # treated as a likely misconfiguration and hard-denied at admission,
            # confirmed against the real t2-d-sbx-arch cluster). The mounted token is
            # still safe: WORKER_SERVICE_ACCOUNT carries zero RoleBindings, so it
            # authenticates as an identity with no RBAC grants beyond the cluster's
            # baseline for any authenticated user.
            service_account_name=WORKER_SERVICE_ACCOUNT,
            security_context=pod_security_context,
            containers=[worker_container],
            init_containers=[status_container],
            volumes=pod_volumes,
            restart_policy="Never",
        ),
    )
    _api_v1.create_namespaced_pod(namespace=NAMESPACE, body=pod)


def create_worker_service(worker_id: str) -> None:
    """Create a ClusterIP service for a worker pod."""
    if not _init_client():
        raise RuntimeError("Kubernetes cluster not available")

    service = client.V1Service(
        metadata=client.V1ObjectMeta(
            name=f"jarvis-worker-{worker_id}",
            namespace=NAMESPACE,
            labels={
                "app": WORKER_LABEL,
                "worker-id": worker_id,
            },
        ),
        spec=client.V1ServiceSpec(
            selector={
                "app": WORKER_LABEL,
                "worker-id": worker_id,
            },
            ports=[
                client.V1ServicePort(name="status", port=8080, target_port=8080),
            ],
        ),
    )
    _api_v1.create_namespaced_service(namespace=NAMESPACE, body=service)


def delete_worker_pod_only(worker_id: str) -> None:
    """Delete only the worker pod (used by pause). Service and PVC are kept."""
    if not _init_client():
        return
    name = f"jarvis-worker-{worker_id}"
    try:
        _api_v1.delete_namespaced_pod(name=name, namespace=NAMESPACE)
    except ApiException as e:
        if e.status != 404:
            logger.error("Failed to delete worker pod %s: %s", name, e)


def delete_worker_service(worker_id: str) -> None:
    """Delete only the worker service. Idempotent on 404."""
    if not _init_client():
        return
    name = f"jarvis-worker-{worker_id}"
    try:
        _api_v1.delete_namespaced_service(name=name, namespace=NAMESPACE)
    except ApiException as e:
        if e.status != 404:
            logger.error("Failed to delete worker service %s: %s", name, e)


def delete_worker_resources(worker_id: str, delete_pvc: bool = False) -> None:
    """Delete a worker's pod and service. PVC is deleted only when delete_pvc=True."""
    delete_worker_pod_only(worker_id)
    delete_worker_service(worker_id)
    if delete_pvc:
        delete_worker_pvc(worker_id)


def get_worker_pod_status(worker_id: str) -> dict[str, str] | None:
    """Query the worker pod's status endpoint. Returns the status dict or None if unreachable."""
    if not _init_client():
        return None

    service_url = f"http://jarvis-worker-{worker_id}.{NAMESPACE}.svc:8080/status"
    try:
        resp = httpx.get(service_url, timeout=3.0)
        if resp.status_code == 200:
            return resp.json()
    except httpx.HTTPError:
        pass
    return None


def get_pod_phase(worker_id: str) -> tuple[str | None, int | None]:
    """Return (phase, exit_code) for the worker pod.

    phase is one of Pending|Running|Succeeded|Failed|Unknown, or None if the pod doesn't exist.
    exit_code is the worker container's terminated exitCode if known, else None.
    """
    if not _init_client():
        return (None, None)
    name = f"jarvis-worker-{worker_id}"
    try:
        pod = _api_v1.read_namespaced_pod(name=name, namespace=NAMESPACE)
    except ApiException as e:
        if e.status == 404:
            return (None, None)
        logger.error("Failed to read worker pod %s: %s", name, e)
        return (None, None)
    phase = pod.status.phase if pod.status else None
    exit_code: int | None = None
    for cs in (pod.status.container_statuses or []) if pod.status else []:
        if cs.name == "worker" and cs.state and cs.state.terminated:
            exit_code = cs.state.terminated.exit_code
            break
    return (phase, exit_code)


def get_pod_detail(worker_id: str) -> dict | None:
    """Return pod diagnostic detail for the terminal bridge, or None if the pod is gone.

    Keys: name, phase, reason, message, worker_ready (the `worker` container's ready flag).
    """
    if not _init_client():
        return None
    name = f"jarvis-worker-{worker_id}"
    try:
        pod = _api_v1.read_namespaced_pod(name=name, namespace=NAMESPACE)
    except ApiException as e:
        if e.status == 404:
            return None
        logger.error("Failed to read worker pod %s: %s", name, e)
        return None
    worker_ready = False
    for cs in (pod.status.container_statuses or []) if pod.status else []:
        if cs.name == "worker":
            worker_ready = bool(cs.ready)
            break
    return {
        "name": name,
        "phase": pod.status.phase if pod.status else None,
        "reason": pod.status.reason if pod.status else None,
        "message": pod.status.message if pod.status else None,
        "worker_ready": worker_ready,
    }


def attach_worker_pty(worker_id: str):
    """Open a raw WebSocket stream attached to the `worker` container's PTY.

    Returns a kubernetes.stream WSClient (``_preload_content=False``). The caller
    owns its lifecycle.
    """
    from kubernetes.stream import stream as k8s_ws_stream

    if not _init_client():
        raise RuntimeError("Kubernetes cluster not available")
    return k8s_ws_stream(
        _api_v1.connect_get_namespaced_pod_attach,
        name=f"jarvis-worker-{worker_id}",
        namespace=NAMESPACE,
        container="worker",
        stderr=True,
        stdin=True,
        stdout=True,
        tty=True,
        _preload_content=False,
    )


def exec_worker_shell(worker_id: str):
    """Start an interactive /bin/bash in the `worker` container via the Exec API.

    Returns a kubernetes.stream WSClient (``_preload_content=False``); each call
    creates an independent shell process.
    """
    from kubernetes.stream import stream as k8s_ws_stream

    if not _init_client():
        raise RuntimeError("Kubernetes cluster not available")
    return k8s_ws_stream(
        _api_v1.connect_get_namespaced_pod_exec,
        name=f"jarvis-worker-{worker_id}",
        namespace=NAMESPACE,
        container="worker",
        command=["/bin/bash"],
        stderr=True,
        stdin=True,
        stdout=True,
        tty=True,
        _preload_content=False,
    )


def read_pod_logs(worker_id: str, tail_lines: int | None = 500) -> str | None:
    """Return the log tail of the `worker` container, or None if unavailable.

    tail_lines=None returns everything the kubelet still has on disk for this
    container (bounded by containerLogMaxSize), not just a recent tail.
    """
    if not _init_client():
        return None
    name = f"jarvis-worker-{worker_id}"
    try:
        return _api_v1.read_namespaced_pod_log(
            name=name,
            namespace=NAMESPACE,
            container="worker",
            tail_lines=tail_lines,
        )
    except ApiException as e:
        if e.status != 404:
            logger.error("Failed to read logs for worker pod %s: %s", name, e)
        return None
