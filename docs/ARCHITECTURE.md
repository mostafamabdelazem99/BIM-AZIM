# BIM-AZIM Architecture

## Seven engines, three transport models, three languages

Revit, Navisworks Manage, and AutoCAD only expose their object models to code running **inside
their own process** (an `IExternalApplication`/`IExtensionApplication` add-in, or an
`AddInPlugin`). All three plugins here are real, building add-ins — not scaffolds — that open a
local **TCP socket** and speak length-prefixed JSON-RPC 2.0 (`Content-Length: N\n{json}`), the
same wire protocol BIM-Bot's own plugins use, so `server/src/bridge/tcp-engine-client.ts` talks to
all three unchanged.

**SketchUp and 3ds Max have no .NET API at all** — SketchUp's extension system is Ruby-only, and
while 3ds Max does have a `.NET SDK` (`Autodesk.Max.dll`), it isn't published on NuGet the way
Revit's and AutoCAD's are, so a compile-without-the-app build (this repo's whole approach for the
.NET plugins) isn't possible for it. Both engines instead get **script-based** extensions in their
own native language — SketchUp a Ruby extension, 3ds Max a Python (`pymxs`) startup script — each
opening the *same* kind of TCP socket and speaking the *same* wire protocol, so the MCP server
still only needs one client class for every in-process engine.

**Tekla Structures is different.** The Tekla Open API (`Tekla.Structures.Model`,
`Tekla.Structures.Dialog`, `Tekla.Structures.Geometry3d`, …) is designed to be used from an
**external** .NET process:

```csharp
var model = new Tekla.Structures.Model.Model();
if (model.GetConnectionStatus()) { /* talking to the running Tekla Structures session */ }
```

It connects to whichever Tekla Structures session is currently running, over Tekla's own remoting
layer — no add-in has to be loaded inside Tekla itself. So the **Tekla bridge**
(`plugins/Tekla/BimAzim.TeklaBridge`) runs as its own standalone .NET service instead, speaking
plain HTTP, and can be restarted without touching Tekla.

**Unreal Engine is a separate product entirely** — real-time visualization, not BIM authoring.
BIM-Bot itself ships it as an independent MCP server rather than folding it into the main one, and
BIM-AZIM follows the same shape: `unreal/server/` is its own Node process (HTTP to Unreal's
built-in Remote Control API, port 30010, plus a small custom `BimAzimMCPBridge` C++ plugin on port
30012 for the handful of operations Remote Control doesn't cover — screenshots, notifications,
Blueprint graph editing).

**ReCap has no standalone plugin surface at all.** Its SDK (`AcDbPointCloudEx`, `RCProject`, …) is
designed to be called *from inside another host app's plugin* — AutoCAD, Revit, Civil 3D — not
hosted by ReCap itself; ReCap ships no extension/scripting mechanism of its own to attach a plugin
to. So "connect BIM-AZIM to ReCap" is implemented as a handful of `recap_*` tools inside the
**AutoCAD** bridge (`recap_list_point_clouds`), reading point-cloud entities the way any AutoCAD
plugin would. Deeper ReCap project data (scan list, true point count, source file path) needs the
separate ReCap SDK from the Autodesk Developer Network, which isn't on NuGet and wasn't available
to build against here — see the `// VERIFY:` comment in
`plugins/AutoCAD/BimAzimAutoCadPlugin/Core/CommandExecutor.cs`.

## Port map (deliberately different from BIM-Bot's, so both can run side by side)

| Engine | BIM-Bot's port | BIM-AZIM's port |
|---|---|---|
| Revit | 8080 | **8082** |
| Navisworks | 8091 | **8093** |
| Tekla | n/a | 8092 |
| AutoCAD | n/a | **8094** |
| SketchUp | n/a | **8095** |
| 3ds Max | n/a | **8096** |
| Unreal bridge plugin | 30011 | **30012** |

## Layers

### 1. AI Client Layer
Claude Desktop, Claude Code, Cursor, Windsurf, Gemini CLI, VS Code (+ Insiders), ChatGPT Desktop,
OpenCode, or (best-effort) DeepSeek Harness — `install.ps1` registers both BIM-AZIM servers with
whichever of these it finds (see `server/scripts/configure-bimazim.cjs`).

### 2. BIM-AZIM MCP Server (`server/`)
Node.js + TypeScript, built on `@modelcontextprotocol/sdk`. One process registers all 345 tools
across Revit (`revit_*`), Navisworks (`navis_*`), Tekla (`tekla_*`), AutoCAD (`autocad_*` +
`recap_*`), SketchUp (`sketchup_*`), 3ds Max (`max_*`), and Microsoft Office (`office_*`) — unlike
BIM-Bot, which needs two separate client entries (one env-scoped for Navisworks) because its
single server only exposes `navis_*` tools when told to. BIM-AZIM's server always registers
everything, so one entry is enough. Routes every in-process engine (Revit, Navisworks, AutoCAD,
SketchUp, 3ds Max) over the same TCP bridge class (`bridge/tcp-engine-client.ts`) and Tekla over
plain HTTP (`bridge/engine-client.ts`).

### 3. Unreal MCP Server (`unreal/server/`)
Entirely separate Node process, registered as a second client entry (`BIM-AZIM-Unreal`). Not
`defineTool`-based like the main server — it keeps BIM-Bot's own architecture (plain
`server.tool()` calls, Python-script generation sent to Unreal's Remote Control API for most
operations, the C++ bridge for the rest).

