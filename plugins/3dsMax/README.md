# BIM-AZIM 3ds Max Plugin

A Python startup script using 3ds Max's embedded `pymxs` API. 3ds Max does have a `.NET SDK`
(`Autodesk.Max.dll`), but — unlike Revit's and AutoCAD's — it isn't published on NuGet, so a
compile-without-the-app build (this repo's approach for the .NET plugins) isn't possible for it.
Python needs no compilation, so this is installed as source instead, the same way the SketchUp
extension is.

## Status

Written against the documented `pymxs` API (`rt.Box`, `rt.Sphere`, `rt.LayerManager`,
`rt.callbacks`, …) and the same length-prefixed JSON-RPC wire protocol as the other engines. All
files byte-compile clean (`python -m py_compile`), confirming they're syntactically valid Python —
but **unverified** against a live 3ds Max session, since no 3ds Max install was available in the
environment this was built in.

## Install

`install.ps1` copies `startup_bimazim.py` and the `bimazim_max/` package folder into each detected
3ds Max version's per-user startup-scripts folder
(`%LOCALAPPDATA%\Autodesk\3dsMax\<year> - 64bit\ENU\scripts\startup`). The `ENU` (English) locale
segment will differ for non-English installs — adjust the path if yours does.

By hand: copy both into that folder, then restart 3ds Max — every script in `scripts/startup/` is
auto-run on launch.

## Using it

On launch 3ds Max prints `BIM-AZIM: 3ds Max plugin loaded` to the MAXScript listener and starts
the socket service (default port 8096, scanning up to 8106 if taken). Run
`bimAzimToggleService()` in the listener to start/stop it manually.

### Threading

`pymxs` is not documented as safe to call from a thread other than 3ds Max's main one. The actual
socket I/O (`socket`/`threading`, no scene access) runs in real background threads;
every dispatched command is handed to the main thread through a queue drained by a 3ds Max "idle"
callback (`callbacks.addScript #idle`) — the same idea as Revit's `ExternalEvent`, AutoCAD's
`Application.Idle`, and SketchUp's `UI.start_timer`, just using 3ds Max's own long-standing
idle-callback primitive.

## Tools

18 tools in `server/src/tools/max.ts` — scene info, object listing/selection, box/sphere/cylinder/
line creation, transform/delete by name, materials, layers, cameras, zoom extents, render to file,
scene export, and save.
