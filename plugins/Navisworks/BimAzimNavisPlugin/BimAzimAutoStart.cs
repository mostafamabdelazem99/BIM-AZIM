using System;
using Autodesk.Navisworks.Api.Plugins;
using BimAzimNavisPlugin.Core;

namespace BimAzimNavisPlugin
{
    /// <summary>
    /// True auto-start. Unlike AddInPlugin (delay-loaded — its constructor
    /// only runs when the ribbon button is first clicked), EventWatcherPlugin
    /// is instantiated during Navisworks startup, so the socket service is
    /// listening on 8093 before the user does anything. The AddInPlugin
    /// ribbon toggle (BimAzimNavisPlugin) shares the same NavisPluginApp
    /// singleton: clicking it while the service runs stops it, clicking
    /// again restarts it.
    /// </summary>
    [Plugin("BimAzimNavisAutoStart", "BAZM",
        DisplayName = "BIM-AZIM Auto-Start",
        ToolTip = "Starts the BIM-AZIM coordination service automatically.")]
    public class BimAzimAutoStart : EventWatcherPlugin
    {
        public override void OnLoaded()
        {
            try
            {
                NavisMainThread.Init();
                NavisPluginApp.StartService();
            }
            catch (Exception ex)
            {
                NavisLogger.LogError("Auto-start failed (non-fatal — use the ribbon button to retry)", ex);
            }
        }

        public override void OnUnloading()
        {
            try { NavisBridgeSession.Stop(); NavisPluginApp.StopService(); }
            catch (Exception ex) { NavisLogger.LogError("Stop on unload failed", ex); }
        }
    }
}
