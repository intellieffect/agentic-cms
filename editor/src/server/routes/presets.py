"""Preset API routes."""
import json
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/presets", tags=["presets"])

PRESETS_DIR = Path(__file__).resolve().parent.parent.parent / "presets"


def _load_presets() -> list[dict]:
    presets = []
    if not PRESETS_DIR.exists():
        return presets
    for f in sorted(PRESETS_DIR.glob("*.json")):
        try:
            presets.append(json.loads(f.read_text()))
        except Exception:
            pass
    return presets


@router.get("")
async def list_presets():
    return {"presets": _load_presets()}


@router.get("/{preset_id}")
async def get_preset(preset_id: str):
    for p in _load_presets():
        if p.get("id") == preset_id:
            return p
    return JSONResponse({"error": "not found"}, status_code=404)
