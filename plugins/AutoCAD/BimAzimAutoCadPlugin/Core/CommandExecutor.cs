using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.Geometry;
using Newtonsoft.Json.Linq;
using AcApp = Autodesk.AutoCAD.ApplicationServices.Core.Application;

namespace BimAzimAutoCadPlugin.Core
{
    /// <summary>
    /// Dispatches BIM-AZIM commands against the active AutoCAD document.
    ///
    /// Threading: AutoCAD's document database may only be touched from the document's own
    /// execution context. Document.ExecuteInCommandContextAsync (added for exactly this kind of
    /// out-of-process automation) marshals the callback there safely, which is why this class
    /// doesn't need Revit's ExternalEvent-style queue — AutoCAD's own API already gives us the
    /// equivalent primitive.
    /// </summary>
    public static class CommandExecutor
    {
        public static Task<JToken> ExecuteAsync(string method, JObject parameters)
        {
            if (string.Equals(method, "ping", StringComparison.OrdinalIgnoreCase))
                return Task.FromResult(Ping());

            return AcadEventManager.EnqueueAsync(method, parameters);
        }

        private static JToken Ping()
        {
            var doc = AcApp.DocumentManager.MdiActiveDocument;
            return new JObject
            {
                ["version"] = AcApp.Version.ToString(),
                ["documentOpen"] = doc != null,
                ["documentName"] = doc?.Name ?? ""
            };
        }

        public static JToken Dispatch(Document doc, string method, JObject p)
        {
            var db = doc.Database;
            switch (method)
            {
                case "autocad_get_model_info": return GetModelInfo(doc, db);
                case "autocad_get_layers": return GetLayers(db);
                case "autocad_create_layer": return CreateLayer(db, p);
                case "autocad_set_layer_properties": return SetLayerProperties(db, p);
                case "autocad_get_entities": return GetEntities(db, p);
                case "autocad_get_selected_entities": return GetSelectedEntities(doc);
                case "autocad_create_line": return CreateLine(db, p);
                case "autocad_create_circle": return CreateCircle(db, p);
                case "autocad_create_polyline": return CreatePolyline(db, p);
                case "autocad_create_text": return CreateText(db, p);
                case "autocad_create_block_reference": return CreateBlockReference(db, p);
                case "autocad_get_blocks": return GetBlocks(db);
                case "autocad_move_entity": return MoveEntity(db, p);
                case "autocad_rotate_entity": return RotateEntity(db, p);
                case "autocad_delete_entities": return DeleteEntities(db, p);
                case "autocad_get_layouts": return GetLayouts(db);
                case "autocad_get_drawing_variables": return GetDrawingVariables(doc, p);
                case "autocad_zoom_extents": return ZoomExtents(doc);
                case "autocad_send_command": return SendCommand(doc, p);
                case "autocad_export_dwg": return ExportDwg(doc, p);
                case "recap_list_point_clouds": return RecapListPointClouds(db);
                default:
                    throw new InvalidOperationException($"Unknown command: {method}");
            }
        }

        // ── Model / document ────────────────────────────────────────────────

        private static JToken GetModelInfo(Document doc, Database db)
        {
            return new JObject
            {
                ["name"] = doc.Name,
                ["units"] = db.Insunits.ToString(),
                ["currentLayer"] = db.Clayer.ToString(),
                ["currentSpace"] = db.TileMode ? "ModelSpace" : "PaperSpace",
                ["drawingExtentsMin"] = PointToJson(db.Extmin),
                ["drawingExtentsMax"] = PointToJson(db.Extmax),
            };
        }

        private static JToken GetDrawingVariables(Document doc, JObject p)
        {
            var names = (p["names"] as JArray)?.Select(t => t.ToString()).ToArray()
                        ?? new[] { "DWGNAME", "INSUNITS", "CLAYER", "DIMSCALE" };
            var result = new JObject();
            foreach (var name in names)
            {
                try { result[name] = JToken.FromObject(AcApp.GetSystemVariable(name)); }
                catch (Exception ex) { result[name] = $"error: {ex.Message}"; }
            }
            return result;
        }

