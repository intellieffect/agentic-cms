"""Content pipeline API — storyboards & subtitles CRUD.

Uses Supabase if tables exist, otherwise falls back to local JSON files.
"""
import uuid
import json
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import JSONResponse, PlainTextResponse
from pydantic import BaseModel
from typing import Optional
from src.server.table_config import TABLE_STORYBOARDS, TABLE_SUBTITLES

router = APIRouter(prefix="/api/content", tags=["content"])

# ─── Local JSON fallback ───
_DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
_SB_FILE = _DATA_DIR / "storyboards.json"
_SUB_FILE = _DATA_DIR / "subtitles.json"
_USE_SB_DB: bool | None = None
_USE_SUB_DB: bool | None = None


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


def _check_sb_db() -> bool:
    global _USE_SB_DB
    if _USE_SB_DB is not None:
        return _USE_SB_DB
    _USE_SB_DB = _check_table(TABLE_STORYBOARDS)
    return _USE_SB_DB


def _check_sub_db() -> bool:
    global _USE_SUB_DB
    if _USE_SUB_DB is not None:
        return _USE_SUB_DB
    _USE_SUB_DB = _check_table(TABLE_SUBTITLES)
    return _USE_SUB_DB


# ─── Models ───

class VisualModel(BaseModel):
    type: str = "carousel_slide"  # carousel_slide | video_clip | image | color
    carousel_id: Optional[str] = None
    slide_index: int = 0
    source: Optional[str] = None  # video_clip: filename, image: filename/URL
    start: Optional[float] = None  # video_clip start (sec)
    end: Optional[float] = None    # video_clip end (sec)
    color: Optional[str] = None    # color: hex


class CameraModel(BaseModel):
    zoom: dict = {"start": 1.0, "end": 1.0}
    speed: float = 1.0


class SubtitleItem(BaseModel):
    text: str = ""
    start_offset: float = 0
    end_offset: float = 2.5
    style: dict = {"size": 18, "x": 50, "y": 80, "color": "#ffffff"}


class TransitionModel(BaseModel):
    type: str = "fade"  # none|fade|fadeblack|fadewhite|wipeleft|slideright
    duration: float = 0.5


class SceneModel(BaseModel):
    scene_id: int
    duration_sec: float = 5
    visual: dict = {"type": "carousel_slide", "carousel_id": None, "slide_index": 0}
    camera: dict = {"zoom": {"start": 1.0, "end": 1.0}, "speed": 1.0}
    subtitles: list[dict] = []
    narration: str = ""
    transition: dict = {"type": "fade", "duration": 0.5}


class FormatModel(BaseModel):
    width: int = 1080
    height: int = 1920
    fps: int = 30


class BgmModel(BaseModel):
    mood: str = "calm"
    source: Optional[str] = None
    volume: int = 60


class StoryboardCreate(BaseModel):
    title: str
    source_text: str = ""
    carousel_id: Optional[str] = None
    scenes: list[dict] = []
    format: dict = {"width": 1080, "height": 1920, "fps": 30}
    bgm: dict = {"mood": "calm", "source": None, "volume": 60}
    total_duration_sec: float = 60


class StoryboardUpdate(BaseModel):
    title: Optional[str] = None
    source_text: Optional[str] = None
    carousel_id: Optional[str] = None
    scenes: Optional[list[dict]] = None
    format: Optional[dict] = None
    bgm: Optional[dict] = None
    total_duration_sec: Optional[float] = None


class SubtitleEntry(BaseModel):
    index: int
    start: str
    end: str
    text: str


class SubtitleCreate(BaseModel):
    title: str
    storyboard_id: Optional[str] = None
    entries: list[dict] = []


class SubtitleUpdate(BaseModel):
    title: Optional[str] = None
    storyboard_id: Optional[str] = None
    entries: Optional[list[dict]] = None


# ═══════════════════════════════════════════
# STORYBOARDS
# ═══════════════════════════════════════════

@router.post("/storyboards")
async def create_storyboard(body: StoryboardCreate):
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": f"sb-{uuid.uuid4().hex[:8]}",
        "title": body.title,
        "source_text": body.source_text,
        "carousel_id": body.carousel_id,
        "scenes": body.scenes,
        "format": body.format,
        "bgm": body.bgm,
        "total_duration_sec": body.total_duration_sec,
        "created_at": now,
        "updated_at": now,
    }
    if _check_sb_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_STORYBOARDS).insert(row).execute()
            return resp.data[0] if resp.data else row
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_SB_FILE)
        items.append(row)
        _write_json(_SB_FILE, items)
        return row


