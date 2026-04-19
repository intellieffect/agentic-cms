"""Media serving routes — thumbnails, video list, upload, resolver, external upload."""
import json
import logging
import os
import subprocess
import urllib.parse
from pathlib import Path

from fastapi import APIRouter, Request, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse, Response

logger = logging.getLogger(__name__)

router = APIRouter(tags=["media"])

BASE = Path(__file__).resolve().parent.parent.parent / "editor"

# Legacy media directories (configurable via LEGACY_MEDIA_DIRS env, comma-separated)
_legacy_env = os.environ.get("LEGACY_MEDIA_DIRS", "")
_LEGACY_DIRS = [Path(d.strip()) for d in _legacy_env.split(",") if d.strip()] if _legacy_env else []

# ─── resolver helpers ───

_resolver_config_path = BASE / "_resolver_config.json"


def _load_resolver_config():
    if _resolver_config_path.exists():
        try:
            return json.loads(_resolver_config_path.read_text())
        except Exception as e:
            logger.debug("Failed to read resolver config: %s", e)
    return {"sourceDirectories": [], "pathMappings": {}}


def _save_resolver_config(config):
    _resolver_config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2))


def resolve_missing_files(filenames):
    """4-step fallback resolver (identical to original server.py logic)."""
    config = _load_resolver_config()
    source_dirs = config.get("sourceDirectories", [])
    path_mappings = config.get("pathMappings", {})
    results = {}

    for fname in filenames:
        if "/" in fname or "\\" in fname or ".." in fname:
            results[fname] = {"status": "missing", "reason": "invalid filename"}
            continue

        local_path = BASE / fname

        # Step 1: Already exists in editor dir
        if local_path.exists():
            results[fname] = {"status": "found", "path": str(local_path)}
            continue

        # Step 1a: Check legacy brxce.ai video-editor directories
        for legacy in _LEGACY_DIRS:
            legacy_path = legacy / fname
            if legacy_path.exists():
                results[fname] = {"status": "found", "path": str(legacy_path.resolve())}
                break
        if fname in results:
            continue

        # Step 1.5: Path mappings
        if fname in path_mappings:
            mapped = Path(path_mappings[fname])
            if mapped.exists():
                try:
                    local_path.symlink_to(mapped)
                except OSError:
                    pass
                results[fname] = {"status": "found", "path": str(mapped), "method": "mapping"}
                continue

        # Step 2: Search source dirs by exact name
        found = False
        for src_dir in source_dirs:
            src_path = Path(src_dir)
            if not src_path.exists():
                continue
            for match in src_path.rglob(fname):
                if match.is_file():
                    try:
                        local_path.symlink_to(match)
                    except OSError:
                        pass
                    path_mappings[fname] = str(match)
                    results[fname] = {"status": "found", "path": str(match), "method": "search"}
                    found = True
                    break
            if found:
                break
        if found:
            continue

        # Step 3: Case-insensitive search
        fname_lower = fname.lower()
        for src_dir in source_dirs:
            src_path = Path(src_dir)
            if not src_path.exists():
                continue
            for f in src_path.rglob("*"):
                if f.is_file() and f.name.lower() == fname_lower:
                    try:
                        local_path.symlink_to(f)
                    except OSError:
                        pass
                    path_mappings[fname] = str(f)
                    results[fname] = {"status": "found", "path": str(f), "method": "case-insensitive"}
                    found = True
                    break
            if found:
                break
        if found:
            continue

        results[fname] = {"status": "missing"}

    config["pathMappings"] = path_mappings
    _save_resolver_config(config)
    return results


# ─── video metadata helpers ───

def get_video_duration(path: str) -> float:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", path],
            capture_output=True, text=True
        )
        return float(json.loads(r.stdout)["format"]["duration"])
    except Exception:
        return 0.0


def get_video_fps(path: str) -> int:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
             "-show_entries", "stream=r_frame_rate", "-of", "csv=p=0", path],
            capture_output=True, text=True
        )
        fps_str = r.stdout.strip().split(",")[0]
        if "/" in fps_str:
            num, den = fps_str.split("/")
            return round(int(num) / int(den))
        return round(float(fps_str))
    except Exception:
        return 30


