"""Whisper auto-subtitle — extract audio from video, transcribe with word timestamps."""
import logging
import os
import subprocess
import tempfile
import threading
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/whisper", tags=["whisper"])

BASE = Path(__file__).resolve().parent.parent.parent / "editor"

# Shared state for async transcription
_transcribe_state: dict = {"status": "idle", "result": None, "error": None}
_lock = threading.Lock()


def _extract_audio(video_path: str, output_path: str) -> bool:
    """Extract audio from video as WAV (16kHz mono)."""
    try:
        subprocess.run([
            "ffmpeg", "-y", "-i", video_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            output_path,
        ], capture_output=True, timeout=60)
        return Path(output_path).exists() and Path(output_path).stat().st_size > 0
    except Exception as e:
        logger.error(f"Audio extraction failed: {e}")
        return False


def _run_whisper(audio_path: str, language: str, model_size: str) -> dict:
    """Run faster-whisper transcription with word timestamps."""
    from faster_whisper import WhisperModel

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, info = model.transcribe(
        audio_path,
        language=language if language != "auto" else None,
        word_timestamps=True,
        vad_filter=True,
    )

    words = []
    full_text_parts = []

    for segment in segments:
        full_text_parts.append(segment.text.strip())
        if segment.words:
            for w in segment.words:
                words.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                })

    return {
        "text": " ".join(full_text_parts),
        "words": words,
        "language": info.language,
        "duration": info.duration,
    }


def _transcribe_background(video_source: str, language: str, model_size: str, time_offset: float):
    """Background thread for transcription."""
    global _transcribe_state
    try:
        with _lock:
            _transcribe_state = {"status": "processing", "result": None, "error": None}

        # Resolve video path
        video_path = BASE / video_source
        if not video_path.exists():
            with _lock:
                _transcribe_state = {"status": "error", "result": None, "error": f"파일 없음: {video_source}"}
            return

        resolved = str(video_path.resolve())

        # Extract audio to temp file
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        if not _extract_audio(resolved, tmp_path):
            with _lock:
                _transcribe_state = {"status": "error", "result": None, "error": "오디오 추출 실패"}
            return

        # Run Whisper
        result = _run_whisper(tmp_path, language, model_size)

        # Apply time offset (clip start time on timeline)
        if time_offset > 0:
            for w in result["words"]:
                w["start"] = round(w["start"] + time_offset, 3)
                w["end"] = round(w["end"] + time_offset, 3)

        # Build subtitle segments (group words into sentences)
        subtitles = _words_to_subtitles(result["words"], time_offset)
        result["subtitles"] = subtitles

        with _lock:
            _transcribe_state = {"status": "done", "result": result, "error": None}

        # Cleanup
        os.unlink(tmp_path)

    except Exception as e:
        logger.error(f"Whisper transcription failed: {e}")
        with _lock:
            _transcribe_state = {"status": "error", "result": None, "error": str(e)}


def _words_to_subtitles(words: list, time_offset: float, max_words: int = 6, max_duration: float = 3.0) -> list:
    """Group words into subtitle segments."""
    if not words:
        return []

    subtitles = []
    current_words = []
    current_start = words[0]["start"]

    for w in words:
        current_words.append(w)
        duration = w["end"] - current_start

        is_sentence_end = w["word"].rstrip().endswith(('.', '!', '?', '。', '！', '？'))
        if len(current_words) >= max_words or duration >= max_duration or is_sentence_end:
            subtitles.append({
                "text": " ".join(cw["word"] for cw in current_words).strip(),
                "start": round(current_start, 2),
                "end": round(w["end"], 2),
            })
            current_words = []
            current_start = w["end"]

    if current_words:
        subtitles.append({
            "text": " ".join(cw["word"] for cw in current_words).strip(),
            "start": round(current_start, 2),
            "end": round(words[-1]["end"], 2),
        })

    return subtitles


# ─── Routes ───

@router.post("/transcribe")
async def start_transcribe(request: Request):
    """Start Whisper transcription for a video source."""
    body = await request.json()
    source = body.get("source", "")
    language = body.get("language", "auto")  # auto, ko, en, vi, etc.
    model_size = body.get("model", "base")  # tiny, base, small, medium, large-v3
    time_offset = body.get("timeOffset", 0)  # timeline offset for the clip

    if not source:
        return JSONResponse({"error": "source required"}, status_code=400)

    with _lock:
        if _transcribe_state["status"] == "processing":
            return JSONResponse({"error": "이미 변환 중입니다"}, status_code=409)

    t = threading.Thread(
        target=_transcribe_background,
        args=(source, language, model_size, time_offset),
        daemon=True,
    )
    t.start()

    return {"status": "started", "source": source}


@router.get("/status")
async def transcribe_status():
    """Poll transcription status."""
    return _transcribe_state


@router.post("/transcribe-sync")
async def transcribe_sync(request: Request):
    """Synchronous transcription (blocks until done). For short clips."""
    body = await request.json()
    source = body.get("source", "")
    language = body.get("language", "auto")
    model_size = body.get("model", "base")
    time_offset = body.get("timeOffset", 0)

    if not source:
        return JSONResponse({"error": "source required"}, status_code=400)

    video_path = BASE / source
    if not video_path.exists():
        return JSONResponse({"error": f"파일 없음: {source}"}, status_code=404)

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = tmp.name

    if not _extract_audio(str(video_path.resolve()), tmp_path):
        return JSONResponse({"error": "오디오 추출 실패"}, status_code=500)

    try:
        result = _run_whisper(tmp_path, language, model_size)
        if time_offset > 0:
            for w in result["words"]:
                w["start"] = round(w["start"] + time_offset, 3)
                w["end"] = round(w["end"] + time_offset, 3)
        result["subtitles"] = _words_to_subtitles(result["words"], time_offset)
        return result
    finally:
        os.unlink(tmp_path)
