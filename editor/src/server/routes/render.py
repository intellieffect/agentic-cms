"""Render & Analyze API routes."""
import json
import os
import shutil
import threading
from pathlib import Path
from urllib.parse import quote

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse

router = APIRouter(tags=["render"])

# Shared state (same pattern as original server.py)
render_status = {"state": "idle", "progress": 0, "total": 0, "error": None, "output": None}
render_lock = threading.Lock()

analyze_status = {"state": "idle", "progress": "", "error": None, "result": None}
analyze_lock = threading.Lock()

BASE = Path(__file__).resolve().parent.parent.parent / "editor"


# ---------- Render ----------

@router.post("/api/render")
async def start_render(request: Request):
    body = await request.json()
    clips = body.get("clips", [])
    if not clips:
        return JSONResponse({"error": "No clips"}, status_code=400)

    with render_lock:
        render_status.update(
            state="rendering", progress=0, total=len(clips), error=None, output=None
        )

    from src.server.renderer import run_render
    t = threading.Thread(target=run_render, args=(body, BASE, render_status, render_lock), daemon=True)
    t.start()

    return {"status": "started", "total": len(clips)}


@router.get("/api/render/status")
async def render_get_status():
    return render_status


@router.get("/api/render/download")
async def render_download(request: Request):
    output = render_status.get("output")
    if not output or not os.path.exists(output):
        return JSONResponse({"error": "No rendered file"}, status_code=404)

    custom_name = request.query_params.get("filename", "")
    fname = custom_name if custom_name else os.path.basename(output)
    if not fname.endswith('.mp4'):
        fname += '.mp4'
    fname_ascii = fname.encode("ascii", "replace").decode("ascii")
    fname_encoded = quote(fname)
    headers = {
        "Content-Disposition": f'attachment; filename="{fname_ascii}"; filename*=UTF-8\'\'{fname_encoded}'
    }
    return FileResponse(output, media_type="video/mp4", headers=headers)


@router.get("/api/render/download/{filename}")
async def render_download_named(filename: str):
    """Download with filename in URL path — works in cross-origin iframes."""
    output = render_status.get("output")
    if not output or not os.path.exists(output):
        return JSONResponse({"error": "No rendered file"}, status_code=404)

    fname = filename if filename.endswith('.mp4') else filename + '.mp4'
    fname_ascii = fname.encode("ascii", "replace").decode("ascii")
    fname_encoded = quote(fname)
    headers = {
        "Content-Disposition": f'attachment; filename="{fname_ascii}"; filename*=UTF-8\'\'{fname_encoded}'
    }
    return FileResponse(output, media_type="video/mp4", headers=headers)


# ---------- Analyze ----------

@router.post("/api/analyze")
async def start_analyze(request: Request):
    body = await request.json()
    files = body.get("files", [])
    options = body.get("options", {})

    if not files:
        return JSONResponse({"error": "No files selected"}, status_code=400)

    with analyze_lock:
        analyze_status.update(state="analyzing", progress="준비 중...", error=None, result=None)

    from src.server.renderer import run_analyze
    t = threading.Thread(target=run_analyze, args=(files, options, BASE, analyze_status, analyze_lock), daemon=True)
    t.start()

    return {"status": "started"}


@router.get("/api/analyze/status")
async def analyze_get_status():
    return analyze_status