def has_audio_stream(path: str) -> bool:
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-select_streams", "a:0",
             "-show_entries", "stream=codec_type", "-of", "csv=p=0", path],
            capture_output=True, text=True, timeout=10
        )
        return "audio" in (r.stdout or "").strip().lower()
    except Exception:
        return False


# ─── Routes ───

@router.get("/api/list-videos")
async def list_videos():
    exts = {".mov", ".mp4", ".avi", ".mkv", ".webm", ".m4v"}
    videos = []
    skip = {"thread_output", "thread_with_subs", "vlog_dev", "edited_output"}
    # editor dir + legacy dirs에서 영상 찾기
    all_files = {}
    search_dirs = [BASE] + [d for d in _LEGACY_DIRS if d.exists()]
    for search_dir in search_dirs:
        try:
            for f in search_dir.iterdir():
                if f.name not in all_files and f.exists():
                    all_files[f.name] = f
        except Exception as e:
            logger.debug("Directory walk failed: %s", e)
    for f in sorted(all_files.values(), key=lambda x: x.name):
        stem = f.stem.split("_v")[0] if "_v" in f.stem else f.stem
        if (
            f.suffix.lower() in exts
            and not f.name.startswith("_")
            and not f.name.startswith("edited_")
            and stem not in skip
            and not any(f.stem.startswith(s) for s in skip)
        ):
            dur = get_video_duration(str(f))
            fps = get_video_fps(str(f))
            size_mb = f.stat().st_size / 1024 / 1024
            videos.append({
                "name": f.name,
                "duration": round(dur, 1),
                "size": round(size_mb, 1),
                "fps": fps,
            })
    return {"videos": videos}


@router.get("/api/media/probe/{filename:path}")
async def probe_media(filename: str):
    """Get media file info (duration, width, height, fps)."""
    name = urllib.parse.unquote(filename)
    # 파일 찾기 (editor → legacy → resolver)
    video_path = (BASE / name).resolve()
    if not video_path.exists():
        for legacy in _LEGACY_DIRS:
            candidate = legacy / name
            if candidate.exists():
                video_path = candidate.resolve()
                break
    if not video_path or not video_path.exists():
        config = _load_resolver_config()
        mapped = config.get("pathMappings", {}).get(name)
        if mapped and Path(mapped).exists():
            video_path = Path(mapped)
        else:
            for src_dir in config.get("sourceDirectories", []):
                candidate = Path(src_dir) / name
                if candidate.exists():
                    video_path = candidate
                    break
    if not video_path or not video_path.exists():
        return JSONResponse({"error": "not found"}, status_code=404)
    
    dur = get_video_duration(str(video_path))
    fps = get_video_fps(str(video_path))
    has_audio = has_audio_stream(str(video_path))
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
             "-show_entries", "stream=width,height", "-of", "json", str(video_path)],
            capture_output=True, timeout=10,
        )
        import json as _json
        info = _json.loads(r.stdout)
        streams = info.get("streams", [{}])
        w = streams[0].get("width", 0) if streams else 0
        h = streams[0].get("height", 0) if streams else 0
    except Exception:
        w, h = 0, 0
    
    return {"duration": dur, "fps": fps, "width": w, "height": h, "path": str(video_path), "hasAudio": has_audio}


