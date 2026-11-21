using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;
using Tekla.Structures.Model;

namespace BimAzim.TeklaBridge.Tools
{
    /// <summary>
    /// A lightweight, Navisworks-free clash check: compares axis-aligned bounding boxes of parts.
    /// Not a substitute for real solid-to-solid clash detection, but useful as a cheap sanity pass
    /// on a structural model without needing a separate Navisworks seat.
    /// </summary>
    public sealed class InterferenceTools
    {
        private readonly TeklaConnection _connection;

        public InterferenceTools(TeklaConnection connection) => _connection = connection;

        public object CheckInterference(JObject args)
        {
            _connection.RequireConnected();
            var guids = args["guids"]?.ToObject<string[]>();
            var tolerance = (double)(args["tolerance"] ?? 0.0);

            var parts = new List<(string Guid, Tekla.Structures.Geometry3d.Point Min, Tekla.Structures.Geometry3d.Point Max)>();

            IEnumerable<ModelObject> source;
            if (guids != null && guids.Length > 0)
            {
                source = guids.Select(g => _connection.GetByGuid(g));
            }
            else
            {
                var list = new List<ModelObject>();
                var enumerator = _connection.Model.GetModelObjectSelector().GetAllObjectsWithType(ModelObject.ModelObjectEnum.PART);
                while (enumerator.MoveNext()) list.Add(enumerator.Current);
                source = list;
            }

            foreach (var obj in source)
            {
                if (!(obj is Part part)) continue;
                Tekla.Structures.Model.Solid solid;
                try { solid = part.GetSolid(); }
                catch { continue; }
                parts.Add((TeklaConnection.GuidOf(part), solid.MinimumPoint, solid.MaximumPoint));
            }

            var clashes = new List<object>();
            for (var i = 0; i < parts.Count; i++)
            {
                for (var j = i + 1; j < parts.Count; j++)
                {
                    var a = parts[i];
                    var b = parts[j];
                    if (BoxesOverlap(a.Min, a.Max, b.Min, b.Max, tolerance))
                    {
                        clashes.Add(new { guidA = a.Guid, guidB = b.Guid });
                    }
                }
            }

            return new { checkedParts = parts.Count, clashCount = clashes.Count, clashes };
        }

        private static bool BoxesOverlap(
            Tekla.Structures.Geometry3d.Point aMin, Tekla.Structures.Geometry3d.Point aMax,
            Tekla.Structures.Geometry3d.Point bMin, Tekla.Structures.Geometry3d.Point bMax,
            double tolerance)
        {
            return Overlap1d(aMin.X, aMax.X, bMin.X, bMax.X, tolerance)
                && Overlap1d(aMin.Y, aMax.Y, bMin.Y, bMax.Y, tolerance)
                && Overlap1d(aMin.Z, aMax.Z, bMin.Z, bMax.Z, tolerance);
        }

        private static bool Overlap1d(double aMin, double aMax, double bMin, double bMax, double tolerance)
        {
            return aMin <= bMax - tolerance && bMin <= aMax - tolerance;
        }
    }
}
