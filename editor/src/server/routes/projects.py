"""Project CRUD routes — replaces both Next.js API and legacy local JSON."""
import json
import logging
import os
import re
import subprocess
import threading
import time
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["projects"])

# Base directory for editor media / local project fallback
BASE = Path(__file__).resolve().parent.parent.parent / "editor"
PROJECTS_DIR = BASE / "_projects"

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _is_uuid(s: str) -> bool:
    return bool(_UUID_RE.match(s))


def _safe_project_path(pid: str) -> Path | None:
    if not pid or "/" in pid or "\\" in pid or ".." in pid:
        return None
    PROJECTS_DIR.mkdir(exist_ok=True)
    fpath = (PROJECTS_DIR / f"{pid}.json").resolve()
    if not str(fpath).startswith(str(PROJECTS_DIR.resolve())):
        return None
    return fpath


def _try_supabase():
    """Return supabase helpers or None if not configured."""
    try:
        from src.db.supabase import (
            list_projects,
            get_project,
            create_project,
            update_project,
            delete_project,
            row_to_summary,
            row_to_project,
        )
        return {
            "list": list_projects,
            "get": get_project,
            "create": create_project,
            "update": update_project,
            "delete": delete_project,
            "to_summary": row_to_summary,
            "to_project": row_to_project,
        }
    except Exception as e:
        # Import failure (e.g., supabase package missing) — legitimate skip,
        # editor 는 local JSON 모드로 fallback. DEBUG 레벨로만 기록.
        logger.debug("Supabase helpers unavailable: %s", e)
        return None


# ---------- GET /api/projects ----------

