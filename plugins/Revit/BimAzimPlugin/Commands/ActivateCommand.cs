using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using BimAzimPlugin.Core;
using BimAzimPlugin.UI;

namespace BimAzimPlugin.Commands
{
    /// <summary>
    /// External command for the "Activate BIM-AZIM" ribbon button.
    /// Opens the activation modal dialog.
    /// </summary>
    [Transaction(TransactionMode.Manual)]
    public class ActivateCommand : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            try
            {
                var window = new ActivationWindow();
                var result = window.ShowDialog();

                if (result == true)
                {
                    // Activation succeeded — update ribbon to show all tools
                    Application.SetActivationUiState(true);
                }

                return Result.Succeeded;
            }
            catch (System.Exception ex)
            {
                Logger.LogError("Activation command failed", ex);
                message = ex.Message;
                return Result.Failed;
            }
        }
    }
}
