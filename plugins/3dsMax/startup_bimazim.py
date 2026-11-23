"""BIM-AZIM for 3ds Max — startup script.

Install: copy this file AND the sibling bimazim_max/ folder into 3ds Max's
scripts/startup/ folder (e.g. %LOCALAPPDATA%\\Autodesk\\3dsMax\\<version>\\<lang>\\scripts\\startup\\
— install.ps1 does this for you). Every script in scripts/startup/ is auto-run by 3ds Max on
launch, in Python since 3ds Max 2017's embedded Python (pymxs) made this layout the standard way
to auto-load a Python-based tool.
"""
import os
import sys

_this_dir = os.path.dirname(os.path.abspath(__file__))
if _this_dir not in sys.path:
    sys.path.insert(0, _this_dir)

try:
    from bimazim_max.socket_service import SocketService

    DEFAULT_PORT = 8096
    _service = SocketService(DEFAULT_PORT)
    _service.start()

    # Expose a couple of MAXScript-callable globals for manual start/stop, mirroring the
    # ribbon/menu toggle the Revit/Navisworks/AutoCAD/SketchUp plugins expose.
    import pymxs

    def _bimazim_toggle():
        if _service.is_running():
            _service.stop()
            print("BIM-AZIM service stopped.")
        else:
            _service.start()
            print(f"BIM-AZIM service running on port {_service.port}.")

    pymxs.runtime.bimAzimToggleService = _bimazim_toggle
    print(f"BIM-AZIM: 3ds Max plugin loaded (service on port {_service.port}). "
          f"Run bimAzimToggleService() in the MAXScript listener to start/stop it.")
except Exception as e:  # noqa: BLE001 — a startup script failure must not break 3ds Max's launch
    print(f"BIM-AZIM: startup failed (non-fatal): {e}")
