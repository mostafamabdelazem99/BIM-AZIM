import { z } from "zod";
import { defineTool, emptyInput } from "./types.js";

const point3 = z.object({ x: z.number(), y: z.number(), z: z.number().optional() });

export const sketchupTools = [
  defineTool({
    name: "sketchup_get_model_info",
    description: "Get the active SketchUp model's title, file path, units, entity count, and active layer/tag.",
    inputShape: emptyInput(),
    bridgeToolName: "sketchup_get_model_info",
  }),

  defineTool({
    name: "sketchup_get_entities",
    description: "List entities in the model (top level), optionally filtered by type (e.g. \"Face\", \"Edge\", \"Group\", \"ComponentInstance\").",
    inputShape: {
      type: z.string().optional(),
      limit: z.number().int().positive().optional(),
    },
    bridgeToolName: "sketchup_get_entities",
  }),

  defineTool({
    name: "sketchup_get_selection",
    description: "Get the entities currently selected in the SketchUp editor.",
    inputShape: emptyInput(),
    bridgeToolName: "sketchup_get_selection",
  }),

  defineTool({
    name: "sketchup_create_edges",
    description: "Draw connected edges through a list of 3D points.",
    inputShape: { points: z.array(point3).min(2) },
    bridgeToolName: "sketchup_create_edges",
  }),

  defineTool({
    name: "sketchup_create_face",
    description: "Create a planar face from a list of 3+ coplanar 3D points.",
    inputShape: { points: z.array(point3).min(3) },
    bridgeToolName: "sketchup_create_face",
  }),

  defineTool({
    name: "sketchup_create_group",
    description: "Group entities by id into a new Group (or create an empty group if entityIds is omitted).",
    inputShape: { entityIds: z.array(z.number().int()).optional() },
    bridgeToolName: "sketchup_create_group",
  }),

  defineTool({
    name: "sketchup_create_component_instance",
    description: "Insert an instance of an existing component definition at a position.",
    inputShape: { definitionName: z.string(), position: point3.optional() },
    bridgeToolName: "sketchup_create_component_instance",
  }),

  defineTool({
    name: "sketchup_get_components",
    description: "List component definitions in this model (name + instance count).",
    inputShape: emptyInput(),
    bridgeToolName: "sketchup_get_components",
  }),

  defineTool({
    name: "sketchup_get_layers",
    description: "List layers (shown as \"Tags\" in the SketchUp UI since 2020) with visibility.",
    inputShape: emptyInput(),
    bridgeToolName: "sketchup_get_layers",
  }),

  defineTool({
    name: "sketchup_create_layer",
    description: "Create a new layer/tag.",
    inputShape: { name: z.string() },
    bridgeToolName: "sketchup_create_layer",
  }),

  defineTool({
    name: "sketchup_get_materials",
    description: "List materials in this model's material library.",
    inputShape: emptyInput(),
    bridgeToolName: "sketchup_get_materials",
  }),

  defineTool({
    name: "sketchup_move_entity",
    description: "Translate an entity (by entity id) by a displacement vector.",
    inputShape: { entityId: z.number().int(), displacement: point3 },
    bridgeToolName: "sketchup_move_entity",
  }),

  defineTool({
    name: "sketchup_delete_entities",
    description: "Erase one or more entities by id.",
    inputShape: { entityIds: z.array(z.number().int()).min(1) },
    bridgeToolName: "sketchup_delete_entities",
  }),

  defineTool({
    name: "sketchup_get_scenes",
    description: "List the named scenes (pages) in this model.",
    inputShape: emptyInput(),
    bridgeToolName: "sketchup_get_scenes",
  }),

  defineTool({
    name: "sketchup_zoom_extents",
    description: "Zoom the active view to the model extents.",
    inputShape: emptyInput(),
    bridgeToolName: "sketchup_zoom_extents",
  }),

  defineTool({
    name: "sketchup_export",
    description: "Export the model to a file — extension picks the format (.skp, .dae, .obj, .png, etc.).",
    inputShape: {
      path: z.string(),
      options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    },
    bridgeToolName: "sketchup_export",
  }),
] as const;
