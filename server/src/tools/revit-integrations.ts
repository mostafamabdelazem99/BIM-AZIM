import { z } from "zod";
import { defineTool } from "./types.js";

/**
 * Revit data-integration tools, ported from BIM-Bot's integrations/export_tools.ts.
 *
 * SQLite/CSV tools are fully local — no external account needed, work out of the box once the
 * Revit plugin's bridge handler is wired up. Google Sheets/Notion/Power BI tools need the plugin
 * configured with the matching credential (Google OAuth, NOTION_API_KEY, PowerBI Azure AD app)
 * before they'll actually do anything — the tool definitions are safe to expose regardless; a
 * misconfigured one just returns a clear "not configured" error from the plugin, the same pattern
 * already used for tekla_push_to_trimble_connect.
 */
export const revitIntegrationTools = [
  defineTool({
    name: "revit_export_to_sqlite",
    description: "Save a snapshot of Revit elements to a local SQLite database. Each export creates a timestamped snapshot for delta-sync comparison.",
    inputShape: {
      category: z.string().describe("Revit category to export, e.g. 'Doors', 'Rooms', 'Walls'"),
      tableName: z.string().optional().describe("Custom table name (default: uses category name)"),
      includeParameters: z.boolean().default(true).describe("Include all element parameters"),
    },
    bridgeToolName: "export_to_sqlite",
  }),

  defineTool({
    name: "revit_get_sqlite_snapshots",
    description: "List all saved snapshots for a category in the local SQLite database.",
    inputShape: {
      tableName: z.string().describe("Table name to query (e.g. 'doors', 'walls', 'rooms')"),
    },
    bridgeToolName: "get_sqlite_snapshots",
  }),

  defineTool({
    name: "revit_import_data_from_csv",
    description: "Import data from a CSV file into Revit element parameters. CSV header row = parameter names. Matches elements by a key parameter (e.g. room Number).",
    inputShape: {
      filePath: z.string().describe("Absolute path to the CSV file"),
      category: z.string().describe("Category to match elements in"),
      keyParameter: z.string().default("Number").describe("Parameter to match CSV rows to elements. Use 'Id' for element IDs."),
    },
    bridgeToolName: "import_data_from_csv",
  }),

  defineTool({
    name: "revit_google_signin",
    description: "Sign in with Google to connect Google Sheets. Opens a browser window for authentication. After sign-in, you can export/import data to/from your Google Sheets directly.",
    inputShape: {},
    bridgeToolName: "google_signin",
  }),

  defineTool({
    name: "revit_google_sign_out",
    description: "Sign out of your Google account (clears both AI-feature and Google Sheets sessions).",
    inputShape: {},
    bridgeToolName: "google_sign_out",
  }),

  defineTool({
    name: "revit_auth_status",
    description: "Check the current Google authentication status.",
    inputShape: {},
    bridgeToolName: "auth_status",
  }),

  defineTool({
    name: "revit_list_google_spreadsheets",
    description: "List your Google Sheets spreadsheets. Requires Google sign-in first (revit_google_signin). Returns spreadsheet names, IDs, and last modified times.",
    inputShape: {
      maxResults: z.number().default(20).describe("Maximum number of spreadsheets to return"),
    },
    bridgeToolName: "list_google_spreadsheets",
  }),

  defineTool({
    name: "revit_read_google_sheets",
    description: "Read data from a Google Sheets spreadsheet. Use this to verify synced data or pull external data. Requires GOOGLE_SHEETS_CREDENTIALS_PATH in .env.",
    inputShape: {
      spreadsheetId: z.string().describe("The Google Sheets spreadsheet ID (from the URL)"),
      range: z.string().default("Sheet1").describe("Range to read. Examples: 'Sheet1!A1:F50', 'Data'"),
    },
    bridgeToolName: "read_google_sheets",
  }),

  defineTool({
    name: "revit_export_to_google_sheets",
    description: "Push Revit elements to a Google Sheets spreadsheet. Requires GOOGLE_SHEETS_CREDENTIALS_PATH in .env (Service Account JSON key).",
    inputShape: {
      spreadsheetId: z.string().describe("The Google Sheets spreadsheet ID (from the URL)"),
      category: z.string().describe("Revit category to export, e.g. 'Doors', 'Rooms', 'Walls'"),
      range: z.string().default("Sheet1!A1").describe("Target range"),
      includeParameters: z.boolean().default(true).describe("Include all element parameters"),
      clearFirst: z.boolean().default(false).describe("Clear existing data in the sheet before writing"),
    },
    bridgeToolName: "export_to_google_sheets",
  }),

  defineTool({
    name: "revit_export_to_notion",
    description: "Sync Revit elements to a Notion database. Creates one page per element. Requires NOTION_API_KEY in .env and the database must be shared with your integration.",
    inputShape: {
      databaseId: z.string().describe("The Notion database ID (32-char hex, from the database URL)"),
      category: z.string().describe("Revit category to export, e.g. 'Doors', 'Rooms', 'Walls'"),
      includeParameters: z.boolean().default(true).describe("Include all element parameters"),
      fieldMapping: z.record(z.unknown()).optional().describe('Optional mapping: { "Notion Property Name": "revit_field_name" }. If omitted, fields are auto-mapped by name.'),
    },
    bridgeToolName: "export_to_notion",
  }),

  defineTool({
    name: "revit_read_notion_database",
    description: "Read pages from a Notion database. Use this to verify synced data or pull external data back. Requires NOTION_API_KEY in .env.",
    inputShape: {
      databaseId: z.string().describe("The Notion database ID (32-char hex, from the database URL)"),
      pageSize: z.number().default(100).describe("Max pages to retrieve"),
    },
    bridgeToolName: "read_notion_database",
  }),

  defineTool({
    name: "revit_export_to_powerbi",
    description: "Export the Revit 3D model with tessellated geometry and all element parameters to Power BI. Default format 'pbit' produces a self-contained dashboard: CSV data files plus a ready-to-open .pbit template with a 3D viewer custom visual embedded and pre-wired — double-click it and Power BI Desktop shows the interactive 3D model with slicers for Category, Level, Family, and every parameter. Format 'sqlite' writes the legacy SQLite database instead (requires an ODBC driver in Power BI).",
    inputShape: {
      format: z.enum(["pbit", "sqlite"]).default("pbit"),
      exportScope: z.enum(["currentView", "allModel"]).default("currentView"),
      categories: z.string().optional().describe("Comma-separated category filter, e.g. 'Walls,Floors,Doors'. Default: all 3D categories"),
      outputFolder: z.string().optional().describe("Output folder for the pbit format"),
      dbPath: z.string().optional().describe("sqlite format only: full path for the .db file"),
      mode: z.enum(["new", "update"]).default("new").describe("sqlite format only"),
    },
    bridgeToolName: "export_to_powerbi",
  }),

  defineTool({
    name: "revit_show_powerbi_report",
    description: "Open an interactive Power BI report viewer inside Revit. Two modes: (1) Paste a public 'Publish to Web' URL — no setup needed. (2) Provide workspaceId + reportId for authenticated embedding via Azure AD (requires POWERBI_CLIENT_ID in .env and user sign-in). If no arguments are provided, opens the viewer with the user's saved settings.",
    inputShape: {
      publicUrl: z.string().optional().describe("Public 'Publish to Web' embed URL from Power BI Service"),
      workspaceId: z.string().optional().describe("Power BI workspace (group) ID for authenticated embedding"),
      reportId: z.string().optional().describe("Power BI report ID for authenticated embedding"),
    },
    bridgeToolName: "show_powerbi_report",
  }),
] as const;
