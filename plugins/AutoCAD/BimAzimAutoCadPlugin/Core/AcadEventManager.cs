using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Core.Application;

namespace BimAzimAutoCadPlugin.Core
{
    /// <summary>
    /// Thread-safe access to the AutoCAD document, the same shape as Revit's
    /// ExternalEventManager: the TCP handler thread enqueues a command, and this class drains
    /// the queue on Application.Idle (the main/command thread) under a document lock. This is
    /// the classic AutoCAD .NET automation pattern and, unlike Document.ExecuteInCommandContextAsync
    /// (which this managed API surface doesn't expose), it's available on every AutoCAD .NET
    /// version.
    /// </summary>
    public static class AcadEventManager
    {
        private static readonly ConcurrentQueue<CommandRequest> _queue = new();
        private static bool _subscribed;
        private static readonly object _subscribeLock = new();

        public static void EnsureSubscribed()
        {
            if (_subscribed) return;
            lock (_subscribeLock)
            {
                if (_subscribed) return;
                AcApp.Idle += OnIdle;
                _subscribed = true;
            }
        }

        /// <summary>Queue a command and wait (up to 2 minutes) for it to run on the main thread.</summary>
        public static async Task<JToken> EnqueueAsync(string method, JObject parameters)
        {
            EnsureSubscribed();
            var tcs = new TaskCompletionSource<JToken>();
            _queue.Enqueue(new CommandRequest(method, parameters, tcs));

            using var cts = new CancellationTokenSource(TimeSpan.FromMinutes(2));
            using (cts.Token.Register(() => tcs.TrySetException(
                new TimeoutException($"Command '{method}' timed out after 2 minutes — is AutoCAD idle/responsive?"))))
            {
                return await tcs.Task;
            }
        }

        private static void OnIdle(object? sender, EventArgs e)
        {
            while (_queue.TryDequeue(out var request))
            {
                try
                {
                    var doc = AcApp.DocumentManager.MdiActiveDocument;
                    if (doc == null)
                        throw new InvalidOperationException("No active AutoCAD document. Open or create a drawing first.");

                    using (doc.LockDocument())
                    {
                        var result = CommandExecutor.Dispatch(doc, request.Method, request.Parameters);
                        request.Tcs.TrySetResult(result);
                    }
                }
                catch (Exception ex)
                {
                    Logger.LogError($"Command '{request.Method}' failed on idle", ex);
                    request.Tcs.TrySetException(ex);
                }
            }
        }

        private sealed class CommandRequest
        {
            public CommandRequest(string method, JObject parameters, TaskCompletionSource<JToken> tcs)
            {
                Method = method;
                Parameters = parameters;
                Tcs = tcs;
            }

            public string Method { get; }
            public JObject Parameters { get; }
            public TaskCompletionSource<JToken> Tcs { get; }
        }
    }
}
