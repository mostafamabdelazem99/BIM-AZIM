using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using Tekla.Structures.Model;

namespace BimAzim.TeklaBridge.Tools
{
    public sealed class SelectionTools
    {
        private readonly TeklaConnection _connection;

        public SelectionTools(TeklaConnection connection) => _connection = connection;

        public object GetSelectedObjects(JObject args)
        {
            var raw = _connection.GetSelectedRaw();
            var items = new List<object>();
            foreach (ModelObject obj in raw)
            {
                items.Add(PropertyHelpers.Summarize(obj));
            }

            if (items.Count == 0)
                throw new ToolException("Nothing is currently selected in Tekla Structures.");

            return new { count = items.Count, objects = items };
        }

        public object SelectByFilter(JObject args)
        {
            _connection.RequireConnected();

            var objectType = (string)args["objectType"] ?? "ANY";
            var namePattern = (string)args["namePattern"];
            int? phaseNumber = args["phaseNumber"]?.ToObject<int>();

            var matches = new List<ModelObject>();
            var enumerator = _connection.Model.GetModelObjectSelector().GetAllObjects();
            // VERIFY: broad "get all objects" enumeration can be slow on large models — consider
            // Model.GetModelObjectSelector().GetObjectsByFilterName(savedFilterName) instead for
            // production use, once you've confirmed the saved-filter workflow for your version.
            while (enumerator.MoveNext())
            {
                var obj = enumerator.Current;

                bool typeMatches = objectType == "ANY"
                    || (objectType == "BEAM" && obj is Beam)
                    || (objectType == "COLUMN" && obj is Beam)
                    || (objectType == "CONTOURPLATE" && obj is ContourPlate)
                    || (objectType == "BOLT" && obj is BoltArray)
                    || (objectType == "WELD" && obj is Weld)
                    || (objectType == "ASSEMBLY" && obj is Assembly);

                if (!typeMatches) continue;

                if (namePattern != null)
                {
                    object nameValue = null;
                    obj.GetReportProperty("NAME", ref nameValue);
                    var name = nameValue as string ?? "";
                    if (!name.ToLowerInvariant().Contains(namePattern.ToLowerInvariant())) continue;
                }

                if (phaseNumber.HasValue)
                {
                    object phaseValue = null;
                    obj.GetReportProperty("PHASE_NUMBER", ref phaseValue);
                    if (phaseValue == null || System.Convert.ToInt32(phaseValue) != phaseNumber.Value) continue;
                }

                matches.Add(obj);
            }

            var selector = new Tekla.Structures.Model.UI.ModelObjectSelector();
            var list = new System.Collections.ArrayList(matches);
            selector.Select(list);

            return new
            {
                count = matches.Count,
                objects = matches.Take(200).Select(PropertyHelpers.Summarize).ToList(),
                truncated = matches.Count > 200,
            };
        }

        public object GetPartProperties(JObject args)
        {
            var guids = args["guids"]?.ToObject<string[]>() ?? new string[0];
            if (guids.Length == 0) throw new ToolException("At least one GUID is required.");

            var results = guids.Select(guid => PropertyHelpers.Summarize(_connection.GetByGuid(guid))).ToList();
            return new { objects = results };
        }

        public object GetAssemblies(JObject args)
        {
            _connection.RequireConnected();
            int? phaseNumber = args["phaseNumber"]?.ToObject<int>();

            var assemblies = new List<object>();
            // VERIFY: the enum for GetAllObjectsWithType is ModelObject.ModelObjectEnum in some Tekla
            // versions and a standalone ModelObjectEnum in others — adjust to whichever your installed
            // Open API reference shows.
            var enumerator = _connection.Model.GetModelObjectSelector().GetAllObjectsWithType(ModelObject.ModelObjectEnum.ASSEMBLY);
            while (enumerator.MoveNext())
            {
                if (!(enumerator.Current is Assembly assembly)) continue;

                if (phaseNumber.HasValue)
                {
                    object phaseValue = null;
                    assembly.GetReportProperty("PHASE_NUMBER", ref phaseValue);
                    if (phaseValue == null || System.Convert.ToInt32(phaseValue) != phaseNumber.Value) continue;
                }

                var summary = PropertyHelpers.Summarize(assembly);
                try
                {
                    var subAssemblies = assembly.GetSubAssemblies();
                    summary["subAssemblyCount"] = subAssemblies?.GetSize() ?? 0;
                }
                catch { /* VERIFY: GetSubAssemblies()/GetSize() naming for your Tekla version */ }

                assemblies.Add(summary);
            }

            return new { count = assemblies.Count, assemblies };
        }
    }
}
