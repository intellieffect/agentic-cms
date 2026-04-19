"""Reference videos API — replaces Next.js reference routes."""
import subprocess
import tempfile
import json
import os
from pathlib import Path
from fastapi import APIRouter, Request, BackgroundTasks
from fastapi.responses import JSONResponse, RedirectResponse, FileResponse
from src.server.table_config import TABLE_VIDEOS, TABLE_ACCOUNTS
from src.server.storage import get_storage, STORAGE_MODE

router = APIRouter(prefix="/api/references", tags=["references"])


def _get_sb():
    try:
        from src.db.supabase import get_client
        return get_client()
    except Exception:
        return None


# ---------- GET /api/references/accounts ----------

@router.get("/accounts")
async def list_accounts():
    sb = _get_sb()
    if not sb:
        return {"accounts": []}
    try:
        resp = sb.table(TABLE_ACCOUNTS).select("*").execute()
        return {"accounts": resp.data or []}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- GET /api/references/videos ----------

@router.get("/videos")
async def list_videos(
    account: str | None = None,
    platform: str | None = None,
    style: str | None = None,
    sort: str = "latest",
    limit: int = 50,
    offset: int = 0,
):
    sb = _get_sb()
    if not sb:
        return {"videos": [], "total": 0}
    try:
        q = sb.table(TABLE_VIDEOS).select("*", count="exact")
        if account:
            q = q.eq("account_id", account)
        if platform:
            q = q.eq("platform", platform)
        if style:
            q = q.contains("style_tags", [style])

        order_map = {
            "latest": ("created_at", True),
            "likes": ("like_count", True),
            "comments": ("comment_count", True),
            "views": ("view_count", True),
        }
        col, desc = order_map.get(sort, ("created_at", True))
        q = q.order(col, desc=desc).range(offset, offset + limit - 1)

        resp = q.execute()
        return {"videos": resp.data or [], "total": resp.count or 0}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- GET /api/references/videos/{id} ----------

@router.get("/videos/{video_id}")
async def get_video(video_id: str):
    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "DB not configured"}, status_code=500)
    try:
        resp = sb.table(TABLE_VIDEOS).select("*").eq("id", video_id).single().execute()
        if not resp.data:
            return JSONResponse({"error": "not found"}, status_code=404)
        return resp.data
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- PATCH /api/references/videos/{id} ----------

@router.patch("/videos/{video_id}")
async def update_video(video_id: str, request: Request):
    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "DB not configured"}, status_code=500)
    try:
        body = await request.json()
        resp = sb.table(TABLE_VIDEOS).update(body).eq("id", video_id).execute()
        return resp.data[0] if resp.data else {}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- DELETE /api/references/videos/{id} ----------

@router.delete("/videos/{video_id}")
async def delete_video(video_id: str):
    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "DB not configured"}, status_code=500)
    try:
        # Delete from Storage (best-effort)
        try:
            row = sb.table(TABLE_VIDEOS).select("account_id").eq("id", video_id).single().execute()
            if row.data and row.data.get("account_id"):
                prefix = f"{row.data['account_id']}/{video_id}"
                storage = get_storage()
                storage.delete_file("references", f"{prefix}/video.mp4")
                storage.delete_file("references", f"{prefix}/thumbnail.jpg")
        except Exception:
            pass
        # Delete from DB
        sb.table(TABLE_VIDEOS).delete().eq("id", video_id).execute()
        return {"ok": True}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- GET /api/references/videos/{id}/stream ----------

@router.get("/videos/{video_id}/stream")
async def stream_video(video_id: str):
    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "DB not configured"}, status_code=500)
    try:
        resp = sb.table(TABLE_VIDEOS).select("video_url").eq("id", video_id).single().execute()
        if not resp.data or not resp.data.get("video_url"):
            return JSONResponse({"error": "not found"}, status_code=404)
        video_url = resp.data["video_url"]
        if video_url.startswith("/_proxy/"):
            local_path = Path(__file__).resolve().parent.parent.parent / "editor" / "_proxy" / video_url[len("/_proxy/"):]
            if local_path.exists():
                return FileResponse(str(local_path), media_type="video/mp4")
        return RedirectResponse(video_url)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- GET /api/references/videos/{id}/thumbnail ----------