@router.get("")
async def project_list(status: str | None = None, limit: int = 50, offset: int = 0):
    projects = []
    db_ids: set[str] = set()

    db = _try_supabase()
    if db:
        try:
            rows = db["list"](status=status, limit=limit, offset=offset)
            for row in rows:
                pd = row.get("project_data") or {}
                projects.append({
                    "id": row["id"],
                    "name": row.get("name", ""),
                    "clipCount": row.get("clip_count", 0),
                    "totalDuration": row.get("duration", 0),
                    "updatedAt": row.get("updated_at", ""),
                    "sources": row.get("source_files", []),
                    "source": "db",
                    "locked": pd.get("locked", False) if isinstance(pd, dict) else False,
                })
                db_ids.add(row["id"])
        except Exception as e:
            # DB list 실패 — 테이블 이름 오염, RLS, 네트워크 등 원인 가능.
            # 2026-04-18 TABLE_PROJECTS 드리프트 버그가 silent fail 로 2일 숨겨졌던
            # 이유이므로 이제는 반드시 WARNING 로 기록한다.
            logger.warning("project_list DB lookup failed (falling back to local): %s", e)

    # Merge local-only projects
    PROJECTS_DIR.mkdir(exist_ok=True)
    for f in sorted(PROJECTS_DIR.glob("*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
        try:
            data = json.loads(f.read_text())
            db_id = data.get("dbId")
            if db_id and db_id in db_ids:
                continue
            # Also skip if local filename matches a DB project ID
            if f.stem in db_ids:
                continue
            projects.append({
                "id": f.stem,
                "name": data.get("name", f.stem),
                "clipCount": len(data.get("clips", [])),
                "totalDuration": round(data.get("totalDuration", 0), 1),
                "updatedAt": f.stat().st_mtime,
                "sources": data.get("sources", []),
                "source": "local",
            })
        except Exception as e:
            # 개별 JSON 파일 parsing 실패 — 파일 1개 깨져도 목록 전체는 계속.
            logger.warning("Failed to parse local project file %s: %s", f, e)

    return {"projects": projects}


# ---------- POST /api/projects ----------

@router.post("")
async def project_create(request: Request):
    body = await request.json()
    name = body.get("name", "").strip()
    if not name:
        return JSONResponse({"error": "name required"}, status_code=400)

    db = _try_supabase()
    if db:
        try:
            row = db["create"](body)
            if row:
                return JSONResponse({"project": db["to_project"](row)}, status_code=201)
            logger.warning("project_create DB insert returned no row — falling back to local save")
        except Exception as e:
            logger.warning("project_create DB insert raised (falling back to local): %s", e)

    # Fallback: local save
    pid = f"project_{int(time.time() * 1000)}"
    body["id"] = pid
    fpath = _safe_project_path(pid)
    if fpath:
        fpath.parent.mkdir(exist_ok=True)
        fpath.write_text(json.dumps(body, ensure_ascii=False, indent=2))
    return JSONResponse({"project": body}, status_code=201)


# ---------- GET /api/projects/{id} ----------

@router.get("/{project_id}")
async def project_get(project_id: str):
    db = _try_supabase()
    if db and _is_uuid(project_id):
        try:
            row = db["get"](project_id)
            if row:
                return {"project": db["to_project"](row)}
        except Exception as e:
            logger.warning("project_get DB lookup failed for %s (trying local): %s", project_id, e)

    fpath = _safe_project_path(project_id)
    if fpath and fpath.exists():
        data = json.loads(fpath.read_text())
        return {"project": data}
    return JSONResponse({"error": "not found"}, status_code=404)


# ---------- PATCH /api/projects/{id} ----------

def _is_locked(project_id: str) -> bool:
    """Check if a project is locked."""
    db = _try_supabase()
    if db and _is_uuid(project_id):
        try:
            row = db["get"](project_id)
            if row:
                pd = row.get("project_data") or {}
                return pd.get("locked", False) if isinstance(pd, dict) else False
        except Exception as e:
            logger.debug("_is_locked DB lookup failed for %s: %s", project_id, e)
    return False


@router.patch("/{project_id}")
async def project_update(project_id: str, request: Request):
    body = await request.json()

    # Allow locked toggle even when locked
    is_lock_toggle = list(body.keys()) == ["locked"]
    if not is_lock_toggle and _is_locked(project_id):
        return JSONResponse({"error": "프로젝트가 잠겨있습니다. 잠금을 해제한 후 수정하세요."}, status_code=403)

    db = _try_supabase()
    if db and _is_uuid(project_id):
        try:
            row = db["update"](project_id, body)
            if row:
                return {"project": db["to_project"](row)}
            logger.warning("project_update DB update returned no row for %s (falling back to local)", project_id)
        except Exception as e:
            logger.warning("project_update DB update failed for %s (falling back to local): %s", project_id, e)

    # Local fallback
    fpath = _safe_project_path(project_id)
    if fpath and fpath.exists():
        data = json.loads(fpath.read_text())
        data.update(body)
        fpath.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        return {"project": data}
    return JSONResponse({"error": "not found"}, status_code=404)


# ---------- DELETE /api/projects/{id} ----------

@router.delete("/{project_id}")
async def project_delete(project_id: str):
    if _is_locked(project_id):
        return JSONResponse({"error": "프로젝트가 잠겨있습니다. 잠금을 해제한 후 삭제하세요."}, status_code=403)

    db = _try_supabase()
    if db and _is_uuid(project_id):
        try:
            db["delete"](project_id)
        except Exception as e:
            logger.warning("project_delete DB soft-delete failed for %s (continuing to local unlink): %s", project_id, e)

    fpath = _safe_project_path(project_id)
    if fpath and fpath.exists():
        fpath.unlink()
    return {"ok": True}


# ---------- Legacy endpoints (editor.html compatibility) ----------

@router.post("/save")
async def project_save(request: Request):
    """Legacy: POST /api/projects/save — used by editor frontend."""
    body = await request.json()

    # Check lock on existing project
    db_id = body.get("dbId")
    if db_id and _is_locked(db_id):
        return JSONResponse({"error": "프로젝트가 잠겨있습니다. 잠금을 해제한 후 수정하세요."}, status_code=403)

    PROJECTS_DIR.mkdir(exist_ok=True)

    pid = body.get("id") or f"project_{int(time.time() * 1000)}"
    body["id"] = pid

    fpath = _safe_project_path(pid)
    if not fpath:
        return {"error": "Invalid project id"}

    # Auto-fill totalDuration for bgmClips if missing
    bgm_clips = body.get("bgmClips", [])
    for bgm in bgm_clips:
        if not bgm.get("totalDuration") and bgm.get("source"):
            bgm_path = BASE / bgm["source"]
            if bgm_path.exists():
                try:
                    result = subprocess.run(
                        ["ffprobe", "-v", "quiet", "-show_entries",
                         "format=duration", "-of", "json", str(bgm_path)],
                        capture_output=True, text=True, timeout=10,
                    )
                    if result.stdout:
                        probe = json.loads(result.stdout)
                        dur = float(probe.get("format", {}).get("duration", 0))
                        if dur > 0:
                            bgm["totalDuration"] = round(dur, 3)
                except Exception as e:
                    # ffprobe 실패 — duration 보조 계산만 놓치는 수준, save 자체는 계속.
                    logger.debug("ffprobe failed for BGM %s: %s", bgm.get("source"), e)

    # DB save
    db = _try_supabase()
    db_id = body.get("dbId")
    if db:
        try:
            db_payload = {
                "name": body.get("name", pid),
                "orientation": body.get("orientation", "vertical"),
                "projectData": body,
                "clipCount": len(body.get("clips", [])),
                "duration": body.get("totalDuration", 0),
                "sourceFiles": [
                    {"filename": s} if isinstance(s, str) else s
                    for s in body.get("sources", [])
                ],
            }
            if db_id:
                row = db["update"](db_id, db_payload)
            else:
                row = db["create"](db_payload)
            if row:
                body["dbId"] = row["id"]
            else:
                # 이게 바로 TABLE_PROJECTS 드리프트 버그가 숨어 있던 지점 —
                # row 가 None 이면 save 실패한 것이므로 경고 로그 필수.
                logger.warning(
                    "project_save DB %s returned no row (pid=%s, dbId=%s) — saved to local only",
                    "update" if db_id else "insert", pid, db_id,
                )
        except Exception as e:
            logger.warning(
                "project_save DB operation raised (pid=%s, dbId=%s) — falling back to local only: %s",
                pid, db_id, e,
            )

    fpath.parent.mkdir(exist_ok=True)
    fpath.write_text(json.dumps(body, ensure_ascii=False, indent=2))
    return {"status": "saved", "id": pid, "dbId": body.get("dbId")}


def _ensure_proxies(data: dict) -> None:
    """Background: ensure proxy exists for every clip source."""
    proxy_dir = BASE / "_proxy"
    proxy_dir.mkdir(exist_ok=True)
    clips = data.get("clips", [])
    bgms = data.get("bgmClips", [])
    all_sources = [c.get("source", "") for c in clips] + [b.get("source", "") for b in bgms]

    for fname in set(all_sources):
        if not fname:
            continue
        proxy_path = proxy_dir / fname
        # Check if proxy exists AND is valid (has moov atom)
        if proxy_path.exists():
            # Quick validation: file > 1KB and ffprobe doesn't error
            if proxy_path.stat().st_size > 1024:
                r = subprocess.run(["ffprobe", "-v", "error", str(proxy_path)], capture_output=True, text=True, timeout=5)
                if not r.stderr:
                    continue
            # Broken proxy — delete and recreate
            proxy_path.unlink(missing_ok=True)
        # Only proxy video files
        if not fname.lower().endswith(('.mp4', '.mov', '.mkv', '.avi')):
            continue
        src_path = BASE / fname
        if not src_path.exists():
            continue
        try:
            from src.server.proxy_utils import generate_proxy
            generate_proxy(src_path, proxy_path)
        except Exception:
            pass


@router.get("/load/{project_id}")
async def project_load(project_id: str):
    """Legacy: GET /api/projects/load/{id} — used by editor frontend."""
    data = None
    db = _try_supabase()
    if db and _is_uuid(project_id):
        try:
            row = db["get"](project_id)
            if row:
                data = row.get("project_data") or {}
                data["dbId"] = row["id"]
                data["name"] = row.get("name") or data.get("name") or ""
                data["locked"] = data.get("locked", False)
        except Exception:
            pass

    if data is None:
        fpath = _safe_project_path(project_id)
        if not fpath or not fpath.exists():
            return JSONResponse({"error": "not found"}, status_code=404)
        data = json.loads(fpath.read_text())

    # Background: ensure proxies for all clips
    threading.Thread(target=_ensure_proxies, args=(data,), daemon=True).start()

    return data


@router.post("/delete")
async def project_delete_legacy(request: Request):
    """Legacy: POST /api/projects/delete."""
    body = await request.json()
    pid = body.get("id")
    if not pid:
        return {"error": "No id"}

    db_id = body.get("dbId")
    db = _try_supabase()
    if db and db_id:
        try:
            db["delete"](db_id)
        except Exception:
            pass

    fpath = _safe_project_path(pid)
    if fpath and fpath.exists():
        fpath.unlink()
    return {"status": "deleted"}


@router.post("/rename")
async def project_rename(request: Request):
    """Legacy: POST /api/projects/rename."""
    body = await request.json()
    pid = body.get("id")
    new_name = body.get("name", "")
    if not pid:
        return JSONResponse({"error": "No id"}, status_code=400)
    if not new_name.strip():
        return JSONResponse({"error": "name required"}, status_code=400)

    new_name = new_name.strip()
    fpath = _safe_project_path(pid)
    db_id = body.get("dbId")

    # Update local JSON if it exists
    if fpath and fpath.exists():
        data = json.loads(fpath.read_text())
        data["name"] = new_name
        db_id = db_id or data.get("dbId")
        fpath.write_text(json.dumps(data, ensure_ascii=False))

    # If id itself is a UUID, use it as db_id (frontend sends DB UUID as id)
    if not db_id and _is_uuid(pid):
        db_id = pid

    db = _try_supabase()
    if db and db_id:
        try:
            db["update"](db_id, {"name": new_name})
        except Exception:
            pass

    return {"status": "renamed"}
