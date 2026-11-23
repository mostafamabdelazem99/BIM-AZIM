import { z } from "zod";
import { defineTool, emptyInput } from "./types.js";

const point2 = z.object({ x: z.number(), y: z.number(), z: z.number().optional() });

export const autocadTools = [
  defineTool({
    name: "autocad_get_model_info",
    description: "Get the active AutoCAD document's name, units, current layer/space, and drawing extents.",
    inputShape: emptyInput(),
    bridgeToolName: "autocad_get_model_info",
  }),

  defineTool({
    name: "autocad_get_drawing_variables",
    description: "Read AutoCAD system (drawing) variables, e.g. DWGNAME, INSUNITS, DIMSCALE.",
    inputShape: {
      names: z.array(z.string()).optional().describe("Defaults to DWGNAME, INSUNITS, CLAYER, DIMSCALE."),
    },
    bridgeToolName: "autocad_get_drawing_variables",
  }),

  defineTool({
    name: "autocad_zoom_extents",
    description: "Zoom the current viewport to the drawing extents.",
    inputShape: emptyInput(),
    bridgeToolName: "autocad_zoom_extents",
  }),

  defineTool({
    name: "autocad_get_layers",
    description: "List every layer in the drawing with its color index and frozen/locked/off state.",
    inputShape: emptyInput(),
    bridgeToolName: "autocad_get_layers",
  }),

  defineTool({
    name: "autocad_create_layer",
    description: "Create a new layer (no-op if it already exists).",
    inputShape: {
      name: z.string(),
      colorIndex: z.number().int().min(1).max(255).optional().describe("AutoCAD Color Index (ACI), default 7 (white/black)."),
    },
    bridgeToolName: "autocad_create_layer",
  }),

  defineTool({
    name: "autocad_set_layer_properties",
    description: "Change a layer's frozen/locked/off state or color.",
    inputShape: {
      name: z.string(),
      frozen: z.boolean().optional(),
      locked: z.boolean().optional(),
      off: z.boolean().optional(),
      colorIndex: z.number().int().min(1).max(255).optional(),
    },
    bridgeToolName: "autocad_set_layer_properties",
  }),

  defineTool({
    name: "autocad_get_entities",
    description: "List entities in model space, optionally filtered by layer, with a result limit (default 200).",
    inputShape: {
      layer: z.string().optional(),
      limit: z.number().int().positive().optional(),
    },
    bridgeToolName: "autocad_get_entities",
  }),

  defineTool({
    name: "autocad_get_selected_entities",
    description: "Get the entities currently selected (picked) by the user in the AutoCAD editor.",
    inputShape: emptyInput(),
    bridgeToolName: "autocad_get_selected_entities",
  }),

  defineTool({
    name: "autocad_create_line",
    description: "Draw a line in model space from one point to another.",
    inputShape: { start: point2, end: point2 },
    bridgeToolName: "autocad_create_line",
  }),

  defineTool({
    name: "autocad_create_circle",
    description: "Draw a circle in model space.",
    inputShape: { center: point2, radius: z.number().positive() },
    bridgeToolName: "autocad_create_circle",
  }),

  defineTool({
    name: "autocad_create_polyline",
    description: "Draw a (optionally closed) lightweight polyline through a list of points.",
    inputShape: { points: z.array(point2).min(2), closed: z.boolean().optional() },
    bridgeToolName: "autocad_create_polyline",
  }),

  defineTool({
    name: "autocad_create_text",
    description: "Add a single-line text (DBText) entity.",
    inputShape: { position: point2, text: z.string(), height: z.number().positive().optional() },
    bridgeToolName: "autocad_create_text",
  }),

  defineTool({
    name: "autocad_create_block_reference",
    description: "Insert a reference to an existing block definition at a position.",
    inputShape: {
      blockName: z.string(),
      position: point2,
      scale: z.number().positive().optional(),
      rotationRadians: z.number().optional(),
    },
    bridgeToolName: "autocad_create_block_reference",
  }),

  defineTool({
    name: "autocad_get_blocks",
    description: "List the named block definitions in this drawing.",
    inputShape: emptyInput(),
    bridgeToolName: "autocad_get_blocks",
  }),

  defineTool({
    name: "autocad_move_entity",
    description: "Move an entity (by handle) by a displacement vector.",
    inputShape: { handle: z.string(), displacement: point2 },
    bridgeToolName: "autocad_move_entity",
  }),

  defineTool({
    name: "autocad_rotate_entity",
    description: "Rotate an entity (by handle) around a center point.",
    inputShape: { handle: z.string(), center: point2, angleRadians: z.number() },
    bridgeToolName: "autocad_rotate_entity",
  }),

  defineTool({
    name: "autocad_delete_entities",
    description: "Delete (erase) one or more entities by handle.",
    inputShape: { handles: z.array(z.string()).min(1) },
    bridgeToolName: "autocad_delete_entities",
  }),

  defineTool({
    name: "autocad_get_layouts",
    description: "List the model/paper space layouts in this drawing.",
    inputShape: emptyInput(),
    bridgeToolName: "autocad_get_layouts",
  }),

  defineTool({
    name: "autocad_send_command",
    description: "Send a raw AutoCAD command-line string (escape hatch for anything not covered by a dedicated tool), e.g. \"_.FILLET\".",
    inputShape: { command: z.string() },
    bridgeToolName: "autocad_send_command",
  }),

  defineTool({
    name: "autocad_export_dwg",
    description: "Save the current drawing to a .dwg path.",
    inputShape: { path: z.string() },
    bridgeToolName: "autocad_export_dwg",
  }),

  defineTool({
    name: "recap_list_point_clouds",
    description:
      "List ReCap point-cloud entities attached to this AutoCAD drawing (layer, handle, bounding box). " +
      "ReCap itself has no scripting API of its own — this reads point-cloud attachments through AutoCAD, " +
      "which is the only way BIM-AZIM can see ReCap data. See docs/ARCHITECTURE.md for why.",
    inputShape: emptyInput(),
    bridgeToolName: "recap_list_point_clouds",
  }),
] as const;
