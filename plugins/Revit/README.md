# BIM-AZIM Revit Plugin (scaffold)

Not yet built out — this is the pointer for where the Revit add-in goes, matching the same
contract every engine bridge uses (`GET /health`, `POST /tools/:name`), consumed by
`server/src/tools/revit.ts`.

## Shape to follow

Revit requires an in-process add-in (`IExternalApplication`), loaded via a per-version `.addin`
manifest, because the Revit API is only accessible from inside Revit's own process. Structure:

```
BimAzim.RevitBridge/
  BimAzimApplication.cs     IExternalApplication — starts the HTTP listener on OnStartup
  JsonHttpServer.cs         reuse the same pattern as plugins/Tekla/.../JsonHttpServer.cs
  Tools/
    ModelInfoTools.cs        get_model_info (Document.Title, Document.PathName, ActiveView)
    SelectionTools.cs        get_selected_elements (UIDocument.Selection.GetElementIds())
    ReadTools.cs              get_elements (FilteredElementCollector by BuiltInCategory)
  BimAzim.RevitBridge.2025.addin   (…one manifest per supported Revit version, 2020–2027)
```

Build against `RevitAPI.dll` / `RevitAPIUI.dll` from the target Revit installation, one build
per supported version (Revit's API is not binary-compatible across major versions the way Tekla's
externally-callable Open API is — see `docs/ARCHITECTURE.md` for why Tekla's bridge is structured
differently).

Port: `8080` (see `server/src/config.ts`, override via `BIMAZIM_REVIT_PORT`).
