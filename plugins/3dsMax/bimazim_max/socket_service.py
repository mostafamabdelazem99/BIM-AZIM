"""TCP socket server for 3ds Max, speaking the same length-prefixed JSON-RPC 2.0 wire protocol
as the Revit/Navisworks/AutoCAD/SketchUp plugins ("Content-Length: N\\n{json}") so
server/src/bridge/tcp-engine-client.ts works against it unchanged.

Threading: pymxs (3ds Max's Python scene API) is not documented as safe to call from a thread
other than the main one. So the actual socket I/O runs in real background threads (Python's
`socket`/`threading`, not pymxs — pure I/O, no scene access), while every dispatched command is
handed to the main thread via a queue drained by a 3ds Max "idle" callback (callbacks.addScript
#idle), the same idea as Revit's ExternalEvent, AutoCAD's Application.Idle, and SketchUp's
UI.start_timer — just using 3ds Max's own idle-callback primitive, which has been stable in
MAXScript/pymxs for a very long time.
"""
import queue
import socket
import threading
import time

from . import command_executor, service_auth, service_endpoint

CONTENT_LENGTH_HEADER = b"Content-Length: "
PORT_SCAN_RANGE = 10
IDLE_BATCH_LIMIT = 20
MAIN_THREAD_TIMEOUT_SECONDS = 120


class _PendingCall:
    __slots__ = ("method", "params", "event", "result", "error")

    def __init__(self, method, params):
        self.method = method
        self.params = params
        self.event = threading.Event()
        self.result = None
        self.error = None


