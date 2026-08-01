import asyncio
import json
import threading
from unittest.mock import patch

from app.services import terminal
from app.services.terminal import Attachment, RingBuffer, TerminalBridge


# --- Fakes ---


class FakeHandle:
    """Stands in for K8sStreamHandle: replays frames, then blocks until closed."""

    def __init__(self, frames=None, block_after_frames=False):
        self._frames = list(frames or [])
        self._block = block_after_frames
        self._closed = threading.Event()
        self.stdin: list[bytes] = []
        self.resizes: list[tuple[int, int]] = []

    def read(self):
        if self._frames:
            return self._frames.pop(0)
        if self._block:
            self._closed.wait()
        return None

    def write_stdin(self, data: bytes):
        self.stdin.append(data)

    def resize(self, cols: int, rows: int):
        self.resizes.append((cols, rows))

    def close(self):
        self._closed.set()


class FakeWS:
    """Minimal Starlette-WebSocket stand-in for the server->client direction."""

    def __init__(self):
        self.sent_bytes: list[bytes] = []
        self.sent_texts: list[str] = []
        self.closed = False
        self.close_code = None

    async def send_bytes(self, data: bytes):
        self.sent_bytes.append(data)

    async def send_text(self, text: str):
        self.sent_texts.append(text)

    async def close(self, code: int = 1000, reason: str | None = None):
        self.closed = True
        self.close_code = code


class FakeClientWS(FakeWS):
    """Adds the client->server receive() side, replaying scripted messages."""

    def __init__(self, messages):
        super().__init__()
        self._messages = list(messages)

    async def receive(self):
        if self._messages:
            return self._messages.pop(0)
        return {"type": "websocket.disconnect"}


# --- RingBuffer ---


def test_ring_buffer_keeps_recent_data():
    buf = RingBuffer(max_size=10)
    buf.push(b"aaaa")
    buf.push(b"bbbb")
    assert buf.get_all() == b"aaaabbbb"


def test_ring_buffer_evicts_oldest_chunks():
    buf = RingBuffer(max_size=10)
    buf.push(b"aaaa")
    buf.push(b"bbbb")
    buf.push(b"cccc")  # 12 bytes total -> "aaaa" evicted
    assert buf.get_all() == b"bbbbcccc"


# --- Attachment fan-out ---


def test_attachment_fans_out_and_ends():
    asyncio.run(_run_attachment_fans_out_and_ends())


async def _run_attachment_fans_out_and_ends():
    loop = asyncio.get_running_loop()
    handle = FakeHandle(frames=[(1, b"hello "), (2, b"world")])
    dropped = []
    att = Attachment("w1", handle, loop, dropped.append)
    ws = FakeWS()
    att.clients.add(ws)

    with patch.object(terminal.k8s, "get_pod_detail", return_value=None):
        att.start()
        for _ in range(100):
            if dropped:
                break
            await asyncio.sleep(0.02)

    assert b"".join(ws.sent_bytes) == b"hello world"
    assert att.buffer.get_all() == b"hello world"
    assert dropped == ["w1"]
    assert ws.closed
    status = json.loads(ws.sent_texts[-1])
    assert status == {"type": "status", "status": "stopped"}


def test_attachment_close_reports_requested_status():
    asyncio.run(_run_attachment_close_reports_requested_status())


async def _run_attachment_close_reports_requested_status():
    loop = asyncio.get_running_loop()
    handle = FakeHandle(block_after_frames=True)
    dropped = []
    att = Attachment("w2", handle, loop, dropped.append)
    ws = FakeWS()
    att.clients.add(ws)
    att.start()

    att.close("error")
    for _ in range(100):
        if dropped:
            break
        await asyncio.sleep(0.02)

    assert dropped == ["w2"]
    status = json.loads(ws.sent_texts[-1])
    assert status["status"] == "error"


# --- Client receive loop / wire protocol ---


def test_client_loop_forwards_bytes_and_resize():
    asyncio.run(_run_client_loop_forwards_bytes_and_resize())


async def _run_client_loop_forwards_bytes_and_resize():
    handle = FakeHandle()
    ws = FakeClientWS(
        [
            {"type": "websocket.receive", "bytes": b"ls\n"},
            {"type": "websocket.receive", "text": json.dumps({"type": "resize", "cols": 120, "rows": 40})},
            {"type": "websocket.receive", "text": "not json {"},
            {"type": "websocket.receive", "text": json.dumps({"type": "resize", "cols": "x", "rows": 40})},
            {"type": "websocket.disconnect"},
        ]
    )
    bridge = TerminalBridge()
    await bridge._client_loop(ws, handle)

    assert handle.stdin == [b"ls\n"]
    assert handle.resizes == [(120, 40)]  # malformed / non-int frames ignored


# --- Bridge cleanup ---


def test_bridge_cleanup_closes_attachment():
    asyncio.run(_run_bridge_cleanup_closes_attachment())


async def _run_bridge_cleanup_closes_attachment():
    loop = asyncio.get_running_loop()
    bridge = TerminalBridge()
    handle = FakeHandle(block_after_frames=True)
    att = Attachment("w3", handle, loop, bridge._drop)
    bridge._attachments["w3"] = att
    ws = FakeWS()
    att.clients.add(ws)
    att.start()

    # Simulates the stop/delete/archive route paths (sync callers).
    bridge.cleanup("w3", status="stopped")
    for _ in range(100):
        if "w3" not in bridge._attachments:
            break
        await asyncio.sleep(0.02)

    assert "w3" not in bridge._attachments
    assert ws.closed
    assert json.loads(ws.sent_texts[-1])["status"] == "stopped"


# --- Terminal connect failure path ---


def test_connect_terminal_pod_gone_streams_failure_context():
    asyncio.run(_run_connect_terminal_pod_gone())


async def _run_connect_terminal_pod_gone():
    bridge = TerminalBridge()
    ws = FakeClientWS([])
    with (
        patch.object(terminal.k8s, "get_pod_detail", return_value=None),
        patch.object(terminal.k8s, "read_pod_logs", return_value="boom\nlast line"),
    ):
        await bridge.connect_terminal("w4", ws)

    assert ws.closed
    assert ws.close_code == 1011
    # 'starting' was announced, then the failure banner + log tail streamed.
    statuses = [json.loads(t)["status"] for t in ws.sent_texts]
    assert statuses[0] == "starting"
    assert statuses[-1] == "stopped"
    combined = b"".join(ws.sent_bytes)
    assert b"pod log" in combined
    assert b"last line" in combined


def test_connect_shell_rejected_when_pod_not_ready():
    asyncio.run(_run_connect_shell_rejected())


async def _run_connect_shell_rejected():
    bridge = TerminalBridge()
    ws = FakeClientWS([])
    with patch.object(terminal.k8s, "get_pod_detail", return_value={"worker_ready": False}):
        await bridge.connect_shell("w5", ws)
    assert ws.closed
    assert ws.close_code == 1008
