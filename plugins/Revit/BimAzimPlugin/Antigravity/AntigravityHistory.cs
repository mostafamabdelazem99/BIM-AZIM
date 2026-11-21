// BIM-AZIM TODO: NOT WIRED UP YET.
// Ported + rebranded from BIM-Bot as-is (natural-language keyword-to-tool
// bridge that forwards parsed commands to this plugin's own local socket
// service). Depends on the AI/ chat integration above (also deferred in this
// pass) to turn free-text into tool calls, so treat it as deferred for the
// same reason. Compiles standalone with no external credentials required.
using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;

namespace BimAzimPlugin.Antigravity
{
    /// <summary>
    /// Persists Antigravity chat messages to disk for save/restore across sessions.
    /// Storage: %APPDATA%\BimAzim\antigravity\history.json
    /// </summary>
    public static class AntigravityHistory
    {
        private static readonly string HistoryFile = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "BimAzim", "antigravity", "history.json");

        /// <summary>Saves messages to disk.</summary>
        public static void Save(List<AntigravityMessage> messages)
        {
            try
            {
                var dir = Path.GetDirectoryName(HistoryFile)!;
                if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
                File.WriteAllText(HistoryFile, JsonConvert.SerializeObject(messages, Formatting.Indented));
            }
            catch { }
        }

        /// <summary>Loads messages from disk. Returns empty list if none exist.</summary>
        public static List<AntigravityMessage> Load()
        {
            try
            {
                if (File.Exists(HistoryFile))
                {
                    var json = File.ReadAllText(HistoryFile);
                    return JsonConvert.DeserializeObject<List<AntigravityMessage>>(json)
                           ?? new List<AntigravityMessage>();
                }
            }
            catch { }
            return new List<AntigravityMessage>();
        }

        /// <summary>Clears saved history.</summary>
        public static void Clear()
        {
            try { if (File.Exists(HistoryFile)) File.Delete(HistoryFile); } catch { }
        }
    }

    /// <summary>
    /// A single chat message in the Antigravity conversation.
    /// </summary>
    public class AntigravityMessage
    {
        public string Role { get; set; } = "user"; // "user" or "assistant"
        public string Text { get; set; } = "";
        public string Timestamp { get; set; } = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
    }
}
