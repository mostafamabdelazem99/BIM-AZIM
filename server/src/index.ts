#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ENGINES } from "./config.js";
import { EngineClient, ToolBridge } from "./bridge/engine-client.js";
import { TcpEngineClient } from "./bridge/tcp-engine-client.js";
import { makeBridgeHandler, ToolDefinition } from "./tools/types.js";
import { teklaTools } from "./tools/tekla.js";
import { revitTools } from "./tools/revit.js";
import { navisworksTools } from "./tools/navisworks.js";

const server = new McpServer({
  name: "bim-azim-server",
  version: "0.1.0",
});

// Revit/Navisworks plugins (ported from BIM-Bot) speak a length-prefixed TCP JSON-RPC protocol;
// the Tekla bridge speaks plain HTTP (see docs/ARCHITECTURE.md for why they differ).
const revitClient = new TcpEngineClient(ENGINES.revit, "service-revit.json", 8082);
const navisClient = new TcpEngineClient(ENGINES.navisworks, "service-navis.json", 8093);
const teklaClient = new EngineClient(ENGINES.tekla);

function registerAll(client: ToolBridge, tools: readonly ToolDefinition[]) {
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.inputShape, makeBridgeHandler(client, tool));
  }
}

registerAll(revitClient, revitTools);
registerAll(navisClient, navisworksTools);
registerAll(teklaClient, teklaTools);

server.tool(
  "bimazim_engine_status",
  "Check which of the three BIM-AZIM engine bridges (Revit, Navisworks Manage, Tekla Structures) are currently reachable.",
  {},
  async () => {
    const [revit, navisworks, tekla] = await Promise.all([
      revitClient.health(),
      navisClient.health(),
      teklaClient.health(),
    ]);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ revit, navisworks, tekla }, null, 2),
        },
      ],
    };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BIM-AZIM MCP server running on stdio.");
}

main().catch((err) => {
  console.error("BIM-AZIM MCP server failed to start:", err);
  process.exit(1);
});
