"""Dispatches BIM-AZIM commands against the 3ds Max scene via pymxs. Only ever called from the
main-thread idle pump in socket_service.py — never call this directly from a background thread.
"""


def _rt():
    import pymxs

    return pymxs.runtime


def ping():
    rt = _rt()
    return {"version": str(rt.maxVersion()), "sceneFile": str(rt.maxFileName) or None}


def execute(method, params):
    rt = _rt()

    if method == "ping":
        return ping()

    handlers = {
        "max_get_scene_info": _get_scene_info,
        "max_get_objects": _get_objects,
        "max_get_selection": _get_selection,
        "max_create_box": _create_box,
        "max_create_sphere": _create_sphere,
        "max_create_cylinder": _create_cylinder,
        "max_create_line": _create_line,
        "max_set_object_transform": _set_object_transform,
        "max_delete_objects": _delete_objects,
        "max_get_materials": _get_materials,
        "max_create_standard_material": _create_standard_material,
        "max_assign_material": _assign_material,
        "max_get_layers": _get_layers,
        "max_create_layer": _create_layer,
        "max_get_cameras": _get_cameras,
        "max_zoom_extents": _zoom_extents,
        "max_render_to_file": _render_to_file,
        "max_export_scene": _export_scene,
        "max_save_scene": _save_scene,
    }
    handler = handlers.get(method)
    if handler is None:
        raise ValueError(f"Unknown command: {method}")
    return handler(rt, params)


# ── Scene / objects ──────────────────────────────────────────────────────────

def _get_scene_info(rt, params):
    return {
        "sceneFile": str(rt.maxFileName) or None,
        "objectCount": int(rt.objects.count),
        "units": str(rt.units.DisplayType),
        "currentFrame": int(rt.sliderTime),
    }


def _node_summary(node):
    try:
        bb = node.boundingBox if hasattr(node, "boundingBox") else None
    except Exception:  # noqa: BLE001 — not every node type exposes a bounding box
        bb = None
    summary = {
        "name": str(node.name),
        "class": str(_class_name(node)),
    }
    if bb:
        summary["boundsMin"] = _point_to_dict(bb[0])
        summary["boundsMax"] = _point_to_dict(bb[1])
    return summary


def _class_name(node):
    try:
        return node.classID if isinstance(node.classID, str) else type(node).__name__
    except Exception:  # noqa: BLE001
        return type(node).__name__


def _get_objects(rt, params):
    limit = int(params.get("limit", 200))
    class_filter = params.get("className")
    result = []
    for obj in rt.objects:
        if len(result) >= limit:
            break
        if class_filter and class_filter.lower() not in str(_class_name(obj)).lower():
            continue
        result.append(_node_summary(obj))
    return {"objects": result, "count": len(result)}


def _get_selection(rt, params):
    selected = [rt.selection[i] for i in range(1, rt.selection.count + 1)]
    return {"objects": [_node_summary(o) for o in selected], "count": len(selected)}


# ── Create primitives ────────────────────────────────────────────────────────

def _create_box(rt, params):
    pos = _point_from_dict(params.get("position", {}))
    box = rt.Box(
        length=float(params.get("length", 10)),
        width=float(params.get("width", 10)),
        height=float(params.get("height", 10)),
        pos=pos,
    )
    if "name" in params:
        box.name = params["name"]
    return {"ok": True, "name": str(box.name)}


def _create_sphere(rt, params):
    pos = _point_from_dict(params.get("position", {}))
    sphere = rt.Sphere(radius=float(params.get("radius", 5)), pos=pos)
    if "name" in params:
        sphere.name = params["name"]
    return {"ok": True, "name": str(sphere.name)}


def _create_cylinder(rt, params):
    pos = _point_from_dict(params.get("position", {}))
    cyl = rt.Cylinder(
        radius=float(params.get("radius", 5)),
        height=float(params.get("height", 10)),
        pos=pos,
    )
    if "name" in params:
        cyl.name = params["name"]
    return {"ok": True, "name": str(cyl.name)}


def _create_line(rt, params):
    points = params.get("points")
    if not points or len(points) < 2:
        raise ValueError("points (>= 2) is required")

    line = rt.SplineShape(pos=_point_from_dict(points[0]))
    rt.addNewSpline(line)
    for p in points:
        rt.addKnot(line, 1, rt.Name("corner"), rt.Name("line"), _point_from_dict(p))
    rt.updateShape(line)
    if "name" in params:
        line.name = params["name"]
    return {"ok": True, "name": str(line.name)}


