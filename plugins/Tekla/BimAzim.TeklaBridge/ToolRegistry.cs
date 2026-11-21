using BimAzim.TeklaBridge.Tools;

namespace BimAzim.TeklaBridge
{
    /// <summary>Wires every tool name the MCP server's tools/tekla.ts expects to its handler method.</summary>
    public static class ToolRegistry
    {
        public static void RegisterAll(JsonHttpServer server, TeklaConnection connection)
        {
            var modelInfo = new ModelInfoTools(connection);
            var selection = new SelectionTools(connection);
            var create = new CreateTools(connection);
            var edit = new EditTools(connection);
            var numberingExport = new NumberingExportTools(connection);
            var interference = new InterferenceTools(connection);

            server.RegisterTool("get_model_info", modelInfo.GetModelInfo);

            server.RegisterTool("get_selected_objects", selection.GetSelectedObjects);
            server.RegisterTool("select_by_filter", selection.SelectByFilter);
            server.RegisterTool("get_part_properties", selection.GetPartProperties);
            server.RegisterTool("get_assemblies", selection.GetAssemblies);

            server.RegisterTool("create_beam", create.CreateBeam);
            server.RegisterTool("create_contour_plate", create.CreateContourPlate);

            server.RegisterTool("move_part", edit.MovePart);
            server.RegisterTool("modify_part", edit.ModifyPart);
            server.RegisterTool("delete_objects", edit.DeleteObjects);

            server.RegisterTool("run_numbering", numberingExport.RunNumbering);
            server.RegisterTool("export_ifc", numberingExport.ExportIfc);
            server.RegisterTool("push_to_trimble_connect", numberingExport.PushToTrimbleConnect);

            server.RegisterTool("check_interference", interference.CheckInterference);
        }
    }
}