@router.get("/api/thumbnail/{filename:path}")
async def get_thumbnail(filename: str):
    name = urllib.parse.unquote(filename)
    video_path = (BASE / name).resolve()

    # editor dir에 없으면 legacy/resolver에서 찾기
    if not video_path.exists():
        video_path = None
        for legacy in _LEGACY_DIRS:
            candidate = legacy / name
            if candidate.exists():
                video_path = candidate.resolve()
                break
        if not video_path:
            config = _load_resolver_config()
            mapped = config.get("pathMappings", {}).get(name)
            if mapped and Path(mapped).exists():
                video_path = Path(mapped)
            else:
                for src_dir in config.get("sourceDirectories", []):
                    candidate = Path(src_dir) / name
                    if candidate.exists():
                        video_path = candidate
                        break
        if not video_path or not video_path.exists():
            return JSONResponse({"error": "Video not found"}, status_code=404)

    thumb_dir = BASE / "_thumbs"
    thumb_dir.mkdir(exist_ok=True)
    thumb_path = thumb_dir / f"{video_path.stem}.jpg"

    if not thumb_path.exists():
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", str(video_path),
                 "-ss", "0.5", "-vframes", "1",
                 "-vf", "scale=160:-2", "-q:v", "8",
                 str(thumb_path)],
                capture_output=True, timeout=10,
            )
        except Exception:
            return JSONResponse({"error": "Thumbnail generation failed"}, status_code=500)

    if not thumb_path.exists():
        return JSONResponse({"error": "Thumbnail not generated"}, status_code=500)

    return FileResponse(
        thumb_path,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/api/upload")
async def upload_file(request: Request):
    """Handle multipart file upload (preserves original server.py logic)."""
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" not in content_type:
        return JSONResponse({"error": "multipart required"}, status_code=400)

    boundary = None
    for part in content_type.split(";"):
        part = part.strip()
        if part.startswith("boundary="):
            boundary = part.split("=", 1)[1].strip('"')
    if not boundary:
        return JSONResponse({"error": "no boundary"}, status_code=400)

    body = await request.body()
    boundary_bytes = f"--{boundary}".encode()
    parts = body.split(boundary_bytes)

    uploaded = []
    for part in parts:
        if b"Content-Disposition" not in part:
            continue
        header_end = part.find(b"\r\n\r\n")
        if header_end < 0:
            continue
        header_section = part[:header_end].decode("utf-8", errors="replace")
        file_data = part[header_end + 4:]
        if file_data.endswith(b"\r\n"):
            file_data = file_data[:-2]

        filename = None
        for line in header_section.split("\r\n"):
            if "filename=" in line:
                fn_start = line.find('filename="')
                if fn_start >= 0:
                    fn_start += 10
                    fn_end = line.find('"', fn_start)
                    filename = line[fn_start:fn_end]

        if filename and file_data:
            safe_name = Path(filename).name
            dest = BASE / safe_name
            with open(dest, "wb") as f:
                f.write(file_data)

            img_exts = {".jpg", ".jpeg", ".png", ".heic", ".webp", ".gif", ".bmp", ".tiff"}
            if Path(safe_name).suffix.lower() in img_exts:
                still_name = Path(safe_name).stem + "_still.mp4"
                still_path = BASE / still_name
                dur_sec = 4
                subprocess.run(
                    ["ffmpeg", "-y", "-loop", "1", "-i", str(dest), "-t", str(dur_sec),
                     "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
                     "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", "-r", "30",
                     str(still_path)],
                    capture_output=True, timeout=30,
                )
                if still_path.exists():
                    safe_name = still_name
                    dur = dur_sec
                    size_mb = still_path.stat().st_size / 1024 / 1024
                else:
                    dur = 0
                    size_mb = dest.stat().st_size / 1024 / 1024
            else:
                dur = get_video_duration(str(dest))
                size_mb = dest.stat().st_size / 1024 / 1024

            uploaded.append({"name": safe_name, "duration": round(dur, 1), "size": round(size_mb, 1)})

    return {"uploaded": uploaded}


@router.post("/api/upload-external")
async def upload_external(request: Request):
    """Symlink an external video file into the editor directory."""
    body = await request.json()
    src_path = Path(body.get("path", "")).expanduser().resolve()

    ALLOWED_DIRS = [
        Path.home() / "Desktop",
        Path.home() / "Downloads",
        Path.home() / "Movies",
        Path("/Volumes"),
    ]
    if not any(str(src_path).startswith(str(d)) for d in ALLOWED_DIRS):
        return JSONResponse({"error": f"허용되지 않은 경로: {src_path}"}, status_code=403)

    if not src_path.exists():
        return JSONResponse({"error": f"File not found: {src_path}"}, status_code=404)

    allowed_ext = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".jpg", ".jpeg", ".png", ".heic"}
    if src_path.suffix.lower() not in allowed_ext:
        return JSONResponse({"error": f"허용되지 않은 파일 형식: {src_path.suffix}"}, status_code=400)

    dest = BASE / src_path.name
    if not dest.exists():
        dest.symlink_to(src_path)

    dur = get_video_duration(str(dest))
    fps = get_video_fps(str(dest))
    size_mb = dest.stat().st_size / 1024 / 1024

    return {"name": dest.name, "duration": round(dur, 1), "size": round(size_mb, 1), "fps": fps}


# ─── Resolver routes ───

@router.get("/api/resolver/config")
async def resolver_config():
    return _load_resolver_config()


