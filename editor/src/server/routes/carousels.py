"""Carousel projects API — CRUD for carousel creation in brxce-editor.

Uses Supabase if `carousels` table exists, otherwise falls back to a local JSON file.
"""
import uuid
import json
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from src.server.table_config import TABLE_CAROUSELS

router = APIRouter(prefix="/api/carousels", tags=["carousels"])

# ─── Local JSON fallback ───
_LOCAL_FILE = Path(__file__).resolve().parent.parent.parent.parent / "data" / "carousels.json"
_USE_DB: bool | None = None  # None = not checked yet


def _ensure_data_dir():
    _LOCAL_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not _LOCAL_FILE.exists():
        _LOCAL_FILE.write_text("[]")


def _read_local() -> list[dict]:
    _ensure_data_dir()
    try:
        return json.loads(_LOCAL_FILE.read_text())
    except Exception:
        return []


def _write_local(data: list[dict]):
    _ensure_data_dir()
    _LOCAL_FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str))


def _get_sb():
    try:
        from src.db.supabase import get_client
        return get_client()
    except Exception:
        return None


def _check_db() -> bool:
    """Check if carousels table exists in Supabase. Caches result."""
    global _USE_DB
    if _USE_DB is not None:
        return _USE_DB
    sb = _get_sb()
    if not sb:
        _USE_DB = False
        return False
    try:
        sb.table(TABLE_CAROUSELS).select("id").limit(1).execute()
        _USE_DB = True
    except Exception:
        _USE_DB = False
    return _USE_DB


# ─── Models ───

class CarouselCreate(BaseModel):
    title: str
    template: str = "slide-deck"
    data: dict = {}
    slides: Optional[list[dict]] = None
    style_config: dict = {}
    width: int = 1080
    height: int = 1350
    caption: Optional[str] = None


class CarouselUpdate(BaseModel):
    title: Optional[str] = None
    template: Optional[str] = None
    data: Optional[dict] = None
    slides: Optional[list[dict]] = None
    style_config: Optional[dict] = None
    caption: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None


def _extract_slides(row: dict) -> list[dict]:
    """data.slides를 최상위 slides로 꺼내기."""
    # 이미 최상위에 slides가 있으면 그대로
    direct = row.get("slides")
    if isinstance(direct, list) and len(direct) > 0:
        return direct
    # data.slides에서 꺼내기
    data = row.get("data")
    if isinstance(data, dict):
        sl = data.get("slides")
        if isinstance(sl, list) and len(sl) > 0:
            return sl
    return []


def _serialize_row(row: dict) -> dict:
    """API 응답용 — slides를 최상위에 포함."""
    result = dict(row)
    result["slides"] = _extract_slides(row)
    return result


# ─── GET /api/carousels ───

@router.get("")
async def list_carousels(limit: int = 50, offset: int = 0):
    if _check_db():
        sb = _get_sb()
        try:
            q = sb.table(TABLE_CAROUSELS).select("*", count="exact") \
                .order("updated_at", desc=True) \
                .range(offset, offset + limit - 1)
            resp = q.execute()
            return {"carousels": [_serialize_row(r) for r in (resp.data or [])], "total": resp.count or 0}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_local()
        items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        sliced = items[offset:offset + limit]
        return {"carousels": [_serialize_row(r) for r in sliced], "total": len(items)}


# ─── GET /api/carousels/:id ───

@router.get("/{carousel_id}")
async def get_carousel(carousel_id: str):
    if _check_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_CAROUSELS).select("*").eq("id", carousel_id).single().execute()
            return _serialize_row(resp.data)
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=404)
    else:
        items = _read_local()
        found = next((c for c in items if c["id"] == carousel_id), None)
        if not found:
            return JSONResponse({"error": "not found"}, status_code=404)
        return _serialize_row(found)


# ─── DB columns helper ───
# Supabase carousels 테이블 실제 컬럼: id, title, caption, slides, created_at, updated_at, variant_id
# template/data/style_config/width/height 컬럼은 schema에 없음 → strip해야 PGRST204 회피.
_CAROUSELS_DB_COLUMNS = {"title", "caption", "slides", "variant_id", "updated_at"}


# ─── POST /api/carousels ───

@router.post("")
async def create_carousel(body: CarouselCreate):
    now = datetime.now(timezone.utc).isoformat()

    # slides 직접 컬럼에 저장 (data 컬럼 없음)
    slides = body.slides
    if slides is None and isinstance(body.data, dict):
        legacy = body.data.get("slides")
        if isinstance(legacy, list):
            slides = legacy

    row_full = {
        "id": f"carousel-{uuid.uuid4().hex[:8]}",
        "title": body.title,
        "slides": slides or [],
        "caption": body.caption,
        "created_at": now,
        "updated_at": now,
    }
    # supabase 컬럼만 선택 (created_at·id·updated_at 포함)
    db_columns = _CAROUSELS_DB_COLUMNS | {"id", "created_at"}
    row = {k: v for k, v in row_full.items() if k in db_columns}

    if _check_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_CAROUSELS).insert(row).execute()
            return _serialize_row(resp.data[0]) if resp.data else _serialize_row(row)
        except Exception as e:
            print(f"[carousel create] failed: {e}, row keys: {list(row.keys())}")
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_local()
        items.append(row)
        _write_local(items)
        return _serialize_row(row)


# ─── PATCH /api/carousels/:id ───

@router.patch("/{carousel_id}")
async def update_carousel(carousel_id: str, body: CarouselUpdate):
    now = datetime.now(timezone.utc).isoformat()
    update: dict = {"updated_at": now}
    if body.title is not None:
        update["title"] = body.title
    if body.caption is not None:
        update["caption"] = body.caption

    # slides → 직접 slides 컬럼에 저장 (data 컬럼 없음)
    if body.slides is not None:
        update["slides"] = body.slides
    elif body.data is not None and isinstance(body.data, dict):
        # legacy data.slides 페이로드 호환
        slides_in_data = body.data.get("slides")
        if isinstance(slides_in_data, list):
            update["slides"] = slides_in_data

    # supabase 테이블에 없는 컬럼 제거 (PGRST204 방지)
    update = {k: v for k, v in update.items() if k in _CAROUSELS_DB_COLUMNS}

    if _check_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_CAROUSELS).update(update).eq("id", carousel_id).execute()
            row = resp.data[0] if resp.data else {"id": carousel_id, **update}
            return _serialize_row(row)
        except Exception as e:
            print(f"[carousel update] failed: {e}, update keys: {list(update.keys())}")
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_local()
        for i, c in enumerate(items):
            if c["id"] == carousel_id:
                items[i] = {**c, **update}
                _write_local(items)
                return _serialize_row(items[i])
        return JSONResponse({"error": "not found"}, status_code=404)


# ─── DELETE /api/carousels/:id ───

@router.delete("/{carousel_id}")
async def delete_carousel(carousel_id: str):
    if _check_db():
        sb = _get_sb()
        try:
            sb.table(TABLE_CAROUSELS).delete().eq("id", carousel_id).execute()
            return {"ok": True}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_local()
        items = [c for c in items if c["id"] != carousel_id]
        _write_local(items)
        return {"ok": True}


# ─── Render endpoints moved to carousel_render.py ───