@router.get("/storyboards")
async def list_storyboards(limit: int = 50, offset: int = 0):
    if _check_sb_db():
        sb = _get_sb()
        try:
            q = sb.table(TABLE_STORYBOARDS).select("*", count="exact") \
                .order("updated_at", desc=True) \
                .range(offset, offset + limit - 1)
            resp = q.execute()
            return {"storyboards": resp.data or [], "total": resp.count or 0}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_SB_FILE)
        items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        sliced = items[offset:offset + limit]
        return {"storyboards": sliced, "total": len(items)}


@router.get("/storyboards/{sb_id}")
async def get_storyboard(sb_id: str):
    if _check_sb_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_STORYBOARDS).select("*").eq("id", sb_id).single().execute()
            return resp.data
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=404)
    else:
        items = _read_json(_SB_FILE)
        found = next((s for s in items if s["id"] == sb_id), None)
        if not found:
            return JSONResponse({"error": "not found"}, status_code=404)
        return found


@router.patch("/storyboards/{sb_id}")
async def update_storyboard(sb_id: str, body: StoryboardUpdate):
    now = datetime.now(timezone.utc).isoformat()
    update: dict = {"updated_at": now}
    if body.title is not None:
        update["title"] = body.title
    if body.source_text is not None:
        update["source_text"] = body.source_text
    if body.carousel_id is not None:
        update["carousel_id"] = body.carousel_id
    if body.scenes is not None:
        update["scenes"] = body.scenes
    if body.format is not None:
        update["format"] = body.format
    if body.bgm is not None:
        update["bgm"] = body.bgm
    if body.total_duration_sec is not None:
        update["total_duration_sec"] = body.total_duration_sec

    if _check_sb_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_STORYBOARDS).update(update).eq("id", sb_id).execute()
            return resp.data[0] if resp.data else {"id": sb_id, **update}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_SB_FILE)
        for i, s in enumerate(items):
            if s["id"] == sb_id:
                items[i] = {**s, **update}
                _write_json(_SB_FILE, items)
                return items[i]
        return JSONResponse({"error": "not found"}, status_code=404)


@router.delete("/storyboards/{sb_id}")
async def delete_storyboard(sb_id: str):
    if _check_sb_db():
        sb = _get_sb()
        try:
            sb.table(TABLE_STORYBOARDS).delete().eq("id", sb_id).execute()
            return {"ok": True}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_SB_FILE)
        items = [s for s in items if s["id"] != sb_id]
        _write_json(_SB_FILE, items)
        return {"ok": True}


def _fetch_storyboard(sb_id: str):
    """Fetch storyboard by id from DB or JSON."""
    if _check_sb_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_STORYBOARDS).select("*").eq("id", sb_id).single().execute()
            return resp.data
        except Exception:
            return None
    else:
        items = _read_json(_SB_FILE)
        return next((s for s in items if s["id"] == sb_id), None)


