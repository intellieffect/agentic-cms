"""brxce-editor FastAPI application — unified server for editor + API."""
import mimetypes
import os
import subprocess
import signal
import sys
from pathlib import Path

# Load .env file (SUPABASE_URL, SUPABASE_SERVICE_KEY, etc.)
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env", override=True)

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from starlette.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

# ─── Paths ───
SRC_DIR = Path(__file__).resolve().parent.parent
EDITOR_DIR = SRC_DIR / "editor"
ASSETS_DIR = SRC_DIR.parent / "assets"
FONTS_DIR = ASSETS_DIR / "fonts"


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # Shutdown: cleanup Playwright browser
    try:
        from src.server.subtitles import cleanup
        cleanup()
    except Exception:
        pass


# ─── App ───
app = FastAPI(title="brxce-editor", version="0.1.0", lifespan=lifespan)

# CORS — match original server.py (allow all origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ─── Routers ───
from src.server.routes.projects import router as projects_router
from src.server.routes.render import router as render_router
from src.server.routes.media import router as media_router
from src.server.routes.references import router as references_router
from src.server.routes.presets import router as presets_router
from src.server.routes.finished import router as finished_router
from src.server.routes.bgm_analyze import router as bgm_analyze_router
from src.server.routes.video_analyze import router as video_analyze_router
from src.server.routes.auto_project import router as auto_project_router
from src.server.routes.render_remotion import router as render_remotion_router
from src.server.routes.whisper import router as whisper_router
from src.server.routes.carousels import router as carousels_router
from src.server.routes.carousel_render import router as carousel_render_router
from src.server.routes.collections import router as collections_router
from src.server.routes.ref_posts import router as ref_posts_router
from src.server.routes.content import router as content_router
from src.server.routes.plans import router as plans_router

app.include_router(projects_router)
app.include_router(render_router)
app.include_router(media_router)
app.include_router(references_router)
app.include_router(presets_router)
app.include_router(finished_router)
app.include_router(bgm_analyze_router)
app.include_router(video_analyze_router)
app.include_router(auto_project_router)
app.include_router(render_remotion_router)
app.include_router(whisper_router)
app.include_router(carousels_router)
app.include_router(carousel_render_router)
app.include_router(collections_router)
app.include_router(ref_posts_router)
app.include_router(content_router)
app.include_router(plans_router)


# ─── Static file serving (editor HTML/JS/fonts) ───

# Serve _fonts directory (used by index.html for @font-face)
if (EDITOR_DIR / "_fonts").exists():
    app.mount("/_fonts", StaticFiles(directory=str(EDITOR_DIR / "_fonts")), name="editor_fonts")
elif FONTS_DIR.exists():
    app.mount("/_fonts", StaticFiles(directory=str(FONTS_DIR)), name="assets_fonts")

# Serve JS modules
if (EDITOR_DIR / "js").exists():
    app.mount("/js", StaticFiles(directory=str(EDITOR_DIR / "js")), name="editor_js")


@app.get("/editor.html")
async def serve_editor_html():
    """Serve the editor redirector page."""
    path = EDITOR_DIR / "editor.html"
    if path.exists():
        return FileResponse(path, media_type="text/html")
    return HTMLResponse("<h1>editor.html not found</h1>", status_code=404)


@app.get("/index.html")
async def serve_index_html():
    """Serve the main editor UI."""
    path = EDITOR_DIR / "index.html"
    if path.exists():
        return FileResponse(path, media_type="text/html")
    return HTMLResponse("<h1>index.html not found</h1>", status_code=404)


@app.get("/finished.html")
async def serve_finished_html():
    """Serve the finished videos page."""
    path = EDITOR_DIR / "finished.html"
    if path.exists():
        return FileResponse(path, media_type="text/html")
    return HTMLResponse("<h1>finished.html not found</h1>", status_code=404)


@app.get("/projects.html")
async def serve_projects_html():
    """Serve the projects list page."""
    path = EDITOR_DIR / "projects.html"
    if path.exists():
        return FileResponse(path, media_type="text/html")
    return HTMLResponse("<h1>projects.html not found</h1>", status_code=404)


