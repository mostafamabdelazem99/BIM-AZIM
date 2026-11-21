using Newtonsoft.Json.Linq;
using Tekla.Structures.Model.Operations;

namespace BimAzim.TeklaBridge.Tools
{
    public sealed class NumberingExportTools
    {
        private readonly TeklaConnection _connection;

        public NumberingExportTools(TeklaConnection connection) => _connection = connection;

        public object RunNumbering(JObject args)
        {
            _connection.RequireConnected();
            var scope = (string)(args["scope"] ?? "MODIFIED_ONLY");

            try
            {
                // VERIFY: Operation.Numbering.NumberAll()/NumberModified() against your installed version's
                // Tekla.Structures.Model.Operations API — this is the most version-sensitive call in this
                // bridge. If it doesn't compile, check Help > Tekla Open API Reference for the current
                // numbering entry point (older/newer versions have exposed this a little differently).
                if (scope == "ALL")
                    Operation.Numbering.NumberAll();
                else
                    Operation.Numbering.NumberModified();
            }
            catch (System.Exception ex)
            {
                throw new ToolException($"Numbering failed: {ex.Message}");
            }

            return new { scope, triggered = true };
        }

        public object ExportIfc(JObject args)
        {
            _connection.RequireConnected();
            var outputPath = (string)args["outputPath"];
            if (string.IsNullOrWhiteSpace(outputPath))
                throw new ToolException("outputPath is required.");

            // There is no stable, version-independent "export to IFC" method in the public Tekla Open
            // API. The documented workaround is to record a Tekla macro once (Applications & Components
            // > record a macro that runs File > Export > IFC with your desired settings, saved under
            // the model's or the user's macro folder) and trigger it here via Operation.RunMacro.
            //
            // VERIFY: macro name, and whether your macro reads the output path from an environment
            // variable / a fixed settings file / a dialog you've pre-configured to not prompt.
            const string macroName = "BimAzim_ExportIfc";

            try
            {
                System.Environment.SetEnvironmentVariable("BIMAZIM_IFC_OUTPUT_PATH", outputPath);
                Operation.RunMacro(macroName);
            }
            catch (System.Exception ex)
            {
                throw new ToolException(
                    $"IFC export macro '{macroName}' failed or is not set up: {ex.Message}. " +
                    "See plugins/Tekla/README.md 'Known gaps' for how to record this macro once in Tekla Structures.");
            }

            return new { outputPath, macroUsed = macroName };
        }

        public object PushToTrimbleConnect(JObject args)
        {
            // Trimble Connect sync is not part of the Tekla Open API — it requires the separate
            // Trimble Connect REST API (its own OAuth + project/file model). Not implemented yet;
            // returning a clear error instead of a fake success. See docs/ARCHITECTURE.md roadmap.
            throw new ToolException(
                "tekla_push_to_trimble_connect is not implemented yet — it needs the separate Trimble " +
                "Connect REST API, not the Tekla Open API. Use Tekla Structures' built-in Trimble Connect " +
                "sync panel for now. Tracked in docs/ARCHITECTURE.md roadmap.");
        }
    }
}
