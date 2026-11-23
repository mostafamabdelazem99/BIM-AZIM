using System;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Media.Imaging;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Autodesk.Revit.UI.Events;
using BimAzimPlugin.UI;

namespace BimAzimPlugin.Core
{
    /// <summary>
    /// Main entry point for the BIM-AZIM Plugin.
    /// Registers the ribbon panel with Start/Stop service and Settings buttons.
    /// </summary>
    public class Application : IExternalApplication
    {
        public static UIControlledApplication? UiApp { get; private set; }
        public static UIApplication? ActiveUIApp { get; set; }
        private static SocketService? _socketService;
        private static ExternalEventManager? _eventManager;
        private static bool _startupUpdateChecked = false;

        // Reference for the update check button (for dynamic badge updates)
        private static PushButton? _updateCheckButton;

        // Reference for toggle-state button
        private static PushButton? _toggleServiceButton;

        public static SocketService? SocketServiceInstance => _socketService;
        public static ExternalEventManager? EventManagerInstance => _eventManager;

        public static string Version => "2.8.0";

        public Result OnStartup(UIControlledApplication application)
        {
            UiApp = application;

            // ── Diagnostic: write before anything else so we can see where the crash is ──
            var _diagLog = System.IO.Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "BimAzim", "logs", $"startup-diag-{DateTime.Now:HHmmss}.log");
            Action<string> _diag = msg =>
            {
                try
                {
                    System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(_diagLog)!);
                    System.IO.File.AppendAllText(_diagLog, $"[{DateTime.Now:HH:mm:ss.fff}] {msg}\n");
                }
                catch { }
            };
            _diag("OnStartup entered");