@app.get("/")
async def root():
    """Redirect to editor."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse("/editor.html")


# ─── Catch-all for media files (video seeking with Range support) ───

@app.api_route("/{filepath:path}", methods=["GET", "HEAD"])
async def serve_static_file(filepath: str, request: Request):
    """Serve media files — editor dir, resolver paths, and source directories."""
    import logging
    logger = logging.getLogger("media")
    logger.info(f"[MEDIA] filepath={filepath}")
    # Skip API routes
    if filepath.startswith("api/"):
        return JSONResponse({"error": "not found"}, status_code=404)

    raw_path = EDITOR_DIR / filepath
    fname = os.path.basename(filepath)
    is_video = fname.lower().endswith(('.mp4', '.mov', '.mkv', '.avi', '.webm'))
    use_original = request.query_params.get("original") == "1"
    quality = request.query_params.get("quality", "")  # "hq" for render-quality proxy
    proxy_dir = EDITOR_DIR / "_proxy"
    proxy_hq_dir = EDITOR_DIR / "_proxy_hq"

    # ─── Step 1: 원본 파일 찾기 (editor → legacy → resolver) ───
    file_path = None

    # 1차: editor 디렉토리
    candidate = EDITOR_DIR / filepath
    if candidate.exists() and candidate.is_file():
        file_path = candidate.resolve()

    # 2차: 레거시/추가 미디어 디렉토리
    if not file_path:
        legacy_env = os.environ.get("LEGACY_MEDIA_DIRS", "/Volumes/Media")
        legacy_dirs = [Path(d.strip()) for d in legacy_env.split(",") if d.strip()] if legacy_env else []
        for ld in legacy_dirs:
            candidate = ld / fname
            if candidate.exists():
                file_path = candidate.resolve()
                break

    # 3차: 리졸버 경로 매핑
    if not file_path:
        try:
            from src.server.routes.media import _load_resolver_config
            config = _load_resolver_config()
            mapped = config.get("pathMappings", {}).get(fname)
            if mapped and Path(mapped).exists():
                file_path = Path(mapped)
            else:
                for src_dir in config.get("sourceDirectories", []):
                    candidate = Path(src_dir) / fname
                    if candidate.exists():
                        file_path = candidate
                        break
                    if not file_path and Path(src_dir).exists():
                        for match in Path(src_dir).rglob(fname):
                            file_path = match
                            break
        except Exception:
            pass

    if not file_path or not file_path.exists():
        return JSONResponse({"error": "not found"}, status_code=404)

    # Auto-link: editor 디렉토리에 심볼릭 링크 생성
    editor_link = EDITOR_DIR / fname
    if not editor_link.exists():
        try:
            editor_link.symlink_to(file_path)
        except Exception:
            pass

    # ─── Step 2: 영상 파일 → 프록시 우선 서빙 ───
    # 프록시 먼저 체크 — 원본 resolve 전에 프록시가 있으면 바로 서빙
    if is_video and not use_original and not filepath.startswith(("_proxy/", "_proxy_hq/")):
        proxy_dir.mkdir(exist_ok=True)

        # HQ 프록시 요청 (렌더링용) — 반드시 regular proxy보다 먼저 체크
        if quality == "hq":
            # 일반 프록시가 이미 올바른 색공간(bt709)으로 변환되어 있으므로
            # HQ에서도 일반 프록시를 우선 사용 (HDR→SDR 변환이 정확함)
            existing_proxy = proxy_dir / fname
            if existing_proxy.exists() and existing_proxy.stat().st_size > 1024:
                file_path = existing_proxy
            else:
                # 일반 프록시 없으면 원본에서 HQ 프록시 생성
                hq_path = proxy_hq_dir / fname
                proxy_hq_dir.mkdir(exist_ok=True)

                if hq_path.exists() and hq_path.stat().st_size > 1024:
                    file_path = hq_path
                else:
                    # 코덱 확인 — H.264 8-bit이면 원본 그대로 서빙
                    needs_hq = True
                    try:
                        probe = subprocess.run(
                            ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
                             "-show_entries", "stream=codec_name,pix_fmt",
                             "-of", "csv=p=0", str(file_path)],
                            capture_output=True, text=True, timeout=10
                        )
                        parts = probe.stdout.strip().split(",")
                        codec = parts[0] if parts else ""
                        pix_fmt = parts[1] if len(parts) > 1 else ""
                        if codec == "h264" and "10" not in pix_fmt:
                            needs_hq = False
                    except Exception:
                        pass

                    if needs_hq:
                        tmp_hq = hq_path.with_suffix(".tmp.mp4")
                        try:
                            result = subprocess.run([
                                "ffmpeg", "-y", "-i", str(file_path),
                                "-vf", "scale=-2:'min(1920,ih)'", "-pix_fmt", "yuv420p",
                                "-c:v", "libx264", "-preset", "fast", "-crf", "18",
                                "-c:a", "aac", "-b:a", "192k",
                                "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                                "-movflags", "+faststart",
                                str(tmp_hq)
                            ], capture_output=True, timeout=300)
                            if result.returncode == 0 and tmp_hq.exists() and tmp_hq.stat().st_size > 1024:
                                tmp_hq.rename(hq_path)
                                file_path = hq_path
                            else:
                                tmp_hq.unlink(missing_ok=True)
                        except Exception:
                            tmp_hq.unlink(missing_ok=True)

        else:
            # 일반 프록시 (프리뷰용 — 720p)
            proxy_path = proxy_dir / fname
            proxy_dir.mkdir(exist_ok=True)

            if proxy_path.exists() and proxy_path.stat().st_size > 1024:
                file_path = proxy_path
            else:
                needs_proxy = True
                try:
                    probe = subprocess.run(
                        ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
                         "-show_entries", "stream=codec_name,pix_fmt",
                         "-of", "csv=p=0", str(file_path)],
                        capture_output=True, text=True, timeout=10
                    )
                    parts = probe.stdout.strip().split(",")
                    codec = parts[0] if parts else ""
                    pix_fmt = parts[1] if len(parts) > 1 else ""
                    if codec == "h264" and "10" not in pix_fmt:
                        needs_proxy = False
                except Exception:
                    pass

                if needs_proxy:
                    # 백그라운드로 프록시 생성 (중복 방지)
                    import threading
                    from src.server.proxy_utils import generate_proxy
                    if not hasattr(serve_static_file, '_proxy_in_progress'):
                        serve_static_file._proxy_in_progress = set()
                    if fname not in serve_static_file._proxy_in_progress:
                        serve_static_file._proxy_in_progress.add(fname)
                        _src, _dst, _fname = Path(str(file_path)), proxy_path, fname
                        def _bg_proxy(src=_src, dst=_dst, fn=_fname):
                            try:
                                generate_proxy(src, dst)
                            finally:
                                serve_static_file._proxy_in_progress.discard(fn)
                        threading.Thread(target=_bg_proxy, daemon=True).start()
    elif is_video and not use_original and filepath.startswith("_proxy/"):
        # 프록시 직접 요청
        pass

    file_size = file_path.stat().st_size
    content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"

    # Handle HEAD requests (Remotion checks video metadata via HEAD)
    if request.method == "HEAD":
        return Response(
            content=b"",
            status_code=200,
            media_type=content_type,
            headers={
                "Accept-Ranges": "bytes",
                "Content-Length": str(file_size),
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        )

    # Handle Range requests (for video seeking)
    range_header = request.headers.get("range")
    if range_header:
        try:
            range_spec = range_header.replace("bytes=", "")
            parts = range_spec.split("-")
            start = int(parts[0]) if parts[0] else 0
            end = int(parts[1]) if parts[1] else file_size - 1
        except (ValueError, IndexError):
            start = 0
            end = file_size - 1

        if start >= file_size:
            # Range exceeds file size (e.g. browser cached original size but now serving smaller proxy)
            # Return full file instead of 416
            def iter_full():
                with open(file_path, "rb") as f:
                    while chunk := f.read(1024 * 256):
                        yield chunk
            return StreamingResponse(
                iter_full(),
                media_type=content_type,
                headers={
                    "Content-Length": str(file_size),
                    "Accept-Ranges": "bytes",
                    "Cache-Control": "no-cache",
                },
            )

        end = min(end, file_size - 1)
        content_length = end - start + 1

        def iter_file():
            with open(file_path, "rb") as f:
                f.seek(start)
                remaining = content_length
                buf_size = 64 * 1024
                while remaining > 0:
                    chunk = f.read(min(buf_size, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(
            iter_file(),
            status_code=206,
            media_type=content_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        )

    return FileResponse(
        file_path,
        media_type=content_type,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache, no-store, must-revalidate",
        },
    )


# ─── CLI entry point ───

def main():
    import uvicorn

    port = int(os.environ.get("PORT", "8090"))
    print(f"🎬 brxce-editor server at http://localhost:{port}/editor.html")
    uvicorn.run(
        "src.server.app:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info",
    )


if __name__ == "__main__":
    main()
