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
    /// Settings for external integrations — persisted to disk.
    /// Controls which integrations are enabled and stores their credentials.
    /// </summary>
    public class IntegrationSettings
    {
        // ── Excel ──
        public bool ExcelEnabled { get; set; } = true;

        // ── Notion ──
        public bool NotionEnabled { get; set; } = false;
        public string NotionApiKey { get; set; } = "";
        public string NotionDatabaseId { get; set; } = "";

        // ── Google Sheets ──
        public bool GoogleSheetsEnabled { get; set; } = false;
        public bool GoogleSignedIn { get; set; } = false;
        public string GoogleEmail { get; set; } = "";
        public string GoogleSheetsCredentialsPath { get; set; } = "";
        public string GoogleSheetsSpreadsheetId { get; set; } = "";

        // ── SQLite ──
        public bool SqliteEnabled { get; set; } = true;

        // ── Ollama ──
        public bool OllamaEnabled { get; set; } = false;
        public string OllamaUrl { get; set; } = "http://localhost:11434";
        public string OllamaModel { get; set; } = "qwen2.5:7b-instruct-q4_K_M";

        // ── Power BI ──
        public bool PowerBIEnabled { get; set; } = false;
        public bool PowerBISignedIn { get; set; } = false;
        public string PowerBIEmail { get; set; } = "";
        public string PowerBIWorkspaceId { get; set; } = "";
        public string PowerBIReportId { get; set; } = "";
        public string PowerBIPublicUrl { get; set; } = "";

        // ── Persistence ──
        private static string SettingsPath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Autodesk", "Revit", "Addins", "BimAzim", "integration-settings.json");

        public void Save()
        {
            var dir = Path.GetDirectoryName(SettingsPath)!;
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            File.WriteAllText(SettingsPath, JsonConvert.SerializeObject(this, Formatting.Indented));
        }

        public static IntegrationSettings Load()
        {
            try
            {
                if (File.Exists(SettingsPath))
                    return JsonConvert.DeserializeObject<IntegrationSettings>(File.ReadAllText(SettingsPath))
                           ?? new IntegrationSettings();
            }
            catch { }
            return new IntegrationSettings();
        }

        // ── Validation helpers ──
        public bool IsNotionConfigured =>
            NotionEnabled && !string.IsNullOrWhiteSpace(NotionApiKey) && NotionApiKey != "your_notion_integration_token";

        public bool IsGoogleSheetsConfigured =>
            GoogleSheetsEnabled && (GoogleSignedIn || !string.IsNullOrWhiteSpace(GoogleSheetsCredentialsPath));

        public bool IsOllamaConfigured =>
            OllamaEnabled && !string.IsNullOrWhiteSpace(OllamaUrl);

        public bool IsPowerBIConfigured =>
            PowerBIEnabled && (PowerBISignedIn || !string.IsNullOrWhiteSpace(PowerBIPublicUrl));
    }
}
