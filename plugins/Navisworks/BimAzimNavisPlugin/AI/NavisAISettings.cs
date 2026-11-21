using System;
using System.IO;
using Newtonsoft.Json;

namespace BimAzimNavisPlugin.AI
{
    /// <summary>
    /// Same provider list as Revit GeminiSettings (gemini/deepseek/perplexity/
    /// openrouter/ollama/cerebras/groq/openai) — user pastes the SAME API key.
    /// Stored separately so Revit settings are never touched:
    ///   %AppData%\Autodesk\Navisworks\Addins\BimAzim\navis-settings.json
    ///
    /// BIM-AZIM TODO: this class is storage-only (load/save a provider name + API key + model to
    /// local disk) — it makes no outbound HTTP calls itself, and neither does any navis_* dispatch
    /// case in NavisCommandExecutor (there is no navis_ai_chat/navis_ai_analyze_clashes case wired
    /// up in this plugin; those calls happen server-side in the BIM-AZIM MCP server using whatever
    /// key the user configures). Ported as-is since it is inert without a network call, but flagged
    /// because wiring an actual Gemini/Ollama call INTO this plugin is out of scope for this pass.
    /// </summary>
    public class NavisAISettings
    {
        public string ApiKey { get; set; } = "";
        public string Model { get; set; } = "gemini-2.0-flash";
        public string Provider { get; set; } = "gemini";

        private static string SettingsPath => Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Autodesk", "Navisworks", "Addins", "BimAzim", "navis-settings.json");

        public void Save()
        {
            var dir = Path.GetDirectoryName(SettingsPath)!;
            if (!Directory.Exists(dir)) Directory.CreateDirectory(dir);
            File.WriteAllText(SettingsPath, JsonConvert.SerializeObject(this, Formatting.Indented));
        }

        public static NavisAISettings Load()
        {
            try
            {
                if (File.Exists(SettingsPath))
                    return JsonConvert.DeserializeObject<NavisAISettings>(File.ReadAllText(SettingsPath))
                           ?? new NavisAISettings();
            }
            catch { }
            return new NavisAISettings();
        }

        public bool IsConfigured =>
            Provider.Equals("ollama", StringComparison.OrdinalIgnoreCase) || !string.IsNullOrWhiteSpace(ApiKey);

        public static string[] Providers { get; } =
            new[] { "gemini", "openai", "deepseek", "perplexity", "openrouter", "groq", "cerebras", "ollama" };
    }
}
