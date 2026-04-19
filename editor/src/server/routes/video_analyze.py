"""Video source analysis — orientation, scene detection, motion, best clip selection."""
import logging
import os
import subprocess
import json
from pathlib import Path

logger = logging.getLogger(__name__)

import numpy as np
import cv2
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/video-analyze", tags=["video-analyze"])

# ── Safety limits to prevent CPU overload ──
MAX_VIDEO_DURATION = 300      # 5분 이상 영상은 앞부분만 분석
MAX_FRAME_SAMPLES = 200       # 프레임 샘플링 최대 개수
MAX_FILES_PER_REQUEST = 20    # 한 번에 분석할 최대 파일 수
MAX_CANDIDATES_PER_FILE = 50  # 파일당 최대 후보 클립 수

BASE = Path(__file__).resolve().parent.parent.parent / "editor"


def _resolve_path(filename: str) -> Path | None:
    """Find video file in editor dir, legacy dirs, or Seagate."""
    p = BASE / filename
    if p.exists():
        return p.resolve() if p.is_symlink() else p
    search = []
    media_root = os.environ.get("MEDIA_ROOT", "")
    if media_root:
        search.append(Path(media_root))
    legacy_env = os.environ.get("LEGACY_MEDIA_DIRS", "")
    if legacy_env:
        search.extend([Path(d.strip()) for d in legacy_env.split(",") if d.strip()])
    for d in search:
        if not d.exists():
            continue
        candidate = d / filename
        if candidate.exists():
            return candidate
        for match in d.rglob(filename):
            return match
    return None


@router.post("/probe")
async def probe_videos(request: Request):
    """Probe multiple video files: orientation, duration, resolution, color space."""
    body = await request.json()
    files = body.get("files", [])
    results = []

    for fname in files[:MAX_FILES_PER_REQUEST]:
        path = _resolve_path(fname)
        if not path or not path.exists():
            results.append({"file": fname, "error": "not found"})
            continue

        try:
            r = subprocess.run([
                "ffprobe", "-v", "quiet", "-show_entries",
                "stream=width,height,duration,r_frame_rate,color_space,color_transfer",
                "-show_entries", "format=duration",
                "-of", "json", str(path)
            ], capture_output=True, text=True, timeout=10)
            info = json.loads(r.stdout)
            stream = info.get("streams", [{}])[0]
            fmt = info.get("format", {})
            w = stream.get("width", 0)
            h = stream.get("height", 0)
            dur = float(fmt.get("duration", 0))
            fps_str = stream.get("r_frame_rate", "30/1")
            fps = eval(fps_str) if "/" in str(fps_str) else float(fps_str)
            cs = stream.get("color_space", "")
            ct = stream.get("color_transfer", "")

            results.append({
                "file": fname,
                "width": w,
                "height": h,
                "orientation": "vertical" if h > w else "horizontal",
                "duration": round(dur, 2),
                "fps": round(fps, 1),
                "colorSpace": cs,
                "colorTransfer": ct,
                "hdr": "bt2020" in cs or "arib-std-b67" in ct or "smpte2084" in ct,
                "path": str(path),
            })
        except Exception as e:
            results.append({"file": fname, "error": str(e)})

    vertical = [r for r in results if r.get("orientation") == "vertical"]
    horizontal = [r for r in results if r.get("orientation") == "horizontal"]

    return {
        "files": results,
        "summary": {
            "total": len(results),
            "vertical": len(vertical),
            "horizontal": len(horizontal),
            "errors": sum(1 for r in results if "error" in r),
        }
    }


