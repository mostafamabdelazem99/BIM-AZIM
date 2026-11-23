import { z } from "zod";
import { defineTool, emptyInput } from "./types.js";

const point3 = z.object({ x: z.number(), y: z.number(), z: z.number().optional() });
const color = z.object({ r: z.number(), g: z.number(), b: z.number() });

export const maxTools = [
  defineTool({
    name: "max_get_scene_info",
    description: "Get the active 3ds Max scene's file name, object count, display units, and current frame.",
    inputShape: emptyInput(),
    bridgeToolName: "max_get_scene_info",
  }),

  defineTool({
    name: "max_get_objects",
    description: "List scene objects, optionally filtered by class name substring (e.g. \"Box\", \"Camera\"), with a result limit (default 200).",
    inputShape: { className: z.string().optional(), limit: z.number().int().positive().optional() },
    bridgeToolName: "max_get_objects",
  }),

  defineTool({
    name: "max_get_selection",
    description: "Get the objects currently selected in the 3ds Max viewport.",
    inputShape: emptyInput(),
    bridgeToolName: "max_get_selection",
  }),

  defineTool({
    name: "max_create_box",
    description: "Create a parametric Box primitive.",
    inputShape: {
      position: point3.optional(),
      length: z.number().positive().optional(),
      width: z.number().positive().optional(),
      height: z.number().positive().optional(),
      name: z.string().optional(),
    },
    bridgeToolName: "max_create_box",
  }),

  defineTool({
    name: "max_create_sphere",
    description: "Create a parametric Sphere primitive.",
    inputShape: { position: point3.optional(), radius: z.number().positive().optional(), name: z.string().optional() },
    bridgeToolName: "max_create_sphere",
  }),

  defineTool({
    name: "max_create_cylinder",
    description: "Create a parametric Cylinder primitive.",
    inputShape: {
      position: point3.optional(),
      radius: z.number().positive().optional(),
      height: z.number().positive().optional(),
      name: z.string().optional(),
    },
    bridgeToolName: "max_create_cylinder",
  }),

  defineTool({
    name: "max_create_line",
    description: "Create a spline shape through a list of 3D points.",
    inputShape: { points: z.array(point3).min(2), name: z.string().optional() },
    bridgeToolName: "max_create_line",
  }),

  defineTool({
    name: "max_set_object_transform",
    description: "Set an object's position, scale, and/or rotation (Euler degrees) by name.",
    inputShape: {
      name: z.string(),
      position: point3.optional(),
      scale: point3.optional(),
      rotationEulerDegrees: point3.optional(),
    },
    bridgeToolName: "max_set_object_transform",
  }),

  defineTool({
    name: "max_delete_objects",
    description: "Delete one or more objects by name.",
    inputShape: { names: z.array(z.string()).min(1) },
    bridgeToolName: "max_delete_objects",
  }),

  defineTool({
    name: "max_get_materials",
    description: "List materials in the scene material library.",
    inputShape: emptyInput(),
    bridgeToolName: "max_get_materials",
  }),

  defineTool({
    name: "max_create_standard_material",
    description: "Create a Standard material with a diffuse color (0-255 per channel) and add it to the scene material library.",
    inputShape: { name: z.string().optional(), diffuseColor: color.optional() },
    bridgeToolName: "max_create_standard_material",
  }),

  defineTool({
    name: "max_assign_material",
    description: "Assign an existing scene material to an object.",
    inputShape: { objectName: z.string(), materialName: z.string() },
    bridgeToolName: "max_assign_material",
  }),

  defineTool({
    name: "max_get_layers",
    description: "List layers in the Layer Manager with visibility.",
    inputShape: emptyInput(),
    bridgeToolName: "max_get_layers",
  }),

  defineTool({
    name: "max_create_layer",
    description: "Create a new layer.",
    inputShape: { name: z.string() },
    bridgeToolName: "max_create_layer",
  }),

  defineTool({
    name: "max_get_cameras",
    description: "List camera objects in the scene.",
    inputShape: emptyInput(),
    bridgeToolName: "max_get_cameras",
  }),

  defineTool({
    name: "max_zoom_extents",
    description: "Zoom all viewports to the scene extents.",
    inputShape: emptyInput(),
    bridgeToolName: "max_zoom_extents",
  }),

  defineTool({
    name: "max_render_to_file",
    description: "Render the active camera/view to an image file.",
    inputShape: { path: z.string(), width: z.number().int().positive().optional(), height: z.number().int().positive().optional() },
    bridgeToolName: "max_render_to_file",
  }),

  defineTool({
    name: "max_export_scene",
    description: "Export the scene to a file (format inferred from extension, e.g. .fbx, .obj).",
    inputShape: { path: z.string(), usingExporter: z.string().optional() },
    bridgeToolName: "max_export_scene",
  }),

  defineTool({
    name: "max_save_scene",
    description: "Save the scene to a .max path (defaults to the currently open file).",
    inputShape: { path: z.string().optional() },
    bridgeToolName: "max_save_scene",
  }),
] as const;
