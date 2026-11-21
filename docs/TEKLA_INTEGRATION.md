# Tekla Structures Integration — Deep Dive

This is the integration docs/ARCHITECTURE.md calls "the new piece." Full setup/build notes live in
[`../plugins/Tekla/README.md`](../plugins/Tekla/README.md); this doc is the tool-by-tool reference.

## Why Tekla connects differently (recap)

Tekla Open API lets an **external** .NET process connect to a running Tekla Structures session —
no in-process add-in required for model read/write. BIM-AZIM's Tekla bridge
(`plugins/Tekla/BimAzim.TeklaBridge`) is therefore a standalone service, not a Tekla plugin DLL
loaded by Tekla itself. Full reasoning in [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Tool catalog

| MCP tool (`server/src/tools/tekla.ts`) | Bridge tool | What it does |
|---|---|---|
| `tekla_get_model_info` | `get_model_info` | Connection status, model name/path |
| `tekla_get_selected_objects` | `get_selected_objects` | Summarize whatever's selected in Tekla right now |
| `tekla_select_by_filter` | `select_by_filter` | Select by object type / name substring / phase number |
| `tekla_get_part_properties` | `get_part_properties` | Full property summary for specific GUIDs |
| `tekla_get_assemblies` | `get_assemblies` | List assemblies, optionally by phase |
| `tekla_create_beam` | `create_beam` | New beam or column (Tekla models both as `Beam`) between two points |
| `tekla_create_contour_plate` | `create_contour_plate` | New plate from an ordered point list |
| `tekla_move_part` | `move_part` | Translate beams/plates by a delta vector |
| `tekla_modify_part` | `modify_part` | Change profile/material/class/name/phase |
| `tekla_delete_objects` | `delete_objects` | Delete by GUID |
| `tekla_run_numbering` | `run_numbering` | Trigger Tekla numbering (all or modified-only) |
| `tekla_check_interference` | `check_interference` | Bounding-box clash pass, no Navisworks needed |
| `tekla_export_ifc` | `export_ifc` | IFC export via a pre-recorded Tekla macro |
| `tekla_push_to_trimble_connect` | `push_to_trimble_connect` | **Stub** — needs the separate Trimble Connect REST API |

## Example round-trip

```jsonc
// AI client calls: tekla_select_by_filter { "objectType": "COLUMN", "phaseNumber": 1 }
// -> MCP server POSTs to http://127.0.0.1:8092/tools/select_by_filter
{ "objectType": "COLUMN", "phaseNumber": 1 }

// Bridge responds:
{
  "ok": true,
  "data": {
    "count": 12,
    "objects": [
      { "guid": "…", "type": "Beam", "name": "COLUMN", "profile": "HEA200", "material": "S355JR", "...": "…" }
    ],
    "truncated": false
  }
}
```

The AI client then has real GUIDs to pass into `tekla_get_part_properties`, `tekla_move_part`,
`tekla_modify_part`, etc.

## Before you build: verification checklist

None of this was compiled against a live Tekla Structures install (none was available in this
environment). Before you rely on it:

1. Set `TeklaStructuresBin` and build. Fix any reference/namespace errors — Tekla Open API has
   moved classes between namespaces across major versions.
2. Open the Tekla Open API reference that ships with your installed version and check every
   `// VERIFY:` comment in `plugins/Tekla/BimAzim.TeklaBridge/`, especially:
   - `Model.GetInfo(out ModelInfo)` field names (`ModelInfoTools.cs`)
   - `Operation.Numbering.NumberAll()/NumberModified()` (`NumberingExportTools.cs`) — the single
     most likely call to need adjusting
   - `ModelObject.ModelObjectEnum` vs. top-level `ModelObjectEnum` (`SelectionTools.cs`,
     `InterferenceTools.cs`)
   - Report property name spelling (`PropertyHelpers.cs`) — some are template/locale-dependent
3. Record the `BimAzim_ExportIfc` macro once inside Tekla before using `tekla_export_ifc`.
4. Start Tekla Structures with a model open, then run the bridge and call
   `bimazim_engine_status` from your AI client to confirm `tekla.data.connected === true` before
   trying anything else.
