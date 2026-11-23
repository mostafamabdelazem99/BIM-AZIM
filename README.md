# BIM-AZIM

**Live site: [mostafamabdelazem99.github.io/BIM-AZIM](https://mostafamabdelazem99.github.io/BIM-AZIM/)**

AI-powered automation for **Autodesk Revit**, **Navisworks Manage**, **Tekla Structures**,
**Unreal Engine**, **AutoCAD**, **SketchUp**, **3ds Max**, **ReCap** (via AutoCAD), and **Microsoft
Office** (Word/Excel/PowerPoint) — 345 MCP tools across seven BIM/CAD/visualization engines plus
direct Office document generation, driven from Claude, ChatGPT, Gemini, Cursor, or any
MCP-compatible client.

Revit and Navisworks support is ported and rebranded from the open-source
[BIM-Bot](https://github.com/HassanElmathary/BIM-Bot) (MIT licensed) — real, building add-ins, not
stubs. **Tekla Structures**, **AutoCAD**, **SketchUp**, and **3ds Max** are BIM-AZIM's own
additions, each wired the way that engine's own extensibility model actually works: Tekla and
AutoCAD's Open APIs let the Tekla bridge run as an external service and the AutoCAD plugin as an
in-process add-in respectively; SketchUp (Ruby-only) and 3ds Max (Python/`pymxs`) get native
script-based extensions speaking the same wire protocol — see `docs/ARCHITECTURE.md`. **ReCap**
has no plugin system of its own, so its point-cloud data is reached through the AutoCAD bridge.
**Unreal Engine** is a separate, standalone MCP server for real-time visualization.

MIT licensed — see [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE) for third-party attribution.

```
AI Client (Claude / ChatGPT / Gemini / Cursor / VS Code / ...)
        │  MCP protocol (stdio / JSON-RPC)
        ▼
BIM-AZIM MCP Server   (Node.js / TypeScript, server/)
        │  TCP JSON-RPC, one port per engine
        ├──────────────┬──────────────┐        BIM-AZIM-Unreal MCP Server
        ▼              ▼              ▼        (separate process, unreal/server/)
   Revit Plugin   Navisworks Plugin   Tekla Bridge         │  HTTP
   (.NET, in-process   (.NET, in-process   (.NET, OUT-of-process        ▼
    add-in, :8082)      add-in, :8093)      — Tekla Open API      Unreal Editor
                                             remote conn., :8092)  (Remote Control API
                                                                    + BimAzimMCPBridge
                                                                    plugin, :30012)
```

## Install

```powershell
irm https://raw.githubusercontent.com/mostafamabdelazem99/BIM-AZIM/main/install.ps1 | iex
```

Or download `BIM-AZIM-Setup.exe` from [the latest release](https://github.com/mostafamabdelazem99/BIM-AZIM/releases/latest).
Detects installed Revit/Navisworks/Tekla/AutoCAD/SketchUp/3ds Max versions, builds and deploys
what it finds, and registers BIM-AZIM with every MCP client on your machine. See
[`install.ps1`](install.ps1) for exactly what it does and doesn't touch.

## Repo layout

| Path | What it is |
|---|---|
| [`website/`](website/index.html) | Public landing page — animated overview + interactive chat simulation |
| [`server/`](server/README.md) | TypeScript MCP server — 345 tool definitions across Revit/Navisworks/Tekla/AutoCAD/SketchUp/3ds Max/Office |
| [`unreal/server/`](unreal/README.md) | Separate standalone MCP server for the Unreal Engine bridge |
| [`plugins/Revit/`](plugins/Revit/README.md) | Real Revit add-in (ported from BIM-Bot), builds clean 2020-2027 |
| [`plugins/Navisworks/`](plugins/Navisworks/README.md) | Real Navisworks Manage add-in (ported from BIM-Bot), builds clean 2020-2027 |
| [`plugins/Tekla/`](plugins/Tekla/README.md) | .NET bridge service for Tekla Structures, built on Tekla Open API |
| [`plugins/Unreal/`](plugins/Unreal/README.md) | C++ Unreal Editor plugin (unverified — no local Unreal Engine available) |
| [`plugins/AutoCAD/`](plugins/AutoCAD/README.md) | Real AutoCAD add-in, builds clean against the `AutoCAD.NET` NuGet package (2026 band) |
| [`plugins/SketchUp/`](plugins/SketchUp/README.md) | Ruby SketchUp extension — unverified, no SketchUp/Ruby available to run it against here |
| [`plugins/3dsMax/`](plugins/3dsMax/README.md) | Python (`pymxs`) 3ds Max startup script — unverified, no 3ds Max available to run it against here |
| [`install.ps1`](install.ps1) | One-command installer: detects, builds, deploys, and registers everything above |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full architecture write-up, including why each engine is wired differently and why ReCap has no plugin of its own |
| [`docs/TEKLA_INTEGRATION.md`](docs/TEKLA_INTEGRATION.md) | Tool-by-tool reference for the Tekla bridge |

## Status

Real, verified, building code — not a scaffold. Revit (2024/2026 bands), Navisworks
(2020/2024/2027), and AutoCAD (2026) plugins build with 0 errors; the server starts clean with all
345 tools registered under unique names. The four `office_*` tools generate real
`.docx`/`.xlsx`/`.pptx` files directly (no Microsoft Office installation required) and were
verified end-to-end against the actual `docx`/`exceljs`/`pptxgenjs` libraries. Gaps are flagged
honestly rather than hidden:

- **Tekla bridge, Unreal C++ plugin, SketchUp extension, and 3ds Max script are unverified** —
  their APIs only exist inside real installs that weren't available while building this (and
  SketchUp/3ds Max's own languages, Ruby and embedded Python, have no local interpreter/install
  here to run them against either), so the code is correct to the best of available documentation
  but untested live. Every uncertain spot is marked `// VERIFY:` in the source. The AutoCAD plugin
  is a half-step better: it compiles clean against the real `AutoCAD.NET` package, just hasn't run
  inside AutoCAD itself.
- **ReCap has no plugin/scripting surface of its own** — "integrating" with it means reading
  point-cloud data through the AutoCAD bridge instead (`recap_list_point_clouds`), since that's the
  only way its SDK is actually meant to be used. See `docs/ARCHITECTURE.md`.
- **Navisworks' Power BI dashboard feature is stubbed** — the JSON config contract it needs isn't
  present anywhere in BIM-Bot's own published source, so those 7 tools reach a plugin that cleanly
  replies "unknown command" rather than crashing.
- **`pptxgenjs`'s transitive `image-size` dependency carries a high-severity DoS advisory**
  ([GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq)) with no non-breaking
  fix — even `pptxgenjs`'s own latest release still pins `image-size@^1.2.1`. Not force-upgraded
  (same policy as the `zod` advisory tracked in `docs/ARCHITECTURE.md`): the current
  `office_create_powerpoint` tool never parses image files, so this code path isn't exercised
  today.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture.
