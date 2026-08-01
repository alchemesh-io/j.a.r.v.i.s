"""WebSocket bridge between browser terminals and worker pod PTYs.

Ported from doctolib/remote-claude's TerminalBridge/ShellBridge (Node) to the
FastAPI backend. The sync kubernetes WSClient is pumped by one reader thread per
attachment; output is fanned out to browser WebSocket clients on the event loop.

Wire protocol (both endpoints):
- binary frames: raw PTY bytes in both directions
- text frames (JSON):
    client -> server  {"type": "resize", "cols": int, "rows": int}
    server -> client  {"type": "status", "status": "starting"|"running"|"stopped"|"error"}
"""

import asyncio
import json
import logging
import threading
from collections import deque

from starlette.websockets import WebSocket, WebSocketDisconnect

from app.services import k8s

logger = logging.getLogger(__name__)

# Sized so a reconnect hands the client back roughly what xterm's in-browser
# scrollback covers — several thousand lines of typical Claude output.
MAX_BUFFER = 500 * 1024

READY_POLL_S = 2.0
READY_TIMEOUT_S = 120.0
KEEPALIVE_S = 30.0

# K8s remote-command protocol channels
STDIN_CHANNEL = 0
STDOUT_CHANNEL = 1
STDERR_CHANNEL = 2
RESIZE_CHANNEL = 4


class RingBuffer:
    """Bounded byte buffer replayed to newly connected terminal clients."""

    def __init__(self, max_size: int = MAX_BUFFER):
        self._chunks: deque[bytes] = deque()
        self._total = 0
        self._max = max_size

    def push(self, data: bytes) -> None:
        self._chunks.append(data)
        self._total += len(data)
        while self._total > self._max and self._chunks:
            removed = self._chunks.popleft()
            self._total -= len(removed)

    def get_all(self) -> bytes:
        return b"".join(self._chunks)


class K8sStreamHandle:
    """Raw-byte adapter over a kubernetes.stream WSClient.

    WSClient.update() decodes frames to str (utf-8/replace), which can corrupt
    multi-byte sequences split across frames — so we read the underlying socket
    frames directly and keep everything as bytes.
    """

    def __init__(self, ws_client):
        self._ws = ws_client

    def read(self) -> tuple[int, bytes] | None:
        """Block until the next data frame. Returns (channel, payload) or None on close."""
        from websocket import ABNF

        try:
            while True:
                if not self._ws.is_open():
                    return None
                op_code, frame = self._ws.sock.recv_data_frame(True)
                if op_code == ABNF.OPCODE_CLOSE:
                    return None
                if op_code in (ABNF.OPCODE_BINARY, ABNF.OPCODE_TEXT):
                    data = frame.data
                    if len(data) > 1:
                        return data[0], data[1:]
                    # Channel byte with no payload — keep reading.
        except Exception:
            return None

    def write_stdin(self, data: bytes) -> None:
        from websocket import ABNF

        self._ws.sock.send(bytes([STDIN_CHANNEL]) + data, opcode=ABNF.OPCODE_BINARY)

    def resize(self, cols: int, rows: int) -> None:
        from websocket import ABNF

        payload = json.dumps({"Width": cols, "Height": rows}).encode()
        self._ws.sock.send(bytes([RESIZE_CHANNEL]) + payload, opcode=ABNF.OPCODE_BINARY)

    def close(self) -> None:
        try:
            self._ws.close()
        except Exception:
            pass


def _status_frame(status: str) -> str:
    return json.dumps({"type": "status", "status": status})


def _banner(msg: str) -> bytes:
    return f"\r\n\x1b[31m{msg}\x1b[0m\r\n".encode()


async def send_failure_context(ws: WebSocket, worker_id: str, headline: str) -> None:
    """Ship pod phase/reason and a log tail down the WS as terminal output so the
    user sees *why* without leaving the browser. Best-effort."""
    try:
        await ws.send_bytes(_banner(f"{headline}."))
        detail = await asyncio.to_thread(k8s.get_pod_detail, worker_id)
        if detail:
            await ws.send_bytes(
                _banner(
                    f"pod={detail['name']} phase={detail['phase'] or '?'} "
                    f"reason={detail['reason'] or '-'} ready={detail['worker_ready']}"
                )
            )
            if detail.get("message"):
                await ws.send_bytes(_banner(f"message: {detail['message']}"))
        logs = await asyncio.to_thread(k8s.read_pod_logs, worker_id, 100)
        if logs:
            await ws.send_bytes(b"\r\n\x1b[2m--- pod log (last 100 lines) ---\x1b[0m\r\n")
            await ws.send_bytes(logs.replace("\n", "\r\n").encode())
    except Exception:
        pass


