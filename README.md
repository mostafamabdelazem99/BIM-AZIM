# BIM-AZIM

**Live site: [mostafamabdelazem99.github.io/BIM-AZIM](https://mostafamabdelazem99.github.io/BIM-AZIM/)**

AI-powered automation for **Autodesk Revit**, **Navisworks Manage**, **Tekla Structures**, and
**Unreal Engine** — 289 MCP tools across four engines, driven from Claude, ChatGPT, Gemini,
Cursor, or any MCP-compatible client.

Revit and Navisworks support is ported and rebranded from the open-source
[BIM-Bot](https://github.com/HassanElmathary/BIM-Bot) (MIT licensed) — real, building add-ins, not
stubs. **Tekla Structures** is BIM-AZIM's own addition, wired the way Tekla's Open API actually
works (an external bridge, not an in-process add-in — see `docs/ARCHITECTURE.md`). **Unreal
Engine** is a separate, standalone MCP server for real-time visualization.

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
Detects installed Revit/Navisworks/Tekla Structures versions, builds and deploys what it finds,
and registers BIM-AZIM with every MCP client on your machine. See [`install.ps1`](install.ps1) for
exactly what it does and doesn't touch.

## Repo layout

| Path | What it is |
|---|---|
| [`website/`](website/index.html) | Public landing page — animated overview + interactive chat simulation |
| [`server/`](server/README.md) | TypeScript MCP server — 289 tool definitions across Revit/Navisworks/Tekla |
| [`unreal/server/`](unreal/README.md) | Separate standalone MCP server for the Unreal Engine bridge |
| [`plugins/Revit/`](plugins/Revit/README.md) | Real Revit add-in (ported from BIM-Bot), builds clean 2020-2027 |
| [`plugins/Navisworks/`](plugins/Navisworks/README.md) | Real Navisworks Manage add-in (ported from BIM-Bot), builds clean 2020-2027 |
| [`plugins/Tekla/`](plugins/Tekla/README.md) | .NET bridge service for Tekla Structures, built on Tekla Open API |
| [`plugins/Unreal/`](plugins/Unreal/README.md) | C++ Unreal Editor plugin (unverified — no local Unreal Engine available) |
| [`install.ps1`](install.ps1) | One-command installer: detects, builds, deploys, and registers everything above |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full architecture write-up, including why Tekla and Unreal are wired differently |
| [`docs/TEKLA_INTEGRATION.md`](docs/TEKLA_INTEGRATION.md) | Tool-by-tool reference for the Tekla bridge |

## Status

Real, verified, building code — not a scaffold. Revit (2024/2026 bands) and Navisworks
(2020/2024/2027) plugins build with 0 errors; the server starts clean with all 289 tools
registered under unique names. Two gaps are flagged honestly rather than hidden:

- **Tekla bridge and Unreal C++ plugin are unverified** — their proprietary APIs only exist inside
  real installs that weren't available while building this, so the code is correct to the best of
  available documentation but untested on real hardware. Every uncertain spot is marked
  `// VERIFY:` in the source.
- **Navisworks' Power BI dashboard feature is stubbed** — the JSON config contract it needs isn't
  present anywhere in BIM-Bot's own published source, so those 7 tools reach a plugin that cleanly
  replies "unknown command" rather than crashing.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full picture.