@router.get("/videos/{video_id}/thumbnail")
async def video_thumbnail(video_id: str):
    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "DB not configured"}, status_code=500)
    try:
        resp = sb.table(TABLE_VIDEOS).select("thumbnail_url").eq("id", video_id).single().execute()
        if not resp.data or not resp.data.get("thumbnail_url"):
            return JSONResponse({"error": "not found"}, status_code=404)
        thumb_url = resp.data["thumbnail_url"]
        if thumb_url.startswith("/_proxy/"):
            local_path = Path(__file__).resolve().parent.parent.parent / "editor" / "_proxy" / thumb_url[len("/_proxy/"):]
            if local_path.exists():
                return FileResponse(str(local_path), media_type="image/jpeg")
        return RedirectResponse(thumb_url)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- POST /api/references/import ----------

def _recognize_music(video_path: str) -> dict | None:
    """Use AudD API to recognize music from a video file."""
    audio_tmp = os.path.join(tempfile.gettempdir(), "audd_tmp.mp3")
    try:
        # Extract first 15 seconds of audio
        subprocess.run(
            ["ffmpeg", "-y", "-i", video_path, "-t", "15", "-vn", "-ar", "16000", "-ac", "1", audio_tmp],
            capture_output=True, timeout=15,
        )
        if not os.path.exists(audio_tmp) or os.path.getsize(audio_tmp) < 100:
            return None

        result = subprocess.run(
            ["curl", "-s", "https://api.audd.io/",
             "-F", f"file=@{audio_tmp}",
             "-F", "api_token=test"],
            capture_output=True, text=True, timeout=15,
        )
        data = json.loads(result.stdout)
        if data.get("status") == "success" and data.get("result"):
            return {
                "artist": data["result"].get("artist"),
                "title": data["result"].get("title"),
                "album": data["result"].get("album"),
            }
        return None
    except Exception:
        return None
    finally:
        try:
            os.remove(audio_tmp)
        except Exception:
            pass


def _detect_platform(url: str) -> str:
    if "instagram.com" in url or "instagr.am" in url:
        return "instagram"
    if "youtube.com" in url or "youtu.be" in url:
        return "youtube"
    if "tiktok.com" in url:
        return "tiktok"
    if "threads.net" in url:
        return "threads"
    return "other"


def _get_storage_public_url(sb, path: str) -> str:
    storage = get_storage()
    return storage.get_file_url("references", path)


