# BIM-AZIM Architecture

## Why a third engine isn't "just another plugin"

Revit and Navisworks Manage only expose their object models to code running **inside their own
process** (an `IExternalApplication` / `IExternalCommand` add-in loaded by Revit, or a Navisworks
plugin loaded by Manage). That's why BIM-Bot-style tools run an in-process .NET add-in that opens a
local HTTP/TCP listener, and the Node MCP server talks to that listener.

**Tekla Structures is different.** The Tekla Open API (`Tekla.Structures.Model`, `Tekla.Structures.Dialog`,
`Tekla.Structures.Geometry3d`, …) is designed to be used from an **external** .NET process — any
console app, Windows service, or WPF tool on the same machine can do:

```csharp
var model = new Tekla.Structures.Model.Model();
if (model.GetConnectionStatus()) { /* talking to the running Tekla Structures session */ }
```

and it connects to whichever Tekla Structures session is currently running, over Tekla's own
remoting layer — no add-in has to be loaded inside Tekla itself for read/model-query/model-edit
operations. (A thin in-app extension is still useful for menu/ribbon buttons and UI picking, so
BIM-AZIM ships one, but it's optional convenience, not a hard requirement the way it is for Revit.)

This changes the deployment story for the better:

- The **Tekla bridge** (`plugins/Tekla/BimAzim.TeklaBridge`) runs as a standalone .NET service,
  started by the MCP server (or by the user) alongside Tekla Structures. It can be restarted
  without touching Tekla, and one bridge process can reconnect across multiple Tekla sessions.
- The **Revit** and **Navisworks** plugins remain in-process add-ins, matching the proven BIM-Bot
  pattern, loaded via `.addin` manifest files per version (2020–2027 for Revit, 2020+ for
  Navisworks Manage).

## Layers

### 1. AI Client Layer
Claude Desktop / Claude Code, ChatGPT Desktop, Cursor, VS Code + Copilot, or any MCP client. Talks
MCP (JSON-RPC over stdio) to the BIM-AZIM server process.

### 2. BIM-AZIM MCP Server (`server/`)
Node.js + TypeScript, built on `@modelcontextprotocol/sdk`. Responsibilities:

- Registers tool schemas (name, description, JSON-schema input) per engine, namespaced
  `revit_*`, `navis_*`, `tekla_*`.
- Routes each tool call to the right engine's HTTP bridge:
  - Revit add-in → `http://127.0.0.1:8080`
  - Navisworks add-in → `http://127.0.0.1:8091`
  - Tekla bridge service → `http://127.0.0.1:8092`
- Normalizes errors (engine not running, nothing selected, stale connection) into one shape so the
  AI client gets a consistent, actionable message instead of a raw exception.

### 3. Plugin / Bridge Layer
Three independent processes, one per engine — see `plugins/Revit`, `plugins/Navisworks`,
`plugins/Tekla`. Each exposes the same shape of contract: `GET /health`, `POST /tools/:name`
with a JSON body, JSON response `{ ok, data?, error? }`.

## What's implemented in this scaffold vs. stubbed

| Engine | Connection model | Tools implemented now | Status |
|---|---|---|---|
| Tekla Structures | out-of-process bridge service | model info, selection, read part/assembly properties, create beam/column/plate, move/modify, basic bounding-box interference check, numbering trigger, export IFC | Real Tekla Open API code, **not yet run against live Tekla Structures** — verify method signatures against the API reference shipped with your installed Tekla version before building (see `docs/TEKLA_INTEGRATION.md`) |
| Revit | in-process add-in | `get_model_info`, `get_selected_elements`, `get_elements` (by category) | Thin parity scaffold — expand following the same pattern used for Tekla tools |
| Navisworks Manage | in-process add-in | `get_model_info`, `get_selected`, `run_clash_test` (stub) | Thin parity scaffold |

The intent is not to re-ship BIM-Bot's 267 tools under a new name — it's to give BIM-AZIM a correct,
extensible skeleton with Tekla genuinely integrated, that you (or future sessions) can grow tool by
tool the same way BIM-Bot grew to 267.

## Roadmap ideas

- **Trimble Connect integration**: since Tekla models often live in Trimble Connect, add
  `tekla_push_to_trimble_connect` / `tekla_pull_markups` tools — this is a natural "exclusive"
  BIM-AZIM feature no Revit-only tool can offer.
- **Cross-engine interference check**: federate a Tekla model + a Revit/Navisworks model and run a
  simple bounding-box clash pass across engines without needing Navisworks at all — useful for
  structural/architectural coordination when the team doesn't have a Navisworks seat.
- **Tekla numbering + drawing automation**: numbering, drawing creation, and drawing-list export
  are high-value, very scriptable Tekla workflows — prioritize these after the core read/create
  tools are verified against a live install.
- **Shared BIM-AZIM dashboard**: reuse the same model-health-dashboard idea across all three
  engines (element counts, warnings, unplaced/ungrouped parts, naming compliance) in one view.
