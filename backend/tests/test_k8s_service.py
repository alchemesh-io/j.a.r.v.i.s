from unittest.mock import MagicMock, patch

import pytest

from app.services import k8s


@pytest.fixture(autouse=True)
def reset_k8s_state():
    """Reset the module-level K8s client state before each test."""
    k8s._api_v1 = None
    k8s._k8s_available = None
    yield
    k8s._api_v1 = None
    k8s._k8s_available = None


@patch("app.services.k8s.config")
def test_init_client_incluster(mock_config):
    mock_config.ConfigException = Exception
    assert k8s._init_client() is True
    mock_config.load_incluster_config.assert_called_once()


@patch("app.services.k8s.config")
def test_init_client_kubeconfig_fallback(mock_config):
    mock_config.ConfigException = Exception
    mock_config.load_incluster_config.side_effect = Exception("not in cluster")
    assert k8s._init_client() is True
    mock_config.load_kube_config.assert_called_once()


@patch("app.services.k8s.config")
def test_init_client_no_cluster(mock_config):
    mock_config.ConfigException = Exception
    mock_config.load_incluster_config.side_effect = Exception("no cluster")
    mock_config.load_kube_config.side_effect = Exception("no kubeconfig")
    assert k8s._init_client() is False
    assert k8s.is_available() is False


