# BIM-AZIM MCP Server

TypeScript MCP server exposing 293 Revit, Navisworks Manage, Tekla Structures, and Microsoft
Office (Word/Excel/PowerPoint) tools to any MCP-compatible AI client. (Unreal Engine is a separate
server — see `../unreal/README.md`.) See [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) for
the full picture.

## Setup

```bash
npm install
npm run build
npm start
```

For local development against a live bridge, `npm run dev` runs the server directly from
TypeScript with file-watching (via `tsx`).

## Configuring your AI client

The easiest way is `../install.ps1` — it detects and configures every MCP client on your machine
automatically via `scripts/configure-bimazim.cjs`. To do it by hand, add to
`claude_desktop_config.json` (or the equivalent for your MCP client):

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
| `BIMAZIM_REVIT_PORT` | `8082` | Port the Revit add-in's TCP bridge listens on (not BIM-Bot's 8080, so both can run side by side) |
| `BIMAZIM_NAVIS_PORT` | `8093` | Port the Navisworks add-in's TCP bridge listens on (not BIM-Bot's 8091) |
| `BIMAZIM_TEKLA_PORT` | `8092` | Port the Tekla bridge service (plain HTTP, unlike the two above) listens on |
| `BIMAZIM_REQUEST_TIMEOUT_MS` | `15000` | Per-call timeout when talking to any engine bridge |

Revit and Navisworks use a TCP JSON-RPC bridge (`bridge/tcp-engine-client.ts`), not HTTP — see
`../docs/ARCHITECTURE.md` for why Tekla's bridge is HTTP while these two aren't.

## Adding a new tool

1. Add a `defineTool({...})` entry to `src/tools/<engine>.ts` with its MCP name, description, and
   Zod input shape.
2. Implement the matching `bridgeToolName` handler in that engine's plugin/bridge
   (`plugins/<Engine>/`).
3. Rebuild (`npm run build`) and restart your AI client so it re-reads the tool list.

Use `bimazim_engine_status` from any AI client to sanity-check which bridges are currently
reachable before debugging a specific tool call.

## Microsoft Office integration

`src/tools/office.ts` adds four tools — `office_create_word_report`, `office_create_excel_workbook`,
`office_read_excel_workbook`, `office_create_powerpoint` — that generate or read real `.docx`/
`.xlsx`/`.pptx` files directly (via `docx`, `exceljs`, `pptxgenjs`). These don't go through an
engine bridge and don't need Word/Excel/PowerPoint installed: any AI client connected to BIM-AZIM
can turn a Revit export, a Navisworks clash list, or a Tekla part schedule straight into a branded
Office document.
