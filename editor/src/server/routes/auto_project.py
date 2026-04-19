"""Auto Project — end-to-end: reference analysis → source selection → clip pick → BGM → project creation."""
import logging
import os
import re
import subprocess
import json
import glob
import traceback
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)

import numpy as np
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from src.server.table_config import TABLE_VIDEOS, TABLE_PROJECTS

router = APIRouter(prefix="/api/auto-project", tags=["auto-project"])

BASE = Path(__file__).resolve().parent.parent.parent / "editor"
# Default source directory (configurable via sourceDir in request body)
SEAGATE = Path(os.environ.get("DEFAULT_SOURCE_DIR", "/Volumes/Media"))


def _ffprobe_json(path: str) -> dict:
    r = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries",
         "stream=width,height,duration,r_frame_rate",
         "-show_entries", "format=duration", "-of", "json", path],
        capture_output=True, text=True, timeout=10,
    )
    return json.loads(r.stdout) if r.stdout else {}


def _get_orientation(path: str) -> str:
    info = _ffprobe_json(path)
    s = info.get("streams", [{}])[0]
    w, h = s.get("width", 0), s.get("height", 0)
    return "vertical" if h > w else "horizontal"


def _get_duration(path: str) -> float:
    info = _ffprobe_json(path)
    return float(info.get("format", {}).get("duration", 0))


# ─── Reference Analysis ───

def analyze_reference(video_path: str) -> dict:
    """Analyze a reference video: orientation, cut structure, total duration."""
    info = _ffprobe_json(video_path)
    s = info.get("streams", [{}])[0]
    w, h = s.get("width", 0), s.get("height", 0)
    dur = float(info.get("format", {}).get("duration", 0))
    ori = "vertical" if h > w else "horizontal"

    # Scene detection (ffprobe)
    r = subprocess.run([
        "ffprobe", "-v", "quiet", "-show_entries", "frame=pts_time",
        "-select_streams", "v", "-of", "csv=p=0",
        "-f", "lavfi", f"movie={video_path},select=gt(scene\\,0.10)"
    ], capture_output=True, text=True, timeout=30)

    scenes = [float(x) for x in r.stdout.strip().split('\n') if x]
    all_pts = [0] + scenes + [dur]

    # De-dup close cuts (0.08s min gap — preserve fast photo-style transitions)
    clean = [all_pts[0]]
    for p in all_pts[1:]:
        if p - clean[-1] > 0.08:
            clean.append(p)
    if clean[-1] < dur - 0.1:
        clean.append(dur)

    cuts = []
    for i in range(len(clean) - 1):
        cuts.append(round(clean[i + 1] - clean[i], 2))

    return {
        "orientation": ori,
        "width": w,
        "height": h,
        "duration": round(dur, 2),
        "numCuts": len(cuts),
        "cutDurations": cuts,
    }


# ─── Source Selection ───

def _load_probe_cache(source_dir: str) -> dict:
    """Load ffprobe cache for a source directory."""
    cache_path = Path(source_dir) / ".probe_cache.json"
    if cache_path.exists():
        try:
            return json.loads(cache_path.read_text())
        except Exception:
            pass
    return {}


def _save_probe_cache(source_dir: str, cache: dict) -> None:
    """Save ffprobe cache."""
    cache_path = Path(source_dir) / ".probe_cache.json"
    try:
        cache_path.write_text(json.dumps(cache, ensure_ascii=False))
    except Exception:
        pass


def scan_sources(source_dir: str, orientation: str) -> list[dict]:
    """Scan directory for video files matching orientation. Uses ffprobe cache."""
    exts = {".mp4", ".mov", ".avi", ".mkv"}
    sources = []
    p = Path(source_dir)
    if not p.exists():
        return sources

    cache = _load_probe_cache(source_dir)
    cache_dirty = False

    # Sort by modification time (newest first), scan up to 100 files
    all_files = sorted(
        [f for f in p.iterdir() if f.suffix.lower() in exts and not f.name.startswith("._")],
        key=lambda x: x.stat().st_mtime, reverse=True
    )[:100]
    for f in all_files:
        try:
            mtime = f.stat().st_mtime
            cached = cache.get(f.name)

            # Use cache if mtime matches
            if cached and cached.get("mtime") == mtime:
                w, h, dur = cached["width"], cached["height"], cached["duration"]
            else:
                info = _ffprobe_json(str(f))
                s = info.get("streams", [{}])[0]
                w, h = s.get("width", 0), s.get("height", 0)
                dur = float(info.get("format", {}).get("duration", 0))
                cache[f.name] = {"width": w, "height": h, "duration": round(dur, 2), "mtime": mtime}
                cache_dirty = True

            ori = "vertical" if h > w else "horizontal"
            if ori != orientation:
                continue
            sources.append({
                "file": f.name,
                "path": str(f),
                "width": w,
                "height": h,
                "duration": round(dur, 2),
            })
        except Exception:
            continue

    if cache_dirty:
        _save_probe_cache(source_dir, cache)

    return sources


# ─── A. Session Grouping ───

_DJI_TS_RE = re.compile(r"DJI_(\d{14})")


def _extract_timestamp(filename: str) -> datetime | None:
    """Extract timestamp from DJI filename pattern: DJI_20260317082502_0212_D.MP4"""
    m = _DJI_TS_RE.search(filename)
    if m:
        try:
            return datetime.strptime(m.group(1), "%Y%m%d%H%M%S")
        except ValueError:
            return None
    return None


