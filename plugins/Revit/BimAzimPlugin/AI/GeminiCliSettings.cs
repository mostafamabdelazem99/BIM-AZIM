// BIM-AZIM TODO: NOT WIRED UP YET.
// Ported + rebranded from BIM-Bot as-is (Gemini/Ollama/Gemini-CLI chat + Google
// OAuth integration) so the code exists and compiles, but it depends on
// external services out of scope for this pass: a user-supplied Gemini API key,
// a locally installed Ollama/Gemini CLI, and/or Google OAuth client credentials
// read from the MCP server's .env file at runtime. None of these are
// compile-time dependencies (no secrets are baked in), and every call path that
// needs one already checks for it and returns/throws a clear "not configured"
// message instead of crashing (see IsConfigured / "API key not configured" /
// "GOOGLE_CLIENT_ID is not configured" below) — that guard is unchanged from
// BIM-Bot. Wire up real BIM-AZIM credentials/config before enabling this surface.
using System;
using System.IO;
using Newtonsoft.Json;

namespace BimAzimPlugin.AI
{
    /// <summary>
    /// Settings for the Gemini CLI integration — persisted to disk.
    /// Stores the API key, CLI mode toggle, and prerequisite paths.
    /// </summary>
    public class GeminiCliSettings
    {
        /// <summary>Google AI Studio API key for Gemini CLI.</summary>
        public string GeminiApiKey { get; set; } = "";

        /// <summary>Whether to use Gemini CLI mode (true) or the HTTP API mode (false).</summary>
        public bool UseGeminiCli { get; set; } = false;

        /// <summary>Auto-detected or manually set path to node.exe.</summary>
        public string NodePath { get; set; } = "";

        /// <summary>Path to the gemini CLI executable (npx or global install).</summary>
        public string GeminiCliPath { get; set; } = "";

        /// <summary>Whether to auto-install the CLI if missing.</summary>
        public bool AutoInstallCli { get; set; } = true;

        /// <summary>Custom MCP server path override. Empty = auto-detect.</summary>
        public string McpServerPath { get; set; } = "";

        // ── Persistence ──
        private static string SettingsPath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Autodesk", "Revit", "Addins", "BimAzim", "gemini-cli-settings.json");

        public void Save()
        {
            var dir = Path.GetDirectoryName(SettingsPath)!;
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            File.WriteAllText(SettingsPath, JsonConvert.SerializeObject(this, Formatting.Indented));
        }

        public static GeminiCliSettings Load()
        {
            try
            {
                if (File.Exists(SettingsPath))
                    return JsonConvert.DeserializeObject<GeminiCliSettings>(File.ReadAllText(SettingsPath))
                           ?? new GeminiCliSettings();
            }
            catch { }
            return new GeminiCliSettings();
        }

        /// <summary>Whether the CLI mode has a valid API key configured.</summary>
        public bool IsConfigured => !string.IsNullOrWhiteSpace(GeminiApiKey);
    }
}
