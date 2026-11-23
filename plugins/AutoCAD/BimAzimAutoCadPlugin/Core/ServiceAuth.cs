using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json.Linq;

namespace BimAzimAutoCadPlugin.Core
{
    /// <summary>
    /// Shared secret every request must carry — identical contract to the Revit/Navisworks
    /// plugins' ServiceAuth, reading/writing the SAME file so one token covers every engine
    /// for this Windows user: %LOCALAPPDATA%\BimAzim\auth.token. Whichever bridge starts first
    /// creates it; the rest just read it. Keep in sync with
    /// plugins/Revit/BimAzimPlugin/Core/ServiceAuth.cs.
    /// </summary>
    public static class ServiceAuth
    {
        public const string FieldName = "auth";
        public const int UnauthorizedCode = -32001;

        public static string FilePath => Path.Combine(ServiceEndpoint.RootDirectory, "auth.token");

        private static readonly object _lock = new object();
        private static string? _cached;

        public static string Token
        {
            get { lock (_lock) { return _cached ??= LoadOrCreate(); } }
        }

        public static bool IsAuthorized(JObject request)
        {
            var presented = request[FieldName]?.ToString();
            if (string.IsNullOrEmpty(presented)) return false;
            if (FixedTimeEquals(presented!, Token)) return true;

            lock (_lock)
            {
                _cached = LoadOrCreate();
                return FixedTimeEquals(presented!, _cached);
            }
        }

        public static JObject UnauthorizedResponse(JObject request) => new JObject
        {
            ["jsonrpc"] = "2.0",
            ["id"] = request["id"]?.ToString() ?? "0",
            ["error"] = new JObject
            {
                ["code"] = UnauthorizedCode,
                ["message"] = "Unauthorized: missing or invalid BIM-AZIM auth token. Reinstall BIM-AZIM and restart AutoCAD."
            }
        };

        private static string LoadOrCreate()
        {
            var existing = TryRead();
            if (existing != null) return existing;

            Directory.CreateDirectory(ServiceEndpoint.RootDirectory);
            var fresh = NewToken();
            var temp = FilePath + "." + Guid.NewGuid().ToString("N") + ".tmp";
            File.WriteAllText(temp, fresh);
            try
            {
                File.Move(temp, FilePath);
                return fresh;
            }
            catch (IOException)
            {
                try { File.Delete(temp); } catch { }
                var winner = TryRead();
                if (winner != null) return winner;
                File.WriteAllText(FilePath, fresh);
                return fresh;
            }
        }

        private static string? TryRead()
        {
            try
            {
                if (!File.Exists(FilePath)) return null;
                var text = File.ReadAllText(FilePath).Trim();
                return text.Length >= 32 ? text : null;
            }
            catch { return null; }
        }

        private static string NewToken()
        {
            var bytes = new byte[32];
            using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(bytes);
            var sb = new StringBuilder(bytes.Length * 2);
            foreach (var b in bytes) sb.Append(b.ToString("x2"));
            return sb.ToString();
        }

        private static bool FixedTimeEquals(string a, string b)
        {
            if (a.Length != b.Length) return false;
            int diff = 0;
            for (int i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
            return diff == 0;
        }
    }
}
