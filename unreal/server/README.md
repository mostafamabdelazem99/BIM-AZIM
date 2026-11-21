# BIM-AZIM Unreal

An MCP (Model Context Protocol) server that bridges AI assistants (Claude, Gemini, etc.) with Unreal Engine's editor. Control your Unreal projects through natural language — spawn actors, manage Blueprints, manipulate materials, build lighting, and more.

> Ported from BIM-Bot's `unreal-mcp-server` (MIT licensed, © Hassan Ahmed Elmathary —
> see [`LICENSE`](LICENSE)) and rebranded for BIM-AZIM. The tool logic, Python scripts
> and Remote Control API calls are unchanged; only names, the server identity and the
> custom bridge port were adapted. See [`../README.md`](../README.md) for how this fits
> next to BIM-AZIM's Revit/Navisworks/Tekla server.

## How this differs from the rest of BIM-AZIM

The Revit, Navisworks and Tekla integrations all plug into one shared TypeScript MCP
server (`../../server/`) via its `defineTool()` / `ToolBridge` pattern, talking to each
host application over its own TCP/HTTP channel.

Unreal is different, by design — this mirrors how BIM-Bot itself ships Unreal support
as its own separate `BIM-Bot-Unreal` MCP connector rather than folding it into the main
server:

- This is a **standalone Node.js MCP server** (plain CommonJS, its own `package.json`,
  its own `server.tool(...)` calls — no `defineTool`/`ToolBridge` abstraction).
- Most tool handlers don't talk to a bespoke plugin RPC. Instead they build a **Python
  script string** and POST it to Unreal Engine's own built-in **Remote Control API**
  (`/remote/object/call` → `PythonScriptLibrary.ExecutePythonCommandEx`), which runs
  inside the Unreal Editor's Python Editor Script Plugin.
- A small subset of tools (screenshots, notifications, console commands, Blueprint
  graph-node editing, UMG widget creation) go through an optional custom C++ Editor
  plugin instead — [`BimAzimMCPBridge`](../../plugins/Unreal/BimAzimMCPBridge/) — because
  those operations aren't well covered by the Python API. Every one of those tools still
  falls back to a Python equivalent when the plugin isn't installed.

## Architecture

```
┌─────────────────┐     MCP/stdio     ┌──────────────────┐     HTTP     ┌──────────────────────┐
│   AI Assistant   │ ◄──────────────► │  BIM-AZIM Unreal │ ◄──────────► │  Unreal Engine       │
│  (Claude, etc.)  │                  │  Server (Node)   │    :30010   │  Remote Control API  │
└─────────────────┘                  └──────────────────┘    :30012   │  MCP Bridge Plugin   │
                                                                       └──────────────────────┘
```

- **Port 30010** — Unreal's own Remote Control API plugin. This default is Epic's, not
  BIM-AZIM's; configure it in the Unreal project's `Config/DefaultRemoteControl.ini` /
  Project Settings, same as upstream BIM-Bot.
- **Port 30012** — the custom `BimAzimMCPBridge` plugin. BIM-Bot's own bridge plugin
  defaults to port 30011; BIM-AZIM's is bumped to **30012** so a BIM-AZIM install can run
  side-by-side with a real BIM-Bot install on the same machine without a port collision.
  Override with `UNREAL_BRIDGE_PORT`.

## Prerequisites