# ── Modify / delete ──────────────────────────────────────────────────────────

def _find_object(rt, name):
    obj = rt.getNodeByName(name)
    if obj is None:
        raise ValueError(f"No object named '{name}' in the scene.")
    return obj


def _set_object_transform(rt, params):
    name = params.get("name")
    if not name:
        raise ValueError("name is required")
    obj = _find_object(rt, name)

    if "position" in params:
        obj.pos = _point_from_dict(params["position"])
    if "scale" in params:
        s = params["scale"]
        obj.scale = rt.Point3(float(s.get("x", 1)), float(s.get("y", 1)), float(s.get("z", 1)))
    if "rotationEulerDegrees" in params:
        r = params["rotationEulerDegrees"]
        obj.rotation = rt.eulerToQuat(
            rt.eulerAngles(float(r.get("x", 0)), float(r.get("y", 0)), float(r.get("z", 0)))
        )
    return {"ok": True, "name": str(obj.name)}


def _delete_objects(rt, params):
    names = params.get("names")
    if not names:
        raise ValueError("names is required")
    deleted = 0
    for name in names:
        obj = rt.getNodeByName(name)
        if obj is not None:
            rt.delete(obj)
            deleted += 1
    return {"ok": True, "deletedCount": deleted}


# ── Materials ────────────────────────────────────────────────────────────────

def _get_materials(rt, params):
    materials = []
    for mat in rt.sceneMaterials:
        materials.append({"name": str(mat.name)})
    return {"materials": materials}


def _create_standard_material(rt, params):
    name = params.get("name", "BimAzimMaterial")
    color = params.get("diffuseColor", {})
    mat = rt.StandardMaterial(name=name)
    mat.diffuse = rt.Color(
        float(color.get("r", 255)), float(color.get("g", 255)), float(color.get("b", 255))
    )
    rt.sceneMaterials.append(mat)
    return {"ok": True, "name": str(mat.name)}


def _assign_material(rt, params):
    object_name = params.get("objectName")
    material_name = params.get("materialName")
    if not object_name or not material_name:
        raise ValueError("objectName and materialName are required")

    obj = _find_object(rt, object_name)
    material = next((m for m in rt.sceneMaterials if str(m.name) == material_name), None)
    if material is None:
        raise ValueError(f"No material named '{material_name}'.")
    obj.material = material
    return {"ok": True}


# ── Layers ───────────────────────────────────────────────────────────────────

def _get_layers(rt, params):
    manager = rt.LayerManager
    layers = []
    for i in range(manager.count):
        layer = manager.getLayer(i)
        layers.append({"name": str(layer.name), "visible": bool(layer.isHidden) is False})
    return {"layers": layers}


def _create_layer(rt, params):
    name = params.get("name")
    if not name:
        raise ValueError("name is required")
    layer = rt.LayerManager.newLayerFromName(name)
    return {"ok": True, "name": str(layer.name) if layer else name}


# ── Cameras / viewport / render / export ─────────────────────────────────────

def _get_cameras(rt, params):
    cameras = [str(c.name) for c in rt.cameras]
    return {"cameras": cameras}


def _zoom_extents(rt, params):
    rt.execute("max zoomext all")
    return {"ok": True}


def _render_to_file(rt, params):
    path = params.get("path")
    if not path:
        raise ValueError("path is required")
    width = int(params.get("width", 640))
    height = int(params.get("height", 480))
    bitmap = rt.render(outputFile=path, outputWidth=width, outputHeight=height)
    if bitmap is not None:
        rt.close(bitmap)
    return {"ok": True, "path": path}


def _export_scene(rt, params):
    path = params.get("path")
    if not path:
        raise ValueError("path is required")
    ok = rt.exportFile(path, rt.Name("noPrompt"), using=params.get("usingExporter"))
    return {"ok": bool(ok), "path": path}


def _save_scene(rt, params):
    path = params.get("path")
    if path:
        ok = rt.saveMaxFile(path)
    else:
        ok = rt.saveMaxFile(rt.maxFileName)
    return {"ok": bool(ok), "path": path or str(rt.maxFileName)}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _point_from_dict(d):
    rt = _rt()
    return rt.Point3(float(d.get("x", 0)), float(d.get("y", 0)), float(d.get("z", 0)))


def _point_to_dict(p):
    return {"x": float(p.x), "y": float(p.y), "z": float(p.z)}
