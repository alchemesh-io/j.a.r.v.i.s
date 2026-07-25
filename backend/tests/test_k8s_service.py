from unittest.mock import MagicMock, patch

import pytest

from app.services import k8s


@pytest.fixture(autouse=True)
def reset_k8s_state():
    """Reset the module-level K8s client state before each test."""
    k8s._api_v1 = None
    k8s._k8s_available = None
    # The mocked read_namespaced_pod never 404s, so create_worker_pod's
    # delete-and-wait preamble must not block.
    k8s.POD_DELETE_WAIT_S = 0.0
    yield
    k8s._api_v1 = None
    k8s._k8s_available = None
    k8s.POD_DELETE_WAIT_S = 30.0


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


# --- Interactive runtime pod spec ---


def _mocked_pod_api(mock_client, mock_config):
    mock_config.ConfigException = Exception
    mock_api = MagicMock()
    mock_client.CoreV1Api.return_value = mock_api
    k8s._init_client()
    k8s._api_v1 = mock_api
    return mock_api


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_has_worker_and_status_containers(mock_client, mock_config):
    _mocked_pod_api(mock_client, mock_config)
    k8s.create_worker_pod("abc123", 42, "worker:latest", [])

    names = [c.kwargs.get("name") for c in mock_client.V1Container.call_args_list]
    assert names == ["worker", "status"]
    worker_kwargs = mock_client.V1Container.call_args_list[0].kwargs
    assert worker_kwargs["tty"] is True
    assert worker_kwargs["stdin"] is True
    assert worker_kwargs["stdin_once"] is False
    status_kwargs = mock_client.V1Container.call_args_list[1].kwargs
    assert status_kwargs["command"] == ["node", "/opt/jarvis-worker/status-server/index.js"]
    assert status_kwargs.get("security_context") is None
    # Shared state volume mounted in both containers.
    state_mounts = [
        c for c in mock_client.V1VolumeMount.call_args_list
        if c.kwargs.get("mount_path") == "/worker-state"
    ]
    assert len(state_mounts) == 2
    # No vestigial ui port anywhere.
    port_names = [c.kwargs.get("name") for c in mock_client.V1ContainerPort.call_args_list]
    assert "ui" not in port_names


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_unprivileged_without_skills(mock_client, mock_config):
    _mocked_pod_api(mock_client, mock_config)
    k8s.create_worker_pod("abc123", 42, "worker:latest", [], skills=[])
    mock_client.V1SecurityContext.assert_not_called()


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_privileged_with_skills(mock_client, mock_config):
    _mocked_pod_api(mock_client, mock_config)
    k8s.create_worker_pod(
        "abc123", 42, "worker:latest", [], skills=[{"name": "s", "version": "1"}]
    )
    mock_client.V1SecurityContext.assert_called_once_with(privileged=True)


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_passes_task_prompt_and_state_file(mock_client, mock_config):
    _mocked_pod_api(mock_client, mock_config)
    k8s.create_worker_pod("abc123", 42, "worker:latest", [], task_prompt="Do the thing")
    env_calls = mock_client.V1EnvVar.call_args_list
    prompt = [c for c in env_calls if c.kwargs.get("name") == "TASK_PROMPT"]
    assert len(prompt) == 1
    assert prompt[0].kwargs["value"] == "Do the thing"
    state = [c for c in env_calls if c.kwargs.get("name") == "STATE_FILE"]
    # Worker container + status sidecar both get STATE_FILE.
    assert len(state) == 2
    assert all(c.kwargs["value"] == "/worker-state/claude-state" for c in state)


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_deletes_leftover_pod_first(mock_client, mock_config):
    from kubernetes.client.exceptions import ApiException

    mock_api = _mocked_pod_api(mock_client, mock_config)
    mock_api.read_namespaced_pod.side_effect = ApiException(status=404)

    k8s.create_worker_pod("abc123", 42, "worker:latest", [])
    mock_api.delete_namespaced_pod.assert_called_once()
    mock_api.create_namespaced_pod.assert_called_once()


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_create_worker_pod_resources_default_from_env(mock_client, mock_config):
    _mocked_pod_api(mock_client, mock_config)
    k8s.create_worker_pod("abc123", 42, "worker:latest", [])
    # First V1ResourceRequirements call is the worker container's.
    worker_res = mock_client.V1ResourceRequirements.call_args_list[0].kwargs
    assert worker_res["requests"] == {
        "memory": k8s.WORKER_MEMORY_REQUEST,
        "cpu": k8s.WORKER_CPU_REQUEST,
    }
    assert worker_res["limits"] == {
        "memory": k8s.WORKER_MEMORY_LIMIT,
        "cpu": k8s.WORKER_CPU_LIMIT,
    }


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_get_pod_detail_returns_worker_readiness(mock_client, mock_config):
    mock_api = _mocked_pod_api(mock_client, mock_config)
    pod = MagicMock()
    pod.status.phase = "Running"
    pod.status.reason = None
    pod.status.message = None
    cs = MagicMock()
    cs.name = "worker"
    cs.ready = True
    pod.status.container_statuses = [cs]
    mock_api.read_namespaced_pod.return_value = pod

    detail = k8s.get_pod_detail("abc123")
    assert detail["phase"] == "Running"
    assert detail["worker_ready"] is True


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_get_pod_detail_none_on_404(mock_client, mock_config):
    from kubernetes.client.exceptions import ApiException

    mock_api = _mocked_pod_api(mock_client, mock_config)
    mock_api.read_namespaced_pod.side_effect = ApiException(status=404)
    assert k8s.get_pod_detail("abc123") is None


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_read_pod_logs_returns_tail(mock_client, mock_config):
    mock_api = _mocked_pod_api(mock_client, mock_config)
    mock_api.read_namespaced_pod_log.return_value = "line1\nline2"
    assert k8s.read_pod_logs("abc123", tail_lines=2) == "line1\nline2"
    call = mock_api.read_namespaced_pod_log.call_args
    assert call.kwargs["container"] == "worker"
    assert call.kwargs["tail_lines"] == 2


@patch("app.services.k8s.config")
@patch("app.services.k8s.client")
def test_read_pod_logs_none_on_404(mock_client, mock_config):
    from kubernetes.client.exceptions import ApiException

    mock_api = _mocked_pod_api(mock_client, mock_config)
    mock_api.read_namespaced_pod_log.side_effect = ApiException(status=404)
    assert k8s.read_pod_logs("abc123") is None


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
