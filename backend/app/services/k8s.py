import logging
from typing import Any

import httpx
from kubernetes import client, config
from kubernetes.client.exceptions import ApiException

logger = logging.getLogger(__name__)

NAMESPACE = "jarvis"
WORKER_LABEL = "jarvis-worker"
GATEWAY_NAME = "jarvis-gateway"
GATEWAY_NAMESPACE = "istio-system"
WORKER_HOST = "jaw.jarvis.io"

_api_v1: client.CoreV1Api | None = None
_custom_api: client.CustomObjectsApi | None = None
_k8s_available: bool | None = None


def _init_client() -> bool:
    """Initialize Kubernetes client. Returns True if available."""
    global _api_v1, _custom_api, _k8s_available
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
    _custom_api = client.CustomObjectsApi()
    return True


def is_available() -> bool:
    """Check if Kubernetes cluster is available."""
    return _init_client()



def create_worker_pod(
    worker_id: str,
    task_id: int,
    worker_image: str,
    repositories: list[dict[str, str]],
    resource_requests: dict[str, str] | None = None,
    resource_limits: dict[str, str] | None = None,
    image_pull_policy: str = "IfNotPresent",
) -> None:
    """Create a worker pod in the jarvis namespace."""
    if not _init_client():
        raise RuntimeError("Kubernetes cluster not available")

    requests = resource_requests or {"memory": "256Mi", "cpu": "250m"}
    limits = resource_limits or {"memory": "1Gi", "cpu": "1000m"}

    repo_env = ",".join(f"{r['git_url']}@{r['branch']}" for r in repositories)

    pod = client.V1Pod(
        metadata=client.V1ObjectMeta(
            name=f"jarvis-worker-{worker_id}",
            namespace=NAMESPACE,
            labels={
                "app": WORKER_LABEL,
                "worker-id": worker_id,
            },
        ),
        spec=client.V1PodSpec(
            service_account_name="jarvis-backend",
            containers=[
                client.V1Container(
                    name="worker",
                    image=worker_image,
                    image_pull_policy=image_pull_policy,
                    ports=[
                        client.V1ContainerPort(container_port=3000, name="ui"),
                        client.V1ContainerPort(container_port=8080, name="status"),
                    ],
                    env=[
                        client.V1EnvVar(name="WORKER_ID", value=worker_id),
                        client.V1EnvVar(name="TASK_ID", value=str(task_id)),
                        client.V1EnvVar(name="REPOSITORIES", value=repo_env),
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
                client.V1ServicePort(name="ui", port=3000, target_port=3000),
                client.V1ServicePort(name="status", port=8080, target_port=8080),
            ],
        ),
    )
    _api_v1.create_namespaced_service(namespace=NAMESPACE, body=service)


def create_worker_httproute(worker_id: str) -> None:
    """Create a Gateway API HTTPRoute for a worker."""
    if not _init_client():
        raise RuntimeError("Kubernetes cluster not available")

    httproute: dict[str, Any] = {
        "apiVersion": "gateway.networking.k8s.io/v1",
        "kind": "HTTPRoute",
        "metadata": {
            "name": f"jarvis-worker-{worker_id}",
            "namespace": NAMESPACE,
            "labels": {
                "app": WORKER_LABEL,
                "worker-id": worker_id,
            },
        },
        "spec": {
            "parentRefs": [
                {
                    "name": GATEWAY_NAME,
                    "namespace": GATEWAY_NAMESPACE,
                }
            ],
            "hostnames": [WORKER_HOST],
            "rules": [
                {
                    "matches": [
                        {
                            "path": {
                                "type": "PathPrefix",
                                "value": f"/{worker_id}",
                            }
                        }
                    ],
                    "filters": [
                        {
                            "type": "URLRewrite",
                            "urlRewrite": {
                                "path": {
                                    "type": "ReplacePrefixMatch",
                                    "replacePrefixMatch": "/",
                                }
                            },
                        }
                    ],
                    "backendRefs": [
                        {
                            "name": f"jarvis-worker-{worker_id}",
                            "port": 3000,
                        }
                    ],
                }
            ],
        },
    }
    _custom_api.create_namespaced_custom_object(
        group="gateway.networking.k8s.io",
        version="v1",
        namespace=NAMESPACE,
        plural="httproutes",
        body=httproute,
    )


def delete_worker_resources(worker_id: str) -> None:
    """Delete all Kubernetes resources for a worker (pod, service, httproute)."""
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

    try:
        _custom_api.delete_namespaced_custom_object(
            group="gateway.networking.k8s.io",
            version="v1",
            namespace=NAMESPACE,
            plural="httproutes",
            name=name,
        )
    except ApiException as e:
        if e.status != 404:
            logger.error("Failed to delete worker httproute %s: %s", name, e)


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