1. **Unreal Engine 5** (tested upstream on 5.8.3)
2. Nothing else when you use `BIM-AZIM-Unreal.exe`: it has Node built in and sets up the Unreal project for you (see [Standalone .exe](#standalone-exe-auto-connect))
3. *(Optional)* **BimAzimMCPBridge plugin**: only adds real editor toast pop-ups and a few editor-only operations. Without it every tool still works through Python, and `show_notification` writes to the Output Log instead

## Manual Setup Guide

Only needed if you don't use the exe's project setup.

### 1 — Enable the built-in Remote Control API plugin

Open your project in Unreal Engine 5.6+, then:

```
Edit → Plugins → search "Remote Control API" → Enable → Restart Editor
Edit → Plugins → search "Python Editor Script Plugin" → Enable → Restart Editor
```

The Remote Control API listens on **port 30010** (default, set by Unreal/Epic — not BIM-AZIM).

Then allow the Python calls (UE 5.1+ refuses them by default). In `Config/DefaultRemoteControl.ini`:

```ini
[/Script/RemoteControlCommon.RemoteControlSettings]
bAutoStartWebServer=True
RemoteControlHttpServerPort=30010
bEnableRemotePythonExecution=True
+CustomAllowedRemoteFunctionCalls=(ClassPath="/Script/PythonScriptPlugin.PythonScriptLibrary",bAllowChildClasses=False)
RemoteControlWebsocketServerBindAddress=127.0.0.1
```

The last line keeps the WebSocket server (which defaults to `0.0.0.0`) from letting other machines run Python. The HTTP server on port 30010 already listens on `127.0.0.1` only.

---

### 2 — *(Optional)* Build and enable the BimAzimMCPBridge plugin

Copy [`plugins/Unreal/BimAzimMCPBridge`](../../plugins/Unreal/BimAzimMCPBridge/) into your Unreal project's `Plugins/` folder:

```
Documents/Unreal Projects/MyProject/Plugins/BimAzimMCPBridge/
```

**Build it:**
1. Close the Unreal Editor
2. Right-click `MyProject.uproject` → **Generate Visual Studio project files**
3. Open `MyProject.sln` in Visual Studio 2022
4. Set solution config to **Development Editor / Win64**
5. Build → the plugin compiles alongside the project
6. Reopen the editor → `Edit → Plugins → Project → BimAzimMCPBridge → Enable`

The bridge starts automatically on **port 30012** when the editor loads.
Check the Output Log for: `[BimAzimMCPBridge] Listening on http://localhost:30012`

> **Alternative (no VS required):** Right-click `MyProject.uproject` → **Switch Unreal Engine version** → select your installed version → then double-click to open. UE will prompt to rebuild missing modules automatically.
>
> **Unverified against a live Unreal install** — see [`plugins/Unreal/README.md`](../../plugins/Unreal/README.md) for the honest caveats on the C++ half.

---

### 3 — Connect Claude Desktop

Copy [`claude_desktop_config.json`](claude_desktop_config.json) into your Claude Desktop config (merge the `mcpServers` block), filling in the real path to your installed exe or `src/index.js`.

Restart Claude Desktop — the **BIM-AZIM-Unreal** MCP server will appear in the tools panel.

**Test the connection** by asking Claude:
> "Ping Unreal Engine and tell me if it's connected"

---

### 4 — Verify everything is working

| Check | Expected result |
|---|---|
| `ping_unreal` tool | `connected: true` |
| `get_project_info` tool | Returns engine version + project name |
| `capture_viewport` tool | Returns a base64 PNG image |
| `execute_python` tool | Runs Python in the editor |

---

## Standalone .exe (auto-connect)

`dist/BIM-AZIM-Unreal.exe` is a single file with Node bundled in — no `npm install` needed. (Not built in this port; see `npm run build:exe` below if you want one.)

**Double-click it** (or run `BIM-AZIM-Unreal.exe --install`). It:
1. Lists the Unreal Engine versions installed on this PC
2. Copies itself to `%LOCALAPPDATA%\Programs\BIM-AZIM Unreal\BIM-AZIM-Unreal.exe` (outside OneDrive)
3. Registers `BIM-AZIM-Unreal` with **Claude Desktop**, **Claude Code** (`~/.claude.json`) and **OpenCode** (`~/.config/opencode/opencode.json`). Each config is backed up to `*.bak` first. Old `unreal-mcp` registrations are replaced
4. Writes the tool permissions below into Claude Code (`~/.claude/settings.json`) and OpenCode (`opencode.json` → `permission`). Your other rules are kept
5. Lists the projects in `Documents\Unreal Projects` and on the Desktop (up to two folders deep) and asks which to set up (Enter = all that need it). Setting up a project:
   - enables the **Remote Control API**, **Python Editor Script** and **Editor Scripting Utilities** plugins in the `.uproject`
   - writes the `Config/DefaultRemoteControl.ini` shown in the manual guide above

   Changed files are backed up to `*.bak` first. Open editors need a restart to pick it up.

Then restart the client. Other flags:

| Command | Does |
|---|---|
| `--setup-engines` | Turn the plugins and Remote Control config on by default in every installed engine, so **any** project connects with no setup of its own. Asks for admin if the engine folder needs it. Re-run after an engine update or "Verify", which restore the stock files. Projects that explicitly disable one of the plugins keep it off |
| `--setup <project.uproject or folder> ...` | Set up those projects without asking. With no path: **every** project in `Documents\Unreal Projects` and on the Desktop |
| *drop a `.uproject` on the exe* | Install, then set up that project |
| `--status [paths]` | Show Unreal versions, registrations and which projects are ready |
| `--uninstall` | Remove the registrations and permissions (projects are left as they are) |
| `--serve` | Force MCP server mode |

When an MCP client launches the exe (with piped stdio), it runs the MCP server directly.

**Build:** `npm run build:exe`. Run it from a folder that is stored locally: OneDrive cloud-only `node_modules` make esbuild time out.

## AI Permissions

What Claude and OpenCode may do with BIM-AZIM Unreal. The single source is [`src/permissions.js`](src/permissions.js): edit it and run `--install` again to change the rules. The tests fail if a tool is missing from it.

| Level | Meaning |
|---|---|
| ✅ **Allow** | Runs without asking |
| ❓ **Ask** | You approve each call |
| ⛔ **Deny** | Blocked, the AI can't call it |

### ✅ Allowed: the AI can do these

| Group | Tools |
|---|---|
| Read the project | `ping_unreal`, `get_project_info`, `get_world_info`, `get_actors`, `find_actors_by_name`, `get_actor_properties`, `get_actor_bounds`, `get_selected_actors`, `search_assets`, `get_asset_info`, `get_blueprints`, `find_blueprint_nodes`, `get_remote_property`, `capture_viewport` |
| Editor UI | `select_actors_by_label`, `focus_viewport`, `show_notification` |
| Edit the level (undoable, in memory until saved) | `spawn_actor`, `spawn_blueprint_actor`, `duplicate_actor`, `rename_actor`, `set_actor_transform`, `set_actor_visibility`, `set_actor_property`, `set_actor_tag`, `set_static_mesh_material`, `undo` |
| Blueprints and UMG | `create_blueprint`, `compile_blueprint`, `add_component_to_blueprint`, `set_static_mesh_properties`, `set_component_property`, `set_physics_properties`, `set_blueprint_property`, `set_pawn_properties`, `add_blueprint_variable`, `add_blueprint_event_node`, `add_blueprint_input_action_node`, `add_blueprint_function_node`, `connect_blueprint_nodes`, `add_blueprint_get_self_component_reference`, `add_blueprint_self_reference`, `create_umg_widget_blueprint`, `add_text_block_to_widget`, `add_button_to_widget`, `bind_widget_event`, `add_widget_to_viewport`, `set_text_block_binding` |
| Play in editor | `play_in_editor`, `stop_play_in_editor` |

### ❓ Ask first: the AI needs your approval

| Tool | Why |
|---|---|
| `delete_actor` | Removes actors from the level |
| `save_level` | Writes the `.umap` to disk |
| `open_level` | Switches level, so unsaved changes can be lost |
| `import_asset` | Reads a file from your disk into `Content/` |
| `create_material` | Writes a material asset to `Content/` (can overwrite one) |
| `build_lighting` | Long-running, overwrites built lighting |
| `create_input_mapping` | Changes project-wide input settings |
| `call_remote_function` | Calls any UFunction on any object |
| `set_remote_property` | Sets any property on any object |

### ⛔ Denied: the AI can't do these

| Tool | Why |
|---|---|
| `execute_python` | Runs arbitrary Python with full access to your files, network and processes |
| `execute_console_command` | Runs arbitrary console commands (`quit`, `exec`, cvars) |

The other tools still use Python internally. Only the AI's direct, free-form calls are blocked. To allow one, move it to `ask` in `permissions.js`.

**Per client**
- **Claude Code**: rules go in `~/.claude/settings.json` as `mcp__BIM-AZIM-Unreal__<tool>`
- **OpenCode**: rules go in `opencode.json` as `"permission": { "BIM-AZIM-Unreal_<tool>": "allow" | "ask" | "deny" }`
- **Claude Desktop** has no config-file rules. It asks per tool in the app, so choose "Always allow" only for the ✅ tools above

## Quick Start

```bash
# Install dependencies
npm install

# Start the MCP server
npm start

# Run tests
npm test
```

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `UNREAL_HOST` | `localhost` | Unreal Engine host |
| `UNREAL_PORT` | `30010` | Remote Control API port (Unreal/Epic default — not BIM-AZIM's) |
| `UNREAL_BRIDGE_PORT` | `30012` | BimAzimMCPBridge plugin port (bumped from BIM-Bot's 30011 to avoid a collision if both are installed) |
| `UNREAL_TIMEOUT` | `10000` | Request timeout (ms) |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |

## Claude Desktop Setup

Copy `claude_desktop_config.json` to your Claude Desktop config directory, or merge the `mcpServers` block into your existing config:

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "BIM-AZIM-Unreal": {
      "command": "node",
      "args": ["C:/path/to/unreal/server/src/index.js"],
      "env": {
        "UNREAL_HOST": "localhost",
        "UNREAL_PORT": "30010",
        "UNREAL_BRIDGE_PORT": "30012"
      }
    }
  }
}
```

## Available Tools (59)

### Connection
| Tool | Description |
|---|---|
| `ping_unreal` | Check if Unreal Engine is reachable |

### Python Execution
| Tool | Description |
|---|---|
| `execute_python` | Execute a Python script inside Unreal Editor |

### Actor Management
| Tool | Description |
|---|---|
| `get_actors` | List all actors in the current level |
| `find_actors_by_name` | Find actors by name pattern (case-insensitive substring) |
| `spawn_actor` | Spawn an actor in the level by class path |
| `spawn_blueprint_actor` | Spawn a Blueprint actor by asset path |
| `delete_actor` | Delete an actor by label |
| `duplicate_actor` | Duplicate an actor with optional offset |
| `rename_actor` | Rename an actor's label |
| `set_actor_transform` | Set location, rotation, and/or scale |
| `set_actor_property` | Set any named property on an actor |
| `get_actor_properties` | Get properties of an actor |
| `get_actor_bounds` | Get bounding box origin and extent |
| `set_actor_visibility` | Show or hide an actor |
| `set_actor_tag` | Add or remove a tag on an actor |
| `get_selected_actors` | Get currently selected actors |
| `select_actors_by_label` | Select actors by their labels |
| `focus_viewport` | Focus the editor viewport on an actor or location |

### Level Management
| Tool | Description |
|---|---|
| `get_world_info` | Get current world/level info |
| `save_level` | Save the current level |
| `open_level` | Open a level by asset path |

### Asset Management
| Tool | Description |
|---|---|
| `search_assets` | Search the content browser |
| `get_asset_info` | Get detailed asset info |

### Blueprint Management
| Tool | Description |
|---|---|
| `get_blueprints` | List Blueprint assets |
| `create_blueprint` | Create a new Blueprint class asset |
| `compile_blueprint` | Compile a Blueprint |
| `add_component_to_blueprint` | Add a component to a Blueprint's component tree |
| `set_static_mesh_properties` | Assign mesh + material to a StaticMeshComponent in a Blueprint |
| `set_component_property` | Set any property on a named component inside a Blueprint |
| `set_physics_properties` | Configure physics on a PrimitiveComponent in a Blueprint |
| `set_blueprint_property` | Set a property on the Blueprint's Class Default Object |
| `set_pawn_properties` | Set Pawn-specific defaults (auto-possess, controller rotation, etc.) |

### Blueprint Node Graph
| Tool | Description |
|---|---|
| `add_blueprint_variable` | Add a member variable to a Blueprint |
| `add_blueprint_event_node` | Add an event node (BeginPlay, Tick, custom) to the event graph |
| `add_blueprint_input_action_node` | Add an InputAction event node |
| `add_blueprint_function_node` | Add a function call node to the event graph |
| `connect_blueprint_nodes` | Wire two nodes together by pin names |
| `add_blueprint_get_self_component_reference` | Add a component getter node |
| `add_blueprint_self_reference` | Add a "Get Self" reference node |
| `find_blueprint_nodes` | Search event graph for nodes by type or event name |

### UMG / Widget UI
| Tool | Description |
|---|---|
| `create_umg_widget_blueprint` | Create a new Widget Blueprint with a Canvas Panel root |
| `add_text_block_to_widget` | Add a TextBlock to a Widget Blueprint |
| `add_button_to_widget` | Add a Button (with label) to a Widget Blueprint |
| `bind_widget_event` | Bind a widget event (OnClicked, etc.) to a Blueprint function |
| `add_widget_to_viewport` | Resolve a Widget Blueprint class for viewport use |
| `set_text_block_binding` | Create a variable + getter for TextBlock data binding |

### Project / Input
| Tool | Description |
|---|---|
| `create_input_mapping` | Create an Action or Axis input mapping in Project Settings |

### Editor Control
| Tool | Description |
|---|---|
| `play_in_editor` | Start Play-in-Editor (PIE) |
| `stop_play_in_editor` | Stop PIE |
| `undo` | Undo the last operation |

### Materials
| Tool | Description |
|---|---|
| `create_material` | Create (or overwrite) a material asset from a glass/metal/opaque preset |
| `set_static_mesh_material` | Set a material on a StaticMeshActor |

### Remote Control API (Low-level)
| Tool | Description |
|---|---|
| `call_remote_function` | Call any function on a UObject |
| `get_remote_property` | Get any UObject property |
| `set_remote_property` | Set any UObject property |

### Lighting
| Tool | Description |
|---|---|
| `build_lighting` | Build lighting in the current level |

### Editor Tools (BimAzimMCPBridge if installed, otherwise Python)
| Tool | Description |
|---|---|
| `capture_viewport` | Screenshot the active viewport (Python: Unreal must run on the same PC) |
| `execute_console_command` | Execute a console command |
| `show_notification` | Editor toast with the bridge; Output Log line without it |
| `get_project_info` | Get engine version, project metadata |
| `import_asset` | Import a file into the content browser |

### How Python results come back

Tools run Python through `PythonScriptLibrary.ExecutePythonCommandEx`, which returns what the script `print`s. A script that raises returns an error with the traceback. (`ExecutePythonScript` only returns `true`/`false`, so no data came back before.)

## Error Handling & Reliability

- **Automatic retries** with exponential backoff (3 attempts, 500ms → 1s → 2s)
- **Connection health monitoring** with periodic heartbeat checks
- **Structured JSON logging** to stderr (stdout reserved for MCP transport)
- **Graceful shutdown** on SIGINT/SIGTERM
- **Configurable timeouts** per-request and globally

## Project Structure

```
unreal/server/   (this folder)
├── src/
│   ├── index.js          # MCP server + tool definitions (59 tools)
│   ├── unreal-client.js  # HTTP client with retries, health checks, Python fallbacks
│   ├── launcher.js       # exe entry point: install, project setup, serve
│   ├── unreal-setup.js   # Unreal project setup (.uproject plugins + Remote Control ini)
│   ├── permissions.js    # AI tool permissions
│   └── logger.js         # Structured JSON logger
├── test/
│   ├── server.test.js    # Test suite
│   └── mock-unreal.js    # Mock Unreal Engine server
├── package.json
├── claude_desktop_config.json
├── LICENSE
└── README.md
```

## License

MIT — see [`LICENSE`](LICENSE). Adapted from
[BIM-Bot](https://github.com/HassanElmathary/BIM-Bot) (© Hassan Ahmed Elmathary, MIT).