class Attachment:
    """One shared pod PTY attachment, fanned out to N WebSocket clients."""

    def __init__(self, worker_id: str, handle, loop: asyncio.AbstractEventLoop, on_terminate):
        self.worker_id = worker_id
        self.handle = handle
        self.loop = loop
        self.buffer = RingBuffer()
        # Mutated only on the event loop.
        self.clients: set[WebSocket] = set()
        self._on_terminate = on_terminate
        self._end_status: str | None = None
        self._ended = False
        self._thread = threading.Thread(
            target=self._pump, name=f"pty-{worker_id[:8]}", daemon=True
        )
        self._keepalive: asyncio.Task | None = None

    def start(self) -> None:
        self._thread.start()
        self._keepalive = self.loop.create_task(self._keepalive_loop())

    # --- reader thread side ---

    def _pump(self) -> None:
        while True:
            item = self.handle.read()
            if item is None:
                break
            channel, payload = item
            if channel in (STDOUT_CHANNEL, STDERR_CHANNEL) and payload:
                fut = asyncio.run_coroutine_threadsafe(self._on_data(payload), self.loop)
                try:
                    fut.result()
                except Exception:
                    pass
        asyncio.run_coroutine_threadsafe(self._on_end(), self.loop)

    # --- event loop side ---

    async def _on_data(self, data: bytes) -> None:
        self.buffer.push(data)
        for ws in list(self.clients):
            try:
                await ws.send_bytes(data)
            except Exception:
                self.clients.discard(ws)

    async def _on_end(self) -> None:
        if self._ended:
            return
        self._ended = True
        if self._keepalive:
            self._keepalive.cancel()
        status = self._end_status
        if status is None:
            # Unexpected end — decide from the pod's fate.
            detail = await asyncio.to_thread(k8s.get_pod_detail, self.worker_id)
            status = "error" if detail and detail.get("phase") == "Failed" else "stopped"
        for ws in list(self.clients):
            try:
                await ws.send_text(_status_frame(status))
                await ws.close()
            except Exception:
                pass
        self.clients.clear()
        self._on_terminate(self.worker_id)

    async def _keepalive_loop(self) -> None:
        # Empty binary frames keep intermediaries (Istio) from idling out the
        # connection; xterm writes nothing for them.
        while True:
            await asyncio.sleep(KEEPALIVE_S)
            for ws in list(self.clients):
                try:
                    await ws.send_bytes(b"")
                except Exception:
                    self.clients.discard(ws)

    # --- control (any thread) ---

    def close(self, status: str = "stopped") -> None:
        """Close the pod attachment; the pump exits and _on_end notifies clients."""
        self._end_status = status
        self.handle.close()


