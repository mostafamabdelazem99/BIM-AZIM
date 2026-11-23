using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace BimAzimAutoCadPlugin.Core
{
    /// <summary>
    /// TCP socket server for AutoCAD, speaking the exact same length-prefixed JSON-RPC 2.0 wire
    /// protocol as the Revit/Navisworks plugins ("Content-Length: N\n{json}") so
    /// server/src/bridge/tcp-engine-client.ts works against it unchanged. Ported structurally
    /// from plugins/Revit/BimAzimPlugin/Core/SocketService.cs — see that file for the framing
    /// rationale; only the command-dispatch call differs (CommandExecutor.ExecuteAsync uses
    /// AutoCAD's own Document.ExecuteInCommandContextAsync instead of Revit's ExternalEvent).
    /// </summary>
    public class SocketService
    {
        private TcpListener? _listener;
        private readonly int _preferredPort;
        private int _port;
        private CancellationTokenSource? _cts;
        private readonly List<TcpClient> _clients = new List<TcpClient>();

        private const string ContentLengthHeader = "Content-Length: ";
        private const int MaxStartRetries = 5;
        private const int RetryDelayMs = 2000;
        private const int PortScanRange = 10;

        public bool IsRunning { get; private set; }
        public int Port => _port;

        public SocketService(int port)
        {
            _preferredPort = port;
            _port = port;
        }

        public void Start()
        {
            if (IsRunning) return;
            _cts = new CancellationTokenSource();
            Exception? lastException = null;

            for (int attempt = 1; attempt <= MaxStartRetries; attempt++)
            {
                bool allowScan = attempt > 1;
                if (attempt > 1) Thread.Sleep(RetryDelayMs);

                int lastPort = allowScan ? _preferredPort + PortScanRange : _preferredPort;
                for (int candidate = _preferredPort; candidate <= lastPort; candidate++)
                {
                    try
                    {
                        _listener = new TcpListener(IPAddress.Loopback, candidate);
                        _listener.Start();
                        _port = candidate;
                        IsRunning = true;

                        Task.Run(() => AcceptClientsWithWatchdogAsync(_cts.Token));
                        Logger.Log(candidate != _preferredPort
                            ? $"Port {_preferredPort} was unavailable — started on {candidate} instead (attempt {attempt})"
                            : $"Socket service started on port {candidate} (attempt {attempt})");

                        ServiceEndpoint.Publish(candidate, Application.Version);
                        EnsureAuthToken();
                        return;
                    }
                    catch (SocketException ex)
                    {
                        lastException = ex;
                        try { _listener?.Stop(); } catch { }
                        _listener = null;
                    }
                }

                Logger.LogError($"Start attempt {attempt}/{MaxStartRetries} failed on ports {_preferredPort}-{lastPort}", lastException);
            }

            IsRunning = false;
            _port = _preferredPort;
            throw lastException ?? new SocketException((int)SocketError.AddressAlreadyInUse);
        }

        public void Stop()
        {
            if (!IsRunning) return;
            _cts?.Cancel();
            lock (_clients)
            {
                foreach (var client in _clients) { try { client.Close(); } catch { } }
                _clients.Clear();
            }
            try { _listener?.Stop(); } catch { }
            IsRunning = false;
            ServiceEndpoint.Clear();
            Logger.Log("Socket service stopped");
        }

        private async Task AcceptClientsWithWatchdogAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                try { await AcceptClientsAsync(ct); }
                catch (Exception ex) when (!ct.IsCancellationRequested)
                {
                    Logger.LogError("AcceptClients crashed — watchdog restarting in 3s", ex);
                    await Task.Delay(3000, ct);
                    try
                    {
                        _listener?.Stop();
                        _listener = new TcpListener(IPAddress.Loopback, _port);
                        _listener.Start();
                    }
                    catch (Exception restartEx)
                    {
                        Logger.LogError("Watchdog: failed to restart listener", restartEx);
                        IsRunning = false;
                        return;
                    }
                }
            }
        }

        private async Task AcceptClientsAsync(CancellationToken ct)
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    var client = await _listener!.AcceptTcpClientAsync(ct);
                    client.ReceiveTimeout = 0;
                    client.SendTimeout = 30000;
                    Logger.Log("BIM-AZIM server connected");
                    lock (_clients) { _clients.Add(client); }
                    _ = Task.Run(() => HandleClientAsync(client, ct));
                }
                catch (OperationCanceledException) { break; }
                catch (ObjectDisposedException) { break; }
                catch (Exception ex)
                {
                    if (!ct.IsCancellationRequested) { Logger.LogError("Error accepting client", ex); throw; }
                }
            }
        }

        private async Task HandleClientAsync(TcpClient client, CancellationToken ct)
        {
            var buffer = new byte[65536];
            var messageBuffer = new StringBuilder();
            try
            {
                var stream = client.GetStream();
                while (!ct.IsCancellationRequested && client.Connected)
                {
                    int bytesRead;
                    try { bytesRead = await stream.ReadAsync(buffer, ct); }
                    catch (OperationCanceledException) { break; }
                    if (bytesRead == 0) break;

                    messageBuffer.Append(Encoding.UTF8.GetString(buffer, 0, bytesRead));
                    await ProcessMessageBuffer(messageBuffer, stream, ct);
                }
            }
            catch (Exception ex)
            {
                if (!ct.IsCancellationRequested) Logger.LogError("Client connection error", ex);
            }
            finally
            {
                lock (_clients) { _clients.Remove(client); }
                try { client.Close(); } catch { }
                Logger.Log("BIM-AZIM server disconnected");
            }
        }

        private async Task ProcessMessageBuffer(StringBuilder messageBuffer, NetworkStream stream, CancellationToken ct)
        {
            while (messageBuffer.Length > 0)
            {
                var data = messageBuffer.ToString().TrimStart();
                if (string.IsNullOrEmpty(data)) { messageBuffer.Clear(); break; }

                string jsonStr;
                if (data.StartsWith(ContentLengthHeader, StringComparison.Ordinal))
                {
                    var newlineIdx = data.IndexOf('\n');
                    if (newlineIdx < 0) break;

                    var lengthStr = data.Substring(ContentLengthHeader.Length, newlineIdx - ContentLengthHeader.Length).Trim();
                    if (!int.TryParse(lengthStr, out var contentLength) || contentLength <= 0)
                    {
                        Logger.LogError($"Invalid Content-Length: '{lengthStr}'");
                        messageBuffer.Clear();
                        break;
                    }

                    var payloadStart = newlineIdx + 1;
                    var totalNeeded = payloadStart + contentLength;
                    var dataBytes = Encoding.UTF8.GetBytes(data);
                    if (dataBytes.Length < totalNeeded) break;

                    jsonStr = Encoding.UTF8.GetString(dataBytes, payloadStart, contentLength);
                    var remaining = Encoding.UTF8.GetString(dataBytes, totalNeeded, dataBytes.Length - totalNeeded);
                    messageBuffer.Clear();
                    if (remaining.Length > 0) messageBuffer.Append(remaining);
                }
                else if (data[0] == '{')
                {
                    var endIdx = FindJsonObjectEnd(data);
                    if (endIdx <= 0) break;
                    jsonStr = data.Substring(0, endIdx);
                    var remaining = data.Substring(endIdx);
                    messageBuffer.Clear();
                    if (remaining.Length > 0) messageBuffer.Append(remaining);
                }
                else
                {
                    var nextBrace = data.IndexOf('{');
                    var nextHeader = data.IndexOf(ContentLengthHeader, StringComparison.Ordinal);
                    var nextValid = -1;
                    if (nextBrace >= 0 && nextHeader >= 0) nextValid = Math.Min(nextBrace, nextHeader);
                    else if (nextBrace >= 0) nextValid = nextBrace;
                    else if (nextHeader >= 0) nextValid = nextHeader;

                    if (nextValid > 0) { messageBuffer.Clear(); messageBuffer.Append(data.Substring(nextValid)); continue; }
                    messageBuffer.Clear();
                    break;
                }

                try
                {
                    var request = JObject.Parse(jsonStr);
                    JObject response = ServiceAuth.IsAuthorized(request)
                        ? await ProcessRequest(request)
                        : ServiceAuth.UnauthorizedResponse(request);

                    var responseJson = JsonConvert.SerializeObject(response);
                    var responseBytes = Encoding.UTF8.GetBytes(responseJson);
                    var header = Encoding.UTF8.GetBytes($"Content-Length: {responseBytes.Length}\n");
                    await stream.WriteAsync(header, ct);
                    await stream.WriteAsync(responseBytes, ct);
                }
                catch (JsonReaderException)
                {
                    Logger.LogError($"Malformed JSON message skipped: {jsonStr.Substring(0, Math.Min(100, jsonStr.Length))}...");
                }
                catch (Exception ex)
                {
                    Logger.LogError("Error processing message", ex);
                    break;
                }
            }
        }

        private static int FindJsonObjectEnd(string data)
        {
            int depth = 0;
            bool inString = false;
            bool escaped = false;
            for (int i = 0; i < data.Length; i++)
            {
                char c = data[i];
                if (escaped) { escaped = false; continue; }
                if (c == '\\' && inString) { escaped = true; continue; }
                if (c == '"') { inString = !inString; continue; }
                if (inString) continue;
                if (c == '{') depth++;
                else if (c == '}') { depth--; if (depth == 0) return i + 1; }
            }
            return -1;
        }

        private static void EnsureAuthToken()
        {
            try { _ = ServiceAuth.Token; }
            catch (Exception ex) { Logger.LogError("Failed to create service auth token (will retry per request)", ex); }
        }

        private async Task<JObject> ProcessRequest(JObject request)
        {
            var id = request["id"]?.ToString() ?? "0";
            var method = request["method"]?.ToString() ?? "";
            var parameters = request["params"] as JObject ?? new JObject();

            try
            {
                Logger.Log($"Executing command: {method}");
                var result = await CommandExecutor.ExecuteAsync(method, parameters);
                return new JObject { ["jsonrpc"] = "2.0", ["id"] = id, ["result"] = result };
            }
            catch (Exception ex)
            {
                Logger.LogError($"Command '{method}' failed", ex);
                return new JObject
                {
                    ["jsonrpc"] = "2.0",
                    ["id"] = id,
                    ["error"] = new JObject { ["code"] = -32000, ["message"] = ex.InnerException?.Message ?? ex.Message }
                };
            }
        }
    }
}
