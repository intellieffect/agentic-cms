"""Finished videos routes — CRUD + upload + thumbnail.
Files are uploaded to Supabase Storage (bucket: finished).
"""
import os
import json
import subprocess
import shutil
import uuid
import tempfile
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import quote

from fastapi import APIRouter, Request, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse
from src.server.table_config import TABLE_FINISHED
from src.server.storage import get_storage, STORAGE_MODE

router = APIRouter(tags=["finished"])

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
STORAGE_BUCKET = "finished"

# 로컬 임시 디렉토리 (ffprobe/썸네일 생성용)
FINISHED_DIR = Path(os.environ.get("FINISHED_DIR", str(Path(__file__).resolve().parent.parent.parent / "editor" / "_finished")))
FINISHED_DIR.mkdir(parents=True, exist_ok=True)
THUMB_DIR = FINISHED_DIR / "_thumbs"
THUMB_DIR.mkdir(exist_ok=True)


def _upload_to_storage(sb, local_path: Path, storage_path: str, content_type: str = "video/mp4") -> str:
    """Storage에 파일 업로드 후 URL 반환. cloud→Supabase Storage, local→로컬 파일 경로."""
    storage = get_storage()
    data = local_path.read_bytes()
    return storage.upload_file(STORAGE_BUCKET, storage_path, data, content_type)


def _get_sb():
    from src.db.supabase import get_client
    return get_client()


def _probe(path):
    """ffprobe로 영상 정보 추출."""
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", str(path)],
            capture_output=True, timeout=10,
        )
        info = json.loads(r.stdout)
        duration = float(info.get("format", {}).get("duration", 0))
        size = int(info.get("format", {}).get("size", 0))
        width = height = 0
        for s in info.get("streams", []):
            if s.get("codec_type") == "video":
                width = s.get("width", 0)
                height = s.get("height", 0)
                break
        return duration, size, width, height
    except Exception:
        return 0, 0, 0, 0


def _make_thumb(video_path, thumb_path):
    """ffmpeg로 썸네일 생성."""
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(video_path), "-ss", "1", "-vframes", "1",
             "-vf", "scale=240:-2", "-q:v", "6", str(thumb_path)],
            capture_output=True, timeout=10,
        )
    except Exception:
        pass