@router.post("/storyboards/{sb_id}/export-project")
async def export_storyboard_to_project(sb_id: str):
    """콘티를 Remotion 프로젝트 JSON으로 변환."""
    storyboard = _fetch_storyboard(sb_id)
    if not storyboard:
        return JSONResponse({"error": "storyboard not found"}, status_code=404)

    scenes = storyboard.get("scenes", [])
    fmt = storyboard.get("format", {"width": 1080, "height": 1920, "fps": 30})
    bgm_conf = storyboard.get("bgm", {"mood": "calm", "source": None, "volume": 60})
    carousel_id = storyboard.get("carousel_id")
    fps = fmt.get("fps", 30)

    clips = []
    clip_meta = []
    clip_zooms = []
    transitions = []
    global_subs = []
    bgm_clips = []
    sources = []
    total_sec = 0.0

    for scene in scenes:
        vis = scene.get("visual", {})
        vis_type = vis.get("type", "carousel_slide")
        dur = scene.get("duration_sec", 5)
        cam = scene.get("camera", {"zoom": {"start": 1.0, "end": 1.0}, "speed": 1.0})
        trans = scene.get("transition", {"type": "fade", "duration": 0.5})

        # --- Clip source ---
        source = ""
        clip_start = 0.0
        clip_end = dur
        if vis_type == "carousel_slide":
            cid = vis.get("carousel_id") or carousel_id or ""
            si = vis.get("slide_index", 0)
            source = f"/api/carousel-render/{cid}/png/{si}" if cid else ""
        elif vis_type == "video_clip":
            source = vis.get("source", "")
            clip_start = vis.get("start", 0)
            clip_end = vis.get("end", dur)
        elif vis_type == "image":
            source = vis.get("source", "")
        elif vis_type == "color":
            source = f"color:{vis.get('color', '#000000')}"

        if source and source not in sources:
            sources.append(source)
        src_idx = sources.index(source) if source in sources else 0

        clips.append({"source": source, "start": clip_start, "end": clip_end, "source_idx": src_idx})

        # --- Camera / Zoom ---
        zoom = cam.get("zoom", {"start": 1.0, "end": 1.0})
        speed = cam.get("speed", 1.0)
        z_start = zoom.get("start", 1.0)
        z_end = zoom.get("end", 1.0)
        animation = "none"
        if z_start < z_end:
            animation = "zoomIn"
        elif z_start > z_end:
            animation = "zoomOut"
        clip_zooms.append({
            "scale": z_start, "panX": 50, "panY": 50,
            "animation": animation, "scaleEnd": z_end, "panXEnd": 50, "panYEnd": 50,
        })
        clip_meta.append({"speed": speed, "opacity": 100, "volume": 100, "positionX": 50, "positionY": 50})

        # --- Transition ---
        transitions.append({"type": trans.get("type", "fade"), "duration": trans.get("duration", 0.5)})

        # --- Subtitles ---
        for sub in scene.get("subtitles", []):
            global_subs.append({
                "text": sub.get("text", ""),
                "start": round(total_sec + sub.get("start_offset", 0), 3),
                "end": round(total_sec + sub.get("end_offset", dur), 3),
                "style": sub.get("style", {"size": 18, "x": 50, "y": 80, "color": "#ffffff"}),
            })

        total_sec += dur

    # --- BGM ---
    if bgm_conf.get("source"):
        bgm_clips.append({
            "source": bgm_conf["source"],
            "start": 0, "audioStart": 0,
            "duration": total_sec,
            "volume": bgm_conf.get("volume", 60),
            "sectionType": bgm_conf.get("mood", "calm"),
        })

    project = {
        "clips": clips,
        "clipMeta": clip_meta,
        "clipCrops": [{"x": 0, "y": 0, "w": 100, "h": 100}] * len(clips),
        "clipZooms": clip_zooms,
        "clipSubStyles": [{"size": 18, "x": 50, "y": 80, "font": ""}] * len(clips),
        "transitions": transitions,
        "subs": [],
        "globalSubs": global_subs,
        "bgmClips": bgm_clips,
        "totalDuration": total_sec,
        "sources": sources,
        "name": storyboard.get("title", ""),
        "storyboard_id": sb_id,
        "format": fmt,
    }

    return {"ok": True, "message": "Remotion 프로젝트 변환 완료", "project": project}


@router.post("/storyboards/{sb_id}/generate-subtitles")
async def generate_subtitles_from_narration(sb_id: str):
    """각 씬의 narration을 subtitles 배열로 자동 변환."""
    storyboard = _fetch_storyboard(sb_id)
    if not storyboard:
        return JSONResponse({"error": "storyboard not found"}, status_code=404)

    scenes = storyboard.get("scenes", [])
    updated_scenes = []

    for scene in scenes:
        narration = scene.get("narration", "").strip()
        dur = scene.get("duration_sec", 5)
        if narration:
            # 문장 단위로 분리 (마침표, 물음표, 느낌표 기준)
            import re
            sentences = [s.strip() for s in re.split(r'(?<=[.?!。])\s*', narration) if s.strip()]
            if not sentences:
                sentences = [narration]

            subtitles = []
            time_per_sent = dur / len(sentences)
            for i, sent in enumerate(sentences):
                subtitles.append({
                    "text": sent,
                    "start_offset": round(i * time_per_sent, 2),
                    "end_offset": round((i + 1) * time_per_sent, 2),
                    "style": {"size": 18, "x": 50, "y": 80, "color": "#ffffff"},
                })
            scene["subtitles"] = subtitles
        updated_scenes.append(scene)

    # Save back
    now = datetime.now(timezone.utc).isoformat()
    update_data = {"scenes": updated_scenes, "updated_at": now}

    if _check_sb_db():
        sb = _get_sb()
        try:
            sb.table(TABLE_STORYBOARDS).update(update_data).eq("id", sb_id).execute()
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_SB_FILE)
        for i, s in enumerate(items):
            if s["id"] == sb_id:
                items[i] = {**s, **update_data}
                _write_json(_SB_FILE, items)
                break

    return {
        "ok": True,
        "message": "자막 자동 생성 완료",
        "scene_count": len(updated_scenes),
        "scenes": updated_scenes,
    }


# ═══════════════════════════════════════════
# SUBTITLES
# ═══════════════════════════════════════════

