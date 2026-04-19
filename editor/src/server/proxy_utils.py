"""Proxy generation utilities."""
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)


def get_duration(filepath: Path) -> float:
    """Get media duration in seconds via ffprobe."""
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
             "-of", "csv=p=0", str(filepath)],
            capture_output=True, text=True, timeout=15
        )
        return float(r.stdout.strip()) if r.stdout.strip() else 0
    except Exception:
        return 0


def _detect_color_space(filepath: Path) -> str:
    """Detect source color space: 'hdr', 'smpte170m', or 'bt709'."""
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
             "-show_entries", "stream=color_space,color_transfer,color_primaries",
             "-of", "csv=p=0", str(filepath)],
            capture_output=True, text=True, timeout=10
        )
        out = r.stdout.lower()
        if "bt2020" in out or "arib-std-b67" in out or "smpte2084" in out:
            return "hdr"
        if "smpte170m" in out or "bt470" in out:
            return "smpte170m"
    except Exception:
        pass
    return "bt709"


def generate_proxy(
    src: Path,
    dst: Path,
    max_height: int = 720,
    crf: int = 22,
    preset: str = "fast",
    max_retries: int = 2,
) -> bool:
    """Generate H.264 proxy with proper color space conversion.

    Returns True if proxy was created successfully.
    """
    src_resolved = src.resolve() if src.is_symlink() else src
    if not src_resolved.exists():
        logger.warning(f"Proxy source not found: {src}")
        return False

    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_suffix(".tmp.mp4")

    vf_str = f"scale=-2:'min({max_height},ih)'"

    for attempt in range(1, max_retries + 1):
        try:
            tmp.unlink(missing_ok=True)
            result = subprocess.run([
                "ffmpeg", "-y", "-noautorotate", "-i", str(src_resolved),
                "-vf", vf_str,
                "-pix_fmt", "yuv420p",
                "-c:v", "libx264", "-preset", preset, "-crf", str(crf),
                "-g", "30", "-keyint_min", "30",
                "-c:a", "aac", "-b:a", "128k",
                "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
                "-metadata:s:v", "rotate=0",
                "-movflags", "+faststart",
                str(tmp)
            ], capture_output=True, timeout=600)

            if result.returncode != 0:
                stderr_msg = (result.stderr or b"")[-500:]
                logger.warning(f"Proxy ffmpeg failed rc={result.returncode} (attempt {attempt}): {dst.name}\n  {stderr_msg}")
                tmp.unlink(missing_ok=True)
                continue

            if not tmp.exists() or tmp.stat().st_size < 1024:
                logger.warning(f"Proxy output too small or missing (attempt {attempt}): {dst.name}")
                tmp.unlink(missing_ok=True)
                continue

            # Success — atomic rename
            tmp.rename(dst)
            logger.info(f"Proxy created: {dst.name} (attempt {attempt})")
            return True

        except subprocess.TimeoutExpired:
            logger.warning(f"Proxy generation timed out (attempt {attempt}): {dst.name}")
            tmp.unlink(missing_ok=True)
        except Exception as e:
            logger.warning(f"Proxy generation error (attempt {attempt}): {dst.name}: {e}")
            tmp.unlink(missing_ok=True)

    logger.error(f"Proxy generation failed after {max_retries} attempts: {dst.name}")
    return False