@router.post("/best-clips")
async def find_best_clips(request: Request):
    """Analyze videos and find best clip segments using PySceneDetect + OpenCV motion analysis.
    
    Input: files[], orientation (vertical/horizontal), refCuts[] (target cut durations)
    Output: recommended clips with scores
    """
    body = await request.json()
    files = body.get("files", [])
    orientation = body.get("orientation", "vertical")
    ref_cuts = body.get("refCuts", [1.0, 1.0, 1.5, 1.5, 2.0])  # target durations per clip
    num_clips = body.get("numClips", len(ref_cuts))

    from scenedetect import open_video, SceneManager, ContentDetector

    all_candidates = []  # (file, start, end, score, motion, brightness)

    for fname in files:
        path = _resolve_path(fname)
        if not path or not path.exists():
            continue

        # Check orientation
        r = subprocess.run([
            "ffprobe", "-v", "quiet", "-show_entries", "stream=width,height",
            "-show_entries", "format=duration", "-of", "json", str(path)
        ], capture_output=True, text=True, timeout=10)
        info = json.loads(r.stdout)
        stream = info.get("streams", [{}])[0]
        w, h = stream.get("width", 0), stream.get("height", 0)
        file_ori = "vertical" if h > w else "horizontal"
        if file_ori != orientation:
            continue  # Skip wrong orientation

        dur = float(info.get("format", {}).get("duration", 0))

        # 1. Scene detection with PySceneDetect
        try:
            video = open_video(str(path))
            scene_manager = SceneManager()
            scene_manager.add_detector(ContentDetector(threshold=20))
            scene_manager.detect_scenes(video)
            scenes = scene_manager.get_scene_list()

            if not scenes:
                # Whole video as one scene
                scenes = [(video.base_timecode, video.base_timecode + dur)]
        except Exception as e:
            # PySceneDetect 실패 — 전체 영상을 한 scene 으로 fallback. 알고리즘 정확도만 떨어짐.
            logger.debug("PySceneDetect failed for %s (using whole-video fallback): %s", fname, e)
            scenes = [(0, dur)]

        # 2. Motion + brightness analysis with OpenCV (sample frames)
        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            continue

        fps = cap.get(cv2.CAP_PROP_FPS) or 30
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        # Cap analysis to MAX_VIDEO_DURATION worth of frames
        max_frames = int(min(total_frames, MAX_VIDEO_DURATION * fps))
        # Dynamic sample interval: ensure we don't exceed MAX_FRAME_SAMPLES
        sample_interval = max(1, int(max_frames / MAX_FRAME_SAMPLES))

        frame_data = []  # (time, motion, brightness)
        prev_gray = None

        for frame_idx in range(0, max_frames, sample_interval):
            cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
            ret, frame = cap.read()
            if not ret:
                break

            t = frame_idx / fps
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            brightness = float(np.mean(gray)) / 255.0

            motion = 0.0
            if prev_gray is not None:
                diff = cv2.absdiff(prev_gray, gray)
                motion = float(np.mean(diff)) / 255.0

            frame_data.append((t, motion, brightness))
            prev_gray = gray

        cap.release()

        if not frame_data:
            continue

        # 3. Score segments (sliding window for each target duration)
        file_candidate_count = 0
        for target_dur in set(ref_cuts):
            if target_dur > dur or file_candidate_count >= MAX_CANDIDATES_PER_FILE:
                continue
            # Dynamic step: cap candidates per duration
            scan_range = dur - target_dur - 0.2
            step = max(0.5, scan_range / (MAX_CANDIDATES_PER_FILE // max(1, len(set(ref_cuts)))))
            for start_t in np.arange(0.2, dur - target_dur, step):
                if file_candidate_count >= MAX_CANDIDATES_PER_FILE:
                    break
                end_t = start_t + target_dur
                # Get frames in this window
                seg_frames = [(t, m, b) for t, m, b in frame_data if start_t <= t < end_t]
                if len(seg_frames) < 2:
                    continue

                motions = [m for _, m, _ in seg_frames]
                brights = [b for _, _, b in seg_frames]

                # Score components
                avg_motion = float(np.mean(motions))
                motion_var = float(np.std(motions))
                avg_brightness = float(np.mean(brights))
                # Prefer well-lit, with some motion but not too shaky
                motion_score = min(1.0, avg_motion * 10) * 0.4  # 40%
                stability_score = max(0, 1.0 - motion_var * 20) * 0.2  # 20% (not too shaky)
                brightness_score = min(1.0, avg_brightness * 1.5) * 0.2  # 20%
                # Avoid start/end of video
                position_score = 0.2 if 0.5 < start_t < dur - 1.0 else 0.1  # 20%

                total_score = motion_score + stability_score + brightness_score + position_score

                all_candidates.append({
                    "file": fname,
                    "start": round(float(start_t), 2),
                    "end": round(float(end_t), 2),
                    "duration": round(float(target_dur), 2),
                    "score": round(float(total_score), 4),
                    "motion": round(float(avg_motion), 4),
                    "brightness": round(float(avg_brightness), 4),
                })
                file_candidate_count += 1

    # 4. Select best clips matching ref_cuts structure
    # Greedy: for each ref_cut duration, pick the best unused candidate from a different source
    selected = []
    used_files = set()

    for target_dur in ref_cuts:
        if len(selected) >= num_clips:
            break
        # Find candidates with matching duration, prefer unused sources
        matching = [c for c in all_candidates
                    if abs(c["duration"] - target_dur) < 0.1
                    and c["file"] not in used_files]
        if not matching:
            # Relax: allow reuse
            matching = [c for c in all_candidates if abs(c["duration"] - target_dur) < 0.1]
        if not matching:
            continue

        matching.sort(key=lambda c: c["score"], reverse=True)
        best = matching[0]
        selected.append(best)
        used_files.add(best["file"])
        # Remove this candidate from pool
        all_candidates = [c for c in all_candidates
                          if not (c["file"] == best["file"]
                                  and abs(c["start"] - best["start"]) < 0.5)]

    return {
        "clips": selected,
        "totalDuration": round(sum(c["duration"] for c in selected), 2),
        "orientation": orientation,
        "candidateCount": len(all_candidates),
    }
