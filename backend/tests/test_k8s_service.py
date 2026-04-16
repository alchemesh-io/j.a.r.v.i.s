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
