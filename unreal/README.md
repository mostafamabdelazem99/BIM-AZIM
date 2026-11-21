# BIM-AZIM Unreal Integration

Unreal Engine support for BIM-AZIM, ported and rebranded from BIM-Bot's Unreal
integration (MIT licensed, © Hassan Ahmed Elmathary). This is a faithful port, not a
rewrite — tool logic, Python scripts and Remote Control API calls are unchanged from
upstream; only names, the server identity, and the custom bridge's default port were
adapted for BIM-AZIM.

## Why this looks different from the rest of BIM-AZIM

Revit, Navisworks and Tekla all share one TypeScript MCP server at `../server/`, built
around a `defineTool()` / `ToolBridge` pattern that talks to each host application over
its own channel. Unreal does **not** plug into that server — it is a wholly separate,
standalone MCP server with its own architecture, because that's how BIM-Bot itself ships
it: as a distinct `BIM-Bot-Unreal` MCP connector, separate from `BIM-Bot`/`BIM-Bot-Navis`.

This port keeps that separation on purpose:

| | Revit / Navisworks / Tekla (`../server/`) | Unreal (this folder + the plugin) |
|---|---|---|
| Server | One shared TS server, `defineTool()` pattern | Standalone Node.js server, CommonJS, raw `server.tool(...)`, zod v4 |
| Transport to the host app | Each engine's own TCP/HTTP channel | Mostly Unreal's **own built-in Remote Control API** (Python scripts over HTTP) |
| Custom bridge code | A bridge/add-in per engine carries real business logic | The optional `BimAzimMCPBridge` C++ plugin is tiny — just the handful of ops (screenshots, toasts, console commands) Python can't do well, each with a Python fallback |

## The two halves

- **[`server/`](server/)** — the Node.js MCP server (59 tools: actors, levels, assets,
  Blueprints, materials, lighting, editor control, UMG widgets, Blueprint graph nodes).
  Runs standalone via `node src/index.js`; see [`server/README.md`](server/README.md)
  for full setup, configuration and the AI tool-permission policy.
- **[`../plugins/Unreal/BimAzimMCPBridge/`](../plugins/Unreal/BimAzimMCPBridge/)** — the
  optional C++ Editor plugin backing a few of those tools. See
  [`../plugins/Unreal/README.md`](../plugins/Unreal/README.md) for what it does and the
  **honest unverified-without-a-local-UE-install caveat** — there is no Unreal Engine
  available in this environment to compile or test it against.

## Quick start

```bash
cd server
npm install
npm start      # or: npm test
```

Then enable Unreal's Remote Control API plugin in your project (port 30010, Epic's
default) and optionally build/enable `BimAzimMCPBridge` (port 30012) — see
[`server/README.md`](server/README.md) for the full walkthrough.

## Ports

| Port | What | Whose default |
|---|---|---|
| 30010 | Unreal's built-in Remote Control API | Epic/Unreal — unchanged |
| 30012 | `BimAzimMCPBridge` custom plugin | BIM-AZIM — bumped from BIM-Bot's 30011 so both can run on one machine without colliding |

## License

MIT, adapted from [BIM-Bot](https://github.com/HassanElmathary/BIM-Bot)
(© Hassan Ahmed Elmathary). See [`server/LICENSE`](server/LICENSE) and
[`../plugins/Unreal/BimAzimMCPBridge/LICENSE`](../plugins/Unreal/BimAzimMCPBridge/LICENSE).
