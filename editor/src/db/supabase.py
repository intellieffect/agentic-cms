"""Supabase client initialization and CRUD helpers.

프로젝트 테이블 이름은 TABLE_PROJECTS env 로 오버라이드 가능 (Phase 4 이후 권장: video_projects).
table_config.py 의 상수를 그대로 사용해 agentic-cms 쪽 MCP/dashboard 와 같은 이름으로 맞춘다.
"""
import os
from supabase import create_client, Client
from src.server.table_config import TABLE_PROJECTS

_client: Client | None = None


def get_client() -> Client:
    """Get or create Supabase client (singleton)."""
    global _client
    if _client is None:
        url = os.environ.get("SUPABASE_URL", "")
        key = os.environ.get("SUPABASE_SERVICE_KEY", "")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")
        _client = create_client(url, key)
    return _client


# --------------- Projects ---------------

def list_projects(*, status: str | None = None, limit: int = 50, offset: int = 0):
    sb = get_client()
    q = sb.table(TABLE_PROJECTS).select(
        "id, name, orientation, status, thumbnail_url, duration, clip_count, "
        "source_files, created_by, created_at, updated_at, project_data"
    ).is_("deleted_at", "null").order("updated_at", desc=True)
    if status:
        q = q.eq("status", status)
    q = q.range(offset, offset + limit - 1)
    resp = q.execute()
    return resp.data or []


def get_project(project_id: str):
    sb = get_client()
    resp = (
        sb.table(TABLE_PROJECTS)
        .select("*")
        .eq("id", project_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    return resp.data


def create_project(data: dict):
    sb = get_client()
    row = {
        "name": data["name"],
        "orientation": data.get("orientation", "vertical"),
        "project_data": data.get("projectData", {}),
        "thumbnail_url": data.get("thumbnailUrl"),
        "duration": data.get("duration"),
        "clip_count": data.get("clipCount", 0),
        "source_files": data.get("sourceFiles"),
    }
    resp = sb.table(TABLE_PROJECTS).insert(row).execute()
    return resp.data[0] if resp.data else None


def update_project(project_id: str, patch: dict):
    sb = get_client()
    row = {}
    field_map = {
        "name": "name",
        "orientation": "orientation",
        "status": "status",
        "projectData": "project_data",
        "thumbnailUrl": "thumbnail_url",
        "duration": "duration",
        "clipCount": "clip_count",
        "sourceFiles": "source_files",
    }
    for camel, snake in field_map.items():
        if camel in patch:
            row[snake] = patch[camel]

    # Handle locked flag — stored inside project_data JSON
    if "locked" in patch:
        existing = get_project(project_id) or {}
        pd = existing.get("project_data") or {}
        if not isinstance(pd, dict):
            pd = {}
        pd["locked"] = bool(patch["locked"])
        row["project_data"] = pd

    if not row:
        return get_project(project_id)
    resp = (
        sb.table(TABLE_PROJECTS)
        .update(row)
        .eq("id", project_id)
        .is_("deleted_at", "null")
        .execute()
    )
    return resp.data[0] if resp.data else None


def delete_project(project_id: str):
    """Soft delete."""
    from datetime import datetime, timezone
    sb = get_client()
    sb.table(TABLE_PROJECTS).update(
        {"deleted_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", project_id).execute()
    return True


# --------------- Row → API helpers ---------------

def row_to_project(row: dict) -> dict:
    """Convert DB snake_case row to camelCase API response."""
    return {
        "id": row["id"],
        "name": row["name"],
        "orientation": row.get("orientation", "vertical"),
        "status": row.get("status", "draft"),
        "projectData": row.get("project_data", {}),
        "thumbnailUrl": row.get("thumbnail_url"),
        "duration": row.get("duration"),
        "clipCount": row.get("clip_count", 0),
        "sourceFiles": row.get("source_files"),
        "createdBy": row.get("created_by"),
        "createdAt": row.get("created_at", ""),
        "updatedAt": row.get("updated_at", ""),
    }


def row_to_summary(row: dict) -> dict:
    """Convert DB row to summary (no projectData)."""
    pd = row.get("project_data") or {}
    return {
        "id": row["id"],
        "name": row["name"],
        "orientation": row.get("orientation", "vertical"),
        "status": row.get("status", "draft"),
        "thumbnailUrl": row.get("thumbnail_url"),
        "duration": row.get("duration"),
        "clipCount": row.get("clip_count", 0),
        "sourceFiles": row.get("source_files"),
        "createdBy": row.get("created_by"),
        "createdAt": row.get("created_at", ""),
        "updatedAt": row.get("updated_at", ""),
        "locked": pd.get("locked", False) if isinstance(pd, dict) else False,
    }
