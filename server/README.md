# BIM-AZIM MCP Server

TypeScript MCP server exposing Revit, Navisworks Manage, and Tekla Structures tools to any
MCP-compatible AI client. See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for the full
picture.

## Setup

```bash
npm install
npm run build
npm start
```

For local development against a live bridge, `npm run dev` runs the server directly from
TypeScript with file-watching (via `tsx`).

## Configuring your AI client

Add to `claude_desktop_config.json` (or the equivalent for your MCP client):

```json
{
  "mcpServers": {
    "BIM-AZIM": {
      "command": "node",
      "args": ["C:\\path\\to\\BIM AZIM\\server\\build\\index.js"],
      "env": {}
    }
  }
}
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `BIMAZIM_REVIT_PORT` | `8080` | Port the Revit add-in's HTTP bridge listens on |
| `BIMAZIM_NAVIS_PORT` | `8091` | Port the Navisworks add-in's HTTP bridge listens on |
| `BIMAZIM_TEKLA_PORT` | `8092` | Port the Tekla bridge service listens on |
| `BIMAZIM_REQUEST_TIMEOUT_MS` | `15000` | Per-call timeout when talking to any engine bridge |

## Adding a new tool

1. Add a `defineTool({...})` entry to `src/tools/<engine>.ts` with its MCP name, description, and
   Zod input shape.
2. Implement the matching `bridgeToolName` handler in that engine's plugin/bridge
   (`plugins/<Engine>/`).
3. Rebuild (`npm run build`) and restart your AI client so it re-reads the tool list.

Use `bimazim_engine_status` from any AI client to sanity-check which bridges are currently
reachable before debugging a specific tool call.