@router.get("/api/finished")
async def list_finished(limit: int = 50, offset: int = 0):
    sb = _get_sb()
    resp = (
        sb.table(TABLE_FINISHED)
        .select("*")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    return {"videos": resp.data or []}


@router.get("/api/finished/{video_id}")
async def get_finished(video_id: str):
    sb = _get_sb()
    resp = sb.table(TABLE_FINISHED).select("*").eq("id", video_id).single().execute()
    if not resp.data:
        return JSONResponse({"error": "not found"}, status_code=404)
    return {"video": resp.data}


@router.get("/api/finished/{video_id}/stream")
async def stream_finished(video_id: str, request: Request):
    from fastapi.responses import RedirectResponse
    sb = _get_sb()
    try:
        resp = sb.table(TABLE_FINISHED).select("file_path,file_url,name").eq("id", video_id).maybe_single().execute()
    except Exception:
        return JSONResponse({"error": "not found"}, status_code=404)
    if not resp or not resp.data:
        return JSONResponse({"error": "not found"}, status_code=404)

    file_url = resp.data.get("file_url")
    fpath_str = resp.data.get("file_path", "")
    fpath = Path(fpath_str).expanduser() if fpath_str else None

    # Cloud mode: always redirect to storage URL
    if STORAGE_MODE == 'cloud':
        storage = get_storage()
        if file_url:
            return RedirectResponse(file_url, status_code=302)
        # Try storage bucket directly
        vid_name = f"{video_id}.mp4"
        if storage.file_exists(STORAGE_BUCKET, vid_name):
            return RedirectResponse(storage.get_file_url(STORAGE_BUCKET, vid_name), status_code=302)
        return JSONResponse({"error": "file missing"}, status_code=404)

    # Local mode: 로컬 파일 우선, 없으면 file_url 리다이렉트
    if fpath and fpath.exists():
        pass  # 로컬 파일 사용
    elif file_url:
        return RedirectResponse(file_url, status_code=302)
    else:
        return JSONResponse({"error": "file missing"}, status_code=404)

    # ?download=1 이면 attachment로 다운로드 (파일명 포함)
    if request.query_params.get("download"):
        fname_param = request.query_params.get("name", "")
        fname = fname_param if fname_param else (resp.data.get("name") or "video") + ".mp4"
        if not fname.endswith(".mp4"):
            fname += ".mp4"
        fname_encoded = quote(fname)
        headers = {
            "Content-Disposition": f"attachment; filename=\"video.mp4\"; filename*=UTF-8''{fname_encoded}"
        }
        return FileResponse(str(fpath), media_type="video/mp4", headers=headers)

    return FileResponse(str(fpath), media_type="video/mp4")


@router.get("/api/finished/{video_id}/download/{filename}")
async def download_finished_named(video_id: str, filename: str):
    """Download with filename in URL path — browser uses this as save name."""
    from fastapi.responses import RedirectResponse
    sb = _get_sb()
    try:
        resp = sb.table(TABLE_FINISHED).select("file_path,file_url").eq("id", video_id).maybe_single().execute()
    except Exception:
        return JSONResponse({"error": "not found"}, status_code=404)
    if not resp or not resp.data:
        return JSONResponse({"error": "not found"}, status_code=404)

    # Cloud mode: redirect to storage URL
    if STORAGE_MODE == 'cloud':
        file_url = resp.data.get("file_url")
        if file_url:
            return RedirectResponse(file_url, status_code=302)
        return JSONResponse({"error": "file missing"}, status_code=404)

    # Local mode: serve file directly
    fpath_str = resp.data.get("file_path", "")
    if not fpath_str:
        return JSONResponse({"error": "not found"}, status_code=404)
    fpath = Path(fpath_str).expanduser()
    if not fpath.exists():
        return JSONResponse({"error": "file missing"}, status_code=404)
    fname = filename if filename.endswith('.mp4') else filename + '.mp4'
    headers = {
        "Content-Disposition": f'attachment; filename="{fname}"'
    }
    return FileResponse(str(fpath), media_type="video/mp4", headers=headers)


@router.get("/api/finished/{video_id}/thumbnail")
async def thumbnail_finished(video_id: str):
    from fastapi.responses import RedirectResponse
    sb = _get_sb()
    resp = sb.table(TABLE_FINISHED).select("file_path,thumbnail_path").eq("id", video_id).single().execute()
    if not resp.data:
        return JSONResponse({"error": "not found"}, status_code=404)
    thumb = resp.data.get("thumbnail_path", "")

    # Storage URL이면 리다이렉트
    if thumb and thumb.startswith("http"):
        return RedirectResponse(thumb, status_code=302)

    # Cloud mode: check storage bucket for thumbnail
    if STORAGE_MODE == 'cloud':
        storage = get_storage()
        thumb_key = f"_thumbs/{video_id}.jpg"
        if storage.file_exists(STORAGE_BUCKET, thumb_key):
            return RedirectResponse(storage.get_file_url(STORAGE_BUCKET, thumb_key), status_code=302)
        return JSONResponse({"error": "no thumbnail"}, status_code=404)

    # Local mode: existing behavior
    if thumb and Path(thumb).expanduser().exists():
        return FileResponse(str(Path(thumb).expanduser()), media_type="image/jpeg")

    # 자동 생성 시도
    fpath = resp.data.get("file_path")
    if fpath and Path(fpath).expanduser().exists():
        tp = THUMB_DIR / f"{video_id}.jpg"
        _make_thumb(fpath, tp)
        if tp.exists():
            sb.table(TABLE_FINISHED).update({"thumbnail_path": str(tp)}).eq("id", video_id).execute()
            return FileResponse(str(tp), media_type="image/jpeg")
    return JSONResponse({"error": "no thumbnail"}, status_code=404)


@router.post("/api/finished/upload")
async def upload_finished(
    file: UploadFile = File(...),
    name: str = Form(None),
    project_id: str = Form(None),
    tags: str = Form(None),
    notes: str = Form(None),
):
    """완료 영상 직접 업로드 → Supabase Storage."""
    vid = str(uuid.uuid4())
    ext = Path(file.filename).suffix or ".mp4"
    
    # 임시 파일에 저장 (ffprobe + 썸네일 생성용)
    dest = FINISHED_DIR / f"{vid}{ext}"
    with open(dest, "wb") as f:
        shutil.copyfileobj(file.file, f)
    
    duration, file_size, width, height = _probe(dest)
    
    # 썸네일 생성
    thumb_path = THUMB_DIR / f"{vid}.jpg"
    _make_thumb(dest, thumb_path)
    
    sb = _get_sb()
    
    # Supabase Storage 업로드
    file_url = _upload_to_storage(sb, dest, f"{vid}{ext}", "video/mp4")
    thumb_url = None
    if thumb_path.exists():
        thumb_url = _upload_to_storage(sb, thumb_path, f"_thumbs/{vid}.jpg", "image/jpeg")
    
    tag_list = [t.strip() for t in (tags or "").split(",") if t.strip()] if tags else None
    
    row = {
        "id": vid,
        "name": name or file.filename or "Untitled",
        "project_id": project_id if project_id else None,
        "file_path": str(dest),
        "file_url": file_url,
        "thumbnail_path": thumb_url if thumb_url else (str(thumb_path) if thumb_path.exists() else None),
        "duration": duration,
        "file_size": file_size or dest.stat().st_size,
        "width": width,
        "height": height,
        "tags": tag_list,
        "notes": notes,
    }
    
    sb.table(TABLE_FINISHED).insert(row).execute()
    
    # 로컬 임시 파일 정리 (Storage에 올렸으므로)
    try:
        dest.unlink(missing_ok=True)
        thumb_path.unlink(missing_ok=True)
    except Exception:
        pass
    
    return {"id": vid, "name": row["name"], "file_url": file_url}


@router.post("/api/finished/from-render")
async def save_from_render(request: Request):
    """렌더링 결과를 완료 영상으로 저장."""
    body = await request.json()
    source_path = body.get("filePath")
    name = body.get("name", "Untitled")
    project_id = body.get("projectId")
    tags = body.get("tags", [])
    notes = body.get("notes", "")
    
    # filePath can be an API path — resolve to actual file
    if source_path and source_path.startswith("/api/render"):
        if "remotion" in source_path:
            from src.server.routes.render_remotion import remotion_render_status
            source_path = remotion_render_status.get("output")
        else:
            from src.server.routes.render import render_status
            source_path = render_status.get("output")
    if not source_path or not Path(source_path).exists():
        return JSONResponse({"error": "source file not found"}, status_code=400)
    
    vid = str(uuid.uuid4())
    ext = Path(source_path).suffix or ".mp4"
    dest = FINISHED_DIR / f"{vid}{ext}"
    shutil.copy2(source_path, dest)
    
    duration, file_size, width, height = _probe(dest)
    thumb_path = THUMB_DIR / f"{vid}.jpg"
    _make_thumb(dest, thumb_path)
    
    sb = _get_sb()
    
    # Supabase Storage 업로드
    file_url = _upload_to_storage(sb, dest, f"{vid}{ext}", "video/mp4")
    thumb_url = None
    if thumb_path.exists():
        thumb_url = _upload_to_storage(sb, thumb_path, f"_thumbs/{vid}.jpg", "image/jpeg")
    
    row = {
        "id": vid,
        "name": name,
        "project_id": project_id,
        "file_path": str(dest),
        "file_url": file_url,
        "thumbnail_path": thumb_url if thumb_url else (str(thumb_path) if thumb_path.exists() else None),
        "duration": duration,
        "file_size": file_size or dest.stat().st_size,
        "width": width,
        "height": height,
        "tags": tags if tags else None,
        "notes": notes,
    }
    
    sb.table(TABLE_FINISHED).insert(row).execute()
    
    # Cloud 모드에서만 로컬 임시 파일 정리 (local 모드에서는 보존)
    if STORAGE_MODE == 'cloud':
        try:
            dest.unlink(missing_ok=True)
            thumb_path.unlink(missing_ok=True)
        except Exception:
            pass
    return {"id": vid, "name": name}


@router.patch("/api/finished/{video_id}")
async def update_finished(video_id: str, request: Request):
    """완료 영상 메타 수정 (name, tags, notes)."""
    body = await request.json()
    update = {}
    if "name" in body:
        update["name"] = body["name"]
    if "tags" in body:
        update["tags"] = body["tags"]
    if "notes" in body:
        update["notes"] = body["notes"]
    if not update:
        return JSONResponse({"error": "nothing to update"}, status_code=400)
    sb = _get_sb()
    resp = sb.table(TABLE_FINISHED).update(update).eq("id", video_id).execute()
    if not resp.data:
        return JSONResponse({"error": "not found"}, status_code=404)
    return resp.data[0]


@router.delete("/api/finished/{video_id}")
async def delete_finished(video_id: str):
    sb = _get_sb()
    resp = sb.table(TABLE_FINISHED).select("file_path,thumbnail_path").eq("id", video_id).single().execute()
    if resp.data:
        if STORAGE_MODE == 'cloud':
            # Delete from cloud storage
            storage = get_storage()
            storage.delete_file(STORAGE_BUCKET, f"{video_id}.mp4")
            storage.delete_file(STORAGE_BUCKET, f"_thumbs/{video_id}.jpg")
        else:
            # Delete local files
            for key in ["file_path", "thumbnail_path"]:
                p = resp.data.get(key)
                if p and not p.startswith("http") and Path(p).exists():
                    try:
                        Path(p).unlink()
                    except Exception:
                        pass
        sb.table(TABLE_FINISHED).delete().eq("id", video_id).execute()
    return {"ok": True}