def _do_import(sb, url: str, meta: dict, video_id: str) -> dict:
    """Synchronous import worker: download + upload + insert."""
    uploader = meta.get("uploader_id") or meta.get("uploader") or meta.get("channel") or "unknown"
    uploader_name = meta.get("uploader") or meta.get("channel") or uploader
    platform = _detect_platform(url)

    # Ensure account exists
    try:
        existing = sb.table(TABLE_ACCOUNTS).select("id").eq("id", uploader).execute()
        if not existing.data:
            sb.table(TABLE_ACCOUNTS).insert({
                "id": uploader,
                "username": uploader,
                "display_name": uploader_name,
                "platform": platform,
            }).execute()
    except Exception:
        pass  # account may already exist

    storage_prefix = f"{uploader}/{video_id}"
    thumbnail_url = None
    video_url = None

    tmp_dir = os.path.join(tempfile.gettempdir(), "ref-import")
    os.makedirs(tmp_dir, exist_ok=True)

    storage = get_storage()

    # Thumbnail
    thumb_src = meta.get("thumbnail")
    if thumb_src:
        thumb_tmp = os.path.join(tmp_dir, f"{video_id}.jpg")
        try:
            subprocess.run(["curl", "-sL", "-o", thumb_tmp, thumb_src], timeout=15, check=True)
            if os.path.exists(thumb_tmp):
                buf = Path(thumb_tmp).read_bytes()
                storage_path = f"{storage_prefix}/thumbnail.jpg"
                thumbnail_url = storage.upload_file("references", storage_path, buf, "image/jpeg")
        except Exception:
            pass

    # Video download
    video_tmp = os.path.join(tmp_dir, f"{video_id}.mp4")
    try:
        subprocess.run(
            ["yt-dlp", "-f", "best[ext=mp4]/best", "--no-playlist", "-o", video_tmp, url],
            timeout=120, check=True, capture_output=True,
        )
        if os.path.exists(video_tmp):
            buf = Path(video_tmp).read_bytes()
            storage_path = f"{storage_prefix}/video.mp4"
            video_url = storage.upload_file("references", storage_path, buf, "video/mp4")
    except Exception:
        pass  # video download failed, thumbnail-only

    # Post date
    upload_date = meta.get("upload_date", "")  # YYYYMMDD
    if upload_date and len(upload_date) == 8:
        post_date = f"{upload_date[:4]}-{upload_date[4:6]}-{upload_date[6:8]}"
    else:
        from datetime import date
        post_date = date.today().isoformat()

    # Music metadata extraction
    music_artist = meta.get("artist") or meta.get("creator") or None
    music_title_raw = meta.get("track") or None
    title_str = meta.get("title") or ""
    # Fallback: parse "Artist - Title" from title
    if not music_artist and " - " in title_str:
        parts = title_str.split(" - ", 1)
        music_artist = parts[0].strip()
        if not music_title_raw:
            import re
            music_title_raw = re.sub(r'\s*[\(\[].*?[\)\]]', '', parts[1]).strip()
    # For music categories, use tags as hints
    if not music_artist and meta.get("categories") and "Music" in meta.get("categories", []):
        music_artist = meta.get("uploader") or meta.get("channel")

    # Audio fingerprint fallback: AudD (Shazam-like recognition)
    if not music_artist and os.path.exists(video_tmp):
        recognized = _recognize_music(video_tmp)
        if recognized:
            music_artist = recognized.get("artist")
            music_title_raw = recognized.get("title")

    # Insert into DB
    row = {
        "id": video_id,
        "account_id": uploader,
        "platform": platform,
        "caption": meta.get("description") or meta.get("title") or "",
        "thumbnail_url": thumbnail_url,
        "video_url": video_url,
        "duration_sec": round(meta["duration"]) if meta.get("duration") else None,
        "like_count": meta.get("like_count") or 0,
        "comment_count": meta.get("comment_count") or 0,
        "view_count": meta.get("view_count"),
        "music_artist": music_artist,
        "music_title": music_title_raw,
    }
    sb.table(TABLE_VIDEOS).insert(row).execute()

    # Cleanup
    for f in [os.path.join(tmp_dir, f"{video_id}.jpg"), video_tmp]:
        try:
            os.remove(f)
        except Exception:
            pass

    return {"id": video_id, "message": "임포트 완료"}


@router.post("/import")
async def import_video(request: Request):
    body = await request.json()
    url = body.get("url", "").strip()
    if not url:
        return JSONResponse({"error": "url required"}, status_code=400)

    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "DB not configured"}, status_code=500)

    try:
        # 1. yt-dlp metadata
        result = subprocess.run(
            ["yt-dlp", "--dump-json", "--no-download", url],
            capture_output=True, text=True, timeout=30,
        )
        if result.returncode != 0:
            return JSONResponse(
                {"error": f"yt-dlp 메타데이터 실패: {result.stderr.strip()[:200]}"},
                status_code=400,
            )
        meta = json.loads(result.stdout)
        video_id = meta.get("id") or meta.get("display_id") or str(int(__import__('time').time()))

        # 2. Duplicate check
        existing = sb.table(TABLE_VIDEOS).select("id").eq("id", video_id).execute()
        if existing.data:
            return {"id": video_id, "message": "이미 존재하는 영상입니다."}

        # 3. Do import (download + upload + insert)
        result = _do_import(sb, url, meta, video_id)
        return result

    except json.JSONDecodeError:
        return JSONResponse({"error": "yt-dlp 메타데이터 파싱 실패"}, status_code=500)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- PATCH /api/references/videos/{id}/favorite ----------

