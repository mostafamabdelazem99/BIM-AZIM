"""Handshake file telling the MCP server which port this 3ds Max session's socket service bound
to: %LOCALAPPDATA%\\BimAzim\\service-max.json — same contract as the Revit/Navisworks/AutoCAD/
SketchUp plugins' ServiceEndpoint, read by server/src/bridge/handshake.ts.
"""
import json
import os
import time


def root_directory():
    base = os.environ.get("LOCALAPPDATA") or os.path.join(os.path.expanduser("~"), "AppData", "Local")
    return os.path.join(base, "BimAzim")


def file_path():
    return os.path.join(root_directory(), "service-max.json")


def publish(port, plugin_version):
    from . import service_auth  # local import avoids a circular import at module load time

    try:
        os.makedirs(root_directory(), exist_ok=True)
        payload = {
            "port": port,
            "pid": os.getpid(),
            "host": "127.0.0.1",
            "token": service_auth.token(),
            "pluginVersion": plugin_version,
            "startedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        with open(file_path(), "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2)
    except OSError as e:
        print(f"BIM-AZIM: failed to publish service endpoint (non-critical): {e}")


def clear():
    try:
        if os.path.exists(file_path()):
            os.remove(file_path())
    except OSError:
        pass