        private static JToken ZoomExtents(Document doc)
        {
            doc.SendStringToExecute("_.ZOOM _Extents ", true, false, false);
            return new JObject { ["ok"] = true };
        }

        private static JToken SendCommand(Document doc, JObject p)
        {
            var command = p["command"]?.ToString()
                ?? throw new ArgumentException("command is required — a raw AutoCAD command-line string, e.g. \"_.CIRCLE 0,0 5 \"");
            doc.SendStringToExecute(command.EndsWith(" ") ? command : command + " ", true, false, true);
            return new JObject { ["ok"] = true, ["sent"] = command };
        }

        private static JToken ExportDwg(Document doc, JObject p)
        {
            var path = p["path"]?.ToString() ?? throw new ArgumentException("path is required");
            doc.Database.SaveAs(path, doc.Database.OriginalFileVersion);
            return new JObject { ["ok"] = true, ["path"] = path };
        }

        // ── Layers ───────────────────────────────────────────────────────────

        private static JToken GetLayers(Database db)
        {
            var layers = new JArray();
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var table = (LayerTable)tr.GetObject(db.LayerTableId, OpenMode.ForRead);
                foreach (ObjectId id in table)
                {
                    var layer = (LayerTableRecord)tr.GetObject(id, OpenMode.ForRead);
                    layers.Add(new JObject
                    {
                        ["name"] = layer.Name,
                        ["colorIndex"] = layer.Color.ColorIndex,
                        ["isFrozen"] = layer.IsFrozen,
                        ["isLocked"] = layer.IsLocked,
                        ["isOff"] = layer.IsOff,
                    });
                }
                tr.Commit();
            }
            return new JObject { ["layers"] = layers };
        }

        private static JToken CreateLayer(Database db, JObject p)
        {
            var name = p["name"]?.ToString() ?? throw new ArgumentException("name is required");
            var colorIndex = (short)(p["colorIndex"]?.Value<int>() ?? 7);

            using (var tr = db.TransactionManager.StartTransaction())
            {
                var table = (LayerTable)tr.GetObject(db.LayerTableId, OpenMode.ForRead);
                if (table.Has(name))
                {
                    tr.Commit();
                    return new JObject { ["ok"] = true, ["alreadyExisted"] = true, ["name"] = name };
                }

                table.UpgradeOpen();
                var record = new LayerTableRecord
                {
                    Name = name,
                    Color = Autodesk.AutoCAD.Colors.Color.FromColorIndex(Autodesk.AutoCAD.Colors.ColorMethod.ByAci, colorIndex)
                };
                table.Add(record);
                tr.AddNewlyCreatedDBObject(record, true);
                tr.Commit();
                return new JObject { ["ok"] = true, ["name"] = name };
            }
        }

