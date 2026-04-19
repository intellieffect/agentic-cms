"""Plans API — 기획 CRUD + status 전환.

Uses Supabase if table exists, otherwise falls back to local JSON.
"""
import uuid
import json
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from src.server.table_config import TABLE_PLANS

router = APIRouter(prefix="/api/plans", tags=["plans"])

# ─── Local JSON fallback ───
_DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
_PLANS_FILE = _DATA_DIR / "plans.json"
_USE_DB: bool | None = None


def _ensure_data_dir():
    _DATA_DIR.mkdir(parents=True, exist_ok=True)


def _read_json(path: Path) -> list[dict]:
    _ensure_data_dir()
    if not path.exists():
        path.write_text("[]")
    try:
        return json.loads(path.read_text())
    except Exception:
        return []


def _write_json(path: Path, data: list[dict]):
    _ensure_data_dir()
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str))


def _get_sb():
    try:
        from src.db.supabase import get_client
        return get_client()
    except Exception:
        return None


def _check_table(table_name: str) -> bool:
    sb = _get_sb()
    if not sb:
        return False
    try:
        sb.table(table_name).select("id").limit(1).execute()
        return True
    except Exception:
        return False


def _check_db() -> bool:
    global _USE_DB
    if _USE_DB is not None:
        return _USE_DB
    _USE_DB = _check_table(TABLE_PLANS)
    return _USE_DB


# ─── Models ───

class PlanCreate(BaseModel):
    title: str
    source_url: str = ''
    source_text: str = ''
    type: str = 'both'  # carousel | video | both
    references: dict = {}  # { videos: [], finished: [], carousels: [] }
    carousel_plan: dict = {}
    video_plan: dict = {}
    trend_research: dict = {}
    status: str = 'draft'  # draft | confirmed | executed


class PlanUpdate(BaseModel):
    title: Optional[str] = None
    source_url: Optional[str] = None
    source_text: Optional[str] = None
    type: Optional[str] = None
    references: Optional[dict] = None
    carousel_plan: Optional[dict] = None
    video_plan: Optional[dict] = None
    trend_research: Optional[dict] = None
    status: Optional[str] = None


# ═══════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════

@router.post("")
async def create_plan(body: PlanCreate):
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": f"plan-{uuid.uuid4().hex[:8]}",
        "title": body.title,
        "source_url": body.source_url,
        "source_text": body.source_text,
        "type": body.type,
        "references": body.references,
        "carousel_plan": body.carousel_plan,
        "video_plan": body.video_plan,
        "status": body.status,
        "created_at": now,
        "updated_at": now,
    }
    if _check_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_PLANS).insert(row).execute()
            return resp.data[0] if resp.data else row
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_PLANS_FILE)
        items.append(row)
        _write_json(_PLANS_FILE, items)
        return row


@router.get("")
async def list_plans(status: Optional[str] = None, limit: int = 50, offset: int = 0):
    if _check_db():
        sb = _get_sb()
        try:
            q = sb.table(TABLE_PLANS).select("*", count="exact") \
                .order("updated_at", desc=True)
            if status:
                q = q.eq("status", status)
            q = q.range(offset, offset + limit - 1)
            resp = q.execute()
            return {"plans": resp.data or [], "total": resp.count or 0}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_PLANS_FILE)
        if status:
            items = [p for p in items if p.get("status") == status]
        items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        total = len(items)
        sliced = items[offset:offset + limit]
        return {"plans": sliced, "total": total}


@router.get("/{plan_id}")
async def get_plan(plan_id: str):
    if _check_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_PLANS).select("*").eq("id", plan_id).single().execute()
            return resp.data
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=404)
    else:
        items = _read_json(_PLANS_FILE)
        found = next((p for p in items if p["id"] == plan_id), None)
        if not found:
            return JSONResponse({"error": "not found"}, status_code=404)
        return found


@router.patch("/{plan_id}")
async def update_plan(plan_id: str, body: PlanUpdate):
    now = datetime.now(timezone.utc).isoformat()
    update: dict = {"updated_at": now}
    for field in ["title", "source_url", "source_text", "type", "references",
                   "carousel_plan", "video_plan", "trend_research", "status"]:
        val = getattr(body, field)
        if val is not None:
            update[field] = val

    if _check_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_PLANS).update(update).eq("id", plan_id).execute()
            return resp.data[0] if resp.data else {"id": plan_id, **update}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_PLANS_FILE)
        for i, p in enumerate(items):
            if p["id"] == plan_id:
                items[i] = {**p, **update}
                _write_json(_PLANS_FILE, items)
                return items[i]
        return JSONResponse({"error": "not found"}, status_code=404)


@router.delete("/{plan_id}")
async def delete_plan(plan_id: str):
    if _check_db():
        sb = _get_sb()
        try:
            sb.table(TABLE_PLANS).delete().eq("id", plan_id).execute()
            return {"ok": True}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_PLANS_FILE)
        items = [p for p in items if p["id"] != plan_id]
        _write_json(_PLANS_FILE, items)
        return {"ok": True}


# ═══════════════════════════════════════════
# Status transitions
# ═══════════════════════════════════════════

@router.post("/{plan_id}/confirm")
async def confirm_plan(plan_id: str):
    """draft → confirmed"""
    now = datetime.now(timezone.utc).isoformat()
    update = {"status": "confirmed", "updated_at": now}

    if _check_db():
        sb = _get_sb()
        try:
            # status가 draft인지 확인
            existing = sb.table(TABLE_PLANS).select("status").eq("id", plan_id).single().execute()
            if existing.data.get("status") != "draft":
                return JSONResponse({"error": "draft 상태만 확정할 수 있습니다"}, status_code=400)
            resp = sb.table(TABLE_PLANS).update(update).eq("id", plan_id).execute()
            return resp.data[0] if resp.data else {"id": plan_id, **update}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_PLANS_FILE)
        for i, p in enumerate(items):
            if p["id"] == plan_id:
                if p.get("status") != "draft":
                    return JSONResponse({"error": "draft 상태만 확정할 수 있습니다"}, status_code=400)
                items[i] = {**p, **update}
                _write_json(_PLANS_FILE, items)
                return items[i]
        return JSONResponse({"error": "not found"}, status_code=404)


@router.post("/{plan_id}/execute")
async def execute_plan(plan_id: str):
    """confirmed → executed (향후 에이전트 연동)"""
    now = datetime.now(timezone.utc).isoformat()
    update = {"status": "executed", "updated_at": now}

    if _check_db():
        sb = _get_sb()
        try:
            existing = sb.table(TABLE_PLANS).select("status").eq("id", plan_id).single().execute()
            if existing.data.get("status") != "confirmed":
                return JSONResponse({"error": "confirmed 상태만 실행할 수 있습니다"}, status_code=400)
            resp = sb.table(TABLE_PLANS).update(update).eq("id", plan_id).execute()
            return resp.data[0] if resp.data else {"id": plan_id, **update}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_PLANS_FILE)
        for i, p in enumerate(items):
            if p["id"] == plan_id:
                if p.get("status") != "confirmed":
                    return JSONResponse({"error": "confirmed 상태만 실행할 수 있습니다"}, status_code=400)
                items[i] = {**p, **update}
                _write_json(_PLANS_FILE, items)
                return items[i]
        return JSONResponse({"error": "not found"}, status_code=404)