def _group_by_session(sources: list[dict], gap_minutes: int = 30) -> dict[str, list[dict]]:
    """Group sources by shooting session.

    Primary grouping: same DATE (YYYYMMDD) = same session.
    Secondary: within same date, if gap > gap_minutes, split into sub-sessions.
    But for source selection, we return by-date groups (maximizes source variety).

    Returns {session_id: [sources]} where session_id = date string.
    Sources without parseable timestamps go into 'unknown' group.
    """
    with_ts = []
    without_ts = []
    for src in sources:
        ts = _extract_timestamp(src["file"])
        if ts:
            with_ts.append((ts, src))
        else:
            without_ts.append(src)

    # Sort by timestamp
    with_ts.sort(key=lambda x: x[0])

    # Group by DATE (same day = same session for source variety)
    groups: dict[str, list[dict]] = {}
    for ts, src in with_ts:
        date_key = ts.strftime("%Y%m%d")
        if date_key not in groups:
            groups[date_key] = []
        groups[date_key].append(src)

    if without_ts:
        groups["unknown"] = without_ts

    # Add session_group field to each source
    for gid, srcs in groups.items():
        for src in srcs:
            src["session_group"] = gid

    return groups


def _select_session(groups: dict[str, list[dict]], mode: str = "auto", min_sources: int = 15) -> list[dict]:
    """Select session based on mode.

    - 'auto': largest group, but merge nearby sessions if too few sources
    - 'latest': most recent session
    - 'all': use all sources across all sessions
    - timestamp string: exact match
    
    min_sources: if selected group has fewer than this, merge with adjacent sessions.
    """
    if not groups:
        return []

    if mode == "all":
        return [src for srcs in groups.values() for src in srcs]

    if mode == "latest":
        sorted_keys = sorted(k for k in groups if k != "unknown")
        if sorted_keys:
            result = groups[sorted_keys[-1]]
            # If too few, merge with previous sessions
            if len(result) < min_sources and len(sorted_keys) > 1:
                for k in reversed(sorted_keys[:-1]):
                    result = result + groups[k]
                    if len(result) >= min_sources:
                        break
            return result
        return groups.get("unknown", [])

    if mode == "auto":
        # Start with largest group
        sorted_groups = sorted(groups.items(), key=lambda x: len(x[1]), reverse=True)
        result = list(sorted_groups[0][1])
        
        # If not enough sources, merge with next-largest groups
        if len(result) < min_sources:
            for gid, srcs in sorted_groups[1:]:
                result.extend(srcs)
                if len(result) >= min_sources:
                    break
        return result

    # Exact timestamp match
    if mode in groups:
        return groups[mode]

    # Fallback: auto
    return _select_session(groups, "auto", min_sources)


# ─── B. Color Histogram Filtering ───