### 4. Plugin / Bridge Layer
- `plugins/Revit/BimAzimPlugin` — real add-in, ported from BIM-Bot, builds clean for 2020-2027
  (net47/net48/net8.0-windows/net10.0-windows bands depending on year).
- `plugins/Navisworks/BimAzimNavisPlugin` — real add-in, ported from BIM-Bot, builds clean for
  2020-2027 against the `Speckle.Navisworks.API` NuGet package (no local Navisworks install
  needed to build, only to run).
- `plugins/Tekla/BimAzim.TeklaBridge` — BIM-AZIM's own code, not ported from anywhere.
- `plugins/Unreal/BimAzimMCPBridge` — ported from BIM-Bot's `UnrealMCPBridge`.
- `plugins/AutoCAD/BimAzimAutoCadPlugin` — BIM-AZIM's own code, built against the `AutoCAD.NET`
  NuGet package (pinned to `25.1.0` — AutoCAD 2026/net8.0-windows; the `25.1.1` patch flips to
  net10.0 and would break this build, see the comment in the `.csproj`).
- `plugins/SketchUp/bimazim_sketchup(.rb)` — BIM-AZIM's own code, a Ruby `SketchupExtension`.
- `plugins/3dsMax/bimazim_max` + `startup_bimazim.py` — BIM-AZIM's own code, a Python
  `scripts/startup/` entry using `pymxs`.

## What's real vs. flagged

| Engine | Tools | Status |
|---|---|---|
| Revit | 211 (across `revit.ts`, `revit-ai.ts`, `revit-integrations.ts`, `revit-documentation.ts`) | Plugin builds clean (0 errors, RevitVersion 2024 & 2026 verified) |
| Navisworks | 65 (across `navisworks.ts`, `navis-ai.ts`, `navis-dashboard.ts`) | Plugin builds clean (0 errors, NavisYear 2020/2024/2027 verified). 7 dashboard tools reach a plugin feature that's stubbed — see below |
| Tekla | 14 | Bridge code written against the Open API from documentation alone — **unverified on real hardware**, every uncertain call flagged `// VERIFY:` |
| Unreal | ~50 (separate server) | Node server verified (71/71 tests pass); the C++ editor plugin is **unverified** — no local Unreal Engine available |
| AutoCAD | 20 (`autocad.ts`, incl. 1 `recap_*` tool) | Plugin builds clean against the real `AutoCAD.NET` package (0 errors) — but **unverified against a live AutoCAD session**, no local install available |
| SketchUp | 15 (`sketchup.ts`) | Real Ruby against the documented SketchUp API — **unverified**, no Ruby interpreter or SketchUp install available in this environment to run it against |
| 3ds Max | 18 (`max.ts`) | Real Python against the documented `pymxs` API, byte-compiles clean (`python -m py_compile`) — **unverified**, no 3ds Max install available to run it against |
| Office | 4 (`office.ts`) | Not a bridge — generates/reads `.docx`/`.xlsx`/`.pptx` directly via `docx`/`exceljs`/`pptxgenjs`. No Office installation needed. Verified end-to-end (real files generated and inspected) |

**Navisworks dashboard gap**: the 7 `navis_dashboard_*` tools call into a JSON config contract
(`DashboardConfig`, `PageSpec`, `VisualSpec`, …) that doesn't exist anywhere in BIM-Bot's own
published source — not a version difference, a genuinely missing file upstream. Rather than
fabricate that contract and risk silently diverging from BIM-Bot's real behavior, the whole
Dashboard feature is excluded from compilation; those 7 tools reach a plugin that cleanly replies
"unknown command" instead of crashing.

## Known dependency advisories (deliberately not force-upgraded)

Both of these have non-breaking fixes available *only* via a major-version bump of a direct
dependency, which would itself be a breaking change — so both are documented instead of patched:

- **`zod@<4.6.6`** (high, memory exhaustion on oversized constrained collections) — fixing it means
  zod v3→v4 across all 293 tool schemas. Deferred.
- **`image-size@<2.0.3`** (high, DoS via malformed JXL/HEIF/ICNS parsing), pulled in transitively by
  `pptxgenjs` — even `pptxgenjs`'s own latest release still pins `image-size@^1.2.1`, so there's no
  fix available without `pptxgenjs` itself updating. `office_create_powerpoint` never parses image
  files today, so this code path isn't reachable through BIM-AZIM yet.

## Roadmap ideas

- **Source the real Navisworks dashboard config contract** from a newer BIM-Bot release, once
  available, to un-stub the 7 dashboard tools.
- **Verify the Tekla bridge, Unreal C++ plugin, AutoCAD plugin, SketchUp extension, and 3ds Max
  script on real installs** — the single biggest confidence gap in the project. Everything else
  here has been built-and-run-verified; these five have only been built against documentation (or,
  for AutoCAD, compiled against the real API but never run inside AutoCAD itself).
- **Extend the AutoCAD plugin to older version bands** (net48, pre-2025) the way the Revit plugin
  covers 2020-2027 — only one band (2026) is covered so far.
- **Source the real ReCap SDK** (Autodesk Developer Network, not on NuGet) to go beyond
  `recap_list_point_clouds`'s generic-entity view into actual scan/point-count data.
- **Trimble Connect integration**: `tekla_push_to_trimble_connect` is already defined as a tool but
  stubbed — wiring it up needs the separate Trimble Connect REST API, not the Tekla Open API.
- **DeepSeek Harness**: its MCP config format is new and not fully documented publicly yet: revisit
  `ensureDeepseekHarnessConfig` in `configure-bimazim.cjs` once its schema stabilizes.
