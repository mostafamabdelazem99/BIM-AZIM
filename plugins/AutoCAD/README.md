# BIM-AZIM AutoCAD Plugin

Real in-process .NET add-in for Autodesk AutoCAD, built against the official `AutoCAD.NET` NuGet
package (pinned to `25.1.0` — the AutoCAD 2026 / net8.0-windows release; `25.1.1` switches to
net10.0 and would break this build). Compiles without AutoCAD installed, the same way the Revit
and Navisworks plugins do.

## Status

Builds clean (0 errors) against the real managed API. **Unverified against a live AutoCAD
session** — no local AutoCAD install was available while building this. See the `// VERIFY:`
comment on `RecapListPointClouds` in `Core/CommandExecutor.cs` for the one spot with real
uncertainty (point-cloud entity property names).

Only one version band is covered so far (2026/net8.0-windows), unlike the Revit plugin's full
2020-2027 range — extending to older AutoCAD years (net48, earlier API surface) is real future
work.

## Build

```powershell
dotnet build plugins/AutoCAD/BimAzimAutoCadPlugin/BimAzimAutoCadPlugin.csproj -c Release
```

## Install

`install.ps1` does this automatically: it builds the plugin, then copies the output into a
per-user `ApplicationPlugins` bundle (`%APPDATA%\Autodesk\ApplicationPlugins\BimAzim.bundle`) —
AutoCAD's equivalent of Revit's per-user `.addin` manifest, auto-loaded on startup, no admin
rights needed.

To install by hand: build the project, then copy `PackageContents.xml` plus the build output into
that same bundle folder structure (`BimAzim.bundle\PackageContents.xml` and
`BimAzim.bundle\Contents\BimAzimAutoCadPlugin.dll`).

## Using it

On AutoCAD startup the plugin auto-starts its socket service (default port 8094, scanning up to
8104 if taken) and tries to add a one-button "BIM-AZIM" ribbon tab. If the ribbon setup fails (the
`Autodesk.Windows` ribbon API has shifted across AutoCAD releases), the plain `BIMAZIM` command
still works from the command line — type it to start/stop the service manually.

## Tools

20 tools in `server/src/tools/autocad.ts` — model info, layers, entity CRUD (lines, circles,
polylines, text, block references), move/rotate/delete by handle, layouts, drawing variables, a
`autocad_send_command` escape hatch for anything not covered by a dedicated tool, DWG export, and
`recap_list_point_clouds` (see the root README and `docs/ARCHITECTURE.md` for why ReCap tools live
here rather than in a standalone ReCap plugin).
