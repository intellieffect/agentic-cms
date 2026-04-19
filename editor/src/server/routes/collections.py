"""Reference collections API — group references into collections/folders.

Uses Supabase if table exists, otherwise falls back to local JSON.
"""
import uuid
import json
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from src.server.table_config import TABLE_COLLECTIONS, TABLE_COLLECTION_ITEMS

router = APIRouter(prefix="/api/references/collections", tags=["collections"])

# ─── Local JSON fallback ───
_LOCAL_FILE = Path(__file__).resolve().parent.parent.parent.parent / "data" / "collections.json"
_USE_DB: bool | None = None


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
    global _USE_DB
    if _USE_DB is not None:
        return _USE_DB
    sb = _get_sb()
    if not sb:
        _USE_DB = False
        return False
    try:
        sb.table(TABLE_COLLECTIONS).select("id").limit(1).execute()
        _USE_DB = True
    except Exception:
        _USE_DB = False
    return _USE_DB


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class CollectionItemsBody(BaseModel):
    video_ids: List[str]


# ─── LIST ───

@router.get("")
async def list_collections():
    if _check_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_COLLECTIONS).select("*").order("updated_at", desc=True).execute()
            return {"collections": resp.data or []}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_local()
        items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return {"collections": items}


# ─── GET ───

@router.get("/{collection_id}")
async def get_collection(collection_id: str):
    if _check_db():
        sb = _get_sb()
        try:
            col = sb.table(TABLE_COLLECTIONS).select("*").eq("id", collection_id).single().execute()
            items = sb.table(TABLE_COLLECTION_ITEMS).select("video_id").eq("collection_id", collection_id).execute()
            result = col.data
            result["video_ids"] = [i["video_id"] for i in (items.data or [])]
            return result
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=404)
    else:
        items = _read_local()
        found = next((c for c in items if c["id"] == collection_id), None)
        if not found:
            return JSONResponse({"error": "not found"}, status_code=404)
        return found


# ─── CREATE ───

@router.post("")
async def create_collection(body: CollectionCreate):
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": f"col-{uuid.uuid4().hex[:8]}",
        "name": body.name,
        "description": body.description,
        "video_ids": [],
        "created_at": now,
        "updated_at": now,
    }

    if _check_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_COLLECTIONS).insert({k: v for k, v in row.items() if k != "video_ids"}).execute()
            return resp.data[0] if resp.data else row
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_local()
        items.append(row)
        _write_local(items)
        return row


# ─── UPDATE ───

@router.patch("/{collection_id}")
async def update_collection(collection_id: str, body: CollectionUpdate):
    now = datetime.now(timezone.utc).isoformat()
    update: dict = {"updated_at": now}
    if body.name is not None:
        update["name"] = body.name
    if body.description is not None:
        update["description"] = body.description

    if _check_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_COLLECTIONS).update(update).eq("id", collection_id).execute()
            return resp.data[0] if resp.data else {"id": collection_id}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_local()
        for i, c in enumerate(items):
            if c["id"] == collection_id:
                items[i] = {**c, **update}
                _write_local(items)
                return items[i]
        return JSONResponse({"error": "not found"}, status_code=404)


# ─── DELETE ───

@router.delete("/{collection_id}")
async def delete_collection(collection_id: str):
    if _check_db():
        sb = _get_sb()
        try:
            sb.table(TABLE_COLLECTIONS).delete().eq("id", collection_id).execute()
            return {"ok": True}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_local()
        items = [c for c in items if c["id"] != collection_id]
        _write_local(items)
        return {"ok": True}


# ─── ADD ITEMS ───

@router.post("/{collection_id}/items")
async def add_items(collection_id: str, body: CollectionItemsBody):
    if _check_db():
        sb = _get_sb()
        try:
            rows = [{"collection_id": collection_id, "video_id": vid} for vid in body.video_ids]
            sb.table(TABLE_COLLECTION_ITEMS).upsert(rows).execute()
            return {"ok": True, "added": len(rows)}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_local()
        for c in items:
            if c["id"] == collection_id:
                existing = set(c.get("video_ids", []))
                existing.update(body.video_ids)
                c["video_ids"] = list(existing)
                _write_local(items)
                return {"ok": True, "added": len(body.video_ids)}
        return JSONResponse({"error": "not found"}, status_code=404)


# ─── REMOVE ITEM ───

@router.delete("/{collection_id}/items/{video_id}")
async def remove_item(collection_id: str, video_id: str):
    if _check_db():
        sb = _get_sb()
        try:
            sb.table(TABLE_COLLECTION_ITEMS).delete() \
                .eq("collection_id", collection_id) \
                .eq("video_id", video_id) \
                .execute()
            return {"ok": True}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_local()
        for c in items:
            if c["id"] == collection_id:
                c["video_ids"] = [v for v in c.get("video_ids", []) if v != video_id]
                _write_local(items)
                return {"ok": True}
        return JSONResponse({"error": "not found"}, status_code=404)
