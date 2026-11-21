using Newtonsoft.Json.Linq;
using Tekla.Structures.Geometry3d;
using Tekla.Structures.Model;

namespace BimAzim.TeklaBridge.Tools
{
    public sealed class CreateTools
    {
        private readonly TeklaConnection _connection;

        public CreateTools(TeklaConnection connection) => _connection = connection;

        public object CreateBeam(JObject args)
        {
            _connection.RequireConnected();

            var start = PropertyHelpers.JsonToPoint(args["startPoint"].ToObject<double[]>());
            var end = PropertyHelpers.JsonToPoint(args["endPoint"].ToObject<double[]>());
            var profile = (string)args["profile"];
            var material = (string)(args["material"] ?? "S355JR");
            var name = (string)(args["name"] ?? "BEAM");
            var className = (string)args["className"];

            if (string.IsNullOrWhiteSpace(profile))
                throw new ToolException("profile is required, e.g. \"HEA200\".");

            var beam = new Beam(start, end)
            {
                Profile = { ProfileString = profile },
                Material = { MaterialString = material },
                Name = name,
            };
            if (!string.IsNullOrEmpty(className)) beam.Class = className;

            if (!beam.Insert())
                throw new ToolException("Tekla rejected the new beam (Beam.Insert() returned false). Check the profile/material strings are valid for this model's catalogs.");

            _connection.Commit();

            return new { guid = TeklaConnection.GuidOf(beam) };
        }

        public object CreateContourPlate(JObject args)
        {
            _connection.RequireConnected();

            var pointsRaw = args["points"].ToObject<double[][]>();
            if (pointsRaw.Length < 3)
                throw new ToolException("At least 3 points are required to define a contour plate.");

            var profile = (string)args["profile"];
            var material = (string)(args["material"] ?? "S355JR");
            var name = (string)(args["name"] ?? "PLATE");

            if (string.IsNullOrWhiteSpace(profile))
                throw new ToolException("profile is required, e.g. \"PL10\".");

            var contour = new Contour();
            foreach (var xyz in pointsRaw)
            {
                // VERIFY: ContourPoint(Point, Chamfer) — passing null for an unchamfered corner is the
                // common pattern, confirm the constructor overload exists as-is in your version.
                contour.AddContourPoint(new ContourPoint(PropertyHelpers.JsonToPoint(xyz), null));
            }

            var plate = new ContourPlate
            {
                Contour = contour,
                Profile = { ProfileString = profile },
                Material = { MaterialString = material },
                Name = name,
            };

            if (!plate.Insert())
                throw new ToolException("Tekla rejected the new contour plate (ContourPlate.Insert() returned false). Check the point order is planar and non-self-intersecting.");

            _connection.Commit();

            return new { guid = TeklaConnection.GuidOf(plate) };
        }
    }
}
