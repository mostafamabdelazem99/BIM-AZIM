using System;
using System.Diagnostics;
using System.IO;
using Newtonsoft.Json.Linq;

namespace BimAzimNavisPlugin.Core
{
    /// <summary>
    /// Publishes where the Navisworks service landed so the MCP server can find it.
    /// Separate file from Revit: %LocalAppData%\BimAzim\service-navis.json
    /// (Revit keeps using service.json — untouched).
    ///
    /// BIM-AZIM TODO (deviation from the BIM-Bot original): BIM-Bot keeps its shared secret in a
    /// sibling file (auth.token) and never puts it in the handshake JSON. The BIM-AZIM MCP server's
    /// TCP client (server/src/bridge/handshake.ts) instead expects the token INLINE as a "token"
    /// field on this same handshake file, so NavisServiceAuth's token is embedded here too. This
    /// keeps the handshake shape at {host, port, pid, token} (plus a few extra informational
    /// fields) as required, while reusing BIM-Bot's proven constant-time-compare validation.
    /// </summary>
    public static class NavisServiceEndpoint
    {
        private static string HandshakePath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "BimAzim", "service-navis.json");

        public static void Publish(int port)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(HandshakePath)!);
                var payload = new JObject
                {
                    ["host"] = "127.0.0.1",
                    ["port"] = port,
                    ["pid"] = Process.GetCurrentProcess().Id,
                    ["token"] = NavisServiceAuth.Token,
                    ["product"] = "navisworks",
                    ["version"] = NavisPluginApp.Version,
                    ["updated"] = DateTime.UtcNow.ToString("o"),
                };
                File.WriteAllText(HandshakePath, payload.ToString());
            }
            catch { }
        }

        public static void Clear()
        {
            try { if (File.Exists(HandshakePath)) File.Delete(HandshakePath); } catch { }
        }
    }
}
