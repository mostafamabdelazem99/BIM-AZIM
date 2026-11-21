import { z } from "zod";
import { defineTool } from "./types.js";

/**
 * Navisworks Power BI dashboard tools, ported from BIM-Bot's navis_dashboard_tools.ts. Builds and
 * exports a dashboard definition (pages/visuals/3D viewer config) to a .pbit Power BI template
 * bound to the federated model, clash results, and element properties. No external account
 * needed — this is local file generation, unlike the Google Sheets/Notion/Power-BI-embed tools.
 *
 * Known gap: the ported Navisworks plugin (plugins/Navisworks/BimAzimNavisPlugin) currently
 * excludes its Dashboard/ implementation from compilation — the JSON config contract types
 * (DashboardConfig, PageSpec, VisualSpec, ...) that BIM-Bot's dashboard code depends on aren't
 * present anywhere in the BIM-Bot source this was ported from (a gap in the upstream repo, not
 * a porting mistake). These 7 tools are defined and will reach the plugin, but it currently
 * replies "Unknown Navisworks command" for all of them until that contract is written.
 */
export const navisDashboardTools = [
  defineTool({
    name: "navis_dashboard_catalog",
    description: "List the visual types a Power BI dashboard can contain (with their field roles) and every bindable field: 'Table.Column' or 'Table.[Measure]' from Elements, Properties and Clashes. Use before building or editing a dashboard config.",
    inputShape: {},
    bridgeToolName: "navis_dashboard_catalog",
  }),

  defineTool({
    name: "navis_dashboard_list",
    description: "List the Power BI dashboards saved for the open Navisworks project (name, created, modified, pages, visuals, last export). The registry is stored next to the NWF/NWD in .bimazim\\.",
    inputShape: {},
    bridgeToolName: "navis_dashboard_list",
  }),

  defineTool({
    name: "navis_dashboard_get",
    description: "Get one dashboard's full configuration JSON (pages, visuals, 3D viewer settings, export options). Edit it and pass it back to navis_dashboard_update.",
    inputShape: {
      dashboard: z.string().describe("Dashboard id or name (from navis_dashboard_list)"),
    },
    bridgeToolName: "navis_dashboard_get",
  }),

  defineTool({
    name: "navis_dashboard_create",
    description: "Create a dashboard definition in the project registry (does not export). template 'default' = Model Overview + Clash Coordination pages with the interactive 3D model, KPI cards, slicers and charts; 'blank' = one page with the 3D viewer and a title. Or pass a full config (see navis_dashboard_catalog).",
    inputShape: {
      name: z.string().optional().describe("Dashboard name (default: 'Default Dashboard' / 'Custom Dashboard', made unique)"),
      description: z.string().optional(),
      template: z.enum(["default", "blank"]).default("default").describe("Starting point. Ignored when config is given."),
      config: z.record(z.unknown()).optional().describe("Full dashboard config JSON (same shape as navis_dashboard_get returns)"),
    },
    bridgeToolName: "navis_dashboard_create",
  }),

  defineTool({
    name: "navis_dashboard_update",
    description: "Save an edited dashboard config: overwrite it, or saveAsCopy=true to keep the original and save a new dashboard. Get the current config with navis_dashboard_get first and send the whole object back.",
    inputShape: {
      dashboard: z.string().describe("Dashboard id or name (from navis_dashboard_list)"),
      config: z.record(z.unknown()).describe("The full edited config JSON"),
      saveAsCopy: z.boolean().default(false).describe("Save as a new dashboard instead of overwriting"),
      newName: z.string().optional().describe("Name of the copy (with saveAsCopy)"),
    },
    bridgeToolName: "navis_dashboard_update",
  }),

  defineTool({
    name: "navis_dashboard_delete",
    description: "Remove a dashboard from the project registry. Exported .pbit and data files are left on disk.",
    inputShape: {
      dashboard: z.string().describe("Dashboard id or name (from navis_dashboard_list)"),
    },
    bridgeToolName: "navis_dashboard_delete",
  }),

  defineTool({
    name: "navis_dashboard_export",
    description: "Export a dashboard to Power BI: reads elements, properties, clash results and (optionally) triangulated geometry from the open model, writes CSVs and a .pbit with the interactive 3D model. Update-aware: in live mode, when only the data changed the .pbit is left alone (manual Power BI edits survive — press Refresh); when the layout changed the .pbit is regenerated. Large models can take several minutes.",
    inputShape: {
      dashboard: z.string().describe("Dashboard id or name (from navis_dashboard_list)"),
      outputFolder: z.string().optional().describe("Root output folder (default: 'BIM-AZIM Dashboards' next to the NWF)"),
      scope: z.enum(["full", "selection"]).default("full"),
      selectionSet: z.string().optional().describe("Selection or search set to export when scope = selection"),
      includeGeometry: z.boolean().default(true).describe("Export 3D geometry for the viewer"),
      includeClashes: z.boolean().default(true).describe("Export Clash Detective results"),
      refreshMode: z.enum(["live", "static"]).default("live").describe("live = fixed data folder that Refresh reloads; static = dated snapshot"),
      force: z.boolean().default(false).describe("Regenerate the .pbit even if the layout is unchanged (overwrites manual Power BI edits)"),
    },
    bridgeToolName: "navis_dashboard_export",
  }),
] as const;