def _get_color_histogram(video_path: str) -> np.ndarray | None:
    """Extract HSV color histogram from a single middle-frame thumbnail via ffmpeg pipe."""
    try:
        # Get duration first
        dur = _get_duration(video_path)
        seek_time = max(0, dur / 2 - 0.5) if dur > 1 else 0

        # Extract single frame as raw RGB via ffmpeg pipe
        cmd = [
            "ffmpeg", "-ss", str(seek_time), "-i", video_path,
            "-vframes", "1", "-f", "rawvideo", "-pix_fmt", "rgb24",
            "-v", "quiet", "-y", "pipe:1",
        ]
        r = subprocess.run(cmd, capture_output=True, timeout=10)
        if not r.stdout or len(r.stdout) < 100:
            return None

        # We need dimensions to reshape — get from ffprobe
        info = _ffprobe_json(video_path)
        s = info.get("streams", [{}])[0]
        w, h = s.get("width", 0), s.get("height", 0)
        if w == 0 or h == 0:
            return None

        expected = w * h * 3
        raw = r.stdout[:expected]
        if len(raw) < expected:
            return None

        frame = np.frombuffer(raw, dtype=np.uint8).reshape((h, w, 3))

        # RGB → HSV manually (no OpenCV)
        # Downsample for speed
        step = max(1, min(h, w) // 64)
        frame_small = frame[::step, ::step, :]

        r_ch = frame_small[:, :, 0].astype(np.float32) / 255
        g_ch = frame_small[:, :, 1].astype(np.float32) / 255
        b_ch = frame_small[:, :, 2].astype(np.float32) / 255

        cmax = np.maximum(np.maximum(r_ch, g_ch), b_ch)
        cmin = np.minimum(np.minimum(r_ch, g_ch), b_ch)
        v_ch = cmax
        s_ch = np.where(cmax > 0, (cmax - cmin) / (cmax + 1e-8), 0)

        # Build 2D histogram: H (hue bucket 0-11) x S (saturation bucket 0-3)
        # Simplified hue from RGB
        delta = cmax - cmin + 1e-8
        h_ch = np.zeros_like(r_ch)
        mask_r = cmax == r_ch
        mask_g = (cmax == g_ch) & ~mask_r
        mask_b = ~mask_r & ~mask_g
        h_ch[mask_r] = ((g_ch[mask_r] - b_ch[mask_r]) / delta[mask_r]) % 6
        h_ch[mask_g] = ((b_ch[mask_g] - r_ch[mask_g]) / delta[mask_g]) + 2
        h_ch[mask_b] = ((r_ch[mask_b] - g_ch[mask_b]) / delta[mask_b]) + 4

        h_bins = np.clip((h_ch / 6 * 12).astype(int), 0, 11).ravel()
        s_bins = np.clip((s_ch * 4).astype(int), 0, 3).ravel()
        v_bins = np.clip((v_ch * 4).astype(int), 0, 3).ravel()

        # 1D histogram combining H, S, V
        hist = np.zeros(12 * 4 * 4)
        for hi, si, vi in zip(h_bins, s_bins, v_bins):
            hist[hi * 16 + si * 4 + vi] += 1

        total = hist.sum()
        if total > 0:
            hist = hist / total
        return hist
    except Exception:
        return None


def _filter_visual_outliers(sources: list[dict]) -> list[dict]:
    """Remove visual outlier sources based on color histogram distance from group mean."""
    if len(sources) <= 2:
        return sources

    histograms = []
    for src in sources:
        h = _get_color_histogram(src["path"])
        histograms.append(h)

    # Only filter if we have enough valid histograms
    valid = [(i, h) for i, h in enumerate(histograms) if h is not None]
    if len(valid) < 3:
        return sources

    # Compute mean histogram
    mean_hist = np.mean([h for _, h in valid], axis=0)

    # Compute distances
    distances = []
    for i, h in valid:
        dist = np.sum((h - mean_hist) ** 2)
        distances.append((i, dist))

    if not distances:
        return sources

    avg_dist = np.mean([d for _, d in distances])
    threshold = avg_dist * 2.0

    # Keep sources within threshold + those without histogram
    keep_indices = set()
    for i, dist in distances:
        if dist <= threshold:
            keep_indices.add(i)
    # Also keep sources where histogram extraction failed
    for i, h in enumerate(histograms):
        if h is None:
            keep_indices.add(i)

    filtered = [sources[i] for i in sorted(keep_indices)]
    return filtered if filtered else sources


# ─── D. Beat-Aligned Cut Generation ───

def _snap_cuts_to_beats(ref_cuts: list[float], beat_times: list[float]) -> list[float]:
    """Snap reference cut boundaries to nearest beats while preserving cut count & structure.
    
    Keeps the reference's cut count and approximate durations,
    but adjusts each boundary to land on a beat for musical sync.
    """
    if not beat_times or not ref_cuts:
        return ref_cuts
    
    beat_arr = sorted(beat_times)
    
    def _nearest_beat(t: float) -> float:
        """Find the nearest beat to time t."""
        if not beat_arr:
            return t
        # Binary search for closest beat
        lo, hi = 0, len(beat_arr) - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if beat_arr[mid] < t:
                lo = mid + 1
            else:
                hi = mid
        # Check neighbors
        candidates = []
        if lo > 0:
            candidates.append(beat_arr[lo - 1])
        if lo < len(beat_arr):
            candidates.append(beat_arr[lo])
        if not candidates:
            return t
        return min(candidates, key=lambda b: abs(b - t))
    
    # Build cumulative boundaries from ref_cuts
    boundaries = [0.0]
    for c in ref_cuts:
        boundaries.append(boundaries[-1] + c)
    total_dur = boundaries[-1]
    
    # Snap each inner boundary to nearest beat (keep first=0 and last=total)
    snapped_boundaries = [0.0]
    for i in range(1, len(boundaries) - 1):
        snapped = _nearest_beat(boundaries[i])
        # Ensure monotonically increasing and min 0.3s gap
        if snapped <= snapped_boundaries[-1] + 0.3:
            snapped = snapped_boundaries[-1] + ref_cuts[i - 1]  # fallback to original
        snapped_boundaries.append(snapped)
    snapped_boundaries.append(total_dur)
    
    # Convert back to cut durations
    snapped_cuts = []
    for i in range(len(snapped_boundaries) - 1):
        dur = round(snapped_boundaries[i + 1] - snapped_boundaries[i], 3)
        snapped_cuts.append(max(0.2, dur))  # minimum 0.2s
    
    return snapped_cuts



def _generate_beat_aligned_cuts(
    beat_times: list[float],
    sections: list[dict],
    video_duration: float,
) -> list[float]:
    """Generate cut durations aligned to beats, varying by section type.

    Section type → cut frequency (in beats):
      - intro: 4~8 beats per cut (slow)
      - verse: 4 beats per cut
      - chorus/highlight: 2~4 beats per cut (fast)
      - bridge: 4~8 beats per cut (slow)
      - buildup: 3~4 beats per cut

    Returns list of cut durations that sum to ~video_duration.
    """
    if not beat_times or len(beat_times) < 2:
        # Fallback: uniform 2s cuts
        n = max(1, int(video_duration / 2))
        base = video_duration / n
        return [round(base, 2)] * n

    # Section type → (min_beats, max_beats) per cut
    SECTION_BEAT_MAP = {
        "intro": (4, 8),
        "verse": (3, 5),
        "chorus": (2, 4),
        "highlight": (2, 4),
        "bridge": (4, 8),
        "buildup": (3, 4),
        "outro": (4, 8),
        "pre-highlight": (3, 5),
    }

    # Average beat interval
    beat_intervals = [beat_times[i + 1] - beat_times[i] for i in range(len(beat_times) - 1)]
    avg_beat_dur = float(np.median(beat_intervals)) if beat_intervals else 0.5

    # Map timeline position → section type
    def _section_at(t: float) -> str:
        for sec in sections:
            if sec["start"] <= t < sec["end"]:
                return sec["type"]
        return "verse"  # default

    cuts = []
    cursor = 0.0
    import random

    while cursor < video_duration - 0.3:
        sec_type = _section_at(cursor)
        min_beats, max_beats = SECTION_BEAT_MAP.get(sec_type, (3, 5))

        # Pick random beat count within range
        n_beats = random.randint(min_beats, max_beats)
        cut_dur = n_beats * avg_beat_dur

        # Snap to nearest actual beat if possible
        target_end = cursor + cut_dur
        if target_end >= video_duration:
            # Last cut: fill remaining
            remaining = video_duration - cursor
            if remaining > 0.3:
                cuts.append(round(remaining, 2))
            break

        # Find closest beat to target_end
        close_beats = [b for b in beat_times if abs(b - target_end) < avg_beat_dur * 0.6]
        if close_beats:
            snapped = min(close_beats, key=lambda b: abs(b - target_end))
            cut_dur = snapped - cursor
            if cut_dur < avg_beat_dur * 0.5:
                # Too short, extend by one beat
                cut_dur += avg_beat_dur

        cut_dur = max(cut_dur, avg_beat_dur)  # Minimum 1 beat
        cuts.append(round(cut_dur, 2))
        cursor += cut_dur

    # Ensure we cover the full duration
    total = sum(cuts)
    if total < video_duration - 0.1 and cuts:
        diff = video_duration - total
        cuts[-1] = round(cuts[-1] + diff, 2)

    return cuts


# ─── F. Section-based Mood Matching ───

def _get_brightness(video_path: str) -> float | None:
    """Get average brightness of middle frame (0~1 scale) via ffmpeg."""
    try:
        dur = _get_duration(video_path)
        seek = max(0, dur / 2 - 0.5) if dur > 1 else 0
        cmd = [
            "ffmpeg", "-ss", str(seek), "-i", video_path,
            "-vframes", "1", "-f", "rawvideo", "-pix_fmt", "gray",
            "-v", "quiet", "-y", "pipe:1",
        ]
        r = subprocess.run(cmd, capture_output=True, timeout=10)
        if not r.stdout or len(r.stdout) < 10:
            return None
        pixels = np.frombuffer(r.stdout, dtype=np.uint8)
        return float(np.mean(pixels)) / 255.0
    except Exception:
        return None


def _sort_clips_by_mood(sources: list[dict], section_types: list[str]) -> list[dict]:
    """Sort available clips to match section moods.

    - intro/bridge: prefer darker, longer clips (wide/calm shots)
    - highlight/chorus: prefer brighter, shorter clips (action shots)
    - verse: neutral
    """
    if not sources or not section_types:
        return sources

    # Pre-compute brightness for all sources (cache in source dict)
    for src in sources:
        if "brightness" not in src:
            b = _get_brightness(src["path"])
            src["brightness"] = b if b is not None else 0.5

    # For each section type, compute a preference score per source
    # Higher score = better fit for that section
    def _mood_score(src: dict, sec_type: str) -> float:
        b = src.get("brightness", 0.5)
        d = src.get("duration", 3)

        if sec_type in ("intro", "bridge", "outro"):
            # Prefer darker, longer (calm, wide shots)
            dark_score = 1.0 - b  # darker = higher
            long_score = min(1, d / 10)  # longer = higher
            return dark_score * 0.6 + long_score * 0.4

        elif sec_type in ("highlight", "chorus"):
            # Prefer brighter, shorter (energetic)
            bright_score = b
            short_score = max(0, 1.0 - d / 10)
            return bright_score * 0.6 + short_score * 0.4

        else:  # verse, buildup, etc.
            return 0.5  # neutral

    # We don't reorder globally — instead we return a mapping of section_index → ranked sources
    # But since find_best_clips iterates per cut, we'll return sources with mood_scores attached
    # The caller should use section_types[i] when picking for cut i
    return sources


def find_best_clips(
    sources: list[dict],
    ref_cuts: list[float],
    section_types: list[str] | None = None,
) -> list[dict]:
    """For each cut duration, pick best segment from available sources.

    Key principle: NEVER repeat the same visual.
    - Round-robin through sources to maximize variety
    - When reusing a file, pick a DIFFERENT time segment (no overlap)
    - Track used segments per file to prevent visual repetition
    """
    import random
    clips = []
    available = list(sources)
    n_sources = len(available)
    n_cuts = len(ref_cuts)

    # Track used time ranges per file: file → [(start, end), ...]
    used_ranges: dict[str, list[tuple[float, float]]] = {}

    def _has_overlap(file: str, start: float, end: float, min_gap: float = 2.0) -> bool:
        """Check if a time range overlaps with already-used ranges for this file."""
        for (us, ue) in used_ranges.get(file, []):
            # Overlap if ranges are within min_gap of each other
            if start < ue + min_gap and end > us - min_gap:
                return True
        return False

    def _find_free_segment(src: dict, target_dur: float, file: str) -> tuple[float, float] | None:
        """Find a non-overlapping segment in this source file."""
        total = src["duration"]
        if total < target_dur + 0.2:
            return None

        # Try multiple random positions, prefer non-overlapping
        best_start = None
        for attempt in range(20):
            max_start = max(0.1, total - target_dur - 0.1)
            start_t = round(random.uniform(0.1, max_start), 2)
            end_t = round(start_t + target_dur, 2)
            if not _has_overlap(file, start_t, end_t):
                return (start_t, end_t)
            if best_start is None:
                best_start = (start_t, end_t)  # fallback

        return best_start  # all positions overlap; use least-bad one

    # Round-robin index — cycle through sources
    rr_idx = 0

    for cut_idx, target_dur in enumerate(ref_cuts):
        sec_type = section_types[cut_idx] if section_types and cut_idx < len(section_types) else None

        # Build scored candidate list with mood
        scored = []
        for src in available:
            if src["duration"] < target_dur + 0.2:
                continue
            mood = 0.5
            if sec_type:
                b = src.get("brightness", 0.5)
                d = src.get("duration", 3)
                if sec_type in ("intro", "bridge", "outro"):
                    mood = (1.0 - b) * 0.6 + min(1, d / 10) * 0.4
                elif sec_type in ("highlight", "chorus"):
                    mood = b * 0.6 + max(0, 1.0 - d / 10) * 0.4
            scored.append((mood, src))

        if not scored:
            continue

        # Primary strategy: round-robin for maximum variety
        # Start from rr_idx, cycle through all candidates
        scored_sorted = sorted(scored, key=lambda x: x[0], reverse=True)
        n_cand = len(scored_sorted)

        best = None
        for attempt in range(n_cand):
            idx = (rr_idx + attempt) % n_cand
            mood, src = scored_sorted[idx]
            seg = _find_free_segment(src, target_dur, src["file"])
            if seg:
                best = {
                    "source": src["file"],
                    "start": seg[0],
                    "end": seg[1],
                    "score": round(0.7 + mood * 0.25, 4) if sec_type else round(random.uniform(0.7, 0.95), 4),
                }
                rr_idx = (idx + 1) % n_cand  # next cut starts from next source
                break

        if best:
            clips.append(best)
            f = best["source"]
            if f not in used_ranges:
                used_ranges[f] = []
            used_ranges[f].append((best["start"], best["end"]))

    return clips


# ─── Main API ───

@router.post("/create")
async def auto_create_project(request: Request):
    """
    End-to-end project creation.
    Input:
      - referenceId: DB reference video ID
      - sourceDir: path to source videos (e.g. /Volumes/Seagate/.../새사무실)
      - bgmSource: (optional) audio file name in editor dir
      - name: (optional) project name
      - sessionGroup: 'auto' | 'latest' | timestamp string (default: 'auto')
      - beatSync: true/false (default: true) — use beat-aligned cuts instead of ref cuts
      - bgmMode: 'auto' | 'section_aware' (default: 'auto')
    """
    body = await request.json()
    reference_id = body.get("referenceId", "")
    source_dir = body.get("sourceDir", "")
    bgm_source = body.get("bgmSource", "")
    project_name = body.get("name", "")
    session_group_mode = body.get("sessionGroup", "auto")
    beat_sync = body.get("beatSync", True)

    # 1. Get reference video
    ref_video_path = None
    ref_meta = {}
    try:
        from src.db.supabase import get_client
        sb = get_client()
        resp = sb.table(TABLE_VIDEOS).select("*").eq("id", reference_id).single().execute()
        ref_meta = resp.data or {}

        # Download reference video to analyze
        video_url = ref_meta.get("video_url")
        if video_url:
            import tempfile
            ref_video_path = os.path.join(tempfile.gettempdir(), f"ref_{reference_id}.mp4")
            subprocess.run(["curl", "-sL", "-o", ref_video_path, video_url, "--max-time", "30"], timeout=35)
            if os.path.getsize(ref_video_path) < 1000:
                ref_video_path = None
    except Exception as e:
        return JSONResponse({"error": f"레퍼런스 로드 실패: {e}"}, status_code=500)

    if not ref_video_path:
        return JSONResponse({"error": "레퍼런스 영상을 다운로드할 수 없습니다"}, status_code=400)

    # 2. Analyze reference
    ref_analysis = analyze_reference(ref_video_path)
    orientation = ref_analysis["orientation"]
    ref_cuts = ref_analysis["cutDurations"]

    # 3. Scan + filter sources by orientation
    sources = scan_sources(source_dir, orientation)
    if not sources:
        return JSONResponse({"error": f"{orientation} 영상이 소스 디렉토리에 없습니다"}, status_code=400)

    # 3a. Session grouping — select sources from same shooting session
    session_groups = _group_by_session(sources)
    sources = _select_session(session_groups, session_group_mode)
    if not sources:
        return JSONResponse({"error": "선택된 세션 그룹에 영상이 없습니다"}, status_code=400)

    # 3b. Color-based visual outlier filtering
    sources = _filter_visual_outliers(sources)

    # 3c. Sort by shooting time (timestamp) instead of random shuffle
    sources.sort(key=lambda s: _extract_timestamp(s["file"]) or datetime.min)

    # 4. Determine cuts — beat-aligned or reference-based
    beat_times_for_cuts = []
    bgm_sections = []
    section_types = None

    if beat_sync and bgm_source:
        # Pre-analyze BGM for beat sync
        try:
            import librosa
            from src.server.routes.bgm_analyze import _detect_sections, _get_chorus_starts

            audio_path = BASE / bgm_source
            if audio_path.exists():
                y_audio, sr_audio = librosa.load(
                    str(audio_path.resolve() if audio_path.is_symlink() else audio_path),
                    sr=22050, mono=True,
                )
                audio_dur = len(y_audio) / sr_audio
                tempo, beat_frames = librosa.beat.beat_track(y=y_audio, sr=sr_audio)
                beat_times_for_cuts = librosa.frames_to_time(beat_frames, sr=sr_audio).tolist()
                chorus_starts = _get_chorus_starts(audio_path, audio_dur)
                bgm_sections, _ = _detect_sections(y_audio, sr_audio, chorus_starts)

                video_duration = ref_analysis["duration"]

                if ref_cuts and len(ref_cuts) >= 2:
                    # Reference exists → keep reference cut structure, snap boundaries to beats
                    snapped_cuts = _snap_cuts_to_beats(ref_cuts, beat_times_for_cuts)
                    ref_cuts = snapped_cuts
                else:
                    # No meaningful reference cuts → generate from beats
                    beat_cuts = _generate_beat_aligned_cuts(beat_times_for_cuts, bgm_sections, video_duration)
                    ref_cuts = beat_cuts

                # Build section_types list aligned with cuts
                cursor = 0.0
                section_types = []
                for cd in ref_cuts:
                    mid = cursor + cd / 2
                    sec_type = "verse"
                    for sec in bgm_sections:
                        if sec["start"] <= mid < sec["end"]:
                            sec_type = sec["type"]
                            break
                    section_types.append(sec_type)
                    cursor += cd
        except Exception:
            pass  # Fall back to ref_cuts

    # 4a. Pre-compute brightness for mood matching (if sections available)
    if section_types:
        _sort_clips_by_mood(sources, section_types)

    # 4b. Find best clips
    clips = find_best_clips(sources, ref_cuts, section_types)
    if not clips:
        return JSONResponse({"error": "적절한 클립을 찾을 수 없습니다"}, status_code=400)

    # 5. Symlink sources to editor dir
    for c in clips:
        src_path = Path(source_dir) / c["source"]
        dest = BASE / c["source"]
        if src_path.exists() and not dest.exists():
            try:
                dest.symlink_to(src_path)
            except FileExistsError:
                pass

    # 6. Build project data
    project_clips = []
    tl_cursor = 0.0
    for i, c in enumerate(clips):
        clip_dur = round(c["end"] - c["start"], 3)
        project_clips.append({
            "source": c["source"],
            "start": c["start"],
            "end": c["end"],
            "source_idx": i,
            "track": 0,
            "timelineStart": round(tl_cursor, 3),
        })
        tl_cursor += clip_dur

    total_dur = sum(c["end"] - c["start"] for c in clips)

    # BGM auto-analyze — hybrid approach (section + energy + beat snap)
    # bgmMode: 'auto' (hybrid, default) | 'section_aware' | 'energy_only' (legacy)
    bgm_mode = body.get("bgmMode", "auto")
    bgm_clips = []
    if bgm_source:
        try:
            import librosa
            from src.server.routes.bgm_analyze import (
                _build_video_energy_curve, _match_energy_curves,
                _detect_sections, _get_chorus_starts,
                _build_intro_to_highlight_clips,
                snap_audio_start_to_beat,
            )

            audio_path = BASE / bgm_source
            if audio_path.exists():
                # Reuse pre-analyzed data if beat_sync already loaded it
                if beat_sync and beat_times_for_cuts and bgm_sections:
                    y, sr = y_audio, sr_audio  # noqa: F841 — reuse from beat sync
                    audio_dur = len(y) / sr
                    beat_times = beat_times_for_cuts
                    sections = bgm_sections
                else:
                    y, sr = librosa.load(str(audio_path.resolve() if audio_path.is_symlink() else audio_path), sr=22050, mono=True)
                    audio_dur = len(y) / sr
                    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
                    beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
                    chorus_starts = _get_chorus_starts(audio_path, audio_dur)
                    sections, _ = _detect_sections(y, sr, chorus_starts)

                SHORTFORM_THRESHOLD = 15.0

                if bgm_mode == "section_aware" and audio_dur >= total_dur:
                    # Explicit section-aware: detect sections → build intro→highlight clips
                    section_clips = _build_intro_to_highlight_clips(
                        sections, total_dur, audio_dur, beat_times)

                    tl_cursor = 0.0
                    for idx, sc in enumerate(section_clips):
                        bgm_clips.append({
                            "id": f"bgm_section_{idx}",
                            "source": bgm_source,
                            "start": round(tl_cursor, 2),
                            "audioStart": sc["audioStart"],
                            "duration": sc["duration"],
                            "totalDuration": round(audio_dur, 1),
                            "volume": 100,
                            "sectionType": sc["sectionType"],
                        })
                        tl_cursor += sc["duration"]

                elif bgm_mode == "energy_only":
                    # Legacy energy-only mode (kept for backward compat)
                    rms = librosa.feature.rms(y=y)[0]
                    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)
                    clips_data = [{"tlStart": sum(project_clips[j]["end"] - project_clips[j]["start"] for j in range(i)),
                                   "duration": c["end"] - c["start"], "speed": 1} for i, c in enumerate(project_clips)]
                    video_energy = _build_video_energy_curve(clips_data, total_dur)
                    best_start, best_score = 0, -1
                    for s in np.arange(0, audio_dur - total_dur, 0.5):
                        score = _match_energy_curves(video_energy, rms, rms_times, s, total_dur)
                        if score > best_score:
                            best_score = score
                            best_start = s
                    best_start = snap_audio_start_to_beat(float(best_start), beat_times)
                    bgm_clips = [{
                        "id": "bgm_auto",
                        "source": bgm_source,
                        "start": 0,
                        "audioStart": round(best_start, 2),
                        "duration": round(total_dur, 1),
                        "totalDuration": round(audio_dur, 1),
                        "volume": 100,
                    }]

                else:
                    # ── mode=auto: HYBRID (section + energy + chorus + beat snap) ──

                    # Step 1: Shortform → highlight direct (best strategy for ≤15s)
                    if total_dur <= SHORTFORM_THRESHOLD:
                        highlights = [s for s in sections if s["type"] == "highlight"]
                        choruses = [s for s in sections if s["type"] == "chorus"]
                        # Prefer chorus > highlight > highest energy section
                        best_sections = choruses or highlights or sorted(sections, key=lambda s: s["energy"], reverse=True)
                        if best_sections:
                            best = max(best_sections, key=lambda s: s["energy"] * s["confidence"])
                            audio_start = snap_audio_start_to_beat(best["start"], beat_times)
                            avail = best["end"] - audio_start
                            if avail < total_dur:
                                # Extend into next section if needed
                                for s in sections:
                                    if s["start"] >= best["end"] - 0.5 and s["end"] > best["end"]:
                                        avail = s["end"] - audio_start
                                        if avail >= total_dur:
                                            break
                            bgm_dur = min(avail, total_dur)
                            bgm_clips = [{
                                "id": "bgm_auto",
                                "source": bgm_source,
                                "start": 0,
                                "audioStart": round(audio_start, 2),
                                "duration": round(bgm_dur, 2),
                                "totalDuration": round(audio_dur, 1),
                                "volume": 100,
                                "sectionType": best["type"],
                            }]

                    # Step 2: Longform → hybrid scoring (energy + section + chorus + beat)
                    if not bgm_clips:
                        rms = librosa.feature.rms(y=y)[0]
                        rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)
                        clips_data = [{"tlStart": sum(project_clips[j]["end"] - project_clips[j]["start"] for j in range(i)),
                                       "duration": c["end"] - c["start"], "speed": 1} for i, c in enumerate(project_clips)]
                        video_energy = _build_video_energy_curve(clips_data, total_dur)

                        # Scan candidates — prefer beat-aligned starts
                        scan_range = audio_dur - total_dur
                        hop_sec = max(0.25, scan_range / 800)
                        candidates = []

                        for s_sec in np.arange(0, scan_range, hop_sec):
                            score_parts = {}

                            # A. Energy curve matching (35%)
                            e_score = _match_energy_curves(video_energy, rms, rms_times, s_sec, total_dur)
                            score_parts["energy"] = e_score * 0.35

                            # B. Section quality — prefer starting at/near highlight or chorus (25%)
                            sec_score = 0.0
                            for sec in sections:
                                if sec["start"] - 2 <= s_sec <= sec["end"]:
                                    if sec["type"] in ("highlight", "chorus"):
                                        sec_score = max(sec_score, 0.8 * sec["confidence"])
                                    elif sec["type"] == "buildup":
                                        sec_score = max(sec_score, 0.5 * sec["confidence"])
                                    elif sec["type"] == "verse":
                                        sec_score = max(sec_score, 0.3 * sec["confidence"])
                                    # intro/bridge/outro get 0
                            # Also check what sections the segment passes through
                            seg_end = s_sec + total_dur
                            highlight_coverage = 0.0
                            for sec in sections:
                                if sec["type"] in ("highlight", "chorus"):
                                    overlap = max(0, min(sec["end"], seg_end) - max(sec["start"], s_sec))
                                    highlight_coverage += overlap
                            coverage_ratio = highlight_coverage / total_dur if total_dur > 0 else 0
                            sec_score = max(sec_score, coverage_ratio * 0.9)
                            score_parts["section"] = sec_score * 0.25

                            # C. Chorus proximity bonus (20%)
                            chorus_score = 0.0
                            if chorus_starts:
                                min_dist = min(abs(s_sec - cs) for cs in chorus_starts)
                                if min_dist < 1.5:
                                    chorus_score = 1.0
                                elif min_dist < 4:
                                    chorus_score = 0.7
                                elif min_dist < 8:
                                    chorus_score = 0.3
                            score_parts["chorus"] = chorus_score * 0.20

                            # D. Beat alignment bonus (10%)
                            beat_dist = min((abs(b - s_sec) for b in beat_times), default=999)
                            beat_score = 1.0 if beat_dist < 0.1 else (0.6 if beat_dist < 0.2 else (0.3 if beat_dist < 0.4 else 0.0))
                            score_parts["beat"] = beat_score * 0.10

                            # E. Natural start — prefer low→rising energy at start (10%)
                            start_idx = max(0, int(s_sec / (rms_times[1] - rms_times[0]) if len(rms_times) > 1 else 1))
                            end_idx = min(len(rms), start_idx + 10)
                            if end_idx > start_idx + 2:
                                start_rms = rms[start_idx:end_idx]
                                gradient = float(np.mean(np.diff(start_rms)))
                                # Rising energy = good start
                                natural_score = min(1.0, max(0, gradient * 50 + 0.5))
                            else:
                                natural_score = 0.3
                            score_parts["natural"] = natural_score * 0.10

                            total_score = sum(score_parts.values())
                            candidates.append({
                                "start": float(s_sec),
                                "score": total_score,
                                "parts": score_parts,
                            })

                        # Pick the best candidate
                        if candidates:
                            best = max(candidates, key=lambda c: c["score"])
                            best_start = snap_audio_start_to_beat(best["start"], beat_times)

                            # For longform, try section_aware as alternative and pick better one
                            section_clips = _build_intro_to_highlight_clips(
                                sections, total_dur, audio_dur, beat_times)
                            if section_clips and len(section_clips) >= 1:
                                # Score the section_aware result too
                                sa_start = section_clips[0]["audioStart"]
                                sa_score = 0
                                for sec in sections:
                                    if sec["start"] - 1 <= sa_start <= sec["end"]:
                                        if sec["type"] in ("intro", "buildup"):
                                            sa_score = 0.7  # structured approach bonus
                                sa_chorus = 0
                                if chorus_starts:
                                    # Check if any section clip overlaps chorus
                                    for sc in section_clips:
                                        for cs in chorus_starts:
                                            if sc["audioStart"] <= cs <= sc["audioStart"] + sc["duration"]:
                                                sa_chorus = 0.2
                                                break
                                sa_total = sa_score + sa_chorus

                                # Use section_aware if it scores better AND covers highlights
                                if sa_total > best["score"] * 0.85 and len(section_clips) > 1:
                                    tl_cursor = 0.0
                                    for idx, sc in enumerate(section_clips):
                                        bgm_clips.append({
                                            "id": f"bgm_hybrid_{idx}",
                                            "source": bgm_source,
                                            "start": round(tl_cursor, 2),
                                            "audioStart": sc["audioStart"],
                                            "duration": sc["duration"],
                                            "totalDuration": round(audio_dur, 1),
                                            "volume": 100,
                                            "sectionType": sc.get("sectionType", "auto"),
                                        })
                                        tl_cursor += sc["duration"]

                            # If section_aware wasn't better, use hybrid result
                            if not bgm_clips:
                                bgm_clips = [{
                                    "id": "bgm_auto",
                                    "source": bgm_source,
                                    "start": 0,
                                    "audioStart": round(best_start, 2),
                                    "duration": round(total_dur, 2),
                                    "totalDuration": round(audio_dur, 1),
                                    "volume": 100,
                                }]

                    # Final fallback
                    if not bgm_clips:
                        bgm_clips = [{
                            "id": "bgm_fallback",
                            "source": bgm_source,
                            "start": 0,
                            "audioStart": 0,
                            "duration": round(min(total_dur, audio_dur), 1),
                            "totalDuration": round(audio_dur, 1),
                            "volume": 100,
                        }]
        except Exception as e:
            logger.error(f"BGM auto-match failed: {e}\n{traceback.format_exc()}")

    logger.info(f"BGM result: {len(bgm_clips)} clips")
    project_data = {
        "clips": project_clips,
        "subs": [],
        "clipMeta": [{"speed": 1}] * len(project_clips),
        "transitions": [{"type": "none", "duration": 0}] * max(0, len(project_clips) - 1),
        "clipSubStyles": [{"size": 16, "x": 50, "y": 80, "font": "'BMDOHYEON',sans-serif"}] * len(project_clips),
        "clipCrops": [{"x": 0, "y": 0, "w": 100, "h": 100}] * len(project_clips),
        "clipZooms": [{"scale": 1, "panX": 0, "panY": 0}] * len(project_clips),
        "clipEffects": [[]] * len(project_clips),
        "globalEffects": [],
        "kbEffects": [],
        "fadeInOut": {"fadeIn": {"enabled": True, "duration": 0.3}, "fadeOut": {"enabled": True, "duration": 0.5}},
        "bgmClips": bgm_clips,
        "sources": list(set(c["source"] for c in project_clips)),
        "totalDuration": total_dur,
        "referenceId": reference_id,
    }

    # 7. Save to DB
    if not project_name:
        account = ref_meta.get("account_name") or ref_meta.get("username") or ""
        project_name = f"{account} style ({reference_id})" if account else f"Auto ({reference_id})"

    try:
        from src.db.supabase import get_client
        sb = get_client()
        resp = sb.table(TABLE_PROJECTS).insert({
            "name": project_name,
            "orientation": orientation,
            "project_data": project_data,
            "clip_count": len(project_clips),
            "duration": total_dur,
            "source_files": [{"filename": c["source"]} for c in project_clips],
        }).execute()
        proj = resp.data[0]
    except Exception as e:
        return JSONResponse({"error": f"프로젝트 저장 실패: {e}"}, status_code=500)

    # Cleanup temp
    try:
        os.remove(ref_video_path)
    except Exception:
        pass

    return {
        "project": {
            "id": proj["id"],
            "name": project_name,
            "url": f"/editor?project={proj['id']}",
        },
        "reference": {
            "id": reference_id,
            "orientation": orientation,
            "duration": ref_analysis["duration"],
            "cuts": ref_cuts,
            "numCuts": ref_analysis["numCuts"],
        },
        "clips": [{
            "source": c["source"],
            "start": c["start"],
            "end": c["end"],
            "score": c.get("score", 0),
        } for c in clips],
        "bgm": bgm_clips[0] if bgm_clips else None,
        "totalDuration": round(total_dur, 2),
        "sessionGroup": sources[0].get("session_group") if sources else None,
        "sessionGroups": {k: len(v) for k, v in session_groups.items()} if session_groups else {},
        "beatSync": bool(beat_sync and beat_times_for_cuts),
    }
