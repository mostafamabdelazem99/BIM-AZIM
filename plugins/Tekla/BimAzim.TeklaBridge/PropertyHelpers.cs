using System.Collections.Generic;
using Tekla.Structures.Geometry3d;
using Tekla.Structures.Model;

namespace BimAzim.TeklaBridge
{
    /// <summary>Shared helpers for turning Tekla ModelObjects into plain JSON-friendly dictionaries.</summary>
    internal static class PropertyHelpers
    {
        public static object PointToJson(Point p) => new { x = p.X, y = p.Y, z = p.Z };

        public static Point JsonToPoint(double[] xyz) => new Point(xyz[0], xyz[1], xyz[2]);

        /// <summary>Generic summary common to every ModelObject — type, GUID, and a few report properties
        /// that exist across most part types. Safe to call on any object; missing properties are omitted.</summary>
        public static Dictionary<string, object> Summarize(ModelObject obj)
        {
            var result = new Dictionary<string, object>
            {
                ["guid"] = TeklaConnection.GuidOf(obj),
                ["type"] = obj.GetType().Name,
            };

            TryAddReportProperty(obj, "NAME", "name", result);
            TryAddReportProperty(obj, "PROFILE", "profile", result);
            TryAddReportProperty(obj, "MATERIAL", "material", result);
            TryAddReportProperty(obj, "CLASS", "className", result);
            TryAddReportProperty(obj, "PHASE_NUMBER", "phaseNumber", result);
            TryAddReportProperty(obj, "ASSEMBLY_POS", "assemblyPosition", result);
            TryAddReportProperty(obj, "PART_POS", "partPosition", result);

            if (obj is Part part)
            {
                try
                {
                    var solid = part.GetSolid();
                    result["boundingBox"] = new
                    {
                        min = PointToJson(solid.MinimumPoint),
                        max = PointToJson(solid.MaximumPoint),
                    };
                }
                catch
                {
                    // GetSolid() can legitimately fail for malformed/unbuilt geometry — omit boundingBox rather than fail the whole call.
                }
            }

            if (obj is Beam beam)
            {
                result["startPoint"] = PointToJson(beam.StartPoint);
                result["endPoint"] = PointToJson(beam.EndPoint);
            }

            return result;
        }

        private static void TryAddReportProperty(ModelObject obj, string teklaName, string jsonName, Dictionary<string, object> result)
        {
            try
            {
                object value = null;
                // VERIFY: ModelObject.GetReportProperty(string, ref object) is the standard way to read
                // the same values Tekla's report/template engine sees — confirm property name spelling
                // for your version (some are version- or template-dependent, e.g. ASSEMBLY_POS vs ASSEMBLY_POS_CAST).
                if (obj.GetReportProperty(teklaName, ref value) && value != null)
                {
                    result[jsonName] = value;
                }
            }
            catch
            {
                // Property not applicable to this object type — skip silently, this is expected and common.
            }
        }
    }
}
