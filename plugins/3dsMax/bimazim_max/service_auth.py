"""Shared secret every request must carry — reads/writes the SAME file as the Revit/Navisworks/
AutoCAD/SketchUp plugins' ServiceAuth, so one token covers every engine for this Windows user:
%LOCALAPPDATA%\\BimAzim\\auth.token. Whichever bridge starts first creates it.
"""
import os
import secrets

from . import service_endpoint

FIELD_NAME = "auth"
UNAUTHORIZED_CODE = -32001

_cached_token = None


def file_path():
    return os.path.join(service_endpoint.root_directory(), "auth.token")


def token():
    global _cached_token
    if _cached_token is None:
        _cached_token = _load_or_create()
    return _cached_token


def authorized(request):
    presented = request.get(FIELD_NAME)
    if not presented:
        return False
    if _fixed_time_equals(presented, token()):
        return True

    global _cached_token
    _cached_token = _load_or_create()
    return _fixed_time_equals(presented, _cached_token)


def unauthorized_response(request):
    return {
        "jsonrpc": "2.0",
        "id": str(request.get("id", "0")),
        "error": {
            "code": UNAUTHORIZED_CODE,
            "message": "Unauthorized: missing or invalid BIM-AZIM auth token. Reinstall BIM-AZIM and restart 3ds Max.",
        },
    }


def _load_or_create():
    existing = _try_read()
    if existing:
        return existing

    os.makedirs(service_endpoint.root_directory(), exist_ok=True)
    fresh = secrets.token_hex(32)
    path = file_path()
    temp = f"{path}.{secrets.token_hex(8)}.tmp"
    with open(temp, "w", encoding="utf-8") as f:
        f.write(fresh)
    try:
        if not os.path.exists(path):
            os.replace(temp, path)
        return _try_read() or fresh
    except OSError:
        try:
            os.remove(temp)
        except OSError:
            pass
        return _try_read() or fresh


def _try_read():
    path = file_path()
    try:
        if not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            text = f.read().strip()
        return text if len(text) >= 32 else None
    except OSError:
        return None


def _fixed_time_equals(a, b):
    if len(a) != len(b):
        return False
    diff = 0
    for x, y in zip(a.encode("utf-8"), b.encode("utf-8")):
        diff |= x ^ y
    return diff == 0
