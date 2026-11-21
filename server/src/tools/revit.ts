import { z } from "zod";
import { defineTool } from "./types.js";

/**
 * Revit tool catalog. Forwards to an in-process Revit add-in (plugins/Revit)
 * exposing the same /tools/:name HTTP contract as the other engines.
 *
 * Ported from the open-source BIM-Bot revit-mcp-server (`src/tools/*.ts`), which used
 * `server.tool(name, description, zodRawShape, handler)` via the MCP SDK's McpServer directly
 * against a live Revit socket connection. Each entry below keeps that project's tool
 * description and zod field `.describe()` text verbatim; `bridgeToolName` preserves the exact
 * (occasionally different) command string the original handler passed to
 * `client.sendCommand(...)`, since the Revit plugin's dispatcher is being ported to match it.
 *
 * NOT ported (depend on integrations out of scope for this pass — Gemini/Ollama AI, Google
 * OAuth, PowerBI, Notion, Google Sheets, Excel, SQLite): ai_tools.ts, powerbi_tools.ts,
 * powerbi_embed_tools.ts, export_tools.ts, documentation_tools.ts (the latter two import from
 * ../integrations/). Navisworks-specific tool files (navis_*.ts) belong to a separate engine
 * and are not part of this catalog.
 */
export const revitTools = [
  defineTool({
    name: "revit_get_model_info",
    description: "Get the name, path, and active view of the currently open Revit document.",
    inputShape: {},
    bridgeToolName: "get_model_info",
  }),

  // ── Creating Tools (creating_tools.ts) ────────────────────────────────────

  defineTool({
    name: "revit_create_wall",
    description: "Create a new wall in Revit given start point, end point, level, height, and optionally a wall type.",
    inputShape: {
      startX: z.number().describe("Start point X coordinate (feet)"),
      startY: z.number().describe("Start point Y coordinate (feet)"),
      endX: z.number().describe("End point X coordinate (feet)"),
      endY: z.number().describe("End point Y coordinate (feet)"),
      levelName: z.string().describe("Name of the level to place the wall on"),
      height: z.number().optional().describe("Wall height in feet (default: 10)"),
      wallType: z.string().optional().describe("Wall type name (default: first available)"),
    },
    bridgeToolName: "create_wall",
  }),

  defineTool({
    name: "revit_create_line_based_element",
    description: "Create a line-based element such as a beam, brace, or structural framing member.",
    inputShape: {
      familyName: z.string().describe("Family name of the element"),
      typeName: z.string().describe("Type name within the family"),
      startX: z.number().describe("Start point X (feet)"),
      startY: z.number().describe("Start point Y (feet)"),
      startZ: z.number().describe("Start point Z (feet)"),
      endX: z.number().describe("End point X (feet)"),
      endY: z.number().describe("End point Y (feet)"),
      endZ: z.number().describe("End point Z (feet)"),
      levelName: z.string().optional().describe("Level name"),
    },
    bridgeToolName: "create_line_based_element",
  }),

  defineTool({
    name: "revit_create_point_based_element",
    description: "Create a point-based element such as a door, window, furniture, or fixture at a specific location.",
    inputShape: {
      familyName: z.string().describe("Family name"),
      typeName: z.string().describe("Type name"),
      x: z.number().describe("X coordinate (feet)"),
      y: z.number().describe("Y coordinate (feet)"),
      z: z.number().optional().describe("Z coordinate (feet, default: 0)"),
      levelName: z.string().optional().describe("Level name"),
      hostElementId: z.number().optional().describe("Host element ID (e.g. wall ID for doors/windows)"),
    },
    bridgeToolName: "create_point_based_element",
  }),

  defineTool({
    name: "revit_create_floor",
    description: "Create a floor element from boundary points on a specific level.",
    inputShape: {
      points: z.array(z.object({
        x: z.number().describe("X coordinate (feet)"),
        y: z.number().describe("Y coordinate (feet)"),
      })).describe("Boundary points defining the floor outline (minimum 3 points)"),
      levelName: z.string().describe("Level name"),
      floorType: z.string().optional().describe("Floor type name (default: first available)"),
    },
    bridgeToolName: "create_floor",
  }),

  defineTool({
    name: "revit_create_ceiling",
    description: "Create a ceiling element from boundary points on a specific level.",
    inputShape: {
      points: z.array(z.object({
        x: z.number().describe("X coordinate (feet)"),
        y: z.number().describe("Y coordinate (feet)"),
      })).describe("Boundary points defining the ceiling outline"),
      levelName: z.string().describe("Level name"),
      ceilingType: z.string().optional().describe("Ceiling type name"),
    },
    bridgeToolName: "create_ceiling",
  }),

  defineTool({
    name: "revit_create_roof",
    description: "Create a roof element from a footprint on a specific level.",
    inputShape: {
      points: z.array(z.object({
        x: z.number().describe("X coordinate (feet)"),
        y: z.number().describe("Y coordinate (feet)"),
      })).describe("Footprint points defining the roof outline"),
      levelName: z.string().describe("Level name"),
      roofType: z.string().optional().describe("Roof type name"),
      slope: z.number().optional().describe("Roof slope angle in degrees"),
    },
    bridgeToolName: "create_roof",
  }),

  defineTool({
    name: "revit_create_level",
    description: "Create a new level at a specified elevation.",
    inputShape: {
      name: z.string().describe("Level name, e.g. 'Level 3'"),
      elevation: z.number().describe("Elevation in feet"),
    },
    bridgeToolName: "create_level",
  }),

  defineTool({
    name: "revit_create_grid",
    description: "Create a grid line from a start point to an end point.",
    inputShape: {
      name: z.string().describe("Grid name, e.g. 'A', '1'"),
      startX: z.number().describe("Start X (feet)"),
      startY: z.number().describe("Start Y (feet)"),
      endX: z.number().describe("End X (feet)"),
      endY: z.number().describe("End Y (feet)"),
    },
    bridgeToolName: "create_grid",
  }),

  defineTool({
    name: "revit_create_room",
    description: "Place a room at a specific location on a level. The room will automatically detect its boundaries from surrounding walls.",
    inputShape: {
      x: z.number().describe("X coordinate inside the room boundary (feet)"),
      y: z.number().describe("Y coordinate inside the room boundary (feet)"),
      levelName: z.string().describe("Level name"),
      roomName: z.string().optional().describe("Room name"),
      roomNumber: z.string().optional().describe("Room number"),
    },
    bridgeToolName: "create_room",
  }),

  defineTool({
    name: "revit_create_sheet",
    description: "Create a new sheet in the Revit project.",
    inputShape: {
      sheetNumber: z.string().describe("Sheet number, e.g. 'A101'"),
      sheetName: z.string().describe("Sheet name, e.g. 'Floor Plan - Level 1'"),
      titleBlockName: z.string().optional().describe("Title block family name (default: first available)"),
    },
    bridgeToolName: "create_sheet",
  }),

  defineTool({
    name: "revit_create_view",
    description: "Create a new view in the Revit project.",
    inputShape: {
      viewType: z.enum(["FloorPlan", "CeilingPlan", "Section", "Elevation", "3D", "Drafting"]).describe("Type of view to create"),
      levelName: z.string().optional().describe("Level name (for floor/ceiling plans)"),
      viewName: z.string().optional().describe("Custom view name"),
    },
    bridgeToolName: "create_view",
  }),

  defineTool({
    name: "revit_create_schedule",
    description: "Create a new schedule/quantity takeoff in the Revit project.",
    inputShape: {
      category: z.string().describe("Category for the schedule, e.g. 'Walls', 'Doors', 'Rooms'"),
      scheduleName: z.string().describe("Name for the new schedule"),
      fields: z.array(z.string()).optional().describe("Parameter names to include as columns"),
    },
    bridgeToolName: "create_schedule",
  }),

  defineTool({
    name: "revit_create_tag",
    description: "Create a tag annotation for an element in the current view.",
    inputShape: {
      elementId: z.number().describe("Element ID to tag"),
      tagType: z.string().optional().describe("Tag family type name"),
      offsetX: z.number().optional().describe("Tag offset X from element center (feet)"),
      offsetY: z.number().optional().describe("Tag offset Y from element center (feet)"),
      withLeader: z.boolean().optional().describe("Show leader line (default: false)"),
    },
    bridgeToolName: "create_tag",
  }),

  defineTool({
    name: "revit_create_dimension",
    description: "Create a dimension annotation between two points or references in the current view.",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs to dimension between (2 elements)"),
      dimensionType: z.string().optional().describe("Dimension type name"),
    },
    bridgeToolName: "create_dimension",
  }),

  defineTool({
    name: "revit_create_text_note",
    description: "Create a text note annotation in the current view.",
    inputShape: {
      text: z.string().describe("Text content"),
      x: z.number().describe("X position (feet)"),
      y: z.number().describe("Y position (feet)"),
      textType: z.string().optional().describe("Text note type name"),
    },
    bridgeToolName: "create_text_note",
  }),

  // ── Editing Tools (editing_tools.ts) ──────────────────────────────────────

  defineTool({
    name: "revit_modify_parameter",
    description: "Set or modify a parameter value on a Revit element.",
    inputShape: {
      elementId: z.number().describe("Element ID to modify"),
      parameterName: z.string().describe("Parameter name to modify"),
      value: z.union([z.string(), z.number(), z.boolean()]).describe("New value for the parameter"),
    },
    bridgeToolName: "modify_element",
  }),

  defineTool({
    name: "revit_move_element",
    description: "Move a Revit element by a translation vector (deltaX, deltaY, deltaZ).",
    inputShape: {
      elementId: z.number().describe("Element ID to move"),
      deltaX: z.number().describe("Translation in X direction (feet)"),
      deltaY: z.number().describe("Translation in Y direction (feet)"),
      deltaZ: z.number().optional().describe("Translation in Z direction (feet, default: 0)"),
    },
    bridgeToolName: "move_element",
  }),

  defineTool({
    name: "revit_rotate_element",
    description: "Rotate a Revit element around a point by a specified angle.",
    inputShape: {
      elementId: z.number().describe("Element ID to rotate"),
      angle: z.number().describe("Rotation angle in degrees"),
      centerX: z.number().optional().describe("Rotation center X (feet, default: element center)"),
      centerY: z.number().optional().describe("Rotation center Y (feet, default: element center)"),
    },
    bridgeToolName: "rotate_element",
  }),

  defineTool({
    name: "revit_copy_element",
    description: "Copy a Revit element to a new location.",
    inputShape: {
      elementId: z.number().describe("Element ID to copy"),
      deltaX: z.number().describe("Offset X from original (feet)"),
      deltaY: z.number().describe("Offset Y from original (feet)"),
      deltaZ: z.number().optional().describe("Offset Z from original (feet, default: 0)"),
      count: z.number().optional().describe("Number of copies (default: 1)"),
    },
    bridgeToolName: "copy_element",
  }),

  defineTool({
    name: "revit_delete_elements",
    description: "Delete one or more elements from the Revit model by their IDs.",
    inputShape: {
      elementIds: z.array(z.number()).describe("Array of element IDs to delete"),
    },
    bridgeToolName: "delete_elements",
  }),

  defineTool({
    name: "revit_mirror_element",
    description: "Mirror a Revit element across a line defined by two points.",
    inputShape: {
      elementId: z.number().describe("Element ID to mirror"),
      axisStartX: z.number().describe("Mirror axis start X (feet)"),
      axisStartY: z.number().describe("Mirror axis start Y (feet)"),
      axisEndX: z.number().describe("Mirror axis end X (feet)"),
      axisEndY: z.number().describe("Mirror axis end Y (feet)"),
      keepOriginal: z.boolean().optional().describe("Keep original element (default: true)"),
    },
    bridgeToolName: "mirror_element",
  }),

  defineTool({
    name: "revit_align_elements",
    description: "Align multiple elements to a reference element or position.",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs to align"),
      referenceElementId: z.number().optional().describe("Reference element ID to align to"),
      alignment: z.enum(["Left", "Right", "Top", "Bottom", "Center", "Middle"]).describe("Alignment direction"),
    },
    bridgeToolName: "align_elements",
  }),

  defineTool({
    name: "revit_group_elements",
    description: "Create a group from multiple elements.",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs to group"),
      groupName: z.string().optional().describe("Name for the new group"),
    },
    bridgeToolName: "group_elements",
  }),

  defineTool({
    name: "revit_change_type",
    description: "Change the type of an element (e.g. change a wall from one type to another).",
    inputShape: {
      elementId: z.number().describe("Element ID"),
      newTypeName: z.string().describe("New type name to apply"),
    },
    bridgeToolName: "change_type",
  }),

  defineTool({
    name: "revit_set_workset",
    description: "Move elements to a different workset (for workshared projects).",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs to move"),
      worksetName: z.string().describe("Target workset name"),
    },
    bridgeToolName: "set_workset",
  }),

  defineTool({
    name: "revit_color_elements",
    description: "Color elements in the current view based on a parameter value. Useful for visual analysis.",
    inputShape: {
      category: z.string().describe("Category of elements to color, e.g. 'Walls', 'Rooms'"),
      parameterName: z.string().describe("Parameter name to base colors on"),
    },
    bridgeToolName: "color_elements",
  }),

  defineTool({
    name: "revit_batch_modify_parameters",
    description: "Modify a parameter value on multiple elements at once.",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs to modify"),
      parameterName: z.string().describe("Parameter name to modify"),
      value: z.union([z.string(), z.number(), z.boolean()]).describe("New value"),
    },
    bridgeToolName: "batch_modify_parameters",
  }),

  defineTool({
    name: "revit_parameter_batch_editor",
    description: "Rule-driven bulk parameter editing. Selects a scope (category, element IDs, current selection), " +
      "keeps only elements matching 'where' conditions, then applies each 'set' edit — a literal value, " +
      "a regex find/replace on the existing value, or a copy from another parameter. " +
      "Example: where Category=Walls and Height > 3 m, set 'Fire Rating' = '2h'. " +
      "Run with dryRun: true first to preview which elements change.",
    inputShape: {
      category: z.string().optional().describe("Category to scope, e.g. 'Walls'"),
      categories: z.array(z.string()).optional().describe("Multiple categories to scope"),
      elementIds: z.array(z.number()).optional().describe("Explicit element IDs instead of a category"),
      useSelection: z.boolean().optional().describe("Use the current Revit selection as the scope"),
      activeViewOnly: z.boolean().optional().describe("Limit a category scope to the active view"),
      where: z.array(z.object({
        parameterName: z.string().describe("Parameter to test (instance or type parameter)"),
        operator: z.enum([
          "equals", "notEquals", "contains", "notContains", "startsWith", "endsWith",
          "matches", "greaterThan", "lessThan", "greaterOrEqual", "lessOrEqual",
          "isEmpty", "isNotEmpty", "exists", "notExists"
        ]).optional().describe("Comparison operator (default: equals). 'matches' is a regex"),
        value: z.union([z.string(), z.number(), z.boolean()]).optional().describe("Value to compare against"),
        unit: z.string().optional().describe("Unit for numeric compares: mm, cm, m, ft, in, m2, m3, deg. Defaults to the parameter's display unit"),
      })).optional().describe("Conditions an element must meet to be edited. Omit to edit the whole scope"),
      matchMode: z.enum(["all", "any"]).optional().describe("Require all conditions (default) or any"),
      set: z.array(z.object({
        parameterName: z.string().describe("Parameter to write"),
        value: z.union([z.string(), z.number(), z.boolean()]).optional().describe("Literal value to set"),
        unit: z.string().optional().describe("Unit of value for numeric parameters"),
        find: z.string().optional().describe("Regex (or literal) to find in the current value — for renaming"),
        replace: z.string().optional().describe("Replacement for 'find'; supports $1 backreferences"),
        regex: z.boolean().optional().describe("Treat 'find' as a regex (default: true)"),
        fromParameter: z.string().optional().describe("Copy the value from this parameter instead"),
        prefix: z.string().optional().describe("Text prepended to the computed value"),
        suffix: z.string().optional().describe("Text appended to the computed value"),
        applyToType: z.boolean().optional().describe("Allow writing the element's type parameter (affects all instances of that type)"),
      })).describe("Edits applied to every matching element"),
      dryRun: z.boolean().optional().describe("Preview the changes without modifying the model (default: false)"),
      limit: z.number().optional().describe("Maximum number of elements to edit"),
      previewLimit: z.number().optional().describe("Maximum change records returned (default: 25)"),
    },
    bridgeToolName: "parameter_batch_editor",
  }),

  // ── Reading Tools (reading_tools.ts) ──────────────────────────────────────

  defineTool({
    name: "revit_get_current_view_info",
    description: "Get detailed information about the currently active Revit view, including view type, name, scale, and properties.",
    inputShape: {},
    bridgeToolName: "get_current_view_info",
  }),

  defineTool({
    name: "revit_get_current_view_elements",
    description: "Get all elements visible in the current Revit view. Optionally filter by category. Supports pagination via offset/limit — response includes totalCount and hasMore to know if more batches are needed.",
    inputShape: {
      category: z.string().optional().describe("Optional category filter, e.g. 'Walls', 'Doors', 'Windows'"),
      offset: z.number().optional().describe("Skip this many elements (for pagination). Default: 0"),
      limit: z.number().optional().describe("Max elements to return (0 = all). Default: 0 (return all)"),
    },
    bridgeToolName: "get_current_view_elements",
  }),

  defineTool({
    name: "revit_get_selected_elements",
    description: "Get details of all currently selected elements in Revit, including their IDs, categories, and parameters.",
    inputShape: {},
    bridgeToolName: "get_selected_elements",
  }),

  defineTool({
    name: "revit_get_elements",
    description: "Get all elements of a specific category from the Revit model. Response includes totalCount (total matching elements) and hasMore (if paginated). Use offset/limit for large datasets — default returns all elements.",
    inputShape: {
      category: z.string().describe("Revit category name, e.g. 'Walls', 'Doors', 'Windows', 'Floors', 'Ceilings', 'Roofs', 'Structural Columns'"),
      includeParameters: z.boolean().optional().describe("Include all parameters for each element (default: false)"),
      includeLinks: z.boolean().optional().describe("Include elements from linked models"),
      linkNames: z.array(z.string()).optional().describe("Specific link names to include"),
      offset: z.number().optional().describe("Skip this many elements (for pagination). Default: 0"),
      limit: z.number().optional().describe("Max elements to return (0 = all). Default: 0 (return all)"),
    },
    bridgeToolName: "get_elements",
  }),

  defineTool({
    name: "revit_get_parameters",
    description: "Get all parameters (instance and type) for a specific element by its ID.",
    inputShape: {
      elementId: z.number().describe("The Revit element ID"),
      namespacedId: z.string().optional().describe("Namespaced ID for cross-link lookup, e.g. 'LinkName:12345'"),
    },
    bridgeToolName: "get_parameters",
  }),

  defineTool({
    name: "revit_get_project_info",
    description: "Get general project information including project name, number, address, client, status, and other metadata.",
    inputShape: {},
    bridgeToolName: "get_project_info",
  }),

  defineTool({
    name: "revit_get_views",
    description: "Get a list of all views in the Revit project. Optionally filter by view type. Supports aliases: '3D' (ThreeD), 'Plan' (FloorPlan), 'RCP' (CeilingPlan), 'Ceiling', 'Drafting' (DraftingView), 'Area' (AreaPlan).",
    inputShape: {
      viewType: z.string().optional().describe("Optional filter: 'FloorPlan', 'CeilingPlan', 'Section', 'Elevation', '3D', 'Schedule', 'Drafting', 'Legend'"),
    },
    bridgeToolName: "get_views",
  }),

  defineTool({
    name: "revit_get_sheets",
    description: "Get all sheets in the Revit project, including sheet name, number, and placed views.",
    inputShape: {},
    bridgeToolName: "get_sheets",
  }),

  defineTool({
    name: "revit_get_levels",
    description: "Get all levels in the Revit project with their names and elevations.",
    inputShape: {
      includeLinks: z.boolean().optional().describe("Include elements from linked models"),
      linkNames: z.array(z.string()).optional().describe("Specific link names to include"),
    },
    bridgeToolName: "get_levels",
  }),

  defineTool({
    name: "revit_get_grids",
    description: "Get all grids in the Revit project with their names, directions, and positions.",
    inputShape: {
      includeLinks: z.boolean().optional().describe("Include elements from linked models"),
      linkNames: z.array(z.string()).optional().describe("Specific link names to include"),
    },
    bridgeToolName: "get_grids",
  }),

  defineTool({
    name: "revit_get_rooms",
    description: "Get all rooms in the Revit project with their names, numbers, areas, and boundary information.",
    inputShape: {
      includeLinks: z.boolean().optional().describe("Include elements from linked models"),
      linkNames: z.array(z.string()).optional().describe("Specific link names to include"),
    },
    bridgeToolName: "get_rooms",
  }),

  defineTool({
    name: "revit_get_families",
    description: "Get available family types in the Revit project. Optionally filter by category.",
    inputShape: {
      category: z.string().optional().describe("Optional category filter, e.g. 'Doors', 'Windows', 'Furniture'"),
      includeLinks: z.boolean().optional().describe("Include elements from linked models"),
      linkNames: z.array(z.string()).optional().describe("Specific link names to include"),
    },
    bridgeToolName: "get_available_family_types",
  }),

  defineTool({
    name: "revit_get_schedules",
    description: "Get all schedules in the Revit project with their names, fields, and data.",
    inputShape: {},
    bridgeToolName: "get_schedules",
  }),

  defineTool({
    name: "revit_get_linked_models",
    description: "Get information about all linked Revit models in the current project.",
    inputShape: {},
    bridgeToolName: "get_linked_models",
  }),

  defineTool({
    name: "revit_get_link_info",
    description: "Get detailed information about linked Revit models: load status, file path, instance count, and linked file status.",
    inputShape: {
      linkName: z.string().optional().describe("Optional filter by link name (partial match)"),
    },
    bridgeToolName: "get_link_info",
  }),

  defineTool({
    name: "revit_unload_links",
    description: "Unload linked Revit models to reduce memory and improve performance. Optionally filter by name.",
    inputShape: {
      linkName: z.string().optional().describe("Optional filter by link name (partial match). If not provided, unloads ALL links."),
    },
    bridgeToolName: "unload_links",
  }),

  defineTool({
    name: "revit_get_warnings",
    description: "Get all active warnings/errors in the Revit model for quality control.",
    inputShape: {
      includeLinks: z.boolean().optional().describe("Include elements from linked models"),
      linkNames: z.array(z.string()).optional().describe("Specific link names to include"),
    },
    bridgeToolName: "get_warnings",
  }),

  defineTool({
    name: "revit_open_view",
    description: "Open a specific view in the Revit UI so the user can see it.",
    inputShape: {
      viewId: z.number().describe("The Element ID of the view to open"),
    },
    bridgeToolName: "open_view",
  }),

  defineTool({
    name: "revit_close_view",
    description: "Close a specific view in the Revit UI.",
    inputShape: {
      viewId: z.number().optional().describe("The Element ID of the view to close. If not provided, it attempts to close the active view."),
    },
    bridgeToolName: "close_view",
  }),

  // ── Extended Tools (extended_tools.ts) ────────────────────────────────────

  defineTool({
    name: "revit_open_document",
    description: "Open a .rvt Revit file. Optionally detach from central.",
    inputShape: {
      filePath: z.string().describe("Full path to the .rvt file"),
      detach: z.boolean().optional().describe("Detach from central when opening (default: false)"),
    },
    bridgeToolName: "open_document",
  }),

  defineTool({
    name: "revit_create_new_project",
    description: "Create a new Revit project. Optionally specify a template file.",
    inputShape: {
      templatePath: z.string().optional().describe("Path to .rte template file. If omitted, uses default metric template."),
    },
    bridgeToolName: "create_new_project",
  }),

  defineTool({
    name: "revit_create_new_family",
    description: "Create a new family (.rfa) from a template. Opens the family editor.",
    inputShape: {
      templatePath: z.string().optional().describe("Path to .rft family template file. If omitted, uses default Generic Model template."),
    },
    bridgeToolName: "create_new_family",
  }),

  defineTool({
    name: "revit_detach_from_central",
    description: "Open a workshared .rvt file detached from its central model.",
    inputShape: {
      filePath: z.string().describe("Full path to the workshared .rvt file"),
    },
    bridgeToolName: "detach_from_central",
  }),

  defineTool({
    name: "revit_change_link_path",
    description: "Change the file path of a linked Revit model. Useful when links are broken or moved.",
    inputShape: {
      linkName: z.string().describe("Name of the linked model (partial match)"),
      newPath: z.string().describe("New file path for the linked model"),
    },
    bridgeToolName: "change_link_path",
  }),

  defineTool({
    name: "revit_manage_link_position",
    description: "Move or rotate a linked model instance in the project.",
    inputShape: {
      linkName: z.string().optional().describe("Name of the link instance (partial match)"),
      moveX: z.number().optional().describe("Move X distance in feet"),
      moveY: z.number().optional().describe("Move Y distance in feet"),
      moveZ: z.number().optional().describe("Move Z distance in feet"),
      rotation: z.number().optional().describe("Rotation angle in degrees around Z axis"),
    },
    bridgeToolName: "manage_link_position",
  }),

  defineTool({
    name: "revit_zoom_to_fit",
    description: "Zoom the active view to fit all visible content. Equivalent to pressing 'ZF' in Revit.",
    inputShape: {},
    bridgeToolName: "zoom_to_fit",
  }),

  defineTool({
    name: "revit_zoom_to_element",
    description: "Zoom the active view to center on a specific element with padding.",
    inputShape: {
      elementId: z.number().describe("Element ID to zoom to"),
    },
    bridgeToolName: "zoom_to_element",
  }),

  defineTool({
    name: "revit_edit_schedule",
    description: "Edit a schedule's structure: add/remove fields, sort, toggle itemization, show/hide headers. Use action='info' to get field details first.",
    inputShape: {
      scheduleId: z.number().describe("Element ID of the schedule"),
      action: z.enum(["info", "sort", "add_field", "remove_field", "set_header", "itemize"]).describe("Action to perform"),
      fieldName: z.string().optional().describe("Field name (for sort, add_field, remove_field)"),
      ascending: z.boolean().optional().describe("Sort ascending (for sort action, default: true)"),
      showHeaders: z.boolean().optional().describe("Show column headers (for set_header action)"),
      itemize: z.boolean().optional().describe("Itemize every instance (for itemize action)"),
    },
    bridgeToolName: "edit_schedule",
  }),

  defineTool({
    name: "revit_create_stairs",
    description: "Create stairs between two levels by defining location, width, and stair configuration.",
    inputShape: {
      baseLevelName: z.string().describe("Base level name"),
      topLevelName: z.string().describe("Top level name"),
      x: z.number().optional().describe("X location in feet"),
      y: z.number().optional().describe("Y location in feet"),
      width: z.number().optional().describe("Stair width in feet (default: 3)"),
    },
    bridgeToolName: "create_stairs",
  }),

  defineTool({
    name: "revit_create_railing",
    description: "Create a railing along a path or attached to stairs.",
    inputShape: {
      stairId: z.number().optional().describe("Element ID of stairs to attach railing to"),
      railingType: z.string().optional().describe("Railing type name"),
    },
    bridgeToolName: "create_railing",
  }),

  defineTool({
    name: "revit_create_curtain_wall",
    description: "Create a curtain wall with configurable grid pattern.",
    inputShape: {
      startX: z.number().describe("Start X in feet"),
      startY: z.number().describe("Start Y in feet"),
      endX: z.number().describe("End X in feet"),
      endY: z.number().describe("End Y in feet"),
      levelName: z.string().optional().describe("Level name"),
      height: z.number().optional().describe("Wall height in feet"),
    },
    bridgeToolName: "create_curtain_wall",
  }),

  defineTool({
    name: "revit_create_filled_region",
    description: "Create a filled region in a view from boundary points.",
    inputShape: {
      points: z.array(z.object({ x: z.number(), y: z.number() })).describe("Boundary points forming a closed loop"),
      fillPatternName: z.string().optional().describe("Fill pattern name"),
      viewId: z.number().optional().describe("View ID (default: active view)"),
    },
    bridgeToolName: "create_filled_region",
  }),

  defineTool({
    name: "revit_create_elevation_views",
    description: "Create elevation views facing a room or area.",
    inputShape: {
      roomId: z.number().optional().describe("Room ID to create elevations around"),
      x: z.number().optional().describe("X location for elevation marker"),
      y: z.number().optional().describe("Y location for elevation marker"),
      levelName: z.string().optional().describe("Level name"),
    },
    bridgeToolName: "create_elevation_views",
  }),

  defineTool({
    name: "revit_create_section_views",
    description: "Create section views through elements or at specified locations.",
    inputShape: {
      elementId: z.number().optional().describe("Element ID to section through"),
      startX: z.number().optional(),
      startY: z.number().optional(),
      endX: z.number().optional(),
      endY: z.number().optional(),
      depth: z.number().optional().describe("Section view depth in feet"),
    },
    bridgeToolName: "create_section_views",
  }),

  defineTool({
    name: "revit_create_spot_elevation",
    description: "Create a spot elevation annotation in the current view.",
    inputShape: {
      x: z.number().describe("X coordinate in feet"),
      y: z.number().describe("Y coordinate in feet"),
      z: z.number().optional().describe("Z coordinate (default: pick from model)"),
    },
    bridgeToolName: "create_spot_elevation",
  }),

  // ── Advanced Tools (advanced_tools.ts) ────────────────────────────────────

  defineTool({
    name: "revit_send_code_to_revit",
    description: "Send C# code to execute directly in Revit. The code runs in the context of the Revit API with access to the current Document and UIApplication. Use for advanced operations not covered by other tools.",
    inputShape: {
      code: z.string().describe("C# code to execute in Revit. Has access to: UIApplication uiApp, Document doc, and all Revit API namespaces."),
      description: z.string().optional().describe("Human-readable description of what the code does"),
    },
    bridgeToolName: "send_code_to_revit",
  }),

  defineTool({
    name: "revit_ai_element_filter",
    description: "Use natural language to filter elements. Describe what you want to find and the system will translate it to Revit filters, e.g. 'all doors wider than 900mm in Level 1'. Returns matching elements with their IDs (use select_elements to highlight them).",
    inputShape: {
      query: z.string().describe("Natural language description of elements to find, e.g. 'all walls taller than 3 m'"),
      category: z.string().optional().describe("Optional category hint to narrow the search"),
    },
    bridgeToolName: "generate_dynamic_schedule",
  }),

  defineTool({
    name: "revit_reset_view",
    description: "Reset the current view to default settings (zoom extents, clear overrides).",
    inputShape: {
      clearOverrides: z.boolean().optional().describe("Clear all graphic overrides (default: false)"),
      zoomExtents: z.boolean().optional().describe("Zoom to fit all elements (default: true)"),
    },
    bridgeToolName: "reset_view",
  }),

  defineTool({
    name: "revit_select_elements",
    description: "Select specific elements in Revit by their IDs.",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs to select"),
    },
    bridgeToolName: "select_elements",
  }),

  defineTool({
    name: "revit_get_model_statistics",
    description: "Get comprehensive model statistics: element counts by category, total elements, file size, warnings count, etc.",
    inputShape: {},
    bridgeToolName: "get_model_statistics",
  }),

  // ── Power Tools (power_tools.ts) ──────────────────────────────────────────

  defineTool({
    name: "revit_auto_join_elements",
    description: "Automatically join geometry between two categories (e.g. Walls↔Floors, Walls↔Columns). Processes all intersecting elements.",
    inputShape: {
      category1: z.string().optional().describe("First category (default: 'Walls')"),
      category2: z.string().optional().describe("Second category (default: 'Floors')"),
    },
    bridgeToolName: "auto_join_elements",
  }),

  defineTool({
    name: "revit_reassign_level",
    description: "Move elements to a different level while preserving their vertical position (offset adjustment).",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs to reassign"),
      targetLevel: z.string().describe("Target level name"),
      maintainOffset: z.boolean().optional().describe("Maintain absolute position by adjusting offset (default: true)"),
    },
    bridgeToolName: "reassign_level",
  }),

  defineTool({
    name: "revit_batch_modify_thickness",
    description: "Modify wall or slab thickness by scaling compound structure layers proportionally.",
    inputShape: {
      category: z.string().optional().describe("Category: 'Walls' or 'Floors' (default: 'Walls')"),
      typeName: z.string().describe("Type name to modify"),
      thickness: z.number().describe("New total thickness in feet"),
    },
    bridgeToolName: "batch_modify_thickness",
  }),

  defineTool({
    name: "revit_room_to_floor",
    description: "Generate floor elements from room boundaries. Creates one floor per room using the room's boundary curves.",
    inputShape: {
      roomIds: z.array(z.number()).optional().describe("Specific room IDs (default: all rooms with area > 0)"),
      floorType: z.string().optional().describe("Floor type name (default: first available)"),
    },
    bridgeToolName: "room_to_floor",
  }),

  defineTool({
    name: "revit_find_replace_names",
    description: "Global find-and-replace in element type names, view names, or sheet names.",
    inputShape: {
      find: z.string().describe("Text to find"),
      replace: z.string().optional().describe("Replacement text (default: empty/remove)"),
      scope: z.enum(["Types", "Views", "Sheets", "All"]).optional().describe("Where to search (default: 'Types')"),
    },
    bridgeToolName: "find_replace_names",
  }),

  defineTool({
    name: "revit_parameter_case_convert",
    description: "Convert a text parameter's value to UPPER, lower, or Title case for all elements in a category.",
    inputShape: {
      category: z.string().describe("Category name"),
      parameterName: z.string().describe("Parameter name to convert"),
      caseType: z.enum(["UPPER", "lower", "Title"]).optional().describe("Target case (default: 'Title')"),
    },
    bridgeToolName: "parameter_case_convert",
  }),

  defineTool({
    name: "revit_bulk_parameter_transfer",
    description: "Copy values from one parameter to another for all elements in a category (e.g. sync Comments to Mark).",
    inputShape: {
      category: z.string().describe("Category name"),
      sourceParameter: z.string().describe("Source parameter name to read from"),
      targetParameter: z.string().describe("Target parameter name to write to"),
    },
    bridgeToolName: "bulk_parameter_transfer",
  }),

  defineTool({
    name: "revit_auto_renumber",
    description: "Sequentially renumber elements (rooms, doors, etc.) sorted by location or name.",
    inputShape: {
      category: z.string().optional().describe("Category (default: 'Rooms')"),
      prefix: z.string().optional().describe("Number prefix, e.g. 'A-' for 'A-101'"),
      startNumber: z.number().optional().describe("Starting number (default: 1)"),
      sortBy: z.enum(["Location", "Name"]).optional().describe("Sort order (default: 'Location')"),
      parameterName: z.string().optional().describe("Parameter to set (default: 'Number')"),
    },
    bridgeToolName: "auto_renumber",
  }),

  defineTool({
    name: "revit_batch_create_sheets",
    description: "Create multiple sheets at once from a list of sheet numbers and names.",
    inputShape: {
      sheets: z.array(z.object({
        number: z.string().describe("Sheet number, e.g. 'A101'"),
        name: z.string().optional().describe("Sheet name"),
      })).describe("Array of sheets to create"),
    },
    bridgeToolName: "batch_create_sheets",
  }),

  defineTool({
    name: "revit_align_viewports",
    description: "Align all viewports on a sheet horizontally, vertically, or to the same center.",
    inputShape: {
      sheetId: z.number().describe("Sheet element ID"),
      alignment: z.enum(["Horizontal", "Vertical", "Center"]).optional().describe("Alignment type (default: 'Center')"),
    },
    bridgeToolName: "align_viewports",
  }),

  defineTool({
    name: "revit_deep_purge",
    description: "Multi-pass deep purge of all unused elements (families, types, line styles, view filters, etc.).",
    inputShape: {},
    bridgeToolName: "deep_purge",
  }),

  defineTool({
    name: "revit_delete_empty_groups",
    description: "Find and delete all empty groups and unused group types in the project.",
    inputShape: {},
    bridgeToolName: "delete_empty_groups",
  }),

  defineTool({
    name: "revit_find_cad_imports",
    description: "Locate all CAD imports in the project. Optionally delete non-linked imports.",
    inputShape: {
      delete: z.boolean().optional().describe("Set to true to delete non-linked CAD imports"),
    },
    bridgeToolName: "find_cad_imports",
  }),

  defineTool({
    name: "revit_select_by_parameter",
    description: "Select all elements where a specific parameter matches a value.",
    inputShape: {
      category: z.string().describe("Category to search in"),
      parameterName: z.string().describe("Parameter name to filter by"),
      value: z.string().optional().describe("Value to match (partial match supported). Omit to select all elements that have this parameter."),
    },
    bridgeToolName: "select_by_parameter",
  }),

  defineTool({
    name: "revit_select_by_workset",
    description: "Select all elements on a specific workset.",
    inputShape: {
      worksetName: z.string().describe("Workset name to select from"),
    },
    bridgeToolName: "select_by_workset",
  }),

  defineTool({
    name: "revit_filter_selection",
    description: "Filter the current selection to keep only elements matching a category and/or level.",
    inputShape: {
      category: z.string().optional().describe("Keep only elements of this category"),
      levelName: z.string().optional().describe("Keep only elements on this level"),
    },
    bridgeToolName: "filter_selection",
  }),

  defineTool({
    name: "revit_category_to_workset",
    description: "Automatically migrate all elements of specified categories to designated worksets.",
    inputShape: {
      mappings: z.array(z.object({
        category: z.string().describe("Category name"),
        worksetName: z.string().describe("Target workset name"),
      })).describe("Category-to-workset mappings"),
    },
    bridgeToolName: "category_to_workset",
  }),

  defineTool({
    name: "revit_inverse_selection",
    description: "Invert the current selection — deselect what's selected and select everything else visible in the view.",
    inputShape: {},
    bridgeToolName: "inverse_selection",
  }),

  defineTool({
    name: "revit_copy_from_linked",
    description: "Copy elements from a linked Revit model into the current document.",
    inputShape: {
      category: z.string().describe("Category of elements to copy (e.g. 'Walls', 'Doors')"),
      linkName: z.string().optional().describe("Name of the linked model (partial match). Default: first link."),
    },
    bridgeToolName: "copy_from_linked",
  }),

  defineTool({
    name: "revit_crop_region_sync",
    description: "Copy the crop region from one master view to multiple target views.",
    inputShape: {
      sourceViewId: z.number().describe("Source view ID to copy crop from"),
      targetViewIds: z.array(z.number()).describe("Target view IDs to apply the crop to"),
    },
    bridgeToolName: "crop_region_sync",
  }),

  defineTool({
    name: "revit_apply_view_template",
    description: "Apply a view template to one or more views. Lists available templates if the specified one is not found.",
    inputShape: {
      templateName: z.string().describe("Name of the view template to apply"),
      viewIds: z.array(z.number()).optional().describe("View IDs to apply to (default: active view)"),
    },
    bridgeToolName: "apply_view_template",
  }),

  defineTool({
    name: "revit_resolve_warnings",
    description: "List or auto-resolve Revit warnings. Can fix duplicate marks, unenclosed rooms, and overlapping room separations.",
    inputShape: {
      action: z.enum(["list", "resolve"]).optional().describe("'list' to view warnings, 'resolve' to auto-fix (default: 'list')"),
      warningType: z.string().optional().describe("Filter to only resolve warnings containing this text"),
    },
    bridgeToolName: "resolve_warnings",
  }),

  defineTool({
    name: "revit_wall_floor_sync",
    description: "Auto-join all walls and floors that intersect, ensuring proper boundary connections.",
    inputShape: {
      levelName: z.string().optional().describe("Limit to a specific level (default: all levels)"),
    },
    bridgeToolName: "wall_floor_sync",
  }),

  defineTool({
    name: "revit_snap_beams_to_columns",
    description: "Snap beam endpoints to the nearest column centerlines. Fixes misaligned structural framing.",
    inputShape: {
      tolerance: z.number().optional().describe("Max snap distance in feet (default: 2.0)"),
    },
    bridgeToolName: "snap_beams_to_columns",
  }),

  defineTool({
    name: "revit_convert_category",
    description: "Convert elements to a different family/category. Deletes old elements and places new ones at the same location.",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs to convert"),
      targetFamily: z.string().describe("Target family name"),
      targetType: z.string().optional().describe("Target type name (default: first type in family)"),
    },
    bridgeToolName: "convert_category",
  }),

  defineTool({
    name: "revit_add_shared_parameter",
    description: "Inject a shared parameter into a Revit category. Creates the shared parameter file automatically if needed.",
    inputShape: {
      parameterName: z.string().describe("Name of the parameter to add"),
      category: z.string().describe("Category to add parameter to"),
      groupName: z.string().optional().describe("Parameter group name (default: 'Data')"),
      paramType: z.enum(["Text", "Number", "Integer", "Length", "Area", "Volume", "Angle", "YesNo"]).optional().describe("Parameter type (default: 'Text')"),
      isInstance: z.boolean().optional().describe("Instance parameter (true) or Type parameter (false). Default: true"),
    },
    bridgeToolName: "add_shared_parameter",
  }),

  defineTool({
    name: "revit_import_data_from_csv",
    description: "Import data from a CSV file into Revit element parameters. CSV header row = parameter names. Matches elements by a key parameter (e.g. room Number).",
    inputShape: {
      filePath: z.string().describe("Absolute path to the CSV file"),
      category: z.string().optional().describe("Category to match elements in"),
      keyParameter: z.string().optional().describe("Parameter to match CSV rows to elements (default: 'Number'). Use 'Id' for element IDs."),
    },
    bridgeToolName: "import_data_from_csv",
  }),

  defineTool({
    name: "revit_generate_legend",
    description: "Generate a door or window legend — creates a drafting view with a table listing all unique types, dimensions, and counts.",
    inputShape: {
      category: z.enum(["Doors", "Windows"]).optional().describe("Category to generate legend for (default: 'Doors')"),
      legendName: z.string().optional().describe("Name for the legend view"),
    },
    bridgeToolName: "generate_legend",
  }),

  defineTool({
    name: "revit_cad_to_lines",
    description: "Convert CAD imports to native Revit detail lines, arcs, and polylines. Optionally delete the CAD import after conversion.",
    inputShape: {
      importIds: z.array(z.number()).optional().describe("Specific CAD import IDs to convert (default: all non-linked imports)"),
      deleteAfter: z.boolean().optional().describe("Delete the CAD import after conversion (default: false)"),
    },
    bridgeToolName: "cad_to_lines",
  }),

  defineTool({
    name: "revit_batch_get_parameters",
    description: "Batch get parameters for elements.",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs"),
      includeLinks: z.boolean().optional().describe("Include elements from linked models"),
      linkNames: z.array(z.string()).optional().describe("Specific link names to include"),
    },
    bridgeToolName: "batch_get_parameters",
  }),

  defineTool({
    name: "revit_find_elements_by_parameter",
    description: "Find elements by parameter value.",
    inputShape: {
      parameterName: z.string().describe("Parameter name"),
      value: z.string().describe("Parameter value"),
      includeLinks: z.boolean().optional().describe("Include elements from linked models"),
      linkNames: z.array(z.string()).optional().describe("Specific link names to include"),
    },
    bridgeToolName: "find_elements_by_parameter",
  }),

  // ── QA/QC Tools (qaqc_tools.ts) ───────────────────────────────────────────

  defineTool({
    name: "revit_audit_model_standards",
    description: "Audit the active model against a JSON standard set (naming, required parameters, " +
      "line weights, view templates, health, workset assignments, phase compliance, shared parameters). " +
      "Returns a 0-100% compliance score and violation list with BEP clause references. " +
      "Pass fix=true to auto-apply safe fixes in one transaction. " +
      "Pass exportBaseline=true to export the current model's config as a reusable standard. " +
      "Uses the built-in BIM-Bot standard unless `standards`, `standardsPath`, or `standardsUrl` is given.",
    inputShape: {
      standardsPath: z.string().optional().describe(
        "Path to a JSON standards file (same shape as the built-in default)"
      ),
      standardsUrl: z.string().url().optional().describe(
        "URL to load a standards JSON file from (e.g., raw GitHub URL). Fetched with 10s timeout."
      ),
      standards: z.record(z.unknown()).optional().describe(
        "Inline standards object; overrides standardsPath and standardsUrl"
      ),
      fix: z.boolean().optional().describe(
        "Auto-apply safe fixes: fill defaultValue parameters, assign views.defaultTemplate, set line weights, fix worksets, apply phase filters (default: false)"
      ),
      exportBaseline: z.boolean().optional().describe(
        "If true, export the current model's configuration as a reusable standard JSON instead of auditing"
      ),
      outputFormat: z.enum(["html", "json", "pdf"]).optional().describe(
        "html writes a styled report file (default); json returns raw results inline; pdf opens HTML report in browser for Print → Save as PDF"
      ),
      filePath: z.string().optional().describe(
        "Report output path. Default: Desktop/bimbot-audit-<timestamp>.html"
      ),
    },
    bridgeToolName: "audit_model_standards",
  }),

  defineTool({
    name: "revit_check_warnings",
    description: "Get all active warnings in the Revit model. Useful for model cleanup and quality control.",
    inputShape: {
      severity: z.enum(["All", "Error", "Warning"]).optional().describe("Filter by severity (default: All)"),
      includeLinks: z.boolean().optional().describe("Include warnings from linked models"),
    },
    bridgeToolName: "check_warnings",
  }),

  defineTool({
    name: "revit_audit_model",
    description: "Perform a comprehensive model audit: check for orphaned elements, unused families, missing views on sheets, etc.",
    inputShape: {},
    bridgeToolName: "audit_model",
  }),

  defineTool({
    name: "revit_check_room_compliance",
    description: "Check rooms for compliance: minimum area requirements, accessibility, proper naming, and boundary closure.",
    inputShape: {
      minArea: z.number().optional().describe("Minimum room area in square feet"),
      checkAccessibility: z.boolean().optional().describe("Check accessibility compliance (default: false)"),
      checkNaming: z.boolean().optional().describe("Check naming conventions (default: false)"),
    },
    bridgeToolName: "check_room_compliance",
  }),

  defineTool({
    name: "revit_check_naming_conventions",
    description: "Verify that views, sheets, and families follow naming conventions (regex pattern matching).",
    inputShape: {
      category: z.enum(["Views", "Sheets", "Families", "Levels", "All"]).describe("Category to check"),
      pattern: z.string().optional().describe("Regex pattern for valid names (optional)"),
    },
    bridgeToolName: "check_naming_conventions",
  }),

  defineTool({
    name: "revit_find_duplicates",
    description: "Find duplicate elements in the model (overlapping walls, duplicate rooms, etc.).",
    inputShape: {
      category: z.string().describe("Category to check for duplicates, e.g. 'Walls', 'Rooms', 'Doors'"),
      tolerance: z.number().optional().describe("Distance tolerance in feet for considering elements as duplicates (default: 0.01)"),
    },
    bridgeToolName: "find_duplicates",
  }),

  defineTool({
    name: "revit_purge_unused",
    description: "Find and optionally purge unused families, types, and materials from the model.",
    inputShape: {
      dryRun: z.boolean().optional().describe("If true, only lists what would be purged without deleting (default: true)"),
      categories: z.array(z.string()).optional().describe("Specific categories to purge (default: all)"),
    },
    bridgeToolName: "purge_unused",
  }),

  defineTool({
    name: "revit_check_links_status",
    description: "Check the status of all linked models (loaded, unloaded, missing).",
    inputShape: {
      includeLinks: z.boolean().optional().describe("Include sub-links from linked models"),
    },
    bridgeToolName: "check_links_status",
  }),

  defineTool({
    name: "revit_validate_parameters",
    description: "Validate that required parameters are filled in for elements of a specific category.",
    inputShape: {
      category: z.string().describe("Category to validate, e.g. 'Doors', 'Windows', 'Rooms'"),
      requiredParameters: z.array(z.string()).describe("List of parameter names that must have values"),
    },
    bridgeToolName: "validate_parameters",
  }),

  defineTool({
    name: "revit_validate_shared_coordinates",
    description: "Check if all linked models share the same shared coordinate system as the host or a master link. " +
      "Reports per-link offsets (X, Y, Z in mm) and rotation angle. Optionally acquires coordinates from a master link to fix misalignment.",
    inputShape: {
      masterLinkName: z.string().optional().describe("Optional link name to use as the master coordinate reference. If omitted, uses host model coordinates."),
      tolerance: z.number().optional().describe("Coordinate mismatch threshold in mm. Default is 1.0 mm."),
      autoFix: z.boolean().optional().describe("If true, acquires coordinates from the master link to align the host model."),
    },
    bridgeToolName: "validate_shared_coordinates",
  }),

  // ── MEP Tools (mep_tools.ts) ──────────────────────────────────────────────

  defineTool({
    name: "revit_create_duct",
    description: "Create a duct segment between two points. Specify duct type and size.",
    inputShape: {
      startX: z.number().describe("Start X coordinate in feet"),
      startY: z.number().describe("Start Y coordinate in feet"),
      startZ: z.number().describe("Start Z (elevation) in feet"),
      endX: z.number().describe("End X coordinate"),
      endY: z.number().describe("End Y coordinate"),
      endZ: z.number().describe("End Z coordinate"),
      ductType: z.string().optional().describe("Duct type name (default: first available)"),
      width: z.number().optional().describe("Duct width in inches (for rectangular)"),
      height: z.number().optional().describe("Duct height in inches (for rectangular)"),
      diameter: z.number().optional().describe("Duct diameter in inches (for round)"),
      level: z.string().optional().describe("Level name (default: closest level)"),
    },
    bridgeToolName: "create_duct",
  }),

  defineTool({
    name: "revit_create_pipe",
    description: "Create a pipe segment between two points. Specify pipe type and diameter.",
    inputShape: {
      startX: z.number().describe("Start X coordinate in feet"),
      startY: z.number().describe("Start Y coordinate"),
      startZ: z.number().describe("Start Z (elevation) in feet"),
      endX: z.number().describe("End X coordinate"),
      endY: z.number().describe("End Y coordinate"),
      endZ: z.number().describe("End Z coordinate"),
      pipeType: z.string().optional().describe("Pipe type name (default: first available)"),
      diameter: z.number().optional().describe("Pipe diameter in inches"),
      systemType: z.string().optional().describe("System type: 'SupplyHydronicPiping', 'ReturnHydronicPiping', 'DomesticColdWater', etc."),
      level: z.string().optional().describe("Level name (default: closest level)"),
    },
    bridgeToolName: "create_pipe",
  }),

  defineTool({
    name: "revit_create_flex_duct",
    description: "Create a flexible duct from a series of waypoints.",
    inputShape: {
      points: z.array(z.object({
        x: z.number(), y: z.number(), z: z.number(),
      })).describe("Array of waypoints for the flex duct path"),
      ductType: z.string().optional().describe("Flex duct type name"),
      diameter: z.number().optional().describe("Diameter in inches"),
      level: z.string().optional().describe("Level name"),
    },
    bridgeToolName: "create_flex_duct",
  }),

  defineTool({
    name: "revit_create_electrical_circuit",
    description: "Create an electrical circuit from a panel and connected device element IDs.",
    inputShape: {
      panelId: z.number().describe("Element ID of the electrical panel"),
      deviceIds: z.array(z.number()).describe("Element IDs of devices to add to the circuit"),
      circuitType: z.enum(["Power", "Data", "FireAlarm", "Communication"]).optional().describe("Circuit type (default: 'Power')"),
    },
    bridgeToolName: "create_electrical_circuit",
  }),

  defineTool({
    name: "revit_connect_mep_elements",
    description: "Auto-connect two MEP elements by generating appropriate fittings (elbows, tees, transitions).",
    inputShape: {
      elementId1: z.number().describe("First MEP element ID"),
      elementId2: z.number().describe("Second MEP element ID"),
    },
    bridgeToolName: "connect_mep_elements",
  }),

  defineTool({
    name: "revit_get_mep_systems",
    description: "Get all MEP systems in the project (duct, pipe, electrical) with element counts and system info.",
    inputShape: {
      systemType: z.string().optional().describe("Filter by system type: 'Duct', 'Pipe', 'Electrical', or 'All' (default: 'All')"),
    },
    bridgeToolName: "get_mep_systems",
  }),

  defineTool({
    name: "revit_duct_sizing",
    description: "Auto-size ducts based on airflow requirements. Calculates optimal duct dimensions for a given CFM.",
    inputShape: {
      elementIds: z.array(z.number()).optional().describe("Duct element IDs to resize (default: all ducts)"),
      method: z.enum(["EqualFriction", "Velocity", "StaticRegain"]).optional().describe("Sizing method (default: 'EqualFriction')"),
    },
    bridgeToolName: "duct_sizing",
  }),

  defineTool({
    name: "revit_create_mep_space",
    description: "Create an MEP space at a specified location on a level for HVAC analysis.",
    inputShape: {
      levelName: z.string().describe("Level name for the space"),
      x: z.number().optional().describe("X coordinate (default: 0)"),
      y: z.number().optional().describe("Y coordinate (default: 0)"),
      name: z.string().optional().describe("Space name"),
      number: z.string().optional().describe("Space number"),
    },
    bridgeToolName: "create_mep_space",
  }),

  // ── Drafting Tools (drafting_tools.ts) ────────────────────────────────────

  defineTool({
    name: "revit_create_detail_lines",
    description: "Draw detail lines in a drafting or plan view from an array of coordinate pairs. Supports polylines, rectangles, and free-form shapes.",
    inputShape: {
      lines: z.array(z.object({
        startX: z.number().describe("Start X coordinate in feet"),
        startY: z.number().describe("Start Y coordinate in feet"),
        endX: z.number().describe("End X coordinate in feet"),
        endY: z.number().describe("End Y coordinate in feet"),
      })).describe("Array of line segments to draw"),
      lineStyle: z.string().optional().describe("Line style name (default: 'Thin Lines')"),
      viewId: z.number().optional().describe("View ID to draw in (default: active view)"),
    },
    bridgeToolName: "create_detail_lines",
  }),

  defineTool({
    name: "revit_create_model_lines",
    description: "Draw 3D model lines from an array of coordinate pairs. Lines exist in 3D space and are visible in all views.",
    inputShape: {
      lines: z.array(z.object({
        startX: z.number(), startY: z.number(), startZ: z.number().optional(),
        endX: z.number(), endY: z.number(), endZ: z.number().optional(),
      })).describe("Array of 3D line segments"),
      lineStyle: z.string().optional().describe("Line style name"),
    },
    bridgeToolName: "create_model_lines",
  }),

  defineTool({
    name: "revit_create_detail_arc",
    description: "Draw a detail arc in a view. Defined by center point, radius, start angle, and end angle.",
    inputShape: {
      centerX: z.number().describe("Center X coordinate in feet"),
      centerY: z.number().describe("Center Y coordinate in feet"),
      radius: z.number().describe("Arc radius in feet"),
      startAngle: z.number().optional().describe("Start angle in degrees (default: 0)"),
      endAngle: z.number().optional().describe("End angle in degrees (default: 360 for full circle)"),
      lineStyle: z.string().optional().describe("Line style name"),
      viewId: z.number().optional().describe("View ID (default: active view)"),
    },
    bridgeToolName: "create_detail_arc",
  }),

  // ── File Management & Worksharing Tools (file_management_tools.ts) ───────

  defineTool({
    name: "revit_save_document",
    description: "Save the currently active Revit document. Equivalent to Ctrl+S.",
    inputShape: {},
    bridgeToolName: "save_document",
  }),

  defineTool({
    name: "revit_save_as_document",
    description: "Save the active document to a new file path (.rvt). Creates a copy without closing the current document.",
    inputShape: {
      filePath: z.string().describe("Full path for the new file, e.g. 'C:\\\\Projects\\\\MyProject_backup.rvt'"),
      overwrite: z.boolean().optional().describe("Overwrite if file exists (default: false)"),
    },
    bridgeToolName: "save_as_document",
  }),

  defineTool({
    name: "revit_close_document",
    description: "Close the active Revit document. Optionally save before closing.",
    inputShape: {
      save: z.boolean().optional().describe("Save the document before closing (default: true)"),
    },
    bridgeToolName: "close_document",
  }),

  defineTool({
    name: "revit_edit_family",
    description: "Open a family for editing. Takes an element ID of a family instance, opens the family document for editing.",
    inputShape: {
      elementId: z.number().describe("Element ID of a family instance to edit its family"),
    },
    bridgeToolName: "edit_family",
  }),

  defineTool({
    name: "revit_create_family_extrusion",
    description: "Create a solid extrusion in the currently open family document. Defines a rectangular or polygonal profile and extrudes it.",
    inputShape: {
      profilePoints: z.array(z.object({
        x: z.number().describe("X coordinate in feet"),
        y: z.number().describe("Y coordinate in feet"),
      })).describe("Array of 2D profile points defining the extrusion shape (closed loop)"),
      extrusionDepth: z.number().optional().describe("Extrusion depth in feet (default: 1.0)"),
      isSolid: z.boolean().optional().describe("True for solid, false for void (default: true)"),
    },
    bridgeToolName: "create_family_extrusion",
  }),

  defineTool({
    name: "revit_save_family",
    description: "Save the currently open family document and optionally load it back into the project.",
    inputShape: {
      loadIntoProject: z.boolean().optional().describe("Load the family back into the host project after saving (default: true)"),
      overwriteParameters: z.boolean().optional().describe("Overwrite parameter values in the project (default: false)"),
    },
    bridgeToolName: "save_family",
  }),

  defineTool({
    name: "revit_load_family",
    description: "Load a .rfa family file from disk into the current Revit project.",
    inputShape: {
      filePath: z.string().describe("Full path to the .rfa family file"),
      overwriteExisting: z.boolean().optional().describe("Overwrite if family already loaded (default: false)"),
    },
    bridgeToolName: "load_family",
  }),

  defineTool({
    name: "revit_sync_to_central",
    description: "Synchronize the local model with the central model. Equivalent to Revit's 'Synchronize with Central' command.",
    inputShape: {
      comment: z.string().optional().describe("Sync comment for the log"),
      relinquishAll: z.boolean().optional().describe("Relinquish all borrowed elements after sync (default: true)"),
      saveLocalBefore: z.boolean().optional().describe("Save the local file before syncing (default: true)"),
      saveLocalAfter: z.boolean().optional().describe("Save the local file after syncing (default: true)"),
    },
    bridgeToolName: "sync_to_central",
  }),

  defineTool({
    name: "revit_relinquish_all",
    description: "Relinquish all borrowed elements and worksets without syncing. Frees up elements for other users.",
    inputShape: {},
    bridgeToolName: "relinquish_all",
  }),

  defineTool({
    name: "revit_get_worksharing_info",
    description: "Get current worksharing status: central model path, local changes, borrowed elements, workset ownership, and last sync time.",
    inputShape: {},
    bridgeToolName: "get_worksharing_info",
  }),

  // ── Project Settings Tools (settings_tools.ts) ────────────────────────────

  defineTool({
    name: "revit_modify_object_styles",
    description: "Modify the default line weight and color for a Revit category (Object Styles). Affects all elements of that category in the project.",
    inputShape: {
      category: z.string().describe("Category name, e.g. 'Walls', 'Doors', 'Furniture'"),
      subcategory: z.string().optional().describe("Subcategory name (optional)"),
      lineWeight: z.number().optional().describe("Projection line weight (1-16)"),
      colorR: z.number().optional().describe("Line color Red (0-255)"),
      colorG: z.number().optional().describe("Line color Green (0-255)"),
      colorB: z.number().optional().describe("Line color Blue (0-255)"),
    },
    bridgeToolName: "modify_object_styles",
  }),

  defineTool({
    name: "revit_set_phase",
    description: "Assign a construction phase (e.g. Existing, New Construction, Demolition) to elements.",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs to set phase on"),
      phaseName: z.string().describe("Phase name, e.g. 'Existing', 'New Construction'"),
    },
    bridgeToolName: "set_phase",
  }),

  defineTool({
    name: "revit_get_phases",
    description: "List all construction phases available in the Revit project.",
    inputShape: {},
    bridgeToolName: "get_phases",
  }),

  defineTool({
    name: "revit_get_materials",
    description: "List all materials available in the Revit project with their colors and transparency.",
    inputShape: {},
    bridgeToolName: "get_materials",
  }),

  defineTool({
    name: "revit_set_material",
    description: "Assign a material to elements. The material must already exist in the project.",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs to assign material to"),
      materialName: z.string().describe("Name of the material to assign"),
      parameterName: z.string().optional().describe("Specific material parameter to set (default: auto-detect)"),
    },
    bridgeToolName: "set_material",
  }),

  defineTool({
    name: "revit_set_view_properties",
    description: "Modify view settings such as scale, detail level, visual style, discipline, phase, name, and crop box. Works on the active view or a specific view by ID.",
    inputShape: {
      viewId: z.number().optional().describe("View ID (default: active view)"),
      scale: z.number().optional().describe("View scale denominator, e.g. 100 for 1:100"),
      detailLevel: z.enum(["Coarse", "Medium", "Fine"]).optional().describe("View detail level"),
      displayStyle: z.enum(["Wireframe", "HiddenLine", "Shading", "ShadingWithEdges", "Realistic"]).optional().describe("Visual style / display style"),
      discipline: z.enum(["Architectural", "Structural", "Mechanical", "Electrical", "Plumbing", "Coordination"]).optional().describe("View discipline (floor plans only)"),
      phaseName: z.string().optional().describe("Phase to show in this view"),
      viewName: z.string().optional().describe("New name for the view"),
      showCropBox: z.boolean().optional().describe("Enable/disable crop box"),
    },
    bridgeToolName: "set_view_properties",
  }),

  defineTool({
    name: "revit_override_element_in_view",
    description: "Apply graphic overrides to specific elements in the current view. Can change color, line weight, transparency, halftone, or hide elements.",
    inputShape: {
      elementIds: z.array(z.number()).describe("Element IDs to override"),
      colorR: z.number().optional().describe("Override color Red (0-255)"),
      colorG: z.number().optional().describe("Override color Green (0-255)"),
      colorB: z.number().optional().describe("Override color Blue (0-255)"),
      lineWeight: z.number().optional().describe("Override line weight (1-16)"),
      transparency: z.number().optional().describe("Surface transparency (0-100)"),
      halftone: z.boolean().optional().describe("Apply halftone effect"),
      visible: z.boolean().optional().describe("Set to false to hide elements in view"),
    },
    bridgeToolName: "override_element_in_view",
  }),

  defineTool({
    name: "revit_get_line_styles",
    description: "List all line styles available in the Revit project with their line weight and color.",
    inputShape: {},
    bridgeToolName: "get_line_styles",
  }),

  defineTool({
    name: "revit_set_line_style",
    description: "Change the line style of detail lines or model lines in the project.",
    inputShape: {
      elementIds: z.array(z.number()).describe("IDs of line elements to change"),
      lineStyleName: z.string().describe("Name of the target line style"),
    },
    bridgeToolName: "set_line_style",
  }),

  // ── Sketch Editing Tools (sketch_tools.ts) ────────────────────────────────

  defineTool({
    name: "revit_get_sketch",
    description: "Get the sketch profile (boundary curves) of a floor, roof, or ceiling element. Returns the curve loops as coordinate arrays.",
    inputShape: {
      elementId: z.number().describe("Element ID of the floor, roof, or ceiling"),
    },
    bridgeToolName: "get_sketch",
  }),

  defineTool({
    name: "revit_edit_sketch",
    description: "Modify the sketch profile of a floor, roof, or ceiling. Can add lines, remove lines, or move vertices within the sketch.",
    inputShape: {
      elementId: z.number().describe("Element ID of the floor, roof, or ceiling to edit"),
      action: z.enum(["add_line", "remove_line", "move_vertex"]).describe("Type of edit to perform"),
      startPoint: z.object({
        x: z.number(), y: z.number(), z: z.number().optional(),
      }).optional().describe("Start point for add_line, or original position for move_vertex"),
      endPoint: z.object({
        x: z.number(), y: z.number(), z: z.number().optional(),
      }).optional().describe("End point for add_line, or new position for move_vertex"),
      lineIndex: z.number().optional().describe("Line index to remove (for remove_line action)"),
    },
    bridgeToolName: "edit_sketch",
  }),

  defineTool({
    name: "revit_set_sketch_profile",
    description: "Replace the entire sketch profile of a floor, roof, or ceiling with new boundary curves. The new profile must form a closed loop.",
    inputShape: {
      elementId: z.number().describe("Element ID of the floor, roof, or ceiling"),
      profile: z.array(z.object({
        x: z.number().describe("X coordinate in feet"),
        y: z.number().describe("Y coordinate in feet"),
        z: z.number().optional().describe("Z coordinate in feet (default: element's level elevation)"),
      })).describe("Array of points forming the new closed boundary profile"),
    },
    bridgeToolName: "set_sketch_profile",
  }),

  // ── Transfer Tools (transfer_tools.ts) ────────────────────────────────────

  defineTool({
    name: "revit_list_open_documents",
    description: "List all documents currently open in Revit: title, file path, whether it is the active document, and whether it is linked. Use this before any cross-document work to get exact document titles. Works even with no active document.",
    inputShape: {},
    bridgeToolName: "list_open_documents",
  }),

  defineTool({
    name: "revit_activate_document",
    description: "Make one of the already-open Revit documents the active document, so subsequent tools operate on it. This replaces the manual step of clicking between Project A and Project B in the Revit UI.",
    inputShape: {
      documentTitle: z.string().optional().describe(
        "Title of the open document as shown by list_open_documents (e.g. 'ProjectB.rvt')"
      ),
      filePath: z.string().optional().describe(
        "Full file path of the open document (alternative to documentTitle)"
      ),
    },
    bridgeToolName: "activate_document",
  }),

  defineTool({
    name: "revit_export_annotations",
    description: "Export annotations (text notes, tags, dimensions) from a view to a neutral JSON transfer file that import_annotations can recreate in another document. Tags carry their host element's identity for re-attachment; dimensions carry their referenced elements.",
    inputShape: {
      viewId: z.number().optional().describe("Source view element ID (default: active view)"),
      viewName: z.string().optional().describe("Source view name (alternative to viewId)"),
      documentTitle: z.string().optional().describe(
        "Source document title (default: active document)"
      ),
      includeTextNotes: z.boolean().optional().describe("Include text notes (default: true)"),
      includeTags: z.boolean().optional().describe("Include tags (default: true)"),
      includeDimensions: z.boolean().optional().describe("Include dimensions (default: true)"),
      filePath: z.string().optional().describe(
        "Output JSON path. Default: Desktop/annotations-<timestamp>.json"
      ),
    },
    bridgeToolName: "export_annotations",
  }),

  defineTool({
    name: "revit_import_annotations",
    description: "Recreate annotations from an export_annotations JSON file in a target view/document. Text notes are recreated exactly. Tags are re-attached to the matching host element (UniqueId first, then category + level + nearest location); hosts that cannot be matched are listed as skipped. Dimensions are recreated only when all referenced elements resolve in the target. Returns created / skipped / failed counts with reasons.",
    inputShape: {
      filePath: z.string().describe("Path to the JSON transfer file from export_annotations"),
      targetDocumentTitle: z.string().optional().describe(
        "Target document title (default: active document)"
      ),
      targetViewId: z.number().optional().describe("Target view element ID"),
      targetViewName: z.string().optional().describe(
        "Target view name, e.g. 'Level 1' (alternative to targetViewId; required when the target document is not active)"
      ),
      matchTolerance: z.number().optional().describe(
        "Fallback host-matching tolerance in feet (default: 1.0)"
      ),
    },
    bridgeToolName: "import_annotations",
  }),

  defineTool({
    name: "revit_transfer_annotations",
    description: "Copy annotations directly between two open, unlinked Revit documents in one step — no linking, no manual focus switching, no intermediate file. Reads text notes, tags and dimensions from the source view and recreates them in the target view. Same fidelity rules as import_annotations: text notes exact, tags re-attached by host matching, dimensions best-effort. The response reports exactly what transferred and what did not, with reasons.",
    inputShape: {
      sourceDocumentTitle: z.string().optional().describe(
        "Source document title (default: active document)"
      ),
      sourceViewId: z.number().optional().describe("Source view element ID"),
      sourceViewName: z.string().optional().describe(
        "Source view name (required when the source document is not active)"
      ),
      targetDocumentTitle: z.string().optional().describe(
        "Target document title (default: the other open document when exactly two are open)"
      ),
      targetViewId: z.number().optional().describe("Target view element ID"),
      targetViewName: z.string().optional().describe(
        "Target view name, e.g. 'Level 1' (required when the target document is not active; " +
        "defaults to the view with the same name as the source view)"
      ),
      includeTextNotes: z.boolean().optional().describe("Include text notes (default: true)"),
      includeTags: z.boolean().optional().describe("Include tags (default: true)"),
      includeDimensions: z.boolean().optional().describe("Include dimensions (default: true)"),
      matchTolerance: z.number().optional().describe(
        "Fallback host-matching tolerance in feet (default: 1.0)"
      ),
    },
    bridgeToolName: "transfer_annotations",
  }),

  // ── Undo / Transaction Control + UI Automation + Safe Code Execution (transaction_tools.ts)

  defineTool({
    name: "revit_undo_last_operation",
    description: "Undo the last MCP operation. Uses Revit's TransactionGroup rollback to revert the most recent change.",
    inputShape: {},
    bridgeToolName: "undo_last_operation",
  }),

  defineTool({
    name: "revit_create_checkpoint",
    description: "Create a named checkpoint (savepoint). All subsequent operations can be rolled back to this point.",
    inputShape: {
      name: z.string().describe("Checkpoint name for identification, e.g. 'before_mass_edit'"),
    },
    bridgeToolName: "create_checkpoint",
  }),

  defineTool({
    name: "revit_rollback_to_checkpoint",
    description: "Roll back all changes made since a named checkpoint. Reverts the model to the checkpoint state.",
    inputShape: {
      name: z.string().describe("Checkpoint name to roll back to"),
    },
    bridgeToolName: "rollback_to_checkpoint",
  }),

  defineTool({
    name: "revit_post_command",
    description: "Execute a Revit PostableCommand by name. This triggers ribbon commands programmatically (e.g., 'CloseInactiveViews', 'PurgeUnused', 'SwitchTo3DView').",
    inputShape: {
      commandName: z.string().describe("PostableCommand name, e.g. 'CloseInactiveViews', 'PurgeUnused', 'SwitchJoinOrder', 'Undo', 'Redo'"),
    },
    bridgeToolName: "post_command",
  }),

  defineTool({
    name: "revit_list_commands",
    description: "List all available Revit PostableCommand names that can be used with post_command.",
    inputShape: {},
    bridgeToolName: "list_commands",
  }),

  defineTool({
    name: "revit_preview_code",
    description: "Compile C# code WITHOUT executing it. Returns compilation success/errors to validate code before running. Use this to check code safety before send_code_to_revit.",
    inputShape: {
      code: z.string().describe("C# code to validate (same format as send_code_to_revit)"),
    },
    bridgeToolName: "preview_code",
  }),

  // ── Rendering & View Settings Tools (rendering_tools.ts) ──────────────────

  defineTool({
    name: "revit_set_sun_settings",
    description: "Configure sun position and shadow settings for the active 3D view. Controls sun azimuth, altitude, and shadow on/off.",
    inputShape: {
      azimuth: z.number().optional().describe("Sun azimuth angle in degrees (0-360, 0=North)"),
      altitude: z.number().optional().describe("Sun altitude angle in degrees (0-90)"),
      shadowsOn: z.boolean().optional().describe("Enable or disable shadows"),
      date: z.string().optional().describe("Date for sun study in YYYY-MM-DD format"),
      time: z.string().optional().describe("Time for sun study in HH:MM format (24h)"),
      viewId: z.number().optional().describe("View ID (default: active view)"),
    },
    bridgeToolName: "set_sun_settings",
  }),

  defineTool({
    name: "revit_set_visual_style",
    description: "Set the visual/display style of a view (Wireframe, Hidden Line, Shaded, Consistent Colors, Realistic, RayTrace).",
    inputShape: {
      style: z.enum(["Wireframe", "HiddenLine", "Shaded", "ShadingWithEdges", "Realistic", "RayTrace"]).describe("Display style to apply"),
      viewId: z.number().optional().describe("View ID (default: active view)"),
    },
    bridgeToolName: "set_visual_style",
  }),

  defineTool({
    name: "revit_export_view_image",
    description: "Export the current or specified view as a PNG/JPG image at a given resolution.",
    inputShape: {
      filePath: z.string().describe("Output file path (e.g. 'C:\\\\Output\\\\view.png')"),
      format: z.enum(["PNG", "JPG", "BMP", "TIFF"]).optional().describe("Image format (default: 'PNG')"),
      resolution: z.number().optional().describe("Image resolution/DPI (default: 150)"),
      pixelWidth: z.number().optional().describe("Image width in pixels (default: 1920)"),
      pixelHeight: z.number().optional().describe("Image height in pixels (default: 1080)"),
      viewId: z.number().optional().describe("View ID to export (default: active view)"),
    },
    bridgeToolName: "export_view_image",
  }),

  // ── BIM Dashboard Tools (bim_dashboard_tools.ts) ──────────────────────────
  // NOTE: these three orchestrate several bridge calls client-side (export_elements /
  // read_project_file / write_project_file / show_bim_dashboard) plus a compliance-analysis
  // engine that runs entirely in the Node layer rather than a single C# handler. bridgeToolName
  // below is the call tied to each tool's distinctive action; see the final report for detail.

  defineTool({
    name: "revit_generate_bim_dashboard",
    description: "Analyse the current Revit model for BEP/MIDP compliance and open the native BIM Compliance Dashboard window inside Revit. Extracts elements from all configured categories, analyses naming conventions, required parameters, and LOD compliance.",
    inputShape: {
      categories: z.array(z.string()).optional().describe(
        "Override category list (default: uses bep_config.json categories)"
      ),
    },
    bridgeToolName: "show_bim_dashboard",
  }),

  defineTool({
    name: "revit_configure_bep_midp",
    description: "Save or update the BEP/MIDP configuration for the current project. Defines naming conventions, required parameters per category, LOD requirements, and the list of categories to audit.",
    inputShape: {
      projectName: z.string().optional().describe("Project name"),
      bepVersion: z.string().optional().describe("BEP version (default: 1.0)"),
      midpVersion: z.string().optional().describe("MIDP version (default: 1.0)"),
      categories: z.array(z.string()).optional().describe("Categories to audit"),
      requiredParameters: z.record(z.array(z.string())).optional().describe(
        "Required parameters per category, e.g. { Walls: ['Mark','Fire Rating'] }"
      ),
      namingConventions: z.record(z.string()).optional().describe(
        "Regex patterns for naming, e.g. { families: '^[A-Z]{3}_.*$' }"
      ),
    },
    bridgeToolName: "write_project_file",
  }),

  defineTool({
    name: "revit_validate_bep_compliance",
    description: "Quick BEP compliance check — returns a text summary without generating the full dashboard. Useful for fast spot-checks on specific categories.",
    inputShape: {
      category: z.string().describe("Revit category to validate, e.g. 'Walls', 'Doors'"),
    },
    bridgeToolName: "export_elements",
  }),

  // ── Federated Query Tools (federated_query_tools.ts) ──────────────────────

  defineTool({
    name: "revit_get_federation_summary",
    description: "Returns dashboard of host + all links.",
    inputShape: {},
    bridgeToolName: "get_federation_summary",
  }),

  defineTool({
    name: "revit_query_across_links",
    description: "Cross-model element query.",
    inputShape: {
      category: z.string().optional().describe("Element category"),
      linkNames: z.array(z.string()).optional().describe("Names of links to query"),
      includeHost: z.boolean().optional().default(true).describe("Include host model"),
      includeParameters: z.boolean().optional().describe("Include all parameters"),
      parameterFilter: z.string().optional().describe("Filter string, e.g. 'Fire Rating=2 HR'"),
      offset: z.number().optional().describe("Pagination offset"),
      limit: z.number().optional().default(200).describe("Pagination limit"),
    },
    bridgeToolName: "query_across_links",
  }),

  defineTool({
    name: "revit_get_link_element_details",
    description: "Full parameter dump of a linked element.",
    inputShape: {
      namespacedId: z.string().describe("Namespaced ID, e.g. 'STR-Link:12345'"),
    },
    bridgeToolName: "get_link_element_details",
  }),

  defineTool({
    name: "revit_compare_link_levels",
    description: "Detect level name/elevation mismatches across all models.",
    inputShape: {},
    bridgeToolName: "compare_link_levels",
  }),

  defineTool({
    name: "revit_find_cross_link_spatial_containment",
    description: "Maps linked equipment to host rooms.",
    inputShape: {
      equipmentCategory: z.string().optional().default("Mechanical Equipment").describe("Equipment category"),
      sourceLinkName: z.string().optional().describe("Source link name"),
    },
    bridgeToolName: "find_cross_link_spatial_containment",
  }),

  // ── Model Health Tools (model_health_tools.ts) ────────────────────────────

  defineTool({
    name: "revit_audit_federated_model_health",
    description: "Audit federated model health.",
    inputShape: {
      scope: z.string().optional().default("all").describe("Scope: 'host_only', 'selected_links', 'all'"),
      linkNames: z.array(z.string()).optional().describe("Selected link names"),
      severityThreshold: z.string().optional().describe("Severity threshold: 'critical', 'moderate', 'all'"),
    },
    bridgeToolName: "audit_federated_model_health",
  }),

  defineTool({
    name: "revit_heal_model_issues",
    description: "Heal model issues like unplaced rooms or CAD imports.",
    inputShape: {
      actions: z.array(z.string()).describe("Actions: 'pin_datums', 'purge_cad_imports', 'clean_unplaced_rooms'"),
      dryRun: z.boolean().optional().default(false).describe("Dry run mode"),
    },
    bridgeToolName: "heal_model_issues",
  }),

  defineTool({
    name: "revit_generate_remediation_report",
    description: "Generate a remediation report.",
    inputShape: {
      linkName: z.string().describe("Link name"),
      format: z.string().optional().default("txt").describe("Format: 'txt', 'csv'"),
    },
    bridgeToolName: "generate_remediation_report",
  }),

  // ── IDS Validation Tools (ids_validation_tools.ts) ────────────────────────

  defineTool({
    name: "revit_validate_ids_spec",
    description: "Validate IDS spec against model.",
    inputShape: {
      idsXmlContent: z.string().optional().describe("IDS XML Content"),
      idsFilePath: z.string().optional().describe("IDS file path"),
      scope: z.string().optional().describe("Scope: 'host_only', 'selected_links', 'all'"),
      discipline: z.string().optional().describe("Discipline to validate"),
    },
    bridgeToolName: "validate_ids_spec",
  }),

  defineTool({
    name: "revit_audit_iso19650_naming",
    description: "Audit ISO19650 naming convention.",
    inputShape: {
      targetType: z.string().describe("Target type: 'sheets'|'views'|'worksets'|'families'|'levels'|'links'"),
      pattern: z.string().optional().describe("Optional override regex pattern"),
      includeLinks: z.boolean().optional().describe("Include links in audit"),
    },
    bridgeToolName: "audit_iso19650_naming",
  }),

  // ── Clash / BCF Tools (clash_bcf_tools.ts) ────────────────────────────────

  defineTool({
    name: "revit_run_smart_clash_triage",
    description: "Run smart clash triage.",
    inputShape: {
      sourceCategory: z.string().describe("Source category"),
      targetCategory: z.string().describe("Target category"),
      sourceLink: z.string().optional().describe("Source link name or 'Host'"),
      targetLink: z.string().optional().describe("Target link name"),
      levelName: z.string().optional().describe("Level name filter"),
      toleranceMm: z.number().optional().default(25).describe("Tolerance in mm"),
    },
    bridgeToolName: "run_smart_clash_triage",
  }),

  defineTool({
    name: "revit_export_bcf_issues",
    description: "Export BCF issues.",
    inputShape: {
      issues: z.array(z.object({
        title: z.string(),
        description: z.string(),
        elementIds: z.array(z.number()),
      })).describe("List of issues to export"),
      outputFilePath: z.string().describe("Output file path"),
      bcfVersion: z.string().optional().default("2.1").describe("BCF version ('2.1' or '3.0')"),
    },
    bridgeToolName: "export_bcf_issues",
  }),

  // ── Model Diff Tools (model_diff_tools.ts) ────────────────────────────────

  defineTool({
    name: "revit_diff_linked_milestones",
    description: "Diff linked milestones.",
    inputShape: {
      linkInstanceName: z.string().describe("Link instance name"),
      baselineSnapshotPath: z.string().optional().describe("Baseline snapshot path"),
      saveSnapshot: z.boolean().optional().default(false).describe("Save snapshot flag"),
    },
    bridgeToolName: "diff_linked_milestones",
  }),

  // ── Family Sanitizer Tools (family_sanitizer_tools.ts) ───────────────────

  defineTool({
    name: "revit_audit_and_clean_family",
    description: "Audit and clean family.",
    inputShape: {
      familyFilePath: z.string().optional().describe("Family file path"),
      fix: z.boolean().optional().default(false).describe("Apply fixes flag"),
      maxPolygonCount: z.number().optional().default(10000).describe("Max polygon count"),
    },
    bridgeToolName: "audit_and_clean_family",
  }),

  // ── COBie Handover Tools (cobie_handover_tools.ts) ────────────────────────

  defineTool({
    name: "revit_enrich_cross_link_cobie",
    description: "Enrich cross link COBie.",
    inputShape: {
      mepCategory: z.string().optional().default("Mechanical Equipment").describe("MEP category"),
      sourceLinkName: z.string().optional().describe("Source link name"),
      targetHostRoomPhase: z.string().optional().describe("Target host room phase"),
    },
    bridgeToolName: "enrich_cross_link_cobie",
  }),
] as const;