        private static JToken SetLayerProperties(Database db, JObject p)
        {
            var name = p["name"]?.ToString() ?? throw new ArgumentException("name is required");
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var table = (LayerTable)tr.GetObject(db.LayerTableId, OpenMode.ForRead);
                if (!table.Has(name)) throw new InvalidOperationException($"Layer '{name}' does not exist.");

                var record = (LayerTableRecord)tr.GetObject(table[name], OpenMode.ForWrite);
                if (p["frozen"] != null) record.IsFrozen = p["frozen"]!.Value<bool>();
                if (p["locked"] != null) record.IsLocked = p["locked"]!.Value<bool>();
                if (p["off"] != null) record.IsOff = p["off"]!.Value<bool>();
                if (p["colorIndex"] != null)
                    record.Color = Autodesk.AutoCAD.Colors.Color.FromColorIndex(
                        Autodesk.AutoCAD.Colors.ColorMethod.ByAci, (short)p["colorIndex"]!.Value<int>());

                tr.Commit();
                return new JObject { ["ok"] = true, ["name"] = name };
            }
        }

        // ── Entities: query ──────────────────────────────────────────────────

        private static JToken GetEntities(Database db, JObject p)
        {
            var layerFilter = p["layer"]?.ToString();
            var limit = p["limit"]?.Value<int>() ?? 200;
            var entities = new JArray();

            using (var tr = db.TransactionManager.StartTransaction())
            {
                var blockTable = (BlockTable)tr.GetObject(db.BlockTableId, OpenMode.ForRead);
                var modelSpace = (BlockTableRecord)tr.GetObject(blockTable[BlockTableRecord.ModelSpace], OpenMode.ForRead);

                foreach (ObjectId id in modelSpace)
                {
                    if (entities.Count >= limit) break;
                    var ent = (Entity)tr.GetObject(id, OpenMode.ForRead);
                    if (layerFilter != null && !string.Equals(ent.Layer, layerFilter, StringComparison.OrdinalIgnoreCase)) continue;
                    entities.Add(EntitySummary(ent));
                }
                tr.Commit();
            }
            return new JObject { ["entities"] = entities, ["count"] = entities.Count };
        }

        private static JToken GetSelectedEntities(Document doc)
        {
            var result = doc.Editor.SelectImplied();
            var entities = new JArray();
            if (result.Status == Autodesk.AutoCAD.EditorInput.PromptStatus.OK)
            {
                using (var tr = doc.Database.TransactionManager.StartTransaction())
                {
                    foreach (var id in result.Value.GetObjectIds())
                    {
                        var ent = (Entity)tr.GetObject(id, OpenMode.ForRead);
                        entities.Add(EntitySummary(ent));
                    }
                    tr.Commit();
                }
            }
            return new JObject { ["entities"] = entities, ["count"] = entities.Count };
        }

        private static JObject EntitySummary(Entity ent)
        {
            var summary = new JObject
            {
                ["handle"] = ent.Handle.ToString(),
                ["type"] = ent.GetType().Name,
                ["layer"] = ent.Layer,
            };
            try
            {
                var extents = ent.GeometricExtents;
                summary["boundsMin"] = PointToJson(extents.MinPoint);
                summary["boundsMax"] = PointToJson(extents.MaxPoint);
            }
            catch { /* some entities (e.g. zero-length) have no extents — omit, don't fail the call */ }
            return summary;
        }

        // ── Entities: create ─────────────────────────────────────────────────

        private static JToken CreateLine(Database db, JObject p)
        {
            var start = PointFromJson(p["start"]);
            var end = PointFromJson(p["end"]);
            return AddEntity(db, new Line(start, end));
        }

        private static JToken CreateCircle(Database db, JObject p)
        {
            var center = PointFromJson(p["center"]);
            var radius = p["radius"]?.Value<double>() ?? throw new ArgumentException("radius is required");
            return AddEntity(db, new Circle(center, Vector3d.ZAxis, radius));
        }

        private static JToken CreatePolyline(Database db, JObject p)
        {
            var pointsArr = p["points"] as JArray ?? throw new ArgumentException("points (array of {x,y}) is required");
            var closed = p["closed"]?.Value<bool>() ?? false;

            var poly = new Polyline();
            for (int i = 0; i < pointsArr.Count; i++)
            {
                var pt = PointFromJson(pointsArr[i]);
                poly.AddVertexAt(i, new Point2d(pt.X, pt.Y), 0, 0, 0);
            }
            poly.Closed = closed;
            return AddEntity(db, poly);
        }

        private static JToken CreateText(Database db, JObject p)
        {
            var position = PointFromJson(p["position"]);
            var text = p["text"]?.ToString() ?? throw new ArgumentException("text is required");
            var height = p["height"]?.Value<double>() ?? 2.5;

            var dbText = new DBText { Position = position, TextString = text, Height = height };
            return AddEntity(db, dbText);
        }

        private static JToken CreateBlockReference(Database db, JObject p)
        {
            var blockName = p["blockName"]?.ToString() ?? throw new ArgumentException("blockName is required");
            var position = PointFromJson(p["position"]);
            var scale = p["scale"]?.Value<double>() ?? 1.0;
            var rotation = p["rotationRadians"]?.Value<double>() ?? 0.0;

            using (var tr = db.TransactionManager.StartTransaction())
            {
                var blockTable = (BlockTable)tr.GetObject(db.BlockTableId, OpenMode.ForRead);
                if (!blockTable.Has(blockName))
                    throw new InvalidOperationException($"Block '{blockName}' is not defined in this drawing.");

                var modelSpace = (BlockTableRecord)tr.GetObject(blockTable[BlockTableRecord.ModelSpace], OpenMode.ForWrite);
                var blockRef = new BlockReference(position, blockTable[blockName])
                {
                    ScaleFactors = new Scale3d(scale),
                    Rotation = rotation,
                };
                modelSpace.AppendEntity(blockRef);
                tr.AddNewlyCreatedDBObject(blockRef, true);
                tr.Commit();
                return new JObject { ["ok"] = true, ["handle"] = blockRef.Handle.ToString() };
            }
        }

        private static JToken GetBlocks(Database db)
        {
            var blocks = new JArray();
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var table = (BlockTable)tr.GetObject(db.BlockTableId, OpenMode.ForRead);
                foreach (ObjectId id in table)
                {
                    var record = (BlockTableRecord)tr.GetObject(id, OpenMode.ForRead);
                    if (record.IsLayout) continue; // skip *Model_Space / *Paper_Space bookkeeping blocks
                    blocks.Add(new JObject { ["name"] = record.Name, ["isAnonymous"] = record.IsAnonymous });
                }
                tr.Commit();
            }
            return new JObject { ["blocks"] = blocks };
        }

        private static JObject AddEntity(Database db, Entity entity)
        {
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var blockTable = (BlockTable)tr.GetObject(db.BlockTableId, OpenMode.ForRead);
                var modelSpace = (BlockTableRecord)tr.GetObject(blockTable[BlockTableRecord.ModelSpace], OpenMode.ForWrite);
                modelSpace.AppendEntity(entity);
                tr.AddNewlyCreatedDBObject(entity, true);
                tr.Commit();
                return new JObject { ["ok"] = true, ["handle"] = entity.Handle.ToString() };
            }
        }

        // ── Entities: modify / delete ────────────────────────────────────────

        private static JToken MoveEntity(Database db, JObject p)
        {
            var handle = ParseHandle(p, "handle");
            var displacement = PointFromJson(p["displacement"]) - Point3d.Origin;
            return WithWritableEntity(db, handle, ent => ent.TransformBy(Matrix3d.Displacement(displacement)));
        }

        private static JToken RotateEntity(Database db, JObject p)
        {
            var handle = ParseHandle(p, "handle");
            var center = PointFromJson(p["center"]);
            var angleRadians = p["angleRadians"]?.Value<double>() ?? throw new ArgumentException("angleRadians is required");
            return WithWritableEntity(db, handle, ent => ent.TransformBy(Matrix3d.Rotation(angleRadians, Vector3d.ZAxis, center)));
        }

        private static JToken DeleteEntities(Database db, JObject p)
        {
            var handles = (p["handles"] as JArray)?.Select(t => t.ToString()).ToArray()
                          ?? throw new ArgumentException("handles (array of handle strings) is required");
            int deleted = 0;
            using (var tr = db.TransactionManager.StartTransaction())
            {
                foreach (var h in handles)
                {
                    if (!TryResolveHandle(db, h, out var id)) continue;
                    var ent = (Entity)tr.GetObject(id, OpenMode.ForWrite);
                    ent.Erase();
                    deleted++;
                }
                tr.Commit();
            }
            return new JObject { ["ok"] = true, ["deletedCount"] = deleted };
        }

        private static JObject WithWritableEntity(Database db, Handle handle, Action<Entity> apply)
        {
            using (var tr = db.TransactionManager.StartTransaction())
            {
                if (!db.TryGetObjectId(handle, out var id))
                    throw new InvalidOperationException($"No entity with handle {handle} in this drawing.");

                var ent = (Entity)tr.GetObject(id, OpenMode.ForWrite);
                apply(ent);
                tr.Commit();
                return new JObject { ["ok"] = true, ["handle"] = handle.ToString() };
            }
        }

        // ── Layouts ──────────────────────────────────────────────────────────

        private static JToken GetLayouts(Database db)
        {
            var layouts = new JArray();
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var dict = (DBDictionary)tr.GetObject(db.LayoutDictionaryId, OpenMode.ForRead);
                foreach (DBDictionaryEntry entry in dict)
                {
                    var layout = (Layout)tr.GetObject(entry.Value, OpenMode.ForRead);
                    layouts.Add(new JObject { ["name"] = layout.LayoutName, ["isModel"] = layout.ModelType });
                }
                tr.Commit();
            }
            return new JObject { ["layouts"] = layouts };
        }

        // ── ReCap (point clouds linked into this AutoCAD drawing) ────────────
        //
        // AutoCAD plugins can see ReCap point-cloud attachments as regular database entities;
        // ReCap itself has no scripting/plugin surface of its own (its SDK is only usable FROM a
        // host app's plugin — see docs/ARCHITECTURE.md). This reads what the base AutoCAD.NET
        // package exposes (layer, handle, bounding box via the generic Entity API, which is
        // solid). VERIFY: deeper ReCap project data (scan list, point count, source .rcp/.rcs
        // path) needs the separate ReCap SDK (Autodesk Developer Network, not on NuGet) via
        // AcDbPointCloudEx.getReCapProject() — not available to build against in this
        // environment, so it is not wired up here. This tool only lists what's attached.
        private static JToken RecapListPointClouds(Database db)
        {
            var clouds = new JArray();
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var blockTable = (BlockTable)tr.GetObject(db.BlockTableId, OpenMode.ForRead);
                var modelSpace = (BlockTableRecord)tr.GetObject(blockTable[BlockTableRecord.ModelSpace], OpenMode.ForRead);

                foreach (ObjectId id in modelSpace)
                {
                    var ent = (Entity)tr.GetObject(id, OpenMode.ForRead);
                    if (!ent.GetType().Name.Contains("PointCloud", StringComparison.OrdinalIgnoreCase)) continue;
                    clouds.Add(EntitySummary(ent));
                }
                tr.Commit();
            }
            return new JObject { ["pointClouds"] = clouds, ["count"] = clouds.Count };
        }

        // ── Helpers ──────────────────────────────────────────────────────────

        private static Point3d PointFromJson(JToken? token)
        {
            if (token == null) throw new ArgumentException("A point ({x,y[,z]}) is required.");
            var x = token["x"]?.Value<double>() ?? 0;
            var y = token["y"]?.Value<double>() ?? 0;
            var z = token["z"]?.Value<double>() ?? 0;
            return new Point3d(x, y, z);
        }

        private static JObject PointToJson(Point3d pt) => new JObject { ["x"] = pt.X, ["y"] = pt.Y, ["z"] = pt.Z };

        private static Handle ParseHandle(JObject p, string field)
        {
            var raw = p[field]?.ToString() ?? throw new ArgumentException($"{field} is required");
            return new Handle(Convert.ToInt64(raw, 16));
        }

        private static bool TryResolveHandle(Database db, string raw, out ObjectId id)
        {
            try { return db.TryGetObjectId(new Handle(Convert.ToInt64(raw, 16)), out id); }
            catch { id = ObjectId.Null; return false; }
        }
    }
}
