import { z } from "zod";
import { defineTool } from "./types.js";

/**
 * Navisworks Manage tool catalog. Ported from BIM-Bot's revit-mcp-server (navis_*_tools.ts files),
 * which forwarded each tool 1:1 to a Navisworks plugin add-in over a TCP bridge (default port 8091).
 * Every tool here keeps that same `bridgeToolName` — the command string BIM-Bot sent over that bridge —
 * so the BIM-AZIM Navisworks plugin can implement the same contract. The plugin implementation itself
 * (the add-in that answers these commands) is being ported separately; this file only carries the
 * MCP-facing schemas (name, description, input shape) and the bridge command each one maps to.
 *
 * Skipped on purpose (not ported here):
 *  - navis_dashboard_tools.ts (navis_dashboard_catalog/list/get/create/update/delete/export): Power BI /
 *    .pbit dashboard export — out of scope per the porting brief (dashboard/PowerBI export tools excluded).
 *  - navis_ai_tools.ts (navis_ai_chat, navis_ai_analyze_clashes, navis_ai_generate_plugin_code): wraps
 *    BIM-Bot's Gemini AI service — out of scope per the porting brief (AI chat integration tools excluded).
 */

// Shared fragments (mirrors the shared consts in BIM-Bot's navis_extended_tools.ts).
const xyz = z.array(z.number()).length(3);
const rgb = z.array(z.number()).length(3).describe("[r,g,b] as 0-1 or 0-255");
const ids = z.array(z.string()).optional().describe("ModelItem displayIds from navis_search_items (default: current selection)");
const clashSelection = z.object({
  selectionSets: z.array(z.string()).optional().describe("Selection/search set names or GUIDs"),
  displayIds: z.array(z.string()).optional().describe("ModelItem displayIds"),
  useCurrentSelection: z.boolean().optional(),
  selfIntersect: z.boolean().optional(),
});
const taskFields = {
  name: z.string().optional(),
  displayId: z.string().optional().describe("Task ID column"),
  plannedStart: z.string().optional().describe("ISO date, e.g. 2026-03-01"),
  plannedEnd: z.string().optional(),
  actualStart: z.string().optional(),
  actualEnd: z.string().optional(),
  taskType: z.string().optional().describe("Construct / Demolish / Temporary (or a custom type)"),
  progressPercent: z.number().optional(),
  materialCost: z.number().optional(),
  laborCost: z.number().optional(),
  selectionSet: z.string().optional().describe("Attach a selection/search set"),
  displayIds: z.array(z.string()).optional().describe("Attach explicit ModelItems"),
  attachCurrentSelection: z.boolean().optional(),
};
const captureSizeArgs = {
  width: z.number().optional().describe("Image width in pixels, 320–2560 (default 1280)"),
  height: z.number().optional().describe("Image height in pixels, 240–1600 (default 720)"),
  format: z.enum(["jpeg", "png"]).optional().describe("jpeg (default, smaller) or png"),
};