# ---------- POST /api/references/recognize-music/{id} ----------

@router.post("/recognize-music/{video_id}")
async def recognize_music_single(video_id: str):
    """Recognize music in a single video using AudD."""
    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "DB not configured"}, status_code=500)
    try:
        row = sb.table(TABLE_VIDEOS).select("video_url").eq("id", video_id).single().execute()
        if not row.data or not row.data.get("video_url"):
            return JSONResponse({"error": "영상 URL 없음"}, status_code=404)

        video_url = row.data["video_url"]
        tmp_video = os.path.join(tempfile.gettempdir(), f"recog_{video_id}.mp4")
        try:
            subprocess.run(["curl", "-sL", "-o", tmp_video, video_url, "--max-time", "30"], timeout=35)
            if not os.path.exists(tmp_video) or os.path.getsize(tmp_video) < 1000:
                return {"id": video_id, "result": None, "message": "영상 다운로드 실패"}

            recognized = _recognize_music(tmp_video)
            if recognized and recognized.get("artist"):
                sb.table(TABLE_VIDEOS).update({
                    "music_artist": recognized["artist"],
                    "music_title": recognized.get("title"),
                }).eq("id", video_id).execute()
                return {"id": video_id, "result": recognized, "message": "인식 완료"}
            return {"id": video_id, "result": None, "message": "음악을 인식하지 못했습니다"}
        finally:
            try:
                os.remove(tmp_video)
            except Exception:
                pass
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- POST /api/references/recognize-music-batch ----------

@router.post("/recognize-music-batch")
async def recognize_music_batch():
    """Batch recognize music for all videos without music_artist."""
    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "DB not configured"}, status_code=500)
    try:
        resp = (
            sb.table(TABLE_VIDEOS)
            .select("id, video_url")
            .is_("music_artist", "null")
            .not_.is_("video_url", "null")
            .limit(50)
            .execute()
        )
        videos = resp.data or []
        results = []
        for v in videos:
            tmp_video = os.path.join(tempfile.gettempdir(), f"recog_{v['id']}.mp4")
            try:
                subprocess.run(["curl", "-sL", "-o", tmp_video, v["video_url"], "--max-time", "30"], timeout=35)
                if not os.path.exists(tmp_video) or os.path.getsize(tmp_video) < 1000:
                    results.append({"id": v["id"], "status": "download_failed"})
                    continue

                recognized = _recognize_music(tmp_video)
                if recognized and recognized.get("artist"):
                    sb.table(TABLE_VIDEOS).update({
                        "music_artist": recognized["artist"],
                        "music_title": recognized.get("title"),
                    }).eq("id", v["id"]).execute()
                    results.append({"id": v["id"], "status": "found", **recognized})
                else:
                    results.append({"id": v["id"], "status": "not_found"})
            except Exception as e:
                results.append({"id": v["id"], "status": "error", "error": str(e)})
            finally:
                try:
                    os.remove(tmp_video)
                except Exception:
                    pass

        found = sum(1 for r in results if r["status"] == "found")
        return {"total": len(videos), "found": found, "results": results}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.patch("/videos/{video_id}/favorite")
async def toggle_favorite(video_id: str, request: Request):
    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "DB not configured"}, status_code=500)
    try:
        body = await request.json()
        favorite = body.get("favorite", False)
        resp = (
            sb.table(TABLE_VIDEOS)
            .update({"favorite": bool(favorite)})
            .eq("id", video_id)
            .execute()
        )
        if not resp.data:
            return JSONResponse({"error": "not found"}, status_code=404)
        return resp.data[0]
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- GET /api/references/favorites ----------

