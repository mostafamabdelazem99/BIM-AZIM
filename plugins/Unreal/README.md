# BIM-AZIM Unreal Bridge Plugin (BimAzimMCPBridge)

A small Unreal Editor C++ plugin that runs a lightweight embedded HTTP server on
**port 30012**, giving the BIM-AZIM Unreal MCP server (`../../unreal/server/`) a few
operations that Unreal's own built-in Remote Control API / Python Editor Script Plugin
don't cover cleanly: viewport screenshots, editor toast notifications, console command
execution, project metadata, and asset import.

It is ported from BIM-Bot's `UnrealMCPBridge` plugin (MIT licensed, © Hassan Ahmed
Elmathary — see [`LICENSE`](BimAzimMCPBridge/LICENSE)) and rebranded for BIM-AZIM. The
plugin logic (routes, handlers, screenshot/notification/import code) is unchanged;
only names and the listening port were adapted.

## Unlike Revit/Navisworks/Tekla — and why

The Revit and Navisworks add-ins, and the Tekla bridge, each expose BIM-AZIM's shared
`defineTool()` tool surface over their own channel back to the main `server/`. Unreal is
different, matching BIM-Bot's own choice to ship Unreal support as a wholly separate
`BIM-Bot-Unreal`/`BIM-Bot-Navis`-style connector rather than folding it into the shared
server:

- Most Unreal tool calls never touch this plugin at all — they're Python scripts POSTed
  to Unreal's **own built-in Remote Control API** (port 30010, Epic's own plugin, not
  custom code), executed via the Python Editor Script Plugin inside the running editor.
- This plugin exists only for the handful of things the Python API can't do well
  (synchronous screenshots, native toast UI, etc.) — and every one of those tools still
  falls back to a Python-only implementation when this plugin isn't installed. It is
  entirely optional.
- Because of that, this plugin is much smaller than the Tekla bridge or the
  Revit/Navisworks add-ins: 6 source files, no business logic beyond routing HTTP
  requests to Slate/AssetTools/screenshot APIs.

## Project layout

```
BimAzimMCPBridge/
  BimAzimMCPBridge.uplugin                         plugin descriptor (module: BimAzimMCPBridge)
  LICENSE                                          MIT, adapted from BIM-Bot
  Source/BimAzimMCPBridge/
    BimAzimMCPBridge.Build.cs                      module dependencies (HTTPServer, Slate, AssetTools, ...)
    Public/BimAzimMCPBridge.h                       FBimAzimMCPBridgeModule (IModuleInterface)
    Private/BimAzimMCPBridge.cpp                    StartupModule/ShutdownModule — starts/stops the HTTP server
    Private/MCPHttpServer.h                         FMCPHttpServer — route declarations
    Private/MCPHttpServer.cpp                       route handlers: info, screenshot, console, notify, project, import
```

## Setup

1. Copy the `BimAzimMCPBridge/` folder into your Unreal project's `Plugins/` directory:
   `MyProject/Plugins/BimAzimMCPBridge/`.
2. Close the Unreal Editor if it's open.
3. Right-click `MyProject.uproject` → **Generate Visual Studio project files**.
4. Open `MyProject.sln` in Visual Studio 2022, set configuration to **Development
   Editor / Win64**, and build.
5. Reopen the editor → `Edit → Plugins → Project → BimAzimMCPBridge` → enable it (it is
   not `EnabledByDefault`, so each project opts in explicitly).
6. The bridge starts automatically on port 30012 when the editor loads. Check the
   Output Log for `[BimAzimMCPBridge] Listening on http://localhost:30012`.
7. Point `unreal/server`'s `UNREAL_BRIDGE_PORT` env var at the same port (30012 is
   already the server's default) and confirm with the `ping_unreal` / `get_project_info`
   MCP tools.

Rebuilding without Visual Studio: right-click the `.uproject` → **Switch Unreal Engine
version** → pick the version you have installed → reopen; Unreal will offer to rebuild
the missing module automatically.

## Known gaps / honest limitations

- **Unverified against a live Unreal Engine install.** This plugin was ported without a
  local Unreal Engine + Visual Studio environment available to compile and test it
  against. The code is a faithful, line-for-line port of BIM-Bot's working
  `UnrealMCPBridge` plugin (same includes, same `HTTPServer`/Slate/AssetTools APIs,
  same route shapes) with only the module name, class name, log strings and listening
  port (30011 → 30012) changed — but **you must build it once against your installed
  Unreal Engine version before trusting it.** Nothing here is flagged `// VERIFY:`
  because nothing in the ported logic itself was uncertain — the risk is purely
  "does this compile against *your* UE version's module API," the same risk BIM-Bot's
  own plugin carries.
- **What to check when you build it:**
  - UE version compatibility: this was written against UE5's `HTTPServer` module
    (`IHttpRouter`, `FHttpServerRequest`/`Response`) and `FHighResScreenshotConfig` /
    `FScreenshotRequest` for the screenshot route — these have been stable across UE5.x
    but a header or signature may have moved in your exact version.
  - Where to place it: a project's `Plugins/` directory (not the engine's own
    `Engine/Plugins/`) unless you specifically want it enabled by default for every
    project on that engine install, the way `unreal/server/src/unreal-setup.js`'s
    `setupEngine()` can do for the stock plugins.
  - The `.uplugin` and `.Build.cs` module dependency list
    (`UnrealEd`, `EditorSubsystem`, `HTTPServer`, `ImageWrapper`, `AssetTools`,
    `LevelEditor`, `ToolMenus`, …) should be checked against your UE version's module
    map if the build fails to resolve a module.
- **No GUID field.** Unlike some other Unreal manifest/project files, a `.uplugin`
  descriptor has no plugin-identity GUID field to collide on (UE plugins are identified
  by module name, not a GUID) — `BimAzimMCPBridge.uplugin` was checked for one and has
  none, so none was generated. The module itself was renamed from BIM-Bot's
  `UnrealMCPBridge` to `BimAzimMCPBridge` throughout (`.uplugin`, `.Build.cs`, class
  names, log tags) specifically so both plugins' *module names* can coexist in the same
  engine/project without clashing, which is the actual collision risk here.
- **Screenshot route is best-effort.** Like upstream, `HandleScreenshot` polls for the
  screenshot file to appear for up to 5 seconds — if the editor viewport is minimized or
  not rendering, this can legitimately time out (503). This is inherited behavior, not a
  porting regression.

## License

MIT — see [`BimAzimMCPBridge/LICENSE`](BimAzimMCPBridge/LICENSE). Adapted from
[BIM-Bot](https://github.com/HassanElmathary/BIM-Bot) (© Hassan Ahmed Elmathary, MIT).
