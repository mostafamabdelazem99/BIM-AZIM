using System;

namespace BimAzim.TeklaBridge
{
    public static class Program
    {
        public static void Main(string[] args)
        {
            var port = GetPort();
            var connection = new TeklaConnection();

            Console.WriteLine($"BIM-AZIM Tekla bridge starting on http://127.0.0.1:{port} ...");

            using (var server = new JsonHttpServer(port, () => new
            {
                connected = connection.IsConnected,
                engine = "tekla",
            }))
            {
                ToolRegistry.RegisterAll(server, connection);
                server.Start();

                Console.WriteLine(connection.IsConnected
                    ? "Connected to a running Tekla Structures session."
                    : "Not connected yet — waiting. Start Tekla Structures and open a model, then retry a tool call.");
                Console.WriteLine("Press Ctrl+C to stop.");

                var exit = new System.Threading.ManualResetEvent(false);
                Console.CancelKeyPress += (_, e) =>
                {
                    e.Cancel = true;
                    exit.Set();
                };
                exit.WaitOne();
            }
        }

        private static int GetPort()
        {
            var raw = Environment.GetEnvironmentVariable("BIMAZIM_TEKLA_PORT");
            return int.TryParse(raw, out var port) ? port : 8092;
        }
    }
}