            try
            {
                _diag("try block entered");
                var asm = Assembly.GetExecutingAssembly().Location;

                // ========================================
                // Create custom "BIM-AZIM" tab in the ribbon
                // ========================================
                const string tabName = "BIM-AZIM";
                application.CreateRibbonTab(tabName);

                // ========================================
                // Panel 1: Core
                // ========================================
                var corePanel = application.CreateRibbonPanel(tabName, "BIM-AZIM");

                // --- Start BIM-AZIM (toggle) ---
                var toggleData = new PushButtonData("MCPToggle", "Start\nBIM-AZIM", asm,
                    "BimAzimPlugin.Commands.ToggleServiceCommand")
                {
                    ToolTip = "Start or stop the BIM-AZIM service for AI integration",
                    LargeImage = RibbonIcons.WithCrossBadge(RibbonIcons.StartService(32), 32),
                    Image = RibbonIcons.WithCrossBadge(RibbonIcons.StartService(16), 16)
                };
                _toggleServiceButton = corePanel.AddItem(toggleData) as PushButton;

                // --- AI Chat ---
                var chatData = new PushButtonData("MCPChat", "AI Chat", asm,
                    "BimAzimPlugin.Commands.ChatCommand")
                {
                    ToolTip = "Open the AI Chat window to interact with your Revit model using natural language",
                    LargeImage = RibbonIcons.Chat(32),
                    Image = RibbonIcons.Chat(16)
                };
                corePanel.AddItem(chatData);

                // --- Project Files ---
                var projectFilesData = new PushButtonData("MCPProjectFiles", "Project\nFiles", asm,
                    "BimAzimPlugin.Commands.Tool_ProjectFiles")
                {
                    ToolTip = "Manage project files — add documents, send to AI for analysis, and work with results",
                    LargeImage = RibbonIcons.ProjectFiles(32),
                    Image = RibbonIcons.ProjectFiles(16)
                };
                corePanel.AddItem(projectFilesData);

                // --- Join Bridge (manual Navisworks master / Revit slave pairing) ---
                var bridgeData = new PushButtonData("MCPBridgeJoin", "Join\nBridge", asm,
                    "BimAzimPlugin.Commands.BridgeJoinCommand")
                {
                    ToolTip = "Join this model to the BIM-AZIM bridge as a slave of the Navisworks master " +
                              "(start the bridge in Navisworks first: Add-ins > BIM-AZIM Bridge). Click again to leave.",
                    LargeImage = RibbonIcons.ProjectFiles(32),
                    Image = RibbonIcons.ProjectFiles(16)
                };
                corePanel.AddItem(bridgeData);

                // --- Connect Claude ---
                var claudeData = new PushButtonData("MCPClaudeConnect", "Connect\nClaude", asm,
                    "BimAzimPlugin.Commands.ConnectToClaudeCommand")
                {
                    ToolTip = "Automatically configure the Claude Desktop app to connect to BIM-AZIM",
                    LargeImage = RibbonIcons.ConnectClaude(32),
                    Image = RibbonIcons.ConnectClaude(16)
                };
                corePanel.AddItem(claudeData);

                // --- Local AI ---
                var localAiData = new PushButtonData("MCPLocalAI", "Local\nAI", asm,
                    "BimAzimPlugin.Commands.LocalAICommand")
                {
                    ToolTip = "Manage local AI models (Ollama) — free, unlimited, private",
                    LargeImage = RibbonIcons.LocalAI(32),
                    Image = RibbonIcons.LocalAI(16)
                };
                corePanel.AddItem(localAiData);

                // --- Tools Hub ---
                var hubData = new PushButtonData("MCPToolsHub", "Tools\nHub", asm,
                    "BimAzimPlugin.Commands.ToolsHubCommand")
                {
                    ToolTip = "Browse and launch all 160+ BIM-AZIM tools from a visual dashboard",
                    LargeImage = RibbonIcons.ToolsHub(32),
                    Image = RibbonIcons.ToolsHub(16)
                };
                corePanel.AddItem(hubData);

                corePanel.AddSeparator();

                // ========================================
                // Export Pulldown
                // ========================================
                var exportPd = corePanel.AddItem(
                    new PulldownButtonData("MCPExport", "Export")
                    {
                        ToolTip = "Export tools — PDF, DWG, DWF, DGN, IFC, NWC, Images, Schedules, CSV",
                        LargeImage = RibbonIcons.Export(32),
                        Image = RibbonIcons.Export(16)
                    }) as PulldownButton;

                AddPulldownItem(exportPd, "ExportManager", "📦 Export Manager", asm,
                    "BimAzimPlugin.Commands.Tool_ExportManager", "Unified export manager — PDF, DWG, DWF, DGN, IFC, NWC, Images");
                AddPulldownItem(exportPd, "ExportSchedule", "📊 Export Schedule", asm,
                    "BimAzimPlugin.Commands.Tool_ExportScheduleData", "Export schedule data to CSV");
                AddPulldownItem(exportPd, "ExportParams", "📋 Export Parameters", asm,
                    "BimAzimPlugin.Commands.Tool_ExportParametersToCsv", "Export element parameters to CSV");
                AddPulldownItem(exportPd, "ImportParams", "📥 Import Parameters", asm,
                    "BimAzimPlugin.Commands.Tool_ImportParametersFromCsv", "Import parameters from CSV file");
                AddPulldownItem(exportPd, "ExportPowerBI", "⚡ Export to Power BI", asm,
                    "BimAzimPlugin.Commands.Tool_ExportToPowerBI", "Export 3D model + parameters to a ready-to-open Power BI dashboard (.pbit)");
                AddPulldownItem(exportPd, "ViewPowerBI", "📊 View Power BI Report", asm,
                    "BimAzimPlugin.Commands.Tool_ViewPowerBIReport", "Open a published Power BI report inside Revit (WebView2)");

                // ========================================
                // Families Pulldown
                // ========================================
                var familiesPd = corePanel.AddItem(
                    new PulldownButtonData("MCPFamilies", "Families")
                    {
                        ToolTip = "Family & parameter management tools",
                        LargeImage = RibbonIcons.Families(32),
                        Image = RibbonIcons.Families(16)
                    }) as PulldownButton;

                AddPulldownItem(familiesPd, "ManageFamilies", "📁 Manage Families", asm,
                    "BimAzimPlugin.Commands.Tool_ManageFamilies", "Rename & organize families");
                AddPulldownItem(familiesPd, "FamilyInfo", "ℹ️ Family Info", asm,
                    "BimAzimPlugin.Commands.Tool_GetFamilyInfo", "Get detailed family information");
                AddPulldownItem(familiesPd, "CreateParam", "➕ Create Parameter", asm,
                    "BimAzimPlugin.Commands.Tool_CreateProjectParameter", "Create a new project parameter");
                AddPulldownItem(familiesPd, "BatchSetParam", "✏️ Batch Set Parameter", asm,
                    "BimAzimPlugin.Commands.Tool_BatchSetParameter", "Set parameter values in batch");
                AddPulldownItem(familiesPd, "DeleteUnused", "🗑️ Delete Unused", asm,
                    "BimAzimPlugin.Commands.Tool_DeleteUnusedFamilies", "Remove unused families from project");

                // ========================================
                // QuickViews Pulldown
                // ========================================
                var viewsPd = corePanel.AddItem(
                    new PulldownButtonData("MCPQuickViews", "Quick\nViews")
                    {
                        ToolTip = "Auto-generate elevation, section, and callout views",
                        LargeImage = RibbonIcons.QuickViews(32),
                        Image = RibbonIcons.QuickViews(16)
                    }) as PulldownButton;

                AddPulldownItem(viewsPd, "Elevations", "📐 Create Elevations", asm,
                    "BimAzimPlugin.Commands.Tool_CreateElevationViews", "Auto-generate elevation views");
                AddPulldownItem(viewsPd, "Sections", "✂️ Create Sections", asm,
                    "BimAzimPlugin.Commands.Tool_CreateSectionViews", "Auto-generate section views");
                AddPulldownItem(viewsPd, "Callouts", "🔍 Create Callouts", asm,
                    "BimAzimPlugin.Commands.Tool_CreateCalloutViews", "Auto-generate callout views");

                // ========================================
                // Views & Sheets Pulldown
                // ========================================
                var sheetsPd = corePanel.AddItem(
                    new PulldownButtonData("MCPSheets", "Views &\nSheets")
                    {
                        ToolTip = "View and sheet management tools",
                        LargeImage = RibbonIcons.ViewsSheets(32),
                        Image = RibbonIcons.ViewsSheets(16)
                    }) as PulldownButton;

                AddPulldownItem(sheetsPd, "AlignViewports", "📏 Align Viewports", asm,
                    "BimAzimPlugin.Commands.Tool_AlignViewports", "Align viewports across sheets");
                AddPulldownItem(sheetsPd, "BatchSheets", "📑 Batch Create Sheets", asm,
                    "BimAzimPlugin.Commands.Tool_BatchCreateSheets", "Create multiple sheets at once");
                AddPulldownItem(sheetsPd, "DuplicateView", "📋 Duplicate View", asm,
                    "BimAzimPlugin.Commands.Tool_DuplicateView", "Duplicate views with options");
                AddPulldownItem(sheetsPd, "ApplyTemplate", "🎨 Apply View Template", asm,
                    "BimAzimPlugin.Commands.Tool_ApplyViewTemplate", "Apply view template to views");

                // ========================================
                // QA/QC Pulldown
                // ========================================
                var qaqcPd = corePanel.AddItem(
                    new PulldownButtonData("MCPQaQc", "QA/QC")
                    {
                        ToolTip = "Quality assurance tools — clash detection, warnings, model audit",
                        LargeImage = RibbonIcons.ToolsHub(32),
                        Image = RibbonIcons.ToolsHub(16)
                    }) as PulldownButton;

                AddPulldownItem(qaqcPd, "ClashDetection", "⚡ Clash Report Viewer", asm,
                    "BimAzimPlugin.Commands.Tool_ClashDetection",
                    "Load a Navisworks clash report HTML and zoom/select clashing elements in Revit");

                corePanel.AddSeparator();

                // ========================================
                // Utility buttons (Settings + Updates) stacked
                // ========================================
                var settingsData = new PushButtonData("MCPSettings", "Settings", asm,
                    "BimAzimPlugin.Commands.SettingsCommand")
                {
                    ToolTip = "Configure BIM-AZIM connection settings",
                    LargeImage = RibbonIcons.Settings(32),
                    Image = RibbonIcons.Settings(16)
                };

                var updateData = new PushButtonData("MCPUpdate", "Check\nUpdates", asm,
                    "BimAzimPlugin.Commands.CheckUpdateCommand")
                {
                    ToolTip = "Check for plugin updates on GitHub",
                    LargeImage = RibbonIcons.CheckUpdates(32),
                    Image = RibbonIcons.CheckUpdates(16)
                };

                var licenseData = new PushButtonData("MCPRequestLicense", "Request\nLicense", asm,
                    "BimAzimPlugin.Commands.ActivateCommand")
                {
                    ToolTip = "Submit your username and email to request a BIM-AZIM license — " +
                              "the admin is notified automatically and replies by email",
                    LargeImage = RibbonIcons.ActivateKey(32),
                    Image = RibbonIcons.ActivateKey(16)
                };

                corePanel.AddItem(settingsData);
                _updateCheckButton = corePanel.AddItem(updateData) as PushButton;
                corePanel.AddItem(licenseData);

                // Initialize the external event manager
                _eventManager = new ExternalEventManager();

                // Register Idling event for one-time startup update check
                application.Idling += OnRevitIdling;

                Logger.Log("BIM-AZIM Plugin started successfully — all ribbon buttons registered");
                _diag("OnStartup succeeded");
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                _diag($"CAUGHT EXCEPTION: {ex.GetType().Name}: {ex.Message}\n{ex.StackTrace}");
                Logger.LogError("Failed to start BIM-AZIM Plugin", ex);
                return Result.Failed;
            }
        }

        /// <summary>Helper to add a sub-item to a pulldown button.</summary>
        private static void AddPulldownItem(PulldownButton pd, string name, string text,
            string asm, string className, string tooltip)
        {
            var data = new PushButtonData(name, text, asm, className) { ToolTip = tooltip };
            pd.AddPushButton(data);
        }

        public Result OnShutdown(UIControlledApplication application)
        {
            try
            {
                BridgeSessionFile.LeaveAllForThisProcess();
                _socketService?.Stop();
                Logger.Log("BIM-AZIM Plugin shut down");
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                Logger.LogError("Error during shutdown", ex);
                return Result.Failed;
            }
        }

        public static void StartService(UIApplication uiApp)
        {
            ActiveUIApp = uiApp;
            _userStoppedService = false;
            if (_socketService == null)
            {
                _socketService = new SocketService(8082, _eventManager!);
            }
            _socketService.Start();
            UpdateToggleButtonState();
            Logger.Log("BIM-AZIM Service started on port 8082");
        }

        public static void StopService()
        {
            _userStoppedService = true;
            _socketService?.Stop();
            UpdateToggleButtonState();
            Logger.Log("BIM-AZIM Service stopped by user");
        }

        /// <summary>
        /// Set when the user stops the service from the ribbon. The idling health
        /// check honours this and will not restart behind the user's back.
        /// </summary>
        private static bool _userStoppedService;

        public static bool IsServiceRunning => _socketService?.IsRunning ?? false;

        // ========================================
        // Dynamic button state updates
        // ========================================

        /// <summary>Update the Start BIM-AZIM button icon/text based on service state.</summary>
        public static void UpdateToggleButtonState()
        {
            if (_toggleServiceButton == null) return;
            try
            {
                bool running = IsServiceRunning;
                var baseIcon32 = RibbonIcons.StartService(32);
                var baseIcon16 = RibbonIcons.StartService(16);
                _toggleServiceButton.ItemText = running ? "BIM-AZIM\n✓ ON" : "Start\nBIM-AZIM";
                _toggleServiceButton.LargeImage = running
                    ? RibbonIcons.WithCheckBadge(baseIcon32, 32)
                    : RibbonIcons.WithCrossBadge(baseIcon32, 32);
                _toggleServiceButton.Image = running
                    ? RibbonIcons.WithCheckBadge(baseIcon16, 16)
                    : RibbonIcons.WithCrossBadge(baseIcon16, 16);
                _toggleServiceButton.ToolTip = running
                    ? "BIM-AZIM service is running — click to stop"
                    : "Start the BIM-AZIM service for AI integration";
            }
            catch (Exception ex)
            {
                Logger.LogError("Failed to update toggle button state", ex);
            }
        }


        /// <summary>
        /// Idling handler that auto-starts the BIM-AZIM service on first Revit idle,
        /// retries if it fails, and periodically health-checks the service.
        /// </summary>
        private static int _autoStartAttempts = 0;
        private const int MaxAutoStartAttempts = 10;
        private static DateTime _lastHealthCheck = DateTime.MinValue;
        private const double HealthCheckIntervalSeconds = 30;

        private static async void OnRevitIdling(object? sender, IdlingEventArgs e)
        {
            if (sender is not UIApplication uiApp) return;
            ActiveUIApp = uiApp;

            // ── Phase 1: One-time auto-start with retry ──
            if (!_startupUpdateChecked)
            {
                _autoStartAttempts++;

                if (!IsServiceRunning && !_userStoppedService)
                {
                    try
                    {
                        StartService(uiApp);
                        Logger.Log($"BIM-AZIM service auto-started on Revit idle (attempt {_autoStartAttempts})");
                    }
                    catch (Exception startEx)
                    {
                        Logger.LogError($"Auto-start attempt {_autoStartAttempts}/{MaxAutoStartAttempts} failed", startEx);

                        if (_autoStartAttempts < MaxAutoStartAttempts)
                        {
                            // Stay subscribed — will retry on next Idling event (~100ms later)
                            return;
                        }

                        Logger.LogError("All auto-start attempts exhausted. User can start manually from ribbon.");
                    }
                }

                // Mark startup phase complete (whether service started or all retries exhausted)
                _startupUpdateChecked = true;

                // Don't unsubscribe from Idling — we keep it for the health check below

                // Self-heal Claude configs in the background: repairs stale
                // BIM-AZIM entries (e.g. after the install/repo path moved).
                // Only writes when an entry is missing or broken.
                _ = Task.Run(() => ClaudeConfigService.EnsureAllSilent());

                // Background update check (non-blocking) — respects user setting
                var settings = PluginSettings.Load();
                if (settings.AutoCheckUpdates)
                {
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var checker = new UpdateChecker();
                            var updateInfo = await checker.CheckForUpdateAsync();

                            if (updateInfo.UpdateAvailable)
                            {
                                var skippedVersion = UpdateChecker.GetSkippedVersion();
                                if (skippedVersion == updateInfo.LatestVersion)
                                {
                                    Logger.Log($"Update {updateInfo.LatestVersion} available but skipped by user.");
                                    return;
                                }

                                Logger.Log($"Update available: {updateInfo.LatestVersion}");
                                // Queue UI notification for next idle
                                _pendingUpdateInfo = updateInfo;
                                // Update the ribbon button badge on the UI thread
                                _pendingUpdateBadge = true;
                            }
                            else
                            {
                                Logger.Log("Plugin is up to date.");
                            }
                        }
                        catch (Exception ex)
                        {
                            Logger.LogError("Startup update check failed (non-critical)", ex);
                        }
                    });
                }
                else
                {
                    Logger.Log("Auto-check for updates is disabled — skipping startup update check.");
                }

                return;
            }

            // ── Apply pending update badge on UI thread ──
            if (_pendingUpdateBadge)
            {
                _pendingUpdateBadge = false;
                UpdateCheckButtonState(true);
            }

            // ── Show pending update notification on UI thread ──
            if (_pendingUpdateInfo != null)
            {
                var info = _pendingUpdateInfo;
                _pendingUpdateInfo = null;
                try
                {
                    var window = new UpdateNotificationWindow(info);
                    window.ShowDialog();
                }
                catch (Exception ex)
                {
                    Logger.LogError("Failed to show update notification", ex);
                }
                return;
            }

            // ── Phase 2: Periodic health check (runs every 30s) ──
            var now = DateTime.Now;
            if ((now - _lastHealthCheck).TotalSeconds < HealthCheckIntervalSeconds)
                return;
            _lastHealthCheck = now;

            if (!IsServiceRunning && !_userStoppedService)
            {
                Logger.Log("Health check: service is down — auto-restarting...");
                try
                {
                    StartService(uiApp);
                    Logger.Log("Health check: service restarted successfully");
                }
                catch (Exception ex)
                {
                    Logger.LogError("Health check: auto-restart failed", ex);
                }
            }
        }

        private static UpdateInfo? _pendingUpdateInfo;
        private static volatile bool _pendingUpdateBadge = false;

        /// <summary>
        /// Updates the Check Updates ribbon button icon to show/hide
        /// the amber notification badge based on update availability.
        /// </summary>
        public static void UpdateCheckButtonState(bool updateAvailable)
        {
            if (_updateCheckButton == null) return;
            try
            {
                var baseIcon32 = RibbonIcons.CheckUpdates(32);
                var baseIcon16 = RibbonIcons.CheckUpdates(16);

                if (updateAvailable)
                {
                    _updateCheckButton.LargeImage = RibbonIcons.WithUpdateBadge(baseIcon32, 32);
                    _updateCheckButton.Image = RibbonIcons.WithUpdateBadge(baseIcon16, 16);
                    _updateCheckButton.ItemText = "Update\nAvailable!";
                    _updateCheckButton.ToolTip = "A new version of BIM-AZIM is available — click to update";
                }
                else
                {
                    _updateCheckButton.LargeImage = baseIcon32;
                    _updateCheckButton.Image = baseIcon16;
                    _updateCheckButton.ItemText = "Check\nUpdates";
                    _updateCheckButton.ToolTip = "Check for plugin updates on GitHub";
                }
            }
            catch (Exception ex)
            {
                Logger.LogError("Failed to update check-updates button state", ex);
            }
        }
    }
}

