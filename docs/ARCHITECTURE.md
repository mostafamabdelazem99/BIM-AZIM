# BIM-AZIM Architecture

## Four engines, two transport models

Revit and Navisworks Manage only expose their object models to code running **inside their own
process** (an `IExternalApplication` add-in loaded by Revit, or an `AddInPlugin` loaded by
Navisworks Manage). Both plugins here are real, ported, building add-ins — not scaffolds — that
open a local **TCP socket** and speak length-prefixed JSON-RPC 2.0 (`Content-Length: N\n{json}`),
the same wire protocol BIM-Bot's own plugins use, so the ported tool-dispatch code needed no
behavioral changes.

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

**Unreal Engine is a fourth, separate product entirely** — real-time visualization, not BIM
authoring. BIM-Bot itself ships it as an independent MCP server rather than folding it into the
main one, and BIM-AZIM follows the same shape: `unreal/server/` is its own Node process (HTTP to
Unreal's built-in Remote Control API, port 30010, plus a small custom `BimAzimMCPBridge` C++
plugin on port 30012 for the handful of operations Remote Control doesn't cover — screenshots,
notifications, Blueprint graph editing).

## Port map (deliberately different from BIM-Bot's, so both can run side by side)

| Engine | BIM-Bot's port | BIM-AZIM's port |
|---|---|---|
| Revit | 8080 | **8082** |
| Navisworks | 8091 | **8093** |
| Tekla | n/a | 8092 |
| Unreal bridge plugin | 30011 | **30012** |

## Layers

### 1. AI Client Layer
Claude Desktop, Claude Code, Cursor, Windsurf, Gemini CLI, VS Code (+ Insiders), ChatGPT Desktop,
OpenCode, or (best-effort) DeepSeek Harness — `install.ps1` registers both BIM-AZIM servers with
whichever of these it finds (see `server/scripts/configure-bimazim.cjs`).

### 2. BIM-AZIM MCP Server (`server/`)
Node.js + TypeScript, built on `@modelcontextprotocol/sdk`. One process registers all 293 tools
across Revit (`revit_*`), Navisworks (`navis_*`), Tekla (`tekla_*`), and Microsoft Office
(`office_*`) — unlike BIM-Bot, which
needs two separate client entries (one env-scoped for Navisworks) because its single server only
exposes `navis_*` tools when told to. BIM-AZIM's server always registers everything, so one entry
is enough. Routes Revit/Navisworks calls over the TCP bridge (`bridge/tcp-engine-client.ts`) and
Tekla calls over plain HTTP (`bridge/engine-client.ts`).

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

## What's real vs. flagged

| Engine | Tools | Status |
|---|---|---|
| Revit | 211 (across `revit.ts`, `revit-ai.ts`, `revit-integrations.ts`, `revit-documentation.ts`) | Plugin builds clean (0 errors, RevitVersion 2024 & 2026 verified) |
| Navisworks | 65 (across `navisworks.ts`, `navis-ai.ts`, `navis-dashboard.ts`) | Plugin builds clean (0 errors, NavisYear 2020/2024/2027 verified). 7 dashboard tools reach a plugin feature that's stubbed — see below |
| Tekla | 14 | Bridge code written against the Open API from documentation alone — **unverified on real hardware**, every uncertain call flagged `// VERIFY:` |
| Unreal | ~50 (separate server) | Node server verified (71/71 tests pass); the C++ editor plugin is **unverified** — no local Unreal Engine available |
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
- **Verify the Tekla bridge and Unreal C++ plugin on real hardware** — the single biggest
  confidence gap in the project. Everything else here has been built-and-run-verified; these two
  have only been built against documentation.
- **Trimble Connect integration**: `tekla_push_to_trimble_connect` is already defined as a tool but
  stubbed — wiring it up needs the separate Trimble Connect REST API, not the Tekla Open API.
- **DeepSeek Harness**: its MCP config format is new and not fully documented publicly yet: revisit
  `ensureDeepseekHarnessConfig` in `configure-bimazim.cjs` once its schema stabilizes.
