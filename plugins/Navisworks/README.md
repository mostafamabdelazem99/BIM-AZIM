# BIM-AZIM Navisworks Manage Plugin (scaffold)

Not yet built out — this is the pointer for where the Navisworks Manage add-in goes, matching the
same contract every engine bridge uses (`GET /health`, `POST /tools/:name`), consumed by
`server/src/tools/navisworks.ts`.

## Shape to follow

Like Revit, Navisworks Manage's API is only accessible from an in-process add-in. Structure:

```
BimAzim.NavisworksBridge/
  BimAzimPlugin.cs           Autodesk.Navisworks.Api.Plugins.AddInPlugin — starts the HTTP listener
  JsonHttpServer.cs          reuse the same pattern as plugins/Tekla/.../JsonHttpServer.cs
  Tools/
    ModelInfoTools.cs         get_model_info (Document.CurrentFileName, appended files)
    SelectionTools.cs         get_selected (Document.CurrentSelection)
    ClashTools.cs              run_clash_test (Autodesk.Navisworks.Api.Clash namespace)
```

Build against `Autodesk.Navisworks.Api.dll` from the target Navisworks Manage installation.

Port: `8091` (see `server/src/config.ts`, override via `BIMAZIM_NAVIS_PORT`).
