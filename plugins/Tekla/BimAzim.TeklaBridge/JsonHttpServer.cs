using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace BimAzim.TeklaBridge
{
    /// <summary>
    /// Minimal dependency-free HTTP JSON server built on System.Net.HttpListener, matching the
    /// contract every BIM-AZIM engine bridge shares:
    ///   GET  /health          -> BridgeResult{ connected, version, modelName }
    ///   POST /tools/{name}    -> BridgeResult{ ok, data?, error? }
    /// </summary>
    public sealed class JsonHttpServer : IDisposable
    {
        public delegate object ToolHandler(JObject args);

        private readonly HttpListener _listener = new HttpListener();
        private readonly Dictionary<string, ToolHandler> _tools = new Dictionary<string, ToolHandler>(StringComparer.OrdinalIgnoreCase);
        private readonly Func<object> _healthProvider;
        private CancellationTokenSource _cts;

        public JsonHttpServer(int port, Func<object> healthProvider)
        {
            _healthProvider = healthProvider;
            _listener.Prefixes.Add($"http://127.0.0.1:{port}/");
        }

        public void RegisterTool(string name, ToolHandler handler) => _tools[name] = handler;

        public void Start()
        {
            _cts = new CancellationTokenSource();
            _listener.Start();
            Task.Run(() => ListenLoop(_cts.Token));
        }

        public void Stop()
        {
            _cts?.Cancel();
            if (_listener.IsListening) _listener.Stop();
        }

        private async Task ListenLoop(CancellationToken token)
        {
            while (!token.IsCancellationRequested)
            {
                HttpListenerContext ctx;
                try
                {
                    ctx = await _listener.GetContextAsync();
                }
                catch (Exception) when (token.IsCancellationRequested)
                {
                    return;
                }

                _ = Task.Run(() => HandleRequestSafe(ctx));
            }
        }

        private void HandleRequestSafe(HttpListenerContext ctx)
        {
            try
            {
                HandleRequest(ctx);
            }
            catch (Exception ex)
            {
                WriteJson(ctx.Response, 500, new { ok = false, error = $"Unhandled bridge error: {ex.Message}" });
            }
        }

        private void HandleRequest(HttpListenerContext ctx)
        {
            var req = ctx.Request;
            var path = req.Url.AbsolutePath.TrimEnd('/');

            if (req.HttpMethod == "GET" && path == "/health")
            {
                WriteJson(ctx.Response, 200, new { ok = true, data = _healthProvider() });
                return;
            }

            if (req.HttpMethod == "POST" && path.StartsWith("/tools/", StringComparison.OrdinalIgnoreCase))
            {
                var toolName = path.Substring("/tools/".Length);
                if (!_tools.TryGetValue(toolName, out var handler))
                {
                    WriteJson(ctx.Response, 404, new { ok = false, error = $"Unknown tool '{toolName}'." });
                    return;
                }

                JObject args;
                using (var reader = new StreamReader(req.InputStream, req.ContentEncoding ?? Encoding.UTF8))
                {
                    var body = reader.ReadToEnd();
                    args = string.IsNullOrWhiteSpace(body) ? new JObject() : JObject.Parse(body);
                }

                try
                {
                    var data = handler(args);
                    WriteJson(ctx.Response, 200, new { ok = true, data });
                }
                catch (ToolException te)
                {
                    WriteJson(ctx.Response, 200, new { ok = false, error = te.Message });
                }
                return;
            }

            WriteJson(ctx.Response, 404, new { ok = false, error = "Not found." });
        }

        private static void WriteJson(HttpListenerResponse response, int statusCode, object payload)
        {
            response.StatusCode = statusCode;
            response.ContentType = "application/json";
            var json = JsonConvert.SerializeObject(payload);
            var bytes = Encoding.UTF8.GetBytes(json);
            response.ContentLength64 = bytes.Length;
            response.OutputStream.Write(bytes, 0, bytes.Length);
            response.OutputStream.Close();
        }

        public void Dispose()
        {
            Stop();
            ((IDisposable)_listener)?.Dispose();
        }
    }

    /// <summary>Throw this from a tool handler for an expected/user-facing failure (nothing selected,
    /// model not connected, bad GUID, ...). Anything else bubbles up as an unhandled 500.</summary>
    public sealed class ToolException : Exception
    {
        public ToolException(string message) : base(message) { }
    }
}
