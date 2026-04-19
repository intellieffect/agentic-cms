"""Remotion render API route — PoC for React-based video rendering."""
import json
import logging
import os
import re
import subprocess
import tempfile
import threading
import uuid
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["render-remotion"])

# ─── Paths ───
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
REMOTION_DIR = PROJECT_ROOT / "remotion"
EDITOR_DIR = PROJECT_ROOT / "src" / "editor"
OUTPUT_DIR = REMOTION_DIR / "out"

# ─── Shared state ───
remotion_render_status: dict = {
    "state": "idle",
    "progress": 0,
    "error": None,
    "output": None,
    "job_id": None,
}
remotion_lock = threading.Lock()


def _resolve_source(fname: str) -> Path | None:
    """Find source file across editor dir, legacy dirs, and resolver config."""
    # 1) editor dir
    candidate = EDITOR_DIR / fname
    if candidate.exists():
        return candidate.resolve() if candidate.is_symlink() else candidate

    # 2) legacy dirs
    legacy_env = os.environ.get("LEGACY_MEDIA_DIRS", "/Volumes/Media")
    for d in (legacy_env or "").split(","):
        d = d.strip()
        if not d:
            continue
        c = Path(d) / fname
        if c.exists():
            return c

    # 3) resolver config source directories
    try:
        from src.server.routes.media import _load_resolver_config
        config = _load_resolver_config()
        mapped = config.get("pathMappings", {}).get(fname)
        if mapped and Path(mapped).exists():
            return Path(mapped)
        for src_dir in config.get("sourceDirectories", []):
            c = Path(src_dir) / fname
            if c.exists():
                return c
            if Path(src_dir).exists():
                for match in Path(src_dir).rglob(fname):
                    return match
    except Exception:
        pass
    return None


def _ensure_proxies(project_data: dict) -> None:
    """Pre-generate proxies for all clips before Remotion render."""
    from src.server.proxy_utils import generate_proxy

    clips = project_data.get("clips", [])
    proxy_dir = EDITOR_DIR / "_proxy"
    proxy_dir.mkdir(parents=True, exist_ok=True)

    for clip in clips:
        source = clip.get("source", "")
        if not source:
            continue
        fname = Path(source).name
        proxy_path = proxy_dir / fname
        if proxy_path.exists() and proxy_path.stat().st_size > 1024:
            continue
        src_path = _resolve_source(fname)
        if src_path and src_path.exists():
            logger.info(f"Pre-generating proxy for: {fname}")
            generate_proxy(src_path, proxy_path)
        else:
            logger.warning(f"Source not found for proxy: {fname}")


