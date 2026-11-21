import { z } from "zod";
import { defineTool } from "./types.js";

/**
 * Revit tool catalog — parity scaffold. Forwards to an in-process Revit add-in (plugins/Revit)
 * exposing the same /tools/:name HTTP contract as the other engines. Expand following the same
 * pattern as tools/tekla.ts.
 */
export const revitTools = [
  defineTool({
    name: "revit_get_model_info",
    description: "Get the name, path, and active view of the currently open Revit document.",
    inputShape: {},
    bridgeToolName: "get_model_info",
  }),

  defineTool({
    name: "revit_get_selected_elements",
    description: "Get the elements currently selected in Revit with their category and key parameters.",
    inputShape: {},
    bridgeToolName: "get_selected_elements",
  }),

  defineTool({
    name: "revit_get_elements",
    description: "Query elements by category (e.g. Walls, Doors, Rooms) in the active or a named view.",
    inputShape: {
      category: z.string().describe('Revit built-in category name, e.g. "OST_Walls".'),
      viewName: z.string().optional().describe("Restrict to a specific view; omit for the whole document."),
    },
    bridgeToolName: "get_elements",
  }),
] as const;