@router.get("/favorites")
async def list_favorites():
    sb = _get_sb()
    if not sb:
        return {"videos": []}
    try:
        resp = (
            sb.table(TABLE_VIDEOS)
            .select("*")
            .eq("favorite", True)
            .order("created_at", desc=True)
            .execute()
        )
        return {"videos": resp.data or []}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- Legacy compatibility: GET /api/references ----------

@router.get("")
async def references_legacy():
    """Legacy endpoint used by editor frontend (proxied to /api/references/videos)."""
    sb = _get_sb()
    if not sb:
        return {"videos": []}
    try:
        resp = (
            sb.table(TABLE_VIDEOS)
            .select("*")
            .order("created_at", desc=True)
            .limit(50)
            .execute()
        )
        return {"videos": resp.data or []}
    except Exception as e:
        return {"error": str(e), "videos": []}


# ---------- POST /api/references/discover ----------

@router.post("/discover")
async def discover_references(request: Request, background_tasks: BackgroundTasks):
    """DB 학습 기반 레퍼런스 자동 탐색.

    Body:
      - mode: 'auto' | 'accounts' | 'hashtags' (default: 'auto')
      - limit: 탐색 수 (default: 10)
      - minLikes: 최소 좋아요 (default: 50)
      - doImport: 매칭 시 자동 임포트 (default: false)
      - refreshProfile: 프로필 강제 재생성 (default: false)
    """
    body = await request.json() if await request.body() else {}
    mode = body.get("mode", "auto")
    limit = body.get("limit", 10)
    min_likes = body.get("minLikes", 50)
    do_import = body.get("doImport", False)
    refresh = body.get("refreshProfile", False)

    try:
        # Import discover function from scripts
        import sys
        scripts_dir = str(Path(__file__).resolve().parent.parent.parent.parent / "scripts")
        if scripts_dir not in sys.path:
            sys.path.insert(0, scripts_dir)

        from find_references import discover, get_or_build_profile, build_profile, fetch_db_references

        if refresh:
            videos = fetch_db_references()
            build_profile(videos)

        result = discover(
            mode=mode,
            limit=limit,
            do_import=do_import,
            min_likes=min_likes,
        )

        # Simplify profile for response
        profile_summary = {}
        if result.get("profile"):
            ga = result["profile"].get("gemini_analysis", {})
            profile_summary = {
                "description": ga.get("description", ""),
                "coreThemes": ga.get("core_themes", []),
                "totalVideos": result["profile"].get("total_videos", 0),
            }

        return {
            "profile": profile_summary,
            "candidates": result.get("candidates", 0),
            "analyzed": result.get("analyzed", 0),
            "matched": result.get("matched", []),
            "imported": result.get("imported", []),
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- GET /api/references/profile ----------

@router.get("/profile")
async def get_reference_profile():
    """현재 레퍼런스 프로필 조회."""
    try:
        import sys
        scripts_dir = str(Path(__file__).resolve().parent.parent.parent.parent / "scripts")
        if scripts_dir not in sys.path:
            sys.path.insert(0, scripts_dir)

        from find_references import load_profile
        profile = load_profile()
        if not profile:
            return JSONResponse({"error": "프로필이 없습니다. /discover에서 refreshProfile:true로 생성하세요."}, status_code=404)
        return profile
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- POST /api/references/profile/build ----------

@router.post("/profile/build")
async def build_reference_profile():
    """레퍼런스 프로필 (재)생성."""
    try:
        import sys
        scripts_dir = str(Path(__file__).resolve().parent.parent.parent.parent / "scripts")
        if scripts_dir not in sys.path:
            sys.path.insert(0, scripts_dir)

        from find_references import fetch_db_references, build_profile
        videos = fetch_db_references()
        profile = build_profile(videos)
        ga = profile.get("gemini_analysis", {})
        return {
            "message": "프로필 생성 완료",
            "totalVideos": profile.get("total_videos", 0),
            "description": ga.get("description", ""),
            "coreThemes": ga.get("core_themes", []),
            "idealHashtags": ga.get("ideal_hashtags", []),
            "excludePatterns": ga.get("exclude_patterns", []),
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