def _run_remotion_render(project_data: dict, job_id: str) -> None:
    """Background thread: write props JSON, invoke Remotion CLI render."""
    try:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

        # Pre-generate all proxies before render
        with remotion_lock:
            remotion_render_status.update(phase="프록시 생성 중...")
        _ensure_proxies(project_data)

        # Write project JSON as input props
        props_file = OUTPUT_DIR / f"props_{job_id}.json"

        # Add mediaBasePath so Remotion can fetch media from FastAPI server
        render_data = {**project_data}
        render_data["mediaBasePath"] = "http://localhost:8092"

        props_file.write_text(json.dumps(render_data, ensure_ascii=False))

        output_path = OUTPUT_DIR / f"render_{job_id}.mp4"

        # Calculate duration for Remotion
        total_duration = render_data.get("totalDuration", 10)
        fps = 30  # 30fps (숏폼 표준, 60fps 대비 렌더링 2배 빠름)
        duration_frames = int(total_duration * fps)

        with remotion_lock:
            remotion_render_status.update(
                state="rendering", progress=0, totalFrames=duration_frames,
                phase="렌더링 준비 중...",
            )

        # Build Remotion CLI command — 고화질 60fps 렌더링
        cmd = [
            "npx", "remotion", "render",
            "VideoProject",
            str(output_path),
            "--props", str(props_file),
            "--codec", "h264",
            "--crf", "20",
            "--concurrency", "2",
            "--log", "verbose",
            "--timeout", "120000",
        ]

        logger.info(f"Remotion render start: job={job_id}, frames={duration_frames}")

        # Use Popen for real-time progress parsing
        proc = subprocess.Popen(
            cmd,
            cwd=str(REMOTION_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )

        stderr_lines: list[str] = []
        # Patterns to match Remotion progress output:
        # "Rendering frames (123/456)" or "rendered 123/456" or "= 27% done"
        # Remotion 4.x: " (123/456)" pattern in verbose mode
        frame_pattern = re.compile(r"(\d+)/(\d+)")
        pct_pattern = re.compile(r"(\d+)%")
        stitching_pattern = re.compile(r"[Ss]titch|[Ee]ncod|[Mm]ux")

        try:
            for line in proc.stdout:
                line = line.strip()
                if not line:
                    continue
                stderr_lines.append(line)

                # Try to parse frame progress (e.g., "Rendering frames (45/300)")
                frame_match = frame_pattern.search(line)
                if frame_match:
                    current = int(frame_match.group(1))
                    total = int(frame_match.group(2))
                    if total > 0:
                        # Rendering phase = 0-85%, Stitching = 85-100%
                        is_stitch = bool(stitching_pattern.search(line))
                        if is_stitch:
                            pct = 85 + int((current / total) * 15)
                            phase = f"인코딩 중... ({current}/{total})"
                        else:
                            pct = int((current / total) * 85)
                            phase = f"프레임 렌더링 중... ({current}/{total})"
                        with remotion_lock:
                            remotion_render_status.update(
                                progress=min(pct, 99), phase=phase
                            )
                    continue

                # Try percentage pattern (e.g., "= 27% done")
                pct_match = pct_pattern.search(line)
                if pct_match and ("done" in line.lower() or "progress" in line.lower() or "render" in line.lower()):
                    pct = int(pct_match.group(1))
                    with remotion_lock:
                        remotion_render_status.update(
                            progress=min(pct, 99), phase=f"렌더링 중... {pct}%"
                        )
                    continue

                # Phase detection
                lower = line.lower()
                if "bundl" in lower:
                    with remotion_lock:
                        remotion_render_status.update(phase="번들링 중...")
                elif "browser" in lower or "chromium" in lower:
                    with remotion_lock:
                        remotion_render_status.update(phase="브라우저 준비 중...")

            proc.wait(timeout=600)
        except subprocess.TimeoutExpired:
            proc.kill()
            with remotion_lock:
                remotion_render_status.update(
                    state="error", error="Render timed out (10 min)", progress=0
                )
            return

        if proc.returncode != 0:
            error_output = "\n".join(stderr_lines[-10:]) if stderr_lines else "Unknown error"
            logger.error(f"Remotion render failed: {error_output}")
            with remotion_lock:
                remotion_render_status.update(
                    state="error", error=error_output, progress=0
                )
            return

        if not output_path.exists():
            with remotion_lock:
                remotion_render_status.update(
                    state="error", error="Output file not created", progress=0
                )
            return

        logger.info(f"Remotion render done: {output_path}")
        with remotion_lock:
            remotion_render_status.update(
                state="done", progress=100, output=str(output_path),
                error=None, phase="완료!"
            )

    except subprocess.TimeoutExpired:
        with remotion_lock:
            remotion_render_status.update(
                state="error", error="Render timed out (10 min)", progress=0
            )
    except Exception as e:
        logger.exception("Remotion render error")
        with remotion_lock:
            remotion_render_status.update(
                state="error", error=str(e), progress=0
            )
    finally:
        # Cleanup props file
        try:
            props_file = OUTPUT_DIR / f"props_{job_id}.json"
            if props_file.exists():
                props_file.unlink()
        except Exception:
            pass


# ─── Routes ───

@router.post("/api/render-remotion")
async def start_remotion_render(request: Request):
    """Start a Remotion-based render. Same project JSON format as /api/render."""
    body = await request.json()
    clips = body.get("clips", [])

    if not clips:
        return JSONResponse({"error": "No clips"}, status_code=400)

    # Check that Remotion project exists
    if not (REMOTION_DIR / "package.json").exists():
        return JSONResponse(
            {"error": "Remotion project not found. Run npm install in remotion/ first."},
            status_code=500,
        )

    # ─── 렌더링 전 색공간 회귀 테스트 실행 ───
    try:
        test_result = subprocess.run(
            ["npx", "vitest", "run", "--reporter=verbose", "tests/video-color-regression"],
            cwd=str(PROJECT_ROOT),
            capture_output=True, text=True, timeout=30,
        )
        if test_result.returncode != 0:
            logger.error(f"Color regression test FAILED:\n{test_result.stdout}\n{test_result.stderr}")
            return JSONResponse(
                {"error": "색공간 회귀 테스트 실패. 렌더링을 중단합니다. 로그를 확인하세요."},
                status_code=500,
            )
        logger.info("Color regression tests passed")
    except subprocess.TimeoutExpired:
        logger.warning("Color regression test timed out — proceeding with render")
    except Exception as e:
        logger.warning(f"Color regression test skipped: {e}")

    job_id = uuid.uuid4().hex[:8]

    with remotion_lock:
        if remotion_render_status["state"] == "rendering":
            return JSONResponse(
                {"error": "A render is already in progress"}, status_code=409
            )
        remotion_render_status.update(
            state="starting", progress=0, error=None, output=None, job_id=job_id
        )

    t = threading.Thread(
        target=_run_remotion_render, args=(body, job_id), daemon=True
    )
    t.start()

    return {"status": "started", "job_id": job_id, "total_clips": len(clips)}


@router.get("/api/render-remotion/status")
async def remotion_render_status_route():
    """Poll render status."""
    return remotion_render_status


@router.get("/api/render-remotion/download")
async def remotion_render_download():
    """Download rendered MP4."""
    output = remotion_render_status.get("output")
    if not output or not Path(output).exists():
        return JSONResponse({"error": "No rendered file"}, status_code=404)

    fname = Path(output).name
    return FileResponse(
        output,
        media_type="video/mp4",
        filename=fname,
        headers={
            "Content-Disposition": f'attachment; filename="{fname}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