export const navisworksTools = [
  // ── reading / connection (navis_reading_tools.ts) ──

  defineTool({
    name: "navis_get_model_info",
    description: "Get Navisworks Manage model info: file name, units, model count, saved viewpoint count. Requires Navisworks Manage with BIM-Bot service ON (port 8091).",
    inputShape: {},
    bridgeToolName: "navis_get_model_info",
  }),

  defineTool({
    name: "navis_search_items",
    description:
      "Search the Navisworks model for items whose property value contains searchText (case-insensitive). " +
      "Returns displayIds like 'p:0/3/12' that navis_select_items, navis_zoom_to_items, navis_hide_items, " +
      "navis_override_color, navis_get_item_properties and the other displayIds tools accept " +
      "(valid until models are removed or reloaded). Each search scans every item on the Navisworks UI thread: " +
      "on large federated models Navisworks freezes for several seconds, so reuse returned displayIds instead of " +
      "re-searching, and use withinSelection to search only under the current selection.",
    inputShape: {
      searchText: z.string().describe("Text the property value must contain, e.g. 'Walls', 'Level 1', 'Pipe'"),
      searchProperty: z.string().optional().describe(
        "Name (Item>Name, default) | Category (Revit Element>Category, falls back to Item>Type) | " +
        "Class (Item>Type) | Material (Item>Material) | 'Tab>Property', e.g. 'Element>Mark'. " +
        "Use navis_get_item_properties on one item to see its tabs."),
      limit: z.number().optional().describe("Max items to return (default 100); 'count' reports all matches"),
      withinSelection: z.boolean().optional().describe("Search only the current Navisworks selection and its children (much faster on big models)"),
    },
    bridgeToolName: "navis_search_items",
  }),

  defineTool({
    name: "navis_get_selected",
    description: "Get currently selected ModelItems in Navisworks.",
    inputShape: {},
    bridgeToolName: "navis_get_selected",
  }),

  defineTool({
    name: "navis_select_items",
    description: "Select ModelItems in Navisworks by displayIds ('p:...' values from navis_search_items or navis_get_selected).",
    inputShape: { displayIds: z.array(z.string()).describe("Navisworks ModelItem display IDs") },
    bridgeToolName: "navis_select_items",
  }),

  defineTool({
    name: "navis_viewpoints_list",
    description: "List saved viewpoints. Each has a 'ref' like 'vp:12' — use it to pick a viewpoint, because names can repeat and many GUIDs are empty.",
    inputShape: {},
    bridgeToolName: "navis_viewpoints_list",
  }),

  defineTool({
    name: "navis_viewpoint_apply",
    description: "Apply a saved viewpoint by ref (e.g. 'vp:12' from navis_viewpoints_list, preferred), name or GUID.",
    inputShape: { viewpoint: z.string().describe("Viewpoint ref (vp:N), name or GUID") },
    bridgeToolName: "navis_viewpoint_apply",
  }),

  defineTool({
    name: "navis_viewpoint_save",
    description: "Save the current Navisworks view as a named viewpoint.",
    inputShape: { name: z.string().describe("New viewpoint name") },
    bridgeToolName: "navis_viewpoint_save",
  }),

  defineTool({
    name: "navis_get_selection_sets",
    description: "List selection sets and search sets in the Navisworks document.",
    inputShape: {},
    bridgeToolName: "navis_get_selection_sets",
  }),

  defineTool({
    name: "navis_connection_status",
    description: "Diagnose the Navisworks connection: checks Navisworks is running, the BIM-Bot plugin is installed, the handshake file, the TCP port and a live ping. Returns a verdict and a fix hint. Safe to call when Navisworks is closed.",
    inputShape: {},
    bridgeToolName: "navis_connection_status",
  }),

  // ── Clash Detective basics (navis_clash_tools.ts) — ADDITIVE-ONLY, Manage only. ──

  defineTool({
    name: "navis_list_clash_tests",
    description: "List Clash Detective tests in Navisworks Manage (name, GUID, status, clash count).",
    inputShape: {},
    bridgeToolName: "navis_list_clash_tests",
  }),

  defineTool({
    name: "navis_run_clash_test",
    description: "Run a Clash Detective test by name or GUID in Navisworks Manage.",
    inputShape: {
      test: z.string().describe("Clash test name or GUID"),
      testType: z.enum(["Hard", "HardConservative", "Duplicates", "Clearance"]).optional().describe("Override test type"),
    },
    bridgeToolName: "navis_run_clash_test",
  }),

  defineTool({
    name: "navis_get_clash_results",
    description: "Get clash results for a test (up to limit). Each result includes IDs, status, distance, and involved ModelItems.",
    inputShape: {
      test: z.string().describe("Clash test name or GUID"),
      limit: z.number().optional().describe("Max results (default 100)"),
      statusFilter: z.string().optional().describe("Filter: New/Active/Reviewed/Approved/Resolved (default all)"),
    },
    bridgeToolName: "navis_get_clash_results",
  }),

  defineTool({
    name: "navis_set_clash_status",
    description: "Set status (New/Active/Reviewed/Approved/Resolved) on clash results.",
    inputShape: {
      test: z.string().describe("Clash test name or GUID"),
      clashIds: z.array(z.string()).describe("Clash result IDs"),
      status: z.enum(["New", "Active", "Reviewed", "Approved", "Resolved"]).describe("New status"),
    },
    bridgeToolName: "navis_set_clash_status",
  }),

  defineTool({
    name: "navis_export_clash_report",
    description: "Export a clash test report to HTML/XML in Navisworks Manage.",
    inputShape: {
      test: z.string().describe("Clash test name or GUID"),
      folder: z.string().optional().describe("Output folder (default: next to the NWD)"),
      format: z.enum(["HTML", "XML"]).optional().describe("Report format (default HTML)"),
    },
    bridgeToolName: "navis_export_clash_report",
  }),

  // ── federation + appearance (navis_federation_tools.ts) ──

  defineTool({
    name: "navis_append_file",
    description: "Append a model file (NWC/NWD/NWF/RVT/IFC) into the federated Navisworks document. Use after Revit export_to_nwc.",
    inputShape: { filePath: z.string().describe("Full path to the file to append") },
    bridgeToolName: "navis_append_file",
  }),

  defineTool({
    name: "navis_export_nwd",
    description: "Save/publish the federated Navisworks document as NWD (or NWF).",
    inputShape: {
      filePath: z.string().optional().describe("Output path (default: overwrite current NWF with same-name NWD)"),
      includeProperties: z.boolean().optional().describe("Embed properties (default true)"),
    },
    bridgeToolName: "navis_export_nwd",
  }),

  defineTool({
    name: "navis_override_color",
    description: "Apply a temporary color/transparency override to ModelItems (by display ID).",
    inputShape: {
      displayIds: z.array(z.string()).describe("ModelItem display IDs"),
      r: z.number().describe("Red 0-1"),
      g: z.number().describe("Green 0-1"),
      b: z.number().describe("Blue 0-1"),
      transparency: z.number().optional().describe("0 opaque – 1 transparent (default 0)"),
    },
    bridgeToolName: "navis_override_color",
  }),

  defineTool({
    name: "navis_hide_items",
    description: "Hide ModelItems (by display ID). Pass unhide=true to unhide.",
    inputShape: {
      displayIds: z.array(z.string()).describe("ModelItem display IDs"),
      unhide: z.boolean().optional().describe("Unhide instead of hide"),
    },
    bridgeToolName: "navis_hide_items",
  }),

  // ── extended: view / display (navis_extended_tools.ts) ──

  defineTool({
    name: "navis_set_view_style",
    description: "Change Navisworks display settings for the current view: render style, lighting and camera projection.",
    inputShape: {
      renderStyle: z.enum(["FullRender", "Preview", "Shaded", "Wireframe", "HiddenLine"]).optional(),
      lighting: z.enum(["None", "SceneLights", "Headlight", "FullLights"]).optional(),
      projection: z.enum(["Perspective", "Orthographic"]).optional(),
    },
    bridgeToolName: "navis_set_view_style",
  }),

  defineTool({
    name: "navis_set_background",
    description: "Set the Navisworks viewport background: plain (1 color), graduated (top, bottom) or horizon (sky, horizon sky, horizon ground, ground).",
    inputShape: {
      mode: z.enum(["plain", "graduated", "horizon"]).optional().describe("Default plain"),
      colors: z.array(rgb).min(1).max(4),
    },
    bridgeToolName: "navis_set_background",
  }),

  defineTool({
    name: "navis_get_grids",
    description: "List Navisworks grid systems, their levels and the current grid render mode.",
    inputShape: {},
    bridgeToolName: "navis_get_grids",
  }),

  defineTool({
    name: "navis_set_grids",
    description: "Change grids & levels display: active grid system, which levels are shown (render mode) or lock to a level.",
    inputShape: {
      activeSystem: z.string().optional().describe("Grid system name (see navis_get_grids)"),
      renderMode: z.enum(["AboveAndBelow", "Above", "Below", "All", "Locked"]).optional(),
      lockedLevel: z.string().optional().describe("Level name to lock grids to (sets renderMode=Locked)"),
    },
    bridgeToolName: "navis_set_grids",
  }),

  defineTool({
    name: "navis_section",
    description: "Section planes / section box in the current view. action=box fits a section box around items (or min/max); get returns the clipping JSON; set applies raw clipping JSON (edit what get returns for planes); clear turns sectioning off.",
    inputShape: {
      action: z.enum(["get", "set", "box", "clear"]),
      displayIds: ids,
      min: xyz.optional().describe("Box min corner (instead of items)"),
      max: xyz.optional().describe("Box max corner"),
      padding: z.number().optional().describe("Extra margin around the box, model units"),
      json: z.any().optional().describe("Clipping-plane JSON for action=set"),
    },
    bridgeToolName: "navis_section",
  }),

  // ── extended: camera (navis_extended_tools.ts) ──

  defineTool({
    name: "navis_get_camera",
    description: "Get the current Navisworks camera: position, projection, field of view, model units and full camera JSON.",
    inputShape: {},
    bridgeToolName: "navis_get_camera",
  }),

  defineTool({
    name: "navis_set_camera",
    description: "Move the Navisworks camera: position, look-at target, world up, vertical field of view (radians), projection, or a full camera JSON from navis_get_camera.",
    inputShape: {
      position: xyz.optional(),
      target: xyz.optional().describe("Point to look at"),
      up: xyz.optional().describe("World up vector"),
      verticalFieldOfView: z.number().optional(),
      projection: z.enum(["Perspective", "Orthographic"]).optional(),
      camera: z.any().optional().describe("Camera JSON (as returned by navis_get_camera.camera)"),
    },
    bridgeToolName: "navis_set_camera",
  }),

  defineTool({
    name: "navis_zoom_to_items",
    description: "Zoom the Navisworks view to fit items (by displayIds or the current selection) and optionally select them.",
    inputShape: { displayIds: ids, select: z.boolean().optional().describe("Also select the items (default true)") },
    bridgeToolName: "navis_zoom_to_items",
  }),

  defineTool({
    name: "navis_view_preset",
    description: "Orient the Navisworks camera to a standard view of the whole model.",
    inputShape: { preset: z.enum(["top", "bottom", "front", "back", "left", "right", "iso", "home"]) },
    bridgeToolName: "navis_view_preset",
  }),

  // ── extended: TimeLiner (4D) (navis_extended_tools.ts) ──

  defineTool({
    name: "navis_timeliner_list_tasks",
    description: "List TimeLiner (4D) tasks with dates, type, status, progress and attached items; also returns available task types.",
    inputShape: { limit: z.number().optional().describe("Default 500") },
    bridgeToolName: "navis_timeliner_list_tasks",
  }),

  defineTool({
    name: "navis_timeliner_add_task",
    description: "Add a TimeLiner task (optionally under a parent task) with dates, type and attached model items/sets.",
    inputShape: { ...taskFields, name: z.string(), parent: z.string().optional().describe("Parent task name or ID") },
    bridgeToolName: "navis_timeliner_add_task",
  }),

  defineTool({
    name: "navis_timeliner_update_task",
    description: "Edit a TimeLiner task: rename, change dates/type/progress/costs, or re-attach items.",
    inputShape: { task: z.string().describe("Task name or ID"), ...taskFields },
    bridgeToolName: "navis_timeliner_update_task",
  }),

  defineTool({
    name: "navis_timeliner_delete_task",
    description: "Delete a TimeLiner task (and its child tasks).",
    inputShape: { task: z.string().describe("Task name or ID") },
    bridgeToolName: "navis_timeliner_delete_task",
  }),

  // ── extended: clash test authoring (navis_extended_tools.ts) ──

  defineTool({
    name: "navis_create_clash_test",
    description: "Create a Clash Detective test from selection/search sets or items, with type and tolerance (model units); optionally run it.",
    inputShape: {
      name: z.string(),
      selectionA: clashSelection,
      selectionB: clashSelection,
      testType: z.enum(["Hard", "HardConservative", "Clearance", "Duplicates"]).optional().describe("Default Hard"),
      tolerance: z.number().optional().describe("Model units"),
      mergeComposites: z.boolean().optional(),
      run: z.boolean().optional().describe("Run immediately"),
    },
    bridgeToolName: "navis_create_clash_test",
  }),

  defineTool({
    name: "navis_update_clash_test",
    description: "Edit an existing clash test: rename, change type/tolerance, or replace selection A/B.",
    inputShape: {
      test: z.string().describe("Clash test name or GUID"),
      newName: z.string().optional(),
      selectionA: clashSelection.optional(),
      selectionB: clashSelection.optional(),
      testType: z.enum(["Hard", "HardConservative", "Clearance", "Duplicates"]).optional(),
      tolerance: z.number().optional(),
      mergeComposites: z.boolean().optional(),
    },
    bridgeToolName: "navis_update_clash_test",
  }),

  defineTool({
    name: "navis_delete_clash_test",
    description: "Delete a Clash Detective test and its results.",
    inputShape: { test: z.string().describe("Clash test name or GUID") },
    bridgeToolName: "navis_delete_clash_test",
  }),

  defineTool({
    name: "navis_edit_clash_results",
    description: "Assign clash results, set description/approved-by, or add a comment to them.",
    inputShape: {
      test: z.string(),
      clashIds: z.array(z.string()),
      assignedTo: z.string().optional(),
      description: z.string().optional(),
      approvedBy: z.string().optional(),
      comment: z.string().optional(),
      author: z.string().optional(),
    },
    bridgeToolName: "navis_edit_clash_results",
  }),

  // ── extended: measurements / redlines / comments (navis_extended_tools.ts) ──

  defineTool({
    name: "navis_measure",
    description: "Measure in Navisworks: distance between two items (center-to-center plus bounding-box clearance), between two points, or read the user's current Measure-tool result when no args are given.",
    inputShape: {
      displayIdA: z.string().optional(),
      displayIdB: z.string().optional(),
      pointA: xyz.optional(),
      pointB: xyz.optional(),
    },
    bridgeToolName: "navis_measure",
  }),

  defineTool({
    name: "navis_get_redlines",
    description: "Get the redline markups (text, lines, clouds…) on the current Navisworks view as JSON.",
    inputShape: {},
    bridgeToolName: "navis_get_redlines",
  }),

  defineTool({
    name: "navis_set_redlines",
    description: "Replace the redlines on the current view with JSON (start from navis_get_redlines output). Optionally save the view + redlines as a viewpoint.",
    inputShape: {
      json: z.any().describe("Redline JSON"),
      saveViewpointAs: z.string().optional(),
    },
    bridgeToolName: "navis_set_redlines",
  }),

  defineTool({
    name: "navis_add_comment",
    description: "Add a comment to a saved viewpoint, selection set, or clash result.",
    inputShape: {
      target: z.enum(["viewpoint", "selectionSet", "clashResult"]),
      id: z.string().describe("Name or GUID of the viewpoint / set / clash result"),
      test: z.string().optional().describe("Clash test (required for clashResult)"),
      body: z.string(),
      status: z.enum(["New", "Active", "Approved", "Resolved"]).optional(),
      author: z.string().optional(),
    },
    bridgeToolName: "navis_add_comment",
  }),

  defineTool({
    name: "navis_list_comments",
    description: "List comments on a saved viewpoint, selection set, or clash result.",
    inputShape: {
      target: z.enum(["viewpoint", "selectionSet", "clashResult"]),
      id: z.string(),
      test: z.string().optional(),
    },
    bridgeToolName: "navis_list_comments",
  }),

  // ── extended: selection / search sets & properties (navis_extended_tools.ts) ──

  defineTool({
    name: "navis_create_selection_set",
    description: "Save a static selection set from displayIds or the current selection.",
    inputShape: { name: z.string(), displayIds: ids },
    bridgeToolName: "navis_create_selection_set",
  }),

  defineTool({
    name: "navis_create_search_set",
    description: "Create a dynamic search set (Find Items). Conditions are ANDed, e.g. [{category:'Element', property:'Category', operator:'equals', value:'Ducts'}].",
    inputShape: {
      name: z.string(),
      conditions: z.array(z.object({
        category: z.string().optional().describe("Property tab, e.g. Item, Element, Revit Type (default Item)"),
        property: z.string().optional().describe("Property name (default Name)"),
        operator: z.enum(["contains", "equals", "notEquals", "wildcard", "exists"]).optional(),
        value: z.string().optional(),
        ignoreCase: z.boolean().optional(),
      })).min(1),
    },
    bridgeToolName: "navis_create_search_set",
  }),

  defineTool({
    name: "navis_manage_selection_set",
    description: "Delete, rename, select, or list the items of a selection/search set.",
    inputShape: {
      set: z.string().describe("Set name or GUID"),
      action: z.enum(["delete", "rename", "select", "items"]),
      newName: z.string().optional(),
      limit: z.number().optional(),
    },
    bridgeToolName: "navis_manage_selection_set",
  }),

  defineTool({
    name: "navis_get_item_properties",
    description: "Read all property tabs/values of items (Selection Inspector / Properties window).",
    inputShape: {
      displayIds: ids,
      category: z.string().optional().describe("Only this property tab"),
      limit: z.number().optional().describe("Max items (default 20)"),
    },
    bridgeToolName: "navis_get_item_properties",
  }),

  defineTool({
    name: "navis_set_user_properties",
    description: "Add or edit user-defined item properties on a custom tab (keeps other keys; a null value deletes a key). remove=true drops the whole tab.",
    inputShape: {
      displayIds: ids,
      tabName: z.string().optional().describe("Default 'BIM-Bot'"),
      properties: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
      remove: z.boolean().optional(),
    },
    bridgeToolName: "navis_set_user_properties",
  }),

  // ── extended: code (navis_extended_tools.ts) ──

  defineTool({
    name: "navis_execute_code",
    description: "Compile and run a C# method body inside Navisworks (C# 5 syntax, .NET Framework). Variable 'doc' is the active Autodesk.Navisworks.Api.Document; usings for Api, Clash and Timeliner are included. 'return' a value to get it back. Use for anything the other navis_* tools don't cover.",
    inputShape: {
      code: z.string().describe("C# statements, e.g. return doc.Models.Count;"),
      description: z.string().optional(),
    },
    bridgeToolName: "navis_execute_code",
  }),

  // ── view capture (navis_capture_tools.ts) — returns MCP image content so the AI can see the view ──

  defineTool({
    name: "navis_capture_view",
    description:
      "Capture an image of the Navisworks 3D view so you can SEE the model. Optionally apply a saved " +
      "viewpoint first, or zoom to displayIds (from navis_search_items) first. Use it to check what a " +
      "clash, section, color override or hide actually looks like. The view stays where it was moved " +
      "unless restore=true.",
    inputShape: {
      viewpoint: z.string().optional().describe("Saved viewpoint to apply first: its ref from navis_viewpoints_list (e.g. 'vp:12', preferred — names can repeat), or its name or GUID"),
      displayIds: z.array(z.string()).optional().describe("Zoom to these items first; they are painted orange and, by default, everything else is hidden for the capture (see context)"),
      select: z.boolean().optional().describe("Also select the items in Navisworks (default true). Selection is not drawn in the image — the orange colour is."),
      restore: z.boolean().optional().describe("Put the camera back after capturing (default false)"),
      highlight: z.boolean().optional().describe("Paint the displayIds items orange in the image (default true; reset after capture)"),
      context: z.enum(["isolate", "fade", "none"]).optional().describe(
        "With displayIds: isolate (default, fast) = show only those items; fade = everything else see-through " +
        "(slow on big models); none = leave as is. Restored after capture."),
      ...captureSizeArgs,
    },
    bridgeToolName: "navis_capture_view",
  }),

  defineTool({
    name: "navis_capture_clash",
    description:
      "Zoom to one clash result, capture an image with item1 in red and item2 in green, with the rest of " +
      "the model hidden by default so walls don't block the view (colours and visibility are restored afterwards), " +
      "and return the image plus both items' details (displayId, name, revitElementId, revitCategory). " +
      "Get test names from navis_list_clash_tests and clashIds from navis_get_clash_results.",
    inputShape: {
      test: z.string().describe("Clash test name or GUID"),
      clashId: z.string().describe("Clash result GUID (id from navis_get_clash_results) or its name"),
      highlight: z.boolean().optional().describe("Colour item1 red and item2 green in the image (default true; reset after capture)"),
      context: z.enum(["isolate", "fade", "none"]).optional().describe(
        "What to do with the rest of the model so nothing blocks the clash: isolate (default, fast) = show only " +
        "the two items; fade = everything else see-through (shows surroundings, can take a minute on big models); " +
        "none = leave as is. Restored after capture."),
      seeThroughSecond: z.boolean().optional().describe("Draw the green item 50% see-through so a red item inside it is visible (default true)"),
      ...captureSizeArgs,
    },
    bridgeToolName: "navis_capture_clash",
  }),

  defineTool({
    name: "navis_export_clash_snapshots",
    description:
      "Save a red/green, isolated JPEG of every clash in a clash test to a folder, plus clashes.csv " +
      "(clash, status, distance, both items, image file). About 1 s per image; max 250 images per call — " +
      "for more, tell the user to use the 'Clash Snapshots' button in Navisworks (Add-ins tab). " +
      "Default folder: Documents\\BIM-Bot Clash Snapshots\\<test>_<date>.",
    inputShape: {
      test: z.string().describe("Clash test name or GUID (from navis_list_clash_tests)"),
      statusFilter: z.string().optional().describe("open (default: New + Active) | all | New | Active | Reviewed | Approved | Resolved"),
      maxImages: z.number().optional().describe("Max images, 1–250 (default 100)"),
      folder: z.string().optional().describe("Output folder (default: Documents\\BIM-Bot Clash Snapshots\\<test>_<date>)"),
      width: z.number().optional().describe("Image width in pixels, 320–2560 (default 1280)"),
      height: z.number().optional().describe("Image height in pixels, 240–1600 (default 720)"),
    },
    bridgeToolName: "navis_export_clash_snapshots",
  }),

  // ── Navisworks <-> Revit bridge (navis_revit_bridge_tools.ts) ──
  // These orchestrate both engine connections server-side (Navisworks on 8091, Revit on 8080) rather
  // than forwarding a single call, so bridgeToolName here names the composite operation the plugin side
  // must implement, not a single pre-existing primitive — except revit_selection_to_navis and
  // navis_clash_handoff_table, whose core result comes from one clear underlying Navisworks command
  // (navis_find_by_revit_ids / navis_list_clash_pairs respectively), which is preserved below.

  defineTool({
    name: "navis_clash_to_revit",
    description:
      "Take one Navisworks clash, read the Revit Element IDs of both clashing items, work out which Revit " +
      "document each ID belongs to (IDs are only unique per Revit file), then select the right elements in " +
      "Revit and zoom to the first. Returns a per-item decision table. Needs Navisworks AND Revit open. " +
      "Get clashIds from navis_get_clash_results.",
    inputShape: {
      test: z.string().describe("Clash test name or GUID"),
      clashId: z.string().describe("Clash result GUID or name"),
      zoom: z.boolean().optional().describe("Zoom Revit to the first selected element (default true)"),
      isolate: z.boolean().optional().describe("Isolate the selected elements in the Revit view (default false)"),
      activateDocument: z.boolean().optional().describe(
        "If no item belongs to the active Revit document but they all belong to one other open document, " +
        "switch Revit to it first (default true)"),
    },
    bridgeToolName: "navis_clash_to_revit",
  }),

  defineTool({
    name: "revit_selection_to_navis",
    description:
      "Take the elements currently selected in Revit and find, select and zoom to the same elements in " +
      "Navisworks. Only Navisworks models whose source file matches the active Revit document are searched " +
      "(Revit IDs are only unique per file). Max 50 elements (the first 50 are used).",
    inputShape: {
      zoom: z.boolean().optional().describe("Zoom Navisworks to the found items (default true)"),
      slot: z.string().optional().describe("Bridge slave slot to read the selection from, e.g. '02' (needed when several Revit slaves joined)"),
      sourceFile: z.string().optional().describe(
        "Override which Navisworks model to search (NWC/RVT file name). Default: the active Revit document's title. " +
        "Pass '*' to search every model."),
    },
    bridgeToolName: "navis_find_by_revit_ids",
  }),

  defineTool({
    name: "navis_bridge_status",
    description:
      "Show the manual BIM-Bot bridge session: the Navisworks master (federated file and its models) and the " +
      "Revit slaves that joined (slot, document, model). Lists models with no slave yet, so you can tell the " +
      "user which Revit files to open and join.",
    inputShape: {},
    bridgeToolName: "navis_bridge_status",
  }),

  defineTool({
    name: "navis_refresh_models",
    description:
      "Reload changed model files in Navisworks (like Home > Refresh), e.g. after re-exporting an NWC from " +
      "Revit. If this Navisworks version does not allow it from a plugin, says so — then click Refresh by hand.",
    inputShape: {},
    bridgeToolName: "navis_refresh_models",
  }),

  defineTool({
    name: "navis_recheck_clash",
    description:
      "Re-run a clash test and report whether one clash is now resolved (status before -> after). Use it " +
      "after fixing the elements in Revit, re-exporting the NWC and refreshing (navis_refresh_models or Home > Refresh).",
    inputShape: {
      test: z.string().describe("Clash test name or GUID"),
      clashId: z.string().describe("Clash result GUID or name to check"),
    },
    bridgeToolName: "navis_recheck_clash",
  }),

  defineTool({
    name: "navis_clash_handoff_table",
    description:
      "List clashes of a test as Revit element-ID pairs grouped by source-file pair, ready to hand to each " +
      "discipline (e.g. 'Arch.nwc vs MEP.nwc: 42 clashes'). Optionally also writes a CSV file.",
    inputShape: {
      test: z.string().describe("Clash test name or GUID"),
      statusFilter: z.string().optional().describe("Only this status: New | Active | Reviewed | Approved | Resolved"),
      limit: z.number().optional().describe("Max clashes (default 200, max 1000)"),
      csvPath: z.string().optional().describe("Absolute path of a .csv file to write (its folder must exist), e.g. C:\\Temp\\clashes.csv"),
    },
    bridgeToolName: "navis_list_clash_pairs",
  }),
] as const;
