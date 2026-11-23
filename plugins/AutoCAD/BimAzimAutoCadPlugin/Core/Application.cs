using System;
using Autodesk.AutoCAD.Runtime;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Core.Application;
using Exception = System.Exception;

[assembly: ExtensionApplication(typeof(BimAzimAutoCadPlugin.Core.Application))]
[assembly: CommandClass(typeof(BimAzimAutoCadPlugin.Core.Application))]

namespace BimAzimAutoCadPlugin.Core
{
    /// <summary>
    /// Main entry point for the BIM-AZIM AutoCAD plugin. Starts the socket service
    /// automatically on load (same auto-start behavior as the Revit/Navisworks plugins) and
    /// exposes plain AutoCAD commands to control it — a ribbon button is a nice-to-have on top
    /// of that, not a replacement, because the Autodesk.Windows ribbon API is markedly less
    /// stable across AutoCAD versions than Revit's PushButtonData API.
    /// </summary>
    public class Application : IExtensionApplication
    {
        private static SocketService? _service;
        public const int DefaultPort = 8094;
        public static string Version => "0.1.0";

        public void Initialize()
        {
            try
            {
                AcadEventManager.EnsureSubscribed();
                StartService();
                TryAddRibbonPanel();
                Logger.Log("BIM-AZIM AutoCAD plugin initialized.");
            }
            catch (Exception ex)
            {
                Logger.LogError("Initialize failed", ex);
            }
        }

        public void Terminate()
        {
            try { _service?.Stop(); }
            catch (Exception ex) { Logger.LogError("Terminate failed", ex); }
        }

        public static void StartService()
        {
            if (_service == null) _service = new SocketService(DefaultPort);
            if (!_service.IsRunning) _service.Start();
        }

        public static void StopService() => _service?.Stop();
        public static bool IsServiceRunning => _service?.IsRunning ?? false;

        [CommandMethod("BIMAZIM")]
        public void ToggleServiceCommand()
        {
            var doc = AcApp.DocumentManager.MdiActiveDocument;
            try
            {
                if (IsServiceRunning)
                {
                    StopService();
                    doc?.Editor.WriteMessage("\nBIM-AZIM service stopped. AI clients can no longer reach AutoCAD.\n");
                }
                else
                {
                    StartService();
                    doc?.Editor.WriteMessage($"\nBIM-AZIM service running on port {_service?.Port}.\n");
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("BIMAZIM command failed", ex);
                doc?.Editor.WriteMessage($"\nBIM-AZIM failed to start: {ex.Message}\n");
            }
        }

        /// <summary>
        /// Adds a one-button "BIM-AZIM" ribbon panel if the ribbon is already loaded. Wrapped
        /// defensively: the Autodesk.Windows ribbon API is a thin wrapper over WPF internals that
        /// has shifted between AutoCAD releases, and a ribbon hiccup must never take the actual
        /// service down with it. If this fails, the BIMAZIM command above still works from the
        /// command line or a user-added CUI button.
        /// </summary>
        private static void TryAddRibbonPanel()
        {
            try
            {
                var ribbon = Autodesk.Windows.ComponentManager.Ribbon;
                if (ribbon == null) return; // No UI (script/console mode) — commands still work.

                const string tabId = "BIMAZIM_TAB";
                var tab = ribbon.FindTab(tabId);
                if (tab == null)
                {
                    tab = new Autodesk.Windows.RibbonTab { Title = "BIM-AZIM", Id = tabId };
                    ribbon.Tabs.Add(tab);
                }

                var panelSource = new Autodesk.Windows.RibbonPanelSource { Title = "BIM-AZIM" };
                var button = new Autodesk.Windows.RibbonButton
                {
                    Text = "Start / Stop\nBIM-AZIM",
                    ShowText = true,
                    ShowImage = false,
                    Size = Autodesk.Windows.RibbonItemSize.Large,
                    Orientation = System.Windows.Controls.Orientation.Vertical,
                    CommandHandler = new RibbonCommandHandler(),
                    CommandParameter = "_BIMAZIM ",
                };
                panelSource.Items.Add(button);
                tab.Panels.Add(new Autodesk.Windows.RibbonPanel { Source = panelSource });
                tab.IsActive = true;
            }
            catch (Exception ex)
            {
                Logger.LogError("Ribbon setup failed (non-critical — use the BIMAZIM command instead)", ex);
            }
        }

        private class RibbonCommandHandler : System.Windows.Input.ICommand
        {
#pragma warning disable CS0067 // required by ICommand; the ribbon never raises it
            public event EventHandler? CanExecuteChanged;
#pragma warning restore CS0067
            public bool CanExecute(object? parameter) => true;

            public void Execute(object? parameter)
            {
                var doc = AcApp.DocumentManager.MdiActiveDocument;
                var command = (parameter as Autodesk.Windows.RibbonButton)?.CommandParameter as string ?? "_BIMAZIM ";
                doc?.SendStringToExecute(command, true, false, true);
            }
        }
    }
}
