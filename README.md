# BIM-AZIM

**Live site: [mostafamabdelazem99.github.io/BIM-AZIM](https://mostafamabdelazem99.github.io/BIM-AZIM/)**

AI-powered automation for **Autodesk Revit**, **Navisworks Manage**, and **Tekla Structures** — one MCP
server, three parallel BIM engines, driven from Claude, ChatGPT, Cursor, or any MCP-compatible client.

BIM-AZIM follows the same three-layer shape pioneered by BIM-Bot (AI client → MCP server → native
plugin bridge), with **Tekla Structures (Trimble)** added as a first-class third engine instead of an
afterthought.

```
AI Client (Claude / ChatGPT / Cursor / VS Code)
        │  MCP protocol (stdio / JSON-RPC)
        ▼
BIM-AZIM MCP Server   (Node.js / TypeScript)
        │  HTTP/JSON bridge, one port per engine
        ├──────────────┬──────────────┬───────────────┐
        ▼              ▼              ▼
   Revit Plugin   Navisworks Plugin   Tekla Bridge Service
   (.NET, in-process   (.NET, in-process   (.NET, OUT-of-process —
    add-in, :8080)      add-in, :8091)      Tekla Open API remote
                                             connection, :8092)
```

## Repo layout

| Path | What it is |
|---|---|
| [`website/`](website/index.html) | Public landing page for BIM-AZIM |
| [`server/`](server/README.md) | TypeScript MCP server — tool definitions + HTTP bridge clients |
| [`plugins/Tekla/`](plugins/Tekla/README.md) | **New.** .NET bridge service for Tekla Structures, built on Tekla Open API |
| [`plugins/Revit/`](plugins/Revit/README.md) | .NET add-in scaffold for Revit (parity layer) |
| [`plugins/Navisworks/`](plugins/Navisworks/README.md) | .NET add-in scaffold for Navisworks Manage (parity layer) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Full architecture write-up, including why Tekla is wired differently |
| [`docs/TEKLA_INTEGRATION.md`](docs/TEKLA_INTEGRATION.md) | Deep dive on the Tekla Open API bridge, tool catalog, and setup |

## Status

This is the **first scaffold**: real architecture, a working MCP server skeleton, and a genuine
(but unverified-on-hardware — no local Tekla Structures install was available to test against)
Tekla Open API bridge with an initial tool set. It is not a 1:1 feature clone of any existing
265-tool product — it's the foundation to grow one, with Tekla done properly from day one.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for what's real vs. stubbed, and the "Roadmap"
section for what to build next.
