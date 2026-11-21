using System.Linq;
using Newtonsoft.Json.Linq;
using Tekla.Structures.Geometry3d;
using Tekla.Structures.Model;

namespace BimAzim.TeklaBridge.Tools
{
    public sealed class EditTools
    {
        private readonly TeklaConnection _connection;

        public EditTools(TeklaConnection connection) => _connection = connection;

        public object MovePart(JObject args)
        {
            var guids = args["guids"].ToObject<string[]>();
            var delta = PropertyHelpers.JsonToPoint(args["delta"].ToObject<double[]>());
            var moved = 0;

            foreach (var guid in guids)
            {
                var obj = _connection.GetByGuid(guid);

                if (obj is Beam beam)
                {
                    beam.StartPoint = new Point(beam.StartPoint.X + delta.X, beam.StartPoint.Y + delta.Y, beam.StartPoint.Z + delta.Z);
                    beam.EndPoint = new Point(beam.EndPoint.X + delta.X, beam.EndPoint.Y + delta.Y, beam.EndPoint.Z + delta.Z);
                    if (!beam.Modify()) throw new ToolException($"Beam.Modify() failed for GUID {guid}.");
                    moved++;
                }
                else if (obj is ContourPlate plate)
                {
                    var newContour = new Contour();
                    foreach (ContourPoint cp in plate.Contour.ContourPoints)
                    {
                        var p = cp.Point;
                        newContour.AddContourPoint(new ContourPoint(new Point(p.X + delta.X, p.Y + delta.Y, p.Z + delta.Z), cp.Chamfer));
                    }
                    plate.Contour = newContour;
                    if (!plate.Modify()) throw new ToolException($"ContourPlate.Modify() failed for GUID {guid}.");
                    moved++;
                }
                else
                {
                    throw new ToolException($"tekla_move_part only supports Beam/Column and ContourPlate right now (GUID {guid} is a {obj.GetType().Name}).");
                }
            }

            _connection.Commit();
            return new { moved };
        }

        public object ModifyPart(JObject args)
        {
            var guids = args["guids"].ToObject<string[]>();
            var profile = (string)args["profile"];
            var material = (string)args["material"];
            var className = (string)args["className"];
            var name = (string)args["name"];
            int? phaseNumber = args["phaseNumber"]?.ToObject<int>();

            var modified = 0;
            foreach (var guid in guids)
            {
                var obj = _connection.GetByGuid(guid);
                if (!(obj is Part part))
                    throw new ToolException($"GUID {guid} ({obj.GetType().Name}) is not a Part and can't be modified by this tool.");

                if (profile != null) part.Profile.ProfileString = profile;
                if (material != null) part.Material.MaterialString = material;
                if (className != null) part.Class = className;
                if (name != null) part.Name = name;
                if (phaseNumber.HasValue)
                {
                    // VERIFY: setting phase via Part.AssemblyPhase / Part.PartPhase (naming differs by version);
                    // some versions require Phase lookup by number rather than direct assignment.
                    part.AssemblyPhase = new Phase { PhaseNumber = phaseNumber.Value };
                }

                if (!part.Modify()) throw new ToolException($"Part.Modify() failed for GUID {guid}.");
                modified++;
            }

            _connection.Commit();
            return new { modified };
        }

        public object DeleteObjects(JObject args)
        {
            var guids = args["guids"].ToObject<string[]>();
            var deleted = guids.Select(guid =>
            {
                var obj = _connection.GetByGuid(guid);
                if (!obj.Delete()) throw new ToolException($"ModelObject.Delete() failed for GUID {guid}.");
                return guid;
            }).ToList();

            _connection.Commit();
            return new { deletedCount = deleted.Count, deleted };
        }
    }
}