@router.post("/subtitles")
async def create_subtitle(body: SubtitleCreate):
    now = datetime.now(timezone.utc).isoformat()
    row = {
        "id": f"sub-{uuid.uuid4().hex[:8]}",
        "title": body.title,
        "storyboard_id": body.storyboard_id,
        "entries": body.entries,
        "created_at": now,
        "updated_at": now,
    }
    if _check_sub_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_SUBTITLES).insert(row).execute()
            return resp.data[0] if resp.data else row
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_SUB_FILE)
        items.append(row)
        _write_json(_SUB_FILE, items)
        return row


@router.get("/subtitles")
async def list_subtitles(limit: int = 50, offset: int = 0):
    if _check_sub_db():
        sb = _get_sb()
        try:
            q = sb.table(TABLE_SUBTITLES).select("*", count="exact") \
                .order("updated_at", desc=True) \
                .range(offset, offset + limit - 1)
            resp = q.execute()
            return {"subtitles": resp.data or [], "total": resp.count or 0}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_SUB_FILE)
        items.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        sliced = items[offset:offset + limit]
        return {"subtitles": sliced, "total": len(items)}


@router.get("/subtitles/{sub_id}")
async def get_subtitle(sub_id: str):
    if _check_sub_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_SUBTITLES).select("*").eq("id", sub_id).single().execute()
            return resp.data
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=404)
    else:
        items = _read_json(_SUB_FILE)
        found = next((s for s in items if s["id"] == sub_id), None)
        if not found:
            return JSONResponse({"error": "not found"}, status_code=404)
        return found


@router.patch("/subtitles/{sub_id}")
async def update_subtitle(sub_id: str, body: SubtitleUpdate):
    now = datetime.now(timezone.utc).isoformat()
    update: dict = {"updated_at": now}
    if body.title is not None:
        update["title"] = body.title
    if body.storyboard_id is not None:
        update["storyboard_id"] = body.storyboard_id
    if body.entries is not None:
        update["entries"] = body.entries

    if _check_sub_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_SUBTITLES).update(update).eq("id", sub_id).execute()
            return resp.data[0] if resp.data else {"id": sub_id, **update}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_SUB_FILE)
        for i, s in enumerate(items):
            if s["id"] == sub_id:
                items[i] = {**s, **update}
                _write_json(_SUB_FILE, items)
                return items[i]
        return JSONResponse({"error": "not found"}, status_code=404)


@router.delete("/subtitles/{sub_id}")
async def delete_subtitle(sub_id: str):
    if _check_sub_db():
        sb = _get_sb()
        try:
            sb.table(TABLE_SUBTITLES).delete().eq("id", sub_id).execute()
            return {"ok": True}
        except Exception as e:
            return JSONResponse({"error": str(e)}, status_code=500)
    else:
        items = _read_json(_SUB_FILE)
        items = [s for s in items if s["id"] != sub_id]
        _write_json(_SUB_FILE, items)
        return {"ok": True}


@router.get("/subtitles/{sub_id}/srt")
async def download_srt(sub_id: str):
    """SRT 파일 다운로드."""
    if _check_sub_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_SUBTITLES).select("*").eq("id", sub_id).single().execute()
            subtitle = resp.data
        except Exception:
            return JSONResponse({"error": "not found"}, status_code=404)
    else:
        items = _read_json(_SUB_FILE)
        subtitle = next((s for s in items if s["id"] == sub_id), None)
        if not subtitle:
            return JSONResponse({"error": "not found"}, status_code=404)

    entries = subtitle.get("entries", [])
    srt_lines = []
    for entry in entries:
        srt_lines.append(str(entry.get("index", 0)))
        srt_lines.append(f"{entry.get('start', '00:00:00,000')} --> {entry.get('end', '00:00:00,000')}")
        srt_lines.append(entry.get("text", ""))
        srt_lines.append("")

    srt_content = "\n".join(srt_lines)
    title = subtitle.get("title", "subtitles")
    return PlainTextResponse(
        srt_content,
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="{title}.srt"'},
    )


@router.post("/subtitles/{sub_id}/apply-to-project")
async def apply_subtitle_to_project(sub_id: str):
    """자막을 영상 프로젝트에 적용 (placeholder)."""
    if _check_sub_db():
        sb = _get_sb()
        try:
            resp = sb.table(TABLE_SUBTITLES).select("*").eq("id", sub_id).single().execute()
            subtitle = resp.data
        except Exception:
            return JSONResponse({"error": "subtitle not found"}, status_code=404)
    else:
        items = _read_json(_SUB_FILE)
        subtitle = next((s for s in items if s["id"] == sub_id), None)
        if not subtitle:
            return JSONResponse({"error": "subtitle not found"}, status_code=404)

    return {
        "ok": True,
        "message": "자막 적용 준비 완료",
        "subtitle_id": sub_id,
        "title": subtitle.get("title", ""),
        "entry_count": len(subtitle.get("entries", [])),
    }
