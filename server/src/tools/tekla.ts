import { z } from "zod";
import { defineTool } from "./types.js";

/**
 * Tekla Structures tool catalog.
 *
 * Every tool here forwards to the BimAzim.TeklaBridge .NET service (plugins/Tekla), which talks
 * to the running Tekla Structures session via the Tekla Open API. See docs/TEKLA_INTEGRATION.md
 * for the full contract and which of these are implemented server-side vs. still TODO.
 */
export const teklaTools = [
  defineTool({
    name: "tekla_get_model_info",
    description: "Get the name, path, and connection status of the currently open Tekla Structures model.",
    inputShape: {},
    bridgeToolName: "get_model_info",
  }),

  defineTool({
    name: "tekla_get_selected_objects",
    description: "Get the objects currently selected in Tekla Structures (parts, assemblies, bolts, etc.) with their basic properties.",
    inputShape: {},
    bridgeToolName: "get_selected_objects",
  }),

  defineTool({
    name: "tekla_select_by_filter",
    description: "Select objects in the Tekla model matching a class/name/phase filter, optionally scoped to a saved object group filter.",
    inputShape: {
      objectType: z.enum(["BEAM", "COLUMN", "CONTOURPLATE", "BOLT", "WELD", "ASSEMBLY", "ANY"]).default("ANY")
        .describe("Tekla object type to match. BEAM and COLUMN both map to Tekla's Beam class, distinguished by orientation/profile."),
      namePattern: z.string().optional().describe("Substring or wildcard match against the part Name."),
      phaseNumber: z.number().int().optional().describe("Restrict to a specific phase/sequence number."),
    },
    bridgeToolName: "select_by_filter",
  }),

  defineTool({
    name: "tekla_get_part_properties",
    description: "Get detailed properties (profile, material, class, position, user-defined attributes) for one or more parts by GUID.",
    inputShape: {
      guids: z.array(z.string()).min(1).describe("Tekla ModelObject GUIDs (from tekla_get_selected_objects or tekla_select_by_filter)."),
    },
    bridgeToolName: "get_part_properties",
  }),

  defineTool({
    name: "tekla_get_assemblies",
    description: "List assemblies in the model with their main part, sub-assembly count, and assembly position/cast unit numbers.",
    inputShape: {
      phaseNumber: z.number().int().optional(),
    },
    bridgeToolName: "get_assemblies",
  }),

  defineTool({
    name: "tekla_create_beam",
    description: "Create a straight beam (or column, by passing a vertical start/end) between two points.",
    inputShape: {
      startPoint: z.tuple([z.number(), z.number(), z.number()]).describe("[x, y, z] in model (work plane) coordinates."),
      endPoint: z.tuple([z.number(), z.number(), z.number()]),
      profile: z.string().describe('Tekla profile string, e.g. "HEA200" or "RHS200*100*8".'),
      material: z.string().default("S355JR"),
      name: z.string().default("BEAM"),
      className: z.string().optional().describe("Tekla part class number, used for reporting/filtering."),
    },
    bridgeToolName: "create_beam",
  }),

  defineTool({
    name: "tekla_create_contour_plate",
    description: "Create a contour (gusset/base) plate from an ordered list of corner points.",
    inputShape: {
      points: z.array(z.tuple([z.number(), z.number(), z.number()])).min(3),
      profile: z.string().describe('Plate thickness profile, e.g. "PL10".'),
      material: z.string().default("S355JR"),
      name: z.string().default("PLATE"),
    },
    bridgeToolName: "create_contour_plate",
  }),

  defineTool({
    name: "tekla_move_part",
    description: "Translate one or more parts by a delta vector.",
    inputShape: {
      guids: z.array(z.string()).min(1),
      delta: z.tuple([z.number(), z.number(), z.number()]),
    },
    bridgeToolName: "move_part",
  }),

  defineTool({
    name: "tekla_modify_part",
    description: "Modify profile, material, class, name, and/or phase of one or more existing parts.",
    inputShape: {
      guids: z.array(z.string()).min(1),
      profile: z.string().optional(),
      material: z.string().optional(),
      className: z.string().optional(),
      name: z.string().optional(),
      phaseNumber: z.number().int().optional(),
    },
    bridgeToolName: "modify_part",
  }),

  defineTool({
    name: "tekla_delete_objects",
    description: "Delete one or more objects by GUID. Irreversible once the model is saved/committed.",
    inputShape: {
      guids: z.array(z.string()).min(1),
    },
    bridgeToolName: "delete_objects",
  }),

  defineTool({
    name: "tekla_run_numbering",
    description: "Run Tekla's numbering (all objects, or only modified objects) to assign/refresh part and assembly marks.",
    inputShape: {
      scope: z.enum(["ALL", "MODIFIED_ONLY"]).default("MODIFIED_ONLY"),
    },
    bridgeToolName: "run_numbering",
  }),

  defineTool({
    name: "tekla_check_interference",
    description: "Run a basic bounding-box interference check across a set of parts (or all parts if none given) — a lightweight clash check that doesn't require Navisworks.",
    inputShape: {
      guids: z.array(z.string()).optional().describe("Limit the check to these parts; omit to check the whole model (can be slow on large models)."),
      tolerance: z.number().default(0).describe("Minimum overlap, in mm, to count as a clash."),
    },
    bridgeToolName: "check_interference",
  }),

  defineTool({
    name: "tekla_export_ifc",
    description: "Export the current model (or a selection) to IFC using Tekla's built-in IFC exporter.",
    inputShape: {
      outputPath: z.string().describe("Absolute path for the .ifc file."),
      selectionOnly: z.boolean().default(false),
    },
    bridgeToolName: "export_ifc",
  }),

  defineTool({
    name: "tekla_push_to_trimble_connect",
    description: "Push the current model state to the linked Trimble Connect project so web/mobile viewers see the latest changes. Requires Trimble Connect to be configured for this model.",
    inputShape: {
      comment: z.string().optional().describe("Optional sync comment/message."),
    },
    bridgeToolName: "push_to_trimble_connect",
  }),
] as const;
