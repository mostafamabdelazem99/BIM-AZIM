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
import { revitAiTools } from "./tools/revit-ai.js";
import { revitIntegrationTools } from "./tools/revit-integrations.js";
import { revitDocumentationTools } from "./tools/revit-documentation.js";
import { navisAiTools } from "./tools/navis-ai.js";
import { navisDashboardTools } from "./tools/navis-dashboard.js";
import { registerOfficeTools } from "./tools/office.js";
import { autocadTools } from "./tools/autocad.js";
import { sketchupTools } from "./tools/sketchup.js";
import { maxTools } from "./tools/max.js";

const server = new McpServer({
  name: "bim-azim-server",
  version: "0.1.0",
});

// Revit/Navisworks plugins (ported from BIM-Bot) speak a length-prefixed TCP JSON-RPC protocol;
// the Tekla bridge speaks plain HTTP (see docs/ARCHITECTURE.md for why they differ).
const revitClient = new TcpEngineClient(ENGINES.revit, "service-revit.json", 8082);
const navisClient = new TcpEngineClient(ENGINES.navisworks, "service-navis.json", 8093);
const teklaClient = new EngineClient(ENGINES.tekla);
const autocadClient = new TcpEngineClient(ENGINES.autocad, "service-autocad.json", 8094);
const sketchupClient = new TcpEngineClient(ENGINES.sketchup, "service-sketchup.json", 8095);
const maxClient = new TcpEngineClient(ENGINES.max, "service-max.json", 8096);

function registerAll(client: ToolBridge, tools: readonly ToolDefinition[]) {
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.inputShape, makeBridgeHandler(client, tool));
  }
}

registerAll(revitClient, revitTools);
registerAll(revitClient, revitAiTools);
registerAll(revitClient, revitIntegrationTools);
registerAll(revitClient, revitDocumentationTools);
registerAll(navisClient, navisworksTools);
registerAll(navisClient, navisAiTools);
registerAll(navisClient, navisDashboardTools);
registerAll(teklaClient, teklaTools);
registerAll(autocadClient, autocadTools);
registerAll(sketchupClient, sketchupTools);
registerAll(maxClient, maxTools);
registerOfficeTools(server);

server.tool(
  "bimazim_engine_status",
  "Check which of the BIM-AZIM engine bridges (Revit, Navisworks Manage, Tekla Structures, AutoCAD, SketchUp, 3ds Max) are currently reachable.",
  {},
  async () => {
    const [revit, navisworks, tekla, autocad, sketchup, max] = await Promise.all([
      revitClient.health(),
      navisClient.health(),
      teklaClient.health(),
      autocadClient.health(),
      sketchupClient.health(),
      maxClient.health(),
    ]);
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ revit, navisworks, tekla, autocad, sketchup, max }, null, 2),
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