class SocketService:
    def __init__(self, preferred_port):
        self.preferred_port = preferred_port
        self.port = preferred_port
        self._server = None
        self._accept_thread = None
        self._running = False
        self._call_queue = queue.Queue()
        self._idle_callback_id = None

    def is_running(self):
        return self._running

    def start(self):
        if self._running:
            return

        for candidate in range(self.preferred_port, self.preferred_port + PORT_SCAN_RANGE + 1):
            try:
                server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
                server.bind(("127.0.0.1", candidate))
                server.listen(8)
                self._server = server
                self.port = candidate
                break
            except OSError:
                continue

        if self._server is None:
            print(f"BIM-AZIM: could not bind any port in {self.preferred_port}-{self.preferred_port + PORT_SCAN_RANGE}")
            return

        self._running = True
        self._accept_thread = threading.Thread(target=self._accept_loop, daemon=True)
        self._accept_thread.start()

        self._register_idle_callback()
        service_endpoint.publish(self.port, "0.1.0")
        print(f"BIM-AZIM: socket service started on port {self.port}")

    def stop(self):
        if not self._running:
            return
        self._running = False
        self._unregister_idle_callback()
        try:
            self._server.close()
        except OSError:
            pass
        self._server = None
        service_endpoint.clear()

    # ── Background accept/read thread (pure socket I/O, no pymxs calls) ────

    def _accept_loop(self):
        while self._running:
            try:
                client, _addr = self._server.accept()
            except OSError:
                break
            threading.Thread(target=self._client_loop, args=(client,), daemon=True).start()

    def _client_loop(self, client):
        buffer = b""
        try:
            while self._running:
                chunk = client.recv(65536)
                if not chunk:
                    break
                buffer += chunk
                buffer = self._process_buffer(client, buffer)
        except OSError:
            pass
        finally:
            try:
                client.close()
            except OSError:
                pass

    def _process_buffer(self, client, buffer):
        while True:
            stripped = buffer.lstrip()
            if not stripped:
                return b""

            if stripped.startswith(CONTENT_LENGTH_HEADER):
                newline_idx = stripped.find(b"\n")
                if newline_idx < 0:
                    return stripped  # incomplete header — wait for more data

                length_str = stripped[len(CONTENT_LENGTH_HEADER):newline_idx].strip()
                try:
                    content_length = int(length_str)
                except ValueError:
                    content_length = -1
                if content_length <= 0:
                    print(f"BIM-AZIM: invalid Content-Length: {length_str!r}")
                    return b""

                payload_start = newline_idx + 1
                total_needed = payload_start + content_length
                if len(stripped) < total_needed:
                    return stripped  # incomplete payload — wait for more data

                json_bytes = stripped[payload_start:total_needed]
                buffer = stripped[total_needed:]
            elif stripped[0:1] == b"{":
                end_idx = _find_json_object_end(stripped)
                if end_idx is None:
                    return stripped  # incomplete — wait for more data
                json_bytes = stripped[:end_idx]
                buffer = stripped[end_idx:]
            else:
                next_brace = stripped.find(b"{")
                buffer = stripped[next_brace:] if next_brace >= 0 else b""
                if next_brace < 0:
                    return b""
                continue

            self._handle_message(client, json_bytes)

    def _handle_message(self, client, json_bytes):
        import json as json_module

        try:
            request = json_module.loads(json_bytes.decode("utf-8"))
        except ValueError:
            print(f"BIM-AZIM: malformed JSON message skipped: {json_bytes[:100]!r}")
            return

        if service_auth.authorized(request):
            response = self._process_request(request)
        else:
            response = service_auth.unauthorized_response(request)

        body = json_module.dumps(response).encode("utf-8")
        header = f"Content-Length: {len(body)}\n".encode("utf-8")
        try:
            client.sendall(header + body)
        except OSError:
            pass

    def _process_request(self, request):
        request_id = str(request.get("id", "0"))
        method = str(request.get("method", ""))
        params = request.get("params") or {}
        try:
            result = self._call_on_main_thread(method, params)
            return {"jsonrpc": "2.0", "id": request_id, "result": result}
        except Exception as e:  # noqa: BLE001 — reported back to the caller, not swallowed
            return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32000, "message": str(e)}}

    def _call_on_main_thread(self, method, params):
        # Every command, "ping" included, is handled on the main thread via the idle queue —
        # pymxs is not documented as safe to call from a background thread, so nothing in this
        # class ever touches it directly.
        call = _PendingCall(method, params)
        self._call_queue.put(call)
        if not call.event.wait(MAIN_THREAD_TIMEOUT_SECONDS):
            raise TimeoutError(f"Command '{method}' timed out after {MAIN_THREAD_TIMEOUT_SECONDS}s — is 3ds Max idle/responsive?")
        if call.error is not None:
            raise call.error
        return call.result

    # ── Main-thread idle pump (pymxs calls happen only here) ────────────────

    def _register_idle_callback(self):
        try:
            import pymxs

            rt = pymxs.runtime
            rt.callbacks.addScript(rt.Name("idle"), self._pump_idle_queue, id=rt.Name("bimAzimIdlePump"))
            self._idle_callback_id = rt.Name("bimAzimIdlePump")
        except ImportError:
            print("BIM-AZIM: pymxs not available — are you running inside 3ds Max?")

    def _unregister_idle_callback(self):
        if not self._idle_callback_id:
            return
        try:
            import pymxs

            rt = pymxs.runtime
            rt.callbacks.removeScripts(id=self._idle_callback_id)
        except ImportError:
            pass
        self._idle_callback_id = None

    def _pump_idle_queue(self):
        processed = 0
        while processed < IDLE_BATCH_LIMIT:
            try:
                call = self._call_queue.get_nowait()
            except queue.Empty:
                return
            processed += 1
            try:
                call.result = command_executor.execute(call.method, call.params)
            except Exception as e:  # noqa: BLE001 — handed back to the waiting request thread
                call.error = e
            finally:
                call.event.set()


def _find_json_object_end(data: bytes):
    depth = 0
    in_string = False
    escaped = False
    for i, byte in enumerate(data):
        char = chr(byte)
        if escaped:
            escaped = False
            continue
        if char == "\\" and in_string:
            escaped = True
            continue
        if char == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return i + 1
    return None