class TerminalBridge:
    """Per-worker shared attachments + client session handling."""

    def __init__(self):
        self._attachments: dict[str, Attachment] = {}
        self._lock = threading.Lock()

    # --- lifecycle hooks (callable from sync request-handler threads) ---

    def cleanup(self, worker_id: str, status: str = "stopped") -> None:
        with self._lock:
            att = self._attachments.get(worker_id)
        if att:
            att.close(status)

    def _drop(self, worker_id: str) -> None:
        with self._lock:
            self._attachments.pop(worker_id, None)

    # --- terminal (shared attach) ---

    async def connect_terminal(self, worker_id: str, ws: WebSocket) -> None:
        """Bridge an already-accepted WebSocket to the worker's shared PTY attachment."""
        if not await self._wait_ready(worker_id, ws):
            return

        with self._lock:
            att = self._attachments.get(worker_id)
        if att is None:
            att = await self._create_attachment(worker_id, ws)
            if att is None:
                return

        # Replay scrollback, mark live, then join the fan-out set.
        buffered = att.buffer.get_all()
        if buffered:
            await ws.send_bytes(buffered)
        await ws.send_text(_status_frame("running"))
        att.clients.add(ws)

        try:
            await self._client_loop(ws, att.handle)
        finally:
            att.clients.discard(ws)
            if not att.clients:
                # Last client gone — release the pod attachment (the buffer dies
                # with it; the next connect re-populates from pod logs).
                att.close("stopped")

    async def _create_attachment(self, worker_id: str, ws: WebSocket) -> Attachment | None:
        try:
            ws_client = await asyncio.to_thread(k8s.attach_worker_pty, worker_id)
        except Exception:
            logger.exception("Failed to attach to worker %s", worker_id)
            await send_failure_context(ws, worker_id, "Failed to attach to the worker PTY")
            await ws.send_text(_status_frame("error"))
            await ws.close(code=1011)
            return None

        handle = K8sStreamHandle(ws_client)
        att = Attachment(worker_id, handle, asyncio.get_running_loop(), self._drop)

        # First attach: pre-populate the buffer from pod logs so the user gets
        # the current screen history immediately.
        logs = await asyncio.to_thread(k8s.read_pod_logs, worker_id, 500)
        if logs:
            att.buffer.push(logs.replace("\n", "\r\n").encode())

        with self._lock:
            existing = self._attachments.get(worker_id)
            if existing is not None:
                # Lost the race to another client — use theirs.
                handle.close()
                return existing
            self._attachments[worker_id] = att
        att.start()
        return att

    async def _wait_ready(self, worker_id: str, ws: WebSocket) -> bool:
        """Poll until the worker container is Ready. Sends 'starting' while waiting.

        Returns False (with the WS closed) on pod-gone, failure, or timeout.
        """
        detail = await asyncio.to_thread(k8s.get_pod_detail, worker_id)
        if detail and detail.get("worker_ready"):
            return True

        try:
            await ws.send_text(_status_frame("starting"))
        except Exception:
            return False

        elapsed = 0.0
        while elapsed < READY_TIMEOUT_S:
            if detail is None or detail.get("phase") in ("Failed", "Succeeded"):
                headline = (
                    "Pod is no longer running" if detail is None else f"Pod is {detail['phase']}"
                )
                await send_failure_context(ws, worker_id, headline)
                await ws.send_text(_status_frame("error" if detail else "stopped"))
                await ws.close(code=1011)
                return False
            if detail.get("worker_ready"):
                return True
            await asyncio.sleep(READY_POLL_S)
            elapsed += READY_POLL_S
            detail = await asyncio.to_thread(k8s.get_pod_detail, worker_id)

        await send_failure_context(
            ws, worker_id, f"Pod did not become ready after {int(READY_TIMEOUT_S)}s"
        )
        await ws.send_text(_status_frame("error"))
        await ws.close(code=1011)
        return False

    # --- shell (independent exec per connection) ---

    async def connect_shell(self, worker_id: str, ws: WebSocket) -> None:
        """Bridge an already-accepted WebSocket to a fresh /bin/bash exec."""
        detail = await asyncio.to_thread(k8s.get_pod_detail, worker_id)
        if not detail or not detail.get("worker_ready"):
            await ws.close(code=1008, reason="Worker pod is not running")
            return

        try:
            ws_client = await asyncio.to_thread(k8s.exec_worker_shell, worker_id)
        except Exception:
            logger.exception("Failed to exec shell in worker %s", worker_id)
            await ws.close(code=1011, reason="Failed to start shell")
            return

        handle = K8sStreamHandle(ws_client)
        loop = asyncio.get_running_loop()
        done = asyncio.Event()

        def pump() -> None:
            while True:
                item = handle.read()
                if item is None:
                    break
                channel, payload = item
                if channel in (STDOUT_CHANNEL, STDERR_CHANNEL) and payload:
                    fut = asyncio.run_coroutine_threadsafe(_send(payload), loop)
                    try:
                        fut.result()
                    except Exception:
                        pass
            loop.call_soon_threadsafe(done.set)

        async def _send(data: bytes) -> None:
            try:
                await ws.send_bytes(data)
            except Exception:
                pass

        threading.Thread(target=pump, name=f"shell-{worker_id[:8]}", daemon=True).start()

        async def close_when_done() -> None:
            await done.wait()
            try:
                await ws.close()
            except Exception:
                pass

        closer = asyncio.get_running_loop().create_task(close_when_done())
        try:
            await self._client_loop(ws, handle)
        finally:
            closer.cancel()
            handle.close()

    # --- shared client receive loop ---

    async def _client_loop(self, ws: WebSocket, handle) -> None:
        """Pump client frames into the PTY until the client disconnects."""
        while True:
            try:
                message = await ws.receive()
            except (WebSocketDisconnect, RuntimeError):
                return
            if message.get("type") == "websocket.disconnect":
                return
            data = message.get("bytes")
            if data:
                try:
                    await asyncio.to_thread(handle.write_stdin, data)
                except Exception:
                    return
                continue
            text = message.get("text")
            if text:
                try:
                    msg = json.loads(text)
                except (ValueError, TypeError):
                    continue  # ignore malformed control frames
                if (
                    isinstance(msg, dict)
                    and msg.get("type") == "resize"
                    and isinstance(msg.get("cols"), int)
                    and isinstance(msg.get("rows"), int)
                ):
                    try:
                        await asyncio.to_thread(handle.resize, msg["cols"], msg["rows"])
                    except Exception:
                        return


# Module-level singleton — the backend runs single-replica (SQLite), so
# in-process attachment state is safe.
bridge = TerminalBridge()