@patch("app.services.k8s.config")
def test_create_worker_pod_no_cluster(mock_config):
    mock_config.ConfigException = Exception
    mock_config.load_incluster_config.side_effect = Exception()
    mock_config.load_kube_config.side_effect = Exception()
    with pytest.raises(RuntimeError, match="not available"):
        k8s.create_worker_pod("abc123", 1, "worker:latest", [])


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_calls_api(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api
    mock_client.CustomObjectsApi.return_value = MagicMock()

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.create_worker_pod(
        "abc123",
        42,
        "worker:latest",
        [{"git_url": "https://github.com/org/repo", "branch": "main"}],
    )
    mock_api.create_namespaced_pod.assert_called_once()
    call_kwargs = mock_api.create_namespaced_pod.call_args
    assert call_kwargs.kwargs["namespace"] == "jarvis"


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_with_skills_env_var(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api
    mock_client.CustomObjectsApi.return_value = MagicMock()

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.create_worker_pod(
        "abc123",
        42,
        "worker:latest",
        [],
        skills=[
            {"name": "planner-daily-wrap-up", "version": "0.1.0"},
            {"name": "code-reviewer", "version": "latest"},
        ],
    )
    mock_api.create_namespaced_pod.assert_called_once()
    # Verify V1EnvVar was called with SKILLS env var
    env_calls = mock_client.V1EnvVar.call_args_list
    skills_calls = [c for c in env_calls if c.kwargs.get("name") == "SKILLS"]
    assert len(skills_calls) == 1
    assert skills_calls[0].kwargs["value"] == "planner-daily-wrap-up@0.1.0,code-reviewer@latest"


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_without_skills_has_empty_env(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api
    mock_client.CustomObjectsApi.return_value = MagicMock()

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.create_worker_pod("abc123", 42, "worker:latest", [])
    env_calls = mock_client.V1EnvVar.call_args_list
    skills_calls = [c for c in env_calls if c.kwargs.get("name") == "SKILLS"]
    assert len(skills_calls) == 1
    assert skills_calls[0].kwargs["value"] == ""


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_service_calls_api(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api
    mock_client.CustomObjectsApi.return_value = MagicMock()

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.create_worker_service("abc123")
    mock_api.create_namespaced_service.assert_called_once()


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_delete_worker_resources(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.delete_worker_resources("abc123")
    mock_api.delete_namespaced_pod.assert_called_once()
    mock_api.delete_namespaced_service.assert_called_once()


@patch("app.services.k8s.config")
def test_delete_worker_resources_no_cluster_is_noop(mock_config):
    mock_config.ConfigException = Exception
    mock_config.load_incluster_config.side_effect = Exception()
    mock_config.load_kube_config.side_effect = Exception()
    # Should not raise
    k8s.delete_worker_resources("abc123")


@patch("app.services.k8s.httpx")
@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_get_worker_pod_status_success(mock_client, mock_config, mock_httpx):
    mock_config.ConfigException = Exception
    mock_client.CoreV1Api.return_value = MagicMock()
    mock_client.CustomObjectsApi.return_value = MagicMock()

    k8s._init_client()

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {"state": "working"}
    mock_httpx.get.return_value = mock_resp

    result = k8s.get_worker_pod_status("abc123")
    assert result == {"state": "working"}


@patch("app.services.k8s.httpx")
@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_get_worker_pod_status_unreachable(mock_client, mock_config, mock_httpx):
    mock_config.ConfigException = Exception
    mock_client.CoreV1Api.return_value = MagicMock()
    mock_client.CustomObjectsApi.return_value = MagicMock()

    k8s._init_client()

    import httpx as real_httpx
    mock_httpx.HTTPError = real_httpx.HTTPError
    mock_httpx.get.side_effect = real_httpx.ConnectError("Connection refused")

    result = k8s.get_worker_pod_status("abc123")
    assert result is None


# --- Stateful mode tests ---


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_stateful_adds_pvc_volume(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api
    mock_client.CustomObjectsApi.return_value = MagicMock()

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.create_worker_pod(
        "abc123",
        42,
        "worker:latest",
        [],
        stateful=True,
    )
    mock_api.create_namespaced_pod.assert_called_once()

    # Verify a PVC volume was added
    pvc_volume_calls = [
        c for c in mock_client.V1Volume.call_args_list
        if c.kwargs.get("name") == "jarvis-data"
    ]
    assert len(pvc_volume_calls) == 1
    # Verify a /home/node mount was added
    home_mount_calls = [
        c for c in mock_client.V1VolumeMount.call_args_list
        if c.kwargs.get("mount_path") == "/home/node"
    ]
    assert len(home_mount_calls) == 1
    # Verify fsGroup was set
    mock_client.V1PodSecurityContext.assert_called_once_with(fs_group=1000)


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_ephemeral_does_not_mount_pvc(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api
    mock_client.CustomObjectsApi.return_value = MagicMock()

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.create_worker_pod(
        "abc123",
        42,
        "worker:latest",
        [],
        stateful=False,
    )

    pvc_volume_calls = [
        c for c in mock_client.V1Volume.call_args_list
        if c.kwargs.get("name") == "jarvis-data"
    ]
    assert len(pvc_volume_calls) == 0
    home_mount_calls = [
        c for c in mock_client.V1VolumeMount.call_args_list
        if c.kwargs.get("mount_path") == "/home/node"
    ]
    assert len(home_mount_calls) == 0
    mock_client.V1PodSecurityContext.assert_not_called()


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_passes_worker_mode_env(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api
    mock_client.CustomObjectsApi.return_value = MagicMock()

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.create_worker_pod("abc123", 42, "worker:latest", [], stateful=True)
    mode_calls = [
        c for c in mock_client.V1EnvVar.call_args_list
        if c.kwargs.get("name") == "WORKER_MODE"
    ]
    assert len(mode_calls) == 1
    assert mode_calls[0].kwargs["value"] == "stateful"


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pvc_calls_api(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.create_worker_pvc("abc123", "5Gi", "fast-ssd")
    mock_api.create_namespaced_persistent_volume_claim.assert_called_once()
    call_kwargs = mock_api.create_namespaced_persistent_volume_claim.call_args
    assert call_kwargs.kwargs["namespace"] == "jarvis"


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pvc_idempotent_on_409(mock_client, mock_config):
    from kubernetes.client.exceptions import ApiException

    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_api.create_namespaced_persistent_volume_claim.side_effect = ApiException(status=409)
    mock_client.CoreV1Api.return_value = mock_api

    k8s._init_client()
    k8s._api_v1 = mock_api

    # Should not raise
    k8s.create_worker_pvc("abc123", "5Gi", "fast-ssd")


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_delete_worker_pvc_idempotent_on_404(mock_client, mock_config):
    from kubernetes.client.exceptions import ApiException

    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_api.delete_namespaced_persistent_volume_claim.side_effect = ApiException(status=404)
    mock_client.CoreV1Api.return_value = mock_api

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.delete_worker_pvc("abc123")  # Should not raise


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_delete_worker_resources_with_delete_pvc(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.delete_worker_resources("abc123", delete_pvc=True)
    mock_api.delete_namespaced_pod.assert_called_once()
    mock_api.delete_namespaced_service.assert_called_once()
    mock_api.delete_namespaced_persistent_volume_claim.assert_called_once()


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_delete_worker_resources_default_keeps_pvc(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api

    k8s._init_client()
    k8s._api_v1 = mock_api

    k8s.delete_worker_resources("abc123")  # default delete_pvc=False
    mock_api.delete_namespaced_pod.assert_called_once()
    mock_api.delete_namespaced_service.assert_called_once()
    mock_api.delete_namespaced_persistent_volume_claim.assert_not_called()


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_get_pod_phase_returns_phase_and_exit_code(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()

    pod = MagicMock()
    pod.status.phase = "Failed"
    cs = MagicMock()
    cs.name = "worker"
    cs.state.terminated.exit_code = 1
    pod.status.container_statuses = [cs]
    mock_api.read_namespaced_pod.return_value = pod

    mock_client.CoreV1Api.return_value = mock_api

    k8s._init_client()
    k8s._api_v1 = mock_api

    phase, exit_code = k8s.get_pod_phase("abc123")
    assert phase == "Failed"
    assert exit_code == 1


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_get_pod_phase_returns_none_on_404(mock_client, mock_config):
    from kubernetes.client.exceptions import ApiException

    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_api.read_namespaced_pod.side_effect = ApiException(status=404)
    mock_client.CoreV1Api.return_value = mock_api

    k8s._init_client()
    k8s._api_v1 = mock_api

    phase, exit_code = k8s.get_pod_phase("abc123")
    assert phase is None
    assert exit_code is None
