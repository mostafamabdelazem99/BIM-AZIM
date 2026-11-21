# BIM-AZIM Tekla Bridge

A standalone .NET service that connects to a running **Tekla Structures** session via the
**Tekla Open API** and exposes it over a small local JSON/HTTP contract, so the BIM-AZIM MCP
server (`../../server`) can drive it from any AI client.

Unlike the Revit/Navisworks plugins, this does **not** need to be loaded inside Tekla Structures'
own process — Tekla's Open API (`Tekla.Structures.Model.Model`) connects to the active session
from any external .NET process on the same machine. You just need Tekla Structures running with a
model open.

> **Important — unverified against a live install.** This project was scaffolded without a local
> Tekla Structures installation available to compile and test against. The API calls below reflect
> my best knowledge of the Tekla Open API, but **you must verify method names/signatures against
> the API reference that ships with your installed Tekla Structures version** (Help → Tekla Open
> API Reference, or `%TeklaStructuresBin%\..\Documents\OpenAPI` depending on version) before
> building. Spots flagged `// VERIFY:` in the code are the ones most likely to need adjustment
> between Tekla versions.

## Project layout

```
BimAzim.TeklaBridge/
  Program.cs                        entrypoint — starts the HTTP server + Tekla connection
  TeklaConnection.cs                wraps Tekla.Structures.Model.Model, GUID lookup, geometry helpers
  JsonHttpServer.cs                 minimal HttpListener-based JSON router (no ASP.NET dependency)
  ToolRegistry.cs                   wires tool names -> handler methods
  Tools/
    ModelInfoTools.cs                get_model_info
    SelectionTools.cs                get_selected_objects, select_by_filter, get_part_properties, get_assemblies
    CreateTools.cs                   create_beam, create_contour_plate
    EditTools.cs                     move_part, modify_part, delete_objects
    NumberingExportTools.cs          run_numbering, export_ifc, push_to_trimble_connect (stub)
    InterferenceTools.cs             check_interference (bounding-box clash check)
```

## Setup

1. Set the `TeklaStructuresBin` environment variable (or edit the `.csproj` directly) to your
   Tekla Structures `bin` folder, e.g.
   `C:\Program Files\Tekla Structures\2024.0\nt\bin`.
2. Open `BimAzim.TeklaBridge.csproj` in Visual Studio (or `dotnet build`, .NET Framework 4.8 SDK
   required) and restore/build.
3. Start Tekla Structures and open a model.
4. Run the bridge: `BimAzim.TeklaBridge.exe` (defaults to port `8092`, override with the
   `BIMAZIM_TEKLA_PORT` environment variable, matching the MCP server's config).
5. From an AI client with the BIM-AZIM MCP server configured, call `bimazim_engine_status` to
   confirm `tekla.data.connected === true`.

## Known gaps / honest limitations

- **Numbering** (`run_numbering`) calls `Operation.Numbering.NumberAll()` /
  `NumberModified()` from `Tekla.Structures.Model.Operations` — verify this matches your version;
  some Tekla versions expose numbering slightly differently.
- **IFC export** (`export_ifc`) does not call a stable, documented "export IFC" Open API method
  (none is reliably version-independent). It's implemented by triggering a pre-recorded Tekla
  macro (`Operation.RunMacro`) that you create once in Tekla (Applications & Components → record a
  macro that runs File → Export → IFC with your desired settings) and point this tool at by name.
  See the comment in `NumberingExportTools.cs`.
- **Trimble Connect push** (`push_to_trimble_connect`) is a stub. Trimble Connect sync isn't part
  of the Tekla Open API — it needs the separate Trimble Connect REST API (its own auth/project
  model). Returns a clear "not implemented" error rather than pretending to succeed. Tracked as a
  roadmap item in `docs/ARCHITECTURE.md`.
- **Interference check** is a naive axis-aligned bounding-box overlap test via `Part.GetSolid()`,
  not a true solid-to-solid clash — fine for a quick "anything roughly overlapping?" pass, not a
  replacement for Navisworks Clash Detective.
