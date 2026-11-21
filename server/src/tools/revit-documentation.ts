import { z } from "zod";
import { defineTool } from "./types.js";

/**
 * Revit documentation tools, ported from BIM-Bot's documentation_tools.ts. This file was
 * originally skipped by the bulk port because it imports the Excel/CSV exporters — but those are
 * pure local file writers with no external account needed (unlike Google Sheets/Notion), so all
 * nine tools here are safe to expose as-is.
 */
export const revitDocumentationTools = [
  defineTool({
    name: "revit_generate_dynamic_schedule",
    description: "Generate a filtered quantity take-off from natural language and export it to Excel or CSV, e.g. \"all doors wider than 900mm in Level 1\". Filters compare real parameter values in the requested units (mm/cm/m/ft/in, areas, volumes), looking at both instance and type parameters. For precise control pass structured `filters` instead of (or as well as) the query.",
    inputShape: {
      query: z.string().optional().describe("Natural language filter, e.g. 'doors wider than 900mm in Level 1' or 'rooms with area over 20 m2'"),
      category: z.string().optional().describe("Revit category (Doors, Windows, Walls, Rooms, ...). Overrides the category detected in the query."),
      filters: z.array(z.object({
        parameter: z.string().describe("Parameter name, e.g. 'Width', 'Fire Rating'"),
        operator: z.enum([">", ">=", "<", "<=", "=", "!=", "contains"]).describe("Comparison operator"),
        value: z.union([z.string(), z.number()]).describe("Value to compare against"),
        unit: z.enum(["mm", "cm", "m", "ft", "in", "m2", "ft2", "m3", "ft3"]).optional().describe("Unit for numeric values"),
      })).optional().describe("Structured filter conditions. If provided, these are used instead of parsing the query."),
      level: z.string().optional().describe("Only include elements on this level, e.g. 'Level 1'"),
      fields: z.array(z.string()).optional().describe("Extra parameter columns to include, e.g. ['Fire Rating', 'Cost']. Id/Name/Type/Level and filtered parameters are always included."),
      exportFormat: z.enum(["xlsx", "csv", "none"]).default("xlsx").describe("Export format. 'none' returns the data inline without writing a file."),
      filePath: z.string().optional().describe("Output file path. Default: Desktop/schedule-<category>-<timestamp>.<ext>"),
      includeTotals: z.boolean().default(true).describe("Append a TOTAL row summing numeric columns"),
      limit: z.number().optional().describe("Maximum rows (default: unlimited)"),
    },
    bridgeToolName: "generate_dynamic_schedule",
  }),

  defineTool({
    name: "revit_place_view_on_sheet",
    description: "Place a view onto a sheet as a viewport.",
    inputShape: {
      sheetId: z.number().describe("Sheet element ID"),
      viewId: z.number().describe("View element ID to place"),
      x: z.number().optional().describe("Viewport X position on the sheet (feet, default: center)"),
      y: z.number().optional().describe("Viewport Y position on the sheet (feet, default: center)"),
    },
    bridgeToolName: "place_view_on_sheet",
  }),

  defineTool({
    name: "revit_create_viewport",
    description: "Create a viewport on a sheet with specific settings.",
    inputShape: {
      sheetNumber: z.string().describe("Sheet number to place on"),
      viewName: z.string().describe("View name to place"),
      x: z.number().optional().describe("X position on sheet"),
      y: z.number().optional().describe("Y position on sheet"),
      scale: z.number().optional().describe("Viewport scale override"),
    },
    bridgeToolName: "create_viewport",
  }),

  defineTool({
    name: "revit_export_schedule",
    description: "Export a schedule's data as structured text (CSV format).",
    inputShape: {
      scheduleId: z.number().optional().describe("Schedule element ID (if omitted, lists all schedules)"),
      scheduleName: z.string().optional().describe("Schedule name (alternative to ID)"),
    },
    bridgeToolName: "export_schedule",
  }),

  defineTool({
    name: "revit_create_legend",
    description: "Create a new legend view in the project.",
    inputShape: {
      legendName: z.string().describe("Name for the legend view"),
      scale: z.number().optional().describe("Legend scale (default: 1:100)"),
    },
    bridgeToolName: "create_legend",
  }),

  defineTool({
    name: "revit_add_revision",
    description: "Add a new revision to the project.",
    inputShape: {
      date: z.string().describe("Revision date, e.g. '2025-02-20'"),
      description: z.string().describe("Revision description"),
      issuedBy: z.string().optional().describe("Issued by name"),
      issuedTo: z.string().optional().describe("Issued to name"),
    },
    bridgeToolName: "add_revision",
  }),

  defineTool({
    name: "revit_print_sheets",
    description: "Print or export selected sheets to PDF.",
    inputShape: {
      sheetNumbers: z.array(z.string()).optional().describe("Sheet numbers to print (default: all sheets)"),
      outputPath: z.string().optional().describe("Output folder path for PDF files"),
    },
    bridgeToolName: "print_sheets",
  }),

  defineTool({
    name: "revit_export_dwg",
    description: "Export views or sheets to DWG format.",
    inputShape: {
      viewIds: z.array(z.number()).optional().describe("View IDs to export"),
      sheetIds: z.array(z.number()).optional().describe("Sheet IDs to export"),
      outputPath: z.string().describe("Output directory path"),
    },
    bridgeToolName: "export_dwg",
  }),

  defineTool({
    name: "revit_tag_all_in_view",
    description: "Automatically tag all elements of a specific category in the current view.",
    inputShape: {
      category: z.string().describe("Category to tag, e.g. 'Walls', 'Doors', 'Windows', 'Rooms'"),
      tagType: z.string().optional().describe("Tag family type name"),
      withLeader: z.boolean().optional().describe("Show leader lines (default: false)"),
    },
    bridgeToolName: "tag_all_in_view",
  }),
] as const;