@router.post("/api/resolver/resolve")
async def resolver_resolve(request: Request):
    body = await request.json()
    filenames = body.get("filenames", [])
    if not filenames:
        return {"error": "filenames required"}
    results = resolve_missing_files(filenames)
    found = sum(1 for r in results.values() if r["status"] == "found")
    missing = sum(1 for r in results.values() if r["status"] == "missing")
    return {"results": results, "found": found, "missing": missing, "total": len(filenames)}


@router.post("/api/resolver/add-directory")
async def resolver_add_directory(request: Request):
    body = await request.json()
    directory = body.get("directory", "").strip()
    filenames = body.get("filenames", [])

    if not directory or not Path(directory).is_dir():
        return {"error": f"Directory not found: {directory}"}

    config = _load_resolver_config()
    if directory not in config["sourceDirectories"]:
        config["sourceDirectories"].append(directory)
        _save_resolver_config(config)

    results = {}
    if filenames:
        results = resolve_missing_files(filenames)

    found = sum(1 for r in results.values() if r["status"] == "found")
    missing = sum(1 for r in results.values() if r["status"] == "missing")
    return {
        "directory": directory,
        "added": True,
        "sourceDirectories": config["sourceDirectories"],
        "results": results,
        "found": found,
        "missing": missing,
    }


@router.post("/api/resolver/link-file")
async def resolver_link_file(request: Request):
    body = await request.json()
    filename = body.get("filename", "").strip()
    filepath = body.get("filepath", "").strip()

    if not filename or not filepath:
        return {"error": "filename and filepath required"}
    if "/" in filename or "\\" in filename or ".." in filename:
        return {"error": "Invalid filename: path traversal not allowed"}

    source = Path(filepath)
    if not source.is_file():
        return {"error": f"File not found: {filepath}"}

    target = BASE / filename
    if target.parent.resolve() != BASE.resolve():
        return {"error": "Invalid target path"}

    if target.is_symlink() and not target.exists():
        target.unlink()
    if not target.exists():
        try:
            target.symlink_to(source)
        except OSError as e:
            return {"error": f"Failed to create symlink: {e}"}

    config = _load_resolver_config()
    config.setdefault("pathMappings", {})[filename] = filepath
    _save_resolver_config(config)

    return {"status": "linked", "filename": filename, "filepath": filepath}


@router.post("/api/resolver/pick-file")
async def resolver_pick_file(request: Request):
    body = await request.json()
    filename = body.get("filename", "file")
    multiple = body.get("multiple", False)
    safe_filename = filename.replace("\\", "\\\\").replace('"', '\\"')
    prompt_text = f"{safe_filename} 파일을 선택하세요"

    if multiple:
        script = (
            f'set theFiles to (choose file with prompt "{prompt_text}" '
            f'of type {{"public.movie", "public.mpeg-4", "com.apple.quicktime-movie", "public.avi"}} '
            f'with multiple selections allowed)\n'
            f'set output to ""\n'
            f'repeat with f in theFiles\n'
            f'  set output to output & POSIX path of f & linefeed\n'
            f'end repeat\n'
            f'return output'
        )
    else:
        script = (
            f'POSIX path of (choose file with prompt "{prompt_text}" '
            f'of type {{"public.movie", "public.mpeg-4", "com.apple.quicktime-movie", "public.avi", "public.image"}})'
        )
    try:
        result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            return {"error": "cancelled", "detail": result.stderr.strip()}
        raw = result.stdout.strip()
        if not raw:
            return {"error": "no file selected"}
        if multiple:
            filepaths = [p.strip() for p in raw.split("\n") if p.strip()]
            return {"filepaths": filepaths}
        return {"filepath": raw}
    except subprocess.TimeoutExpired:
        return {"error": "dialog timeout"}
    except Exception as e:
        return {"error": str(e)}


@router.post("/api/resolver/pick-directory")
async def resolver_pick_directory(request: Request):
    script = 'POSIX path of (choose folder with prompt "영상 소스 폴더를 선택하세요")'
    try:
        result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            return {"error": "cancelled", "detail": result.stderr.strip()}
        dirpath = result.stdout.strip().rstrip("/")
        return {"directory": dirpath} if dirpath else {"error": "no folder selected"}
    except subprocess.TimeoutExpired:
        return {"error": "dialog timeout"}
    except Exception as e:
        return {"error": str(e)}
