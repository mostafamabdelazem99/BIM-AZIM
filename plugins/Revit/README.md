# BIM-AZIM Revit Plugin

Ported and rebranded from the open-source [BIM-Bot](https://github.com/HassanElmathary/BIM-Bot)
(MIT licensed) Revit add-in. It is a real, working `IExternalApplication` add-in — not a scaffold
— that runs inside Revit's own process and talks to `server/src/bridge/tcp-engine-client.ts` over
a loopback TCP socket.

## Where it lives

```
BimAzimPlugin/
  BimAzimPlugin.csproj       multi-targeting project — one build "band" per Revit year (2020-2027)
  Directory.Build.props      per-band output paths (bin\R<year>, obj\R<year>)
  NuGet.Config                adds nuget.org as a package source for this project
  LICENSE                     MIT, adapted from BIM-Bot — original copyright preserved
  Core/
    Application.cs             IExternalApplication entry point — ribbon tab "BIM-AZIM",
                                 starts/stops the socket service, auto-start + health check
    SocketService.cs            TCP listener, JSON-RPC 2.0 "Content-Length: N\n{json}" framing
    ExternalEventManager.cs     marshals socket requests onto Revit's UI thread (ExternalEvent)
    CommandExecutor*.cs         the ~150+ case `switch(command)` — one partial file per domain
                                 (Mep, Structural, Export, ViewSheet, Transfer, Utility, …)
    ServiceAuth.cs               per-request shared-secret token (%LOCALAPPDATA%\BimAzim\auth.token)
    ServiceEndpoint.cs           writes the MCP-server handshake file (see below)
    Compat/                      Revit-2020..2027 API-shape compatibility shims
  Commands/                    thin IExternalCommand wrappers that the ribbon buttons invoke
  UI/                          WPF/WinForms dialogs (chat window, settings, tool windows, …)
  AI/, Antigravity/, PowerBI/  ported + rebranded, but NOT wired up yet — each file has a
                                 "BIM-AZIM TODO" header explaining what external config/credentials
                                 it still needs (Gemini/Ollama API keys, Google OAuth, Power BI
                                 OAuth) before this pass turns it on
  Resources/Icons/              ribbon button icons (embedded resources)
  Deploy/
    BimAzim.addin.template      .addin manifest template (VendorId/ClientId — see below)
    Generate-AddinManifest.ps1  writes %ProgramData%\Autodesk\Revit\Addins\<year>\BimAzim.addin
                                 for a built band (ported equivalent of BIM-Bot's deploy.ps1
                                 addin-writing step; full installer porting is out of scope)
```

## Wire protocol

Same contract the MCP server's `TcpEngineClient` expects (see `server/src/bridge/tcp-engine-client.ts`
and `handshake.ts`): a loopback TCP socket, JSON-RPC 2.0 framed as `Content-Length: N\n{json}`,
request shape `{jsonrpc, method, params, id, auth}`, response matched back by `id`.

- **Default port 8082** (not BIM-Bot's 8080 — deliberately different so a real BIM-Bot install can
  run side by side on the same machine). Scans up to 10 ports forward if busy, same as BIM-Bot.
  Override via `BIMAZIM_REVIT_PORT` (see `server/src/config.ts`).
- **Handshake file**: `%LOCALAPPDATA%\BimAzim\service-revit.json` — `{ port, pid, host, token,
  pluginVersion, startedAt }`. Written right after the socket binds so the MCP server finds the
  plugin even if it had to scan to another port. `token` is the same per-user shared secret
  `ServiceAuth` already enforces on every request (`auth` field) — unchanged from BIM-Bot, just
  also published here for the MCP server to read and send back.
- Command/tool name strings in `CommandExecutor`'s switch cases (`create_wall`,
  `get_selected_elements`, etc.) are unchanged from BIM-Bot — they must match the tool names
  `server/src/tools/revit.ts` uses.

## Add-in identity

So this plugin can be installed alongside a real BIM-Bot install without an add-in ID collision:

| | BIM-Bot | BIM-AZIM |
|---|---|---|
| VendorId | `HassanElmathary` | `BimAzim` |
| VendorDescription | AI-Powered BIM-Bot Plugin by Hassan Ahmed Elmathary | BIM-AZIM — AI-Powered BIM Automation |
| ClientId | `A1B2C3D4-E5F6-7890-ABCD-EF1234567890` | `3A2276CB-8AD1-4C16-9C62-2F4D6AB1291E` |
| Default port | 8080 | 8082 |

## Building

```powershell
$env:PATH = "C:\Program Files\dotnet;" + $env:PATH
dotnet build -p:RevitVersion=2024 .\BimAzimPlugin\BimAzimPlugin.csproj   # net48 band
dotnet build -p:RevitVersion=2026 .\BimAzimPlugin\BimAzimPlugin.csproj   # net8.0-windows band
```

No local Revit install is required to build — `Nice3point.Revit.Api.RevitAPI`/`RevitAPIUI`
(version `$(RevitVersion).*`) supply the API surface from NuGet. Both the 2024 (net48) and 2026
(net8.0-windows) bands build clean (0 errors).

To install into a real Revit for manual testing, build a band and then run
`Deploy\Generate-AddinManifest.ps1 -Year <year>` to drop the `.addin` manifest into
`%ProgramData%\Autodesk\Revit\Addins\<year>`.
