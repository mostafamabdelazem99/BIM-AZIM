# BIM-AZIM SketchUp Extension

A real Ruby `SketchupExtension`. SketchUp has no .NET or C++ plugin API for extensions — Ruby is
the only supported mechanism — so unlike the Revit/Navisworks/AutoCAD plugins, this can't be
"built" in the usual sense; it's installed as source.

## Status

Written against the documented SketchUp Ruby API (`Sketchup`, `Geom::Point3d`,
`Geom::Transformation`, `Sketchup::Entities`, …) and the same length-prefixed JSON-RPC wire
protocol as the other engines. **Unverified** — no Ruby interpreter or SketchUp install was
available in the environment this was built in, so it has not been run.

## Install

`install.ps1` copies `bimazim_sketchup.rb` and the `bimazim_sketchup/` folder into each detected
SketchUp version's per-user Plugins folder
(`%APPDATA%\SketchUp\SketchUp <year>\SketchUp\Plugins`). By hand: copy both into that same folder,
then restart SketchUp — Window > Extension Manager should list "BIM-AZIM".

## Using it

The extension auto-starts its socket service (default port 8095, scanning up to 8105 if taken) a
moment after SketchUp finishes loading. A "BIM-AZIM" item appears under the Plugins menu with
Start/Stop and Status commands.

### Threading

SketchUp's Ruby runs single-threaded with no real background threads. `socket_service.rb` uses
non-blocking sockets (`accept_nonblock`/`read_nonblock`) polled by a repeating `UI.start_timer`
tick (every 50ms) rather than a blocking accept loop — the same approach used by the public
`sketchup-mcp` extension for the same reason.

## Tools

15 tools in `server/src/tools/sketchup.ts` — model info, entity listing/selection, edges/faces,
groups, component instances, layers ("Tags" in the UI since 2020), materials, move/delete by
entity id, scenes, zoom extents, and export.
