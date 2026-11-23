using System;
using System.IO;
using Newtonsoft.Json;

namespace BimAzimAutoCadPlugin.Core
{
    /// <summary>
    /// Handshake file telling the MCP server which port this AutoCAD session's socket service
    /// bound to: %LOCALAPPDATA%\BimAzim\service-autocad.json — read by
    /// server/src/bridge/handshake.ts exactly like the Revit/Navisworks handshake files.
    /// </summary>
    public static class ServiceEndpoint
    {
        public static string RootDirectory => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "BimAzim");

        public static string FilePath => Path.Combine(RootDirectory, "service-autocad.json");

        private class Payload
        {
            [JsonProperty("port")] public int Port { get; set; }
            [JsonProperty("pid")] public int Pid { get; set; }
            [JsonProperty("host")] public string Host { get; set; } = "127.0.0.1";
            [JsonProperty("token")] public string Token { get; set; } = "";
            [JsonProperty("pluginVersion")] public string PluginVersion { get; set; } = "";
            [JsonProperty("startedAt")] public string StartedAt { get; set; } = "";
        }

        public static void Publish(int port, string pluginVersion)
        {
            try
            {
                Directory.CreateDirectory(RootDirectory);
                var payload = new Payload
                {
                    Port = port,
                    Pid = System.Diagnostics.Process.GetCurrentProcess().Id,
                    Host = "127.0.0.1",
                    Token = ServiceAuth.Token,
                    PluginVersion = pluginVersion,
                    StartedAt = DateTime.UtcNow.ToString("o")
                };
                File.WriteAllText(FilePath, JsonConvert.SerializeObject(payload, Formatting.Indented));
                Logger.Log($"Service endpoint published: 127.0.0.1:{port} -> {FilePath}");
            }
            catch (Exception ex)
            {
                Logger.LogError("Failed to publish service endpoint (non-critical)", ex);
            }
        }

        public static void Clear()
        {
            try { if (File.Exists(FilePath)) File.Delete(FilePath); }
            catch (Exception ex) { Logger.LogError("Failed to clear service endpoint (non-critical)", ex); }
        }
    }
}
