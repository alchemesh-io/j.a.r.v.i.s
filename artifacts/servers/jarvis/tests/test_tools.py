"""Tests for jarvis MCP server tools — tool loading and discovery."""

import sys
from pathlib import Path

import pytest

# Add src to Python path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.server import DynamicMCPServer  # noqa: E402


EXPECTED_TOOLS = ["tasks", "dailies", "weeklies", "task_notes"]


class TestToolLoading:
    """Test that all tools can be loaded successfully."""

    def test_server_initialization(self) -> None:
        server = DynamicMCPServer(name="Test Server", tools_dir="src/tools")
        assert server is not None
        assert server.name == "Test Server"

    def test_tool_discovery(self) -> None:
        server = DynamicMCPServer(name="Test Server", tools_dir="src/tools")
        try:
            server.load_tools()
        except SystemExit:
            pytest.fail("Tool loading failed - server exited")

    def test_loaded_tools_count(self) -> None:
        server = DynamicMCPServer(name="Test Server", tools_dir="src/tools")
        server.load_tools()
        for tool in EXPECTED_TOOLS:
            assert tool in server.loaded_tools, f"Tool module '{tool}' not loaded"

    def test_tool_functions_callable(self) -> None:
        server = DynamicMCPServer(name="Test Server", tools_dir="src/tools")
        server.load_tools()
        tools = server.get_tools_sync()
        for tool_name, tool in tools.items():
            assert hasattr(tool, 'fn'), f"Tool {tool_name} has no fn attribute"
            assert callable(tool.fn), f"Tool {tool_name} is not callable"
