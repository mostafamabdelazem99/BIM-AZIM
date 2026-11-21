// BIM-AZIM TODO: NOT WIRED UP YET.
// Ported + rebranded from BIM-Bot as-is (natural-language keyword-to-tool
// bridge that forwards parsed commands to this plugin's own local socket
// service). Depends on the AI/ chat integration above (also deferred in this
// pass) to turn free-text into tool calls, so treat it as deferred for the
// same reason. Compiles standalone with no external credentials required.
using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace BimAzimPlugin.Antigravity
{
    /// <summary>
    /// Revit external command that opens the Antigravity chat window.
    /// Registered as a ribbon button in Application.cs.
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    public class AntigravityCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                AntigravityWindow.Open();
                return Result.Succeeded;
            }
            catch (System.Exception ex)
            {
                message = ex.Message;
                return Result.Failed;
            }
        }
    }
}
