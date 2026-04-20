import logging
import os

import httpx
from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

logger = logging.getLogger(__name__)

NAMESPACE = "jarvis"
WORKER_LABEL = "jarvis-worker"

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



def create_worker_pod(
    worker_id: str,
    task_id: int,
    worker_image: str,
    repositories: list[dict[str, str]],
    skills: list[dict[str, str]] | None = None,
    resource_requests: dict[str, str] | None = None,
    resource_limits: dict[str, str] | None = None,
    image_pull_policy: str = "IfNotPresent",
) -> None:
    """Create a worker pod in the jarvis namespace."""
    if not _init_client():
        raise RuntimeError("Kubernetes cluster not available")

    requests = resource_requests or {"memory": "1Gi", "cpu": "500m"}
    limits = resource_limits or {"memory": "4Gi", "cpu": "2000m"}

    repo_env = ",".join(f"{r['git_url']}@{r['branch']}" for r in repositories)
    skills_env = ",".join(
        f"{s['name']}@{s.get('version', 'latest')}" for s in (skills or [])
    )

    pod = client.V1Pod(
        metadata=client.V1ObjectMeta(
            name=f"jarvis-worker-{worker_id}",
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
            service_account_name="jarvis-backend",
            containers=[
                client.V1Container(
                    name="worker",
                    image=worker_image,
                    image_pull_policy=image_pull_policy,
                    # Rootless dockerd + slirp4netns needs /dev/net/tun and CAP_NET_ADMIN
                    # to set up the TAP device inside its user namespace.
                    security_context=client.V1SecurityContext(
                        capabilities=client.V1Capabilities(
                            add=["NET_ADMIN", "SYS_ADMIN"],
                        ),
                    ),
                    ports=[
                        client.V1ContainerPort(container_port=3000, name="ui"),
                        client.V1ContainerPort(container_port=8080, name="status"),
                    ],
                    env=[
                        client.V1EnvVar(name="WORKER_ID", value=worker_id),
                        client.V1EnvVar(name="TASK_ID", value=str(task_id)),
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
                            name="GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE",
                            value="/etc/gws/credentials.json",
                        ),
                    ],
                    resources=client.V1ResourceRequirements(
                        requests=requests,
                        limits=limits,
                    ),
                    volume_mounts=[
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
                        client.V1VolumeMount(
                            name="dev-net-tun",
                            mount_path="/dev/net/tun",
                        ),
                    ],
                ),
            ],
            volumes=[
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
                # Required by rootless dockerd + slirp4netns to create the TAP device
                client.V1Volume(
                    name="dev-net-tun",
                    host_path=client.V1HostPathVolumeSource(
                        path="/dev/net/tun",
                        type="CharDevice",
                    ),
                ),
            ],
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


def delete_worker_resources(worker_id: str) -> None:
    """Delete all Kubernetes resources for a worker (pod, service)."""
    if not _init_client():
        return

    name = f"jarvis-worker-{worker_id}"

    try:
        _api_v1.delete_namespaced_pod(name=name, namespace=NAMESPACE)
    except ApiException as e:
        if e.status != 404:
            logger.error("Failed to delete worker pod %s: %s", name, e)

    try:
        _api_v1.delete_namespaced_service(name=name, namespace=NAMESPACE)
    except ApiException as e:
        if e.status != 404:
            logger.error("Failed to delete worker service %s: %s", name, e)


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
