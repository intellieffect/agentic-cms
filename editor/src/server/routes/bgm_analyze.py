"""BGM auto-segment finder — analyzes audio to find best matching segments for video."""
import os
import subprocess
import tempfile
import asyncio
from pathlib import Path

import numpy as np
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/bgm", tags=["bgm"])

# ── Safety limits to prevent CPU overload ──
MAX_AUDIO_DURATION = 600  # 10분 이상 음원은 잘라서 분석
MAX_SLIDING_WINDOW_CANDIDATES = 500  # 슬라이딩 윈도우 최대 후보 수
ANALYZE_TIMEOUT_SEC = 60  # 분석 최대 시간 (초)

BASE = Path(__file__).resolve().parent.parent.parent / "editor"


def _resolve_audio(source: str) -> Path | None:
    p = BASE / Path(source).name
    if p.exists():
        return p.resolve() if p.is_symlink() else p
    return None


# ─── Section Detection ───

def _compute_novelty_curve(y, sr):
    """Compute novelty curve from MFCC self-similarity using checkerboard kernel.

    Returns (novelty_curve, novelty_times) — peaks indicate section boundaries.
    """
    import librosa
    from scipy.ndimage import uniform_filter1d

    # MFCC features for self-similarity
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13, hop_length=512)
    mfcc_times = librosa.frames_to_time(np.arange(mfcc.shape[1]), sr=sr, hop_length=512)

    # Normalize MFCC per coefficient
    mfcc_norm = (mfcc - mfcc.mean(axis=1, keepdims=True)) / (mfcc.std(axis=1, keepdims=True) + 1e-8)

    # Cosine similarity matrix
    from numpy.linalg import norm
    norms = norm(mfcc_norm, axis=0, keepdims=True)
    norms = np.maximum(norms, 1e-8)
    mfcc_unit = mfcc_norm / norms
    sim_matrix = mfcc_unit.T @ mfcc_unit  # (T, T)

    # Checkerboard kernel convolution along diagonal for novelty
    kernel_size = min(32, sim_matrix.shape[0] // 4)
    if kernel_size < 4:
        return np.zeros(mfcc.shape[1]), mfcc_times

    # Build checkerboard kernel: +1 for same-segment blocks, -1 for cross-segment
    half = kernel_size // 2
    kern = -np.ones((kernel_size, kernel_size))
    kern[:half, :half] = 1
    kern[half:, half:] = 1

    n_frames = sim_matrix.shape[0]
    novelty = np.zeros(n_frames)
    for i in range(half, n_frames - half):
        patch = sim_matrix[i - half:i + half, i - half:i + half]
        if patch.shape == kern.shape:
            novelty[i] = np.sum(patch * kern)

    # Normalize and smooth
    novelty = np.maximum(novelty, 0)
    if np.max(novelty) > 1e-6:
        novelty = novelty / np.max(novelty)
    novelty = uniform_filter1d(novelty, size=max(3, kernel_size // 4))

    return novelty, mfcc_times


def _detect_sections(y, sr, chorus_starts=None):
    """Detect music structure: intro, buildup, highlight, verse, bridge, outro.

    Multi-feature analysis: RMS + spectral contrast + onset strength + spectral flux.
    Dynamic thresholds based on percentile. MFCC self-similarity for section boundaries.
    Chorus overlap promotes verse → chorus.

    Returns (sections, novelty_data).
    sections: list of {type, start, end, energy, confidence}.
    novelty_data: list of {time, value} for frontend visualization.
    """
    import librosa
    from scipy.signal import medfilt

    total_dur = len(y) / sr
    if total_dur < 3:
        return ([{"type": "highlight", "start": 0, "end": round(total_dur, 2),
                  "energy": 1.0, "confidence": 0.5}],
                [])

    # ── Feature extraction ──

    hop_length = 512
    # RMS energy
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length)
    frame_dur = rms_times[1] - rms_times[0] if len(rms_times) > 1 else 0.023
    n_frames = len(rms)

    # Onset strength
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
    # Align length
    min_len = min(n_frames, len(onset_env))
    onset_env = onset_env[:min_len]

    # Spectral contrast (mean across bands)
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr, hop_length=hop_length)
    contrast_mean = np.mean(contrast, axis=0)[:min_len]

    # Spectral flux
    S = np.abs(librosa.stft(y, hop_length=hop_length))
    spectral_flux = np.sqrt(np.mean(np.diff(S, axis=1) ** 2, axis=0))
    spectral_flux = np.concatenate([[0], spectral_flux])[:min_len]

    rms = rms[:min_len]
    rms_times = rms_times[:min_len]

    # ── Smooth all features (~2s window) ──
    win_size = max(3, int(2.0 / frame_dur))
    if win_size % 2 == 0:
        win_size += 1

    def _smooth_norm(arr):
        smoothed = medfilt(arr, kernel_size=min(win_size, len(arr) if len(arr) % 2 == 1 else len(arr) - 1))
        mx = np.max(smoothed)
        return smoothed / mx if mx > 1e-6 else smoothed

    rms_norm = _smooth_norm(rms)
    onset_norm = _smooth_norm(onset_env)
    contrast_norm = _smooth_norm(contrast_mean)
    flux_norm = _smooth_norm(spectral_flux)

    # ── Composite energy score ──
    energy_score = (0.40 * rms_norm
                    + 0.25 * onset_norm
                    + 0.20 * contrast_norm
                    + 0.15 * flux_norm)

    # Normalize composite
    es_max = np.max(energy_score)
    if es_max < 1e-6:
        return ([{"type": "highlight", "start": 0, "end": round(total_dur, 2),
                  "energy": 0.0, "confidence": 0.3}],
                [])
    energy_score = energy_score / es_max

    # ── Dynamic thresholds (percentile-based) ──
    intro_thresh = float(np.percentile(energy_score, 35))
    highlight_thresh = float(np.percentile(energy_score, 75))
    verse_lo = intro_thresh
    verse_hi = highlight_thresh

    # Energy gradient
    gradient = np.gradient(energy_score)

    # ── Novelty curve from MFCC self-similarity ──
    novelty_curve, novelty_times = _compute_novelty_curve(y, sr)

    # Find novelty peaks as candidate section boundaries
    novelty_peak_indices = []
    if len(novelty_curve) > 4:
        from scipy.signal import find_peaks
        # Minimum distance between boundaries: ~4 seconds
        min_dist_frames = max(1, int(4.0 / (novelty_times[1] - novelty_times[0]) if len(novelty_times) > 1 else 1))
        peak_indices, _ = find_peaks(novelty_curve, height=0.15, distance=min_dist_frames)
        novelty_peak_indices = peak_indices.tolist()

    # Build novelty data for frontend
    novelty_data = []
    step = max(1, len(novelty_curve) // 200)  # cap at ~200 points
    for i in range(0, len(novelty_curve), step):
        if i < len(novelty_times):
            novelty_data.append({
                "time": round(float(novelty_times[i]), 3),
                "value": round(float(novelty_curve[i]), 4),
            })

    # ── Section boundary candidates: merge novelty peaks with energy transitions ──
    # Convert novelty peak times
    boundary_times = sorted(set(
        [0.0]
        + [float(novelty_times[i]) for i in novelty_peak_indices if i < len(novelty_times)]
        + [total_dur]
    ))

    # Ensure minimum segment length of 3s; remove too-close boundaries
    filtered_boundaries = [boundary_times[0]]
    for bt in boundary_times[1:]:
        if bt - filtered_boundaries[-1] >= 3.0:
            filtered_boundaries.append(bt)
    if filtered_boundaries[-1] < total_dur - 1.0:
        filtered_boundaries.append(total_dur)
    elif filtered_boundaries[-1] != total_dur:
        filtered_boundaries[-1] = total_dur

    # ── Label each segment ──
    sections = []

    for seg_idx in range(len(filtered_boundaries) - 1):
        seg_start = filtered_boundaries[seg_idx]
        seg_end = filtered_boundaries[seg_idx + 1]

        i_s = max(0, int(seg_start / frame_dur))
        i_e = min(min_len, int(seg_end / frame_dur))
        if i_e <= i_s:
            continue

        seg_energy_vals = energy_score[i_s:i_e]
        seg_mean = float(np.mean(seg_energy_vals))
        seg_grad = float(np.mean(gradient[i_s:i_e]))

        # Determine section type — energy first, position second
        if seg_mean >= highlight_thresh:
            sec_type = "highlight"
            conf = 0.8
        elif seg_mean <= intro_thresh:
            # Low energy: position determines sub-type
            if seg_start < 2.0:
                sec_type = "intro"
                conf = 0.7
            elif seg_end > total_dur - 3.0:
                sec_type = "outro"
                conf = 0.6
            else:
                sec_type = "bridge"
                conf = 0.5
        elif seg_start < 2.0 and seg_grad > 0.001:
            # Start of track with rising mid-energy → intro leading into buildup
            sec_type = "intro"
            conf = 0.65
        elif seg_grad > 0.002:
            # Rising energy → buildup
            sec_type = "buildup"
            conf = 0.65
        else:
            # Mid-energy, not rising → verse
            sec_type = "verse"
            conf = 0.6

        # Chorus overlap: promote verse → chorus
        if sec_type == "verse" and chorus_starts:
            for cs in chorus_starts:
                if seg_start - 3 <= cs <= seg_end + 3:
                    sec_type = "chorus"
                    conf = min(1.0, conf + 0.15)
                    break

        # Chorus overlap bonus for highlights
        if sec_type == "highlight" and chorus_starts:
            for cs in chorus_starts:
                if seg_start - 3 <= cs <= seg_end + 3:
                    conf = min(1.0, conf + 0.15)
                    break

        sections.append({
            "type": sec_type,
            "start": round(seg_start, 2),
            "end": round(seg_end, 2),
            "energy": round(seg_mean, 3),
            "confidence": round(conf, 2),
        })

    # ── Post-processing: merge adjacent same-type segments ──
    if len(sections) > 1:
        merged = [sections[0]]
        for s in sections[1:]:
            prev = merged[-1]
            if s["type"] == prev["type"] and s["start"] - prev["end"] < 0.5:
                # Merge
                total_len = s["end"] - prev["start"]
                prev_len = prev["end"] - prev["start"]
                s_len = s["end"] - s["start"]
                prev["end"] = s["end"]
                prev["energy"] = round((prev["energy"] * prev_len + s["energy"] * s_len) / total_len, 3)
                prev["confidence"] = round(max(prev["confidence"], s["confidence"]), 2)
            else:
                merged.append(s)
        sections = merged

    # Sort by start time
    sections.sort(key=lambda s: s["start"])

    # Fallback
    if not sections:
        sections = [{"type": "highlight", "start": 0, "end": round(total_dur, 2),
                     "energy": round(float(np.mean(energy_score)), 3), "confidence": 0.4}]

    return sections, novelty_data


def _get_chorus_starts(audio_path, total_dur):
    """Extract chorus start positions using pychorus."""
    chorus_starts = []
    try:
        from pychorus import create_chroma
        from pychorus.helpers import find_chorus as _find_chorus
        chroma_data, _, chroma_sr, song_len = create_chroma(str(audio_path))
        seen = set()
        for cl in [15, 10, 8, 20, 12, 5]:
            if cl < 5 or cl > total_dur:
                continue
            try:
                cs = _find_chorus(chroma_data, chroma_sr, song_len, clip_length=cl)
                if cs is not None and cs >= 0:
                    rounded = round(float(cs), 1)
                    if rounded not in seen:
                        chorus_starts.append(rounded)
                        seen.add(rounded)
            except Exception:
                pass
    except (ImportError, Exception):
        pass
    return chorus_starts


def _build_video_energy_curve(clips_data, video_duration, num_points=20):
    """Build a normalized energy curve for the video based on clip properties.
    
    Short clips = high energy (fast cuts), long clips = low energy (slow/intro).
    Also considers clip position (later clips tend to be more intense in short-form).
    """
    if not clips_data:
        # Default: rising energy
        return np.linspace(0.3, 0.8, num_points)

    curve = np.zeros(num_points)
    t_step = video_duration / num_points if video_duration > 0 else 1

    for clip in clips_data:
        c_start = clip.get("tlStart", 0)
        c_dur = clip.get("duration", 1)
        c_speed = clip.get("speed", 1)

        # Energy heuristics:
        # 1. Shorter clips = higher energy (fast cutting)
        dur_energy = max(0, 1.0 - (c_dur / 5.0))  # <1s = 1.0, 5s = 0.0
        # 2. Higher speed = higher energy
        speed_energy = min(1, c_speed / 2.0)
        # 3. Combine
        clip_energy = 0.7 * dur_energy + 0.3 * speed_energy

        # Fill the curve at this clip's time range
        i_start = int(c_start / t_step)
        i_end = int((c_start + c_dur) / t_step)
        for i in range(max(0, i_start), min(num_points, i_end + 1)):
            curve[i] = max(curve[i], clip_energy)

    # Smooth
    if len(curve) > 3:
        kernel = np.array([0.15, 0.7, 0.15])
        curve = np.convolve(curve, kernel, mode='same')

    # Normalize to 0~1
    mn, mx = curve.min(), curve.max()
    if mx - mn > 0.01:
        curve = (curve - mn) / (mx - mn)

    return curve


def _match_energy_curves(video_curve, audio_rms, audio_rms_times, start_sec, duration, num_points=20):
    """Compute similarity between video energy curve and audio energy curve at given segment."""
    t_step = duration / num_points
    audio_curve = np.zeros(num_points)

    for i in range(num_points):
        t = start_sec + i * t_step
        mask = (audio_rms_times >= t) & (audio_rms_times < t + t_step)
        vals = audio_rms[mask]
        audio_curve[i] = float(np.mean(vals)) if len(vals) > 0 else 0

    # Normalize
    mn, mx = audio_curve.min(), audio_curve.max()
    if mx - mn > 0.01:
        audio_curve = (audio_curve - mn) / (mx - mn)

    # Pearson correlation — measures shape similarity
    if np.std(video_curve) < 0.01 or np.std(audio_curve) < 0.01:
        return 0.0
    corr = float(np.corrcoef(video_curve, audio_curve)[0, 1])
    return max(0, corr)


def _load_audio_wav(audio_path: Path):
    """Load audio as mono float32 numpy array. Returns (y, sr, total_dur)."""
    from scipy.io import wavfile

    wav_path = audio_path
    tmp_wav = None
    if not str(audio_path).lower().endswith(".wav"):
        import tempfile
        tmp_wav = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        tmp_wav.close()
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(audio_path), "-ac", "1",
             "-ar", "22050", "-t", str(MAX_AUDIO_DURATION),
             tmp_wav.name],
            capture_output=True, timeout=30,
        )
        wav_path = Path(tmp_wav.name)

    try:
        sr, data = wavfile.read(str(wav_path))
        if data.ndim > 1:
            data = data.mean(axis=1)
        y = data.astype(np.float32) / (np.iinfo(data.dtype).max if np.issubdtype(data.dtype, np.integer) else 1.0)
        total_dur = len(y) / sr
        return y, sr, total_dur
    finally:
        if tmp_wav:
            try:
                os.remove(tmp_wav.name)
            except OSError:
                pass


def _detect_impact_beats(y, sr, min_gap=0.4, energy_percentile=70):
    """Detect impact beats using low-frequency (kick/bass) energy peaks.

    Filters 20-200Hz band, computes RMS energy, finds peaks above percentile threshold.
    """
    from scipy.signal import find_peaks, butter, sosfilt

    # Bandpass filter: 20-200Hz (kick drum / bass impact range)
    nyq = sr / 2
    low = max(20 / nyq, 0.001)
    high = min(200 / nyq, 0.999)
    sos = butter(4, [low, high], btype='band', output='sos')
    y_low = sosfilt(sos, y)

    # RMS energy in short windows
    hop = 512
    frame_len = 2048
    n_frames = max(1, (len(y_low) - frame_len) // hop)
    energy = np.zeros(n_frames)
    for i in range(n_frames):
        frame = y_low[i * hop: i * hop + frame_len]
        energy[i] = np.sqrt(np.mean(frame ** 2))

    if energy.max() > 0:
        energy = energy / energy.max()

    # Onset strength (spectral flux) for full spectrum — used as secondary signal
    onset_env = np.zeros(n_frames)
    prev_spec = np.zeros(frame_len // 2 + 1)
    for i in range(n_frames):
        frame = y[i * hop: i * hop + frame_len]
        if len(frame) < frame_len:
            frame = np.pad(frame, (0, frame_len - len(frame)))
        spec = np.abs(np.fft.rfft(frame * np.hanning(frame_len)))
        flux = np.sum(np.maximum(0, spec - prev_spec))
        onset_env[i] = flux
        prev_spec = spec
    if onset_env.max() > 0:
        onset_env = onset_env / onset_env.max()

    # Combined score: low-freq energy * full onset strength
    combined = energy * 0.6 + onset_env * 0.4

    # Dynamic threshold: percentile-based
    threshold = np.percentile(combined, energy_percentile)
    min_dist = int(sr / hop * min_gap)

    peaks, properties = find_peaks(combined, height=threshold, distance=max(1, min_dist))
    beat_times = (peaks * hop / sr).tolist()

    # Estimate tempo
    if len(beat_times) >= 2:
        intervals = np.diff(beat_times)
        tempo_val = round(60.0 / float(np.median(intervals)), 1) if float(np.median(intervals)) > 0 else 0.0
    else:
        tempo_val = 0.0

    return beat_times, tempo_val


def _detect_downbeats(y, sr, min_gap=0.8):
    """Detect downbeats (first beat of each measure) using accent pattern analysis.

    Estimates beat positions, then selects every Nth beat based on detected meter.
    """
    from scipy.signal import find_peaks

    hop = 512
    frame_len = 2048
    n_frames = max(1, (len(y) - frame_len) // hop)

    # Full onset envelope
    onset_env = np.zeros(n_frames)
    prev_spec = np.zeros(frame_len // 2 + 1)
    for i in range(n_frames):
        frame = y[i * hop: i * hop + frame_len]
        if len(frame) < frame_len:
            frame = np.pad(frame, (0, frame_len - len(frame)))
        spec = np.abs(np.fft.rfft(frame * np.hanning(frame_len)))
        flux = np.sum(np.maximum(0, spec - prev_spec))
        onset_env[i] = flux
        prev_spec = spec
    if onset_env.max() > 0:
        onset_env = onset_env / onset_env.max()

    # Find all beats first
    min_dist_beat = int(sr / hop * 0.25)
    all_peaks, _ = find_peaks(onset_env, height=0.1, distance=max(1, min_dist_beat))

    if len(all_peaks) < 4:
        beat_times = (all_peaks * hop / sr).tolist()
        tempo_val = 0.0
        if len(beat_times) >= 2:
            tempo_val = round(60.0 / float(np.median(np.diff(beat_times))), 1)
        return beat_times, tempo_val

    # Estimate beat interval and meter (4/4 assumed, select every 4th beat)
    intervals = np.diff(all_peaks)
    median_interval = float(np.median(intervals))
    tempo_val = round(60.0 / (median_interval * hop / sr), 1) if median_interval > 0 else 0.0

    # Score each beat's "accent strength" using low-freq energy
    from scipy.signal import butter, sosfilt
    nyq = sr / 2
    low = max(20 / nyq, 0.001)
    high = min(300 / nyq, 0.999)
    sos = butter(4, [low, high], btype='band', output='sos')
    y_low = sosfilt(sos, y)
    low_energy = np.zeros(n_frames)
    for i in range(n_frames):
        frame = y_low[i * hop: i * hop + frame_len]
        low_energy[i] = np.sqrt(np.mean(frame ** 2))
    if low_energy.max() > 0:
        low_energy = low_energy / low_energy.max()

    # Group beats and pick the strongest in each group of 4
    group_size = 4
    downbeat_peaks = []
    for g in range(0, len(all_peaks), group_size):
        group = all_peaks[g:g + group_size]
        if len(group) == 0:
            continue
        scores = [low_energy[p] if p < len(low_energy) else 0 for p in group]
        best_idx = int(np.argmax(scores))
        downbeat_peaks.append(group[best_idx])

    # Filter by minimum gap
    min_dist_db = int(sr / hop * min_gap)
    filtered = [downbeat_peaks[0]] if downbeat_peaks else []
    for p in downbeat_peaks[1:]:
        if p - filtered[-1] >= min_dist_db:
            filtered.append(p)

    beat_times = [round(p * hop / sr, 3) for p in filtered]
    return beat_times, tempo_val


@router.post("/beats")
async def extract_beats(request: Request):
    """Extract beat/impact times from an audio file.

    Input:
      { "source": "filename.mp3", "mode": "all"|"impact"|"downbeat", "minGap": 0.4 }

    Modes:
      - "all": All detected beats (default, onset-based)
      - "impact": Low-frequency kick/bass impact points only (쿵 쿵)
      - "downbeat": Downbeats (강박, first beat of each measure)

    Output:
      { "tempo", "beatTimes", "totalDuration", "beatCount", "mode" }
    """
    body = await request.json()
    source = body.get("source", "")
    mode = body.get("mode", "all")
    min_gap = body.get("minGap", None)

    audio_path = _resolve_audio(source)
    if not audio_path or not audio_path.exists():
        return JSONResponse({"error": f"Audio not found: {source}"}, status_code=404)

    try:
        if mode == "impact":
            y, sr, total_dur = _load_audio_wav(audio_path)
            gap = min_gap if min_gap is not None else 0.4
            beat_times, tempo_val = _detect_impact_beats(y, sr, min_gap=gap)

        elif mode == "downbeat":
            y, sr, total_dur = _load_audio_wav(audio_path)
            gap = min_gap if min_gap is not None else 0.8
            beat_times, tempo_val = _detect_downbeats(y, sr, min_gap=gap)

        else:
            # mode == "all" — original logic
            try:
                import librosa
                y, sr = librosa.load(str(audio_path), sr=22050, mono=True,
                                     duration=MAX_AUDIO_DURATION)
                total_dur = len(y) / sr
                tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
                beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
                tempo_val = float(np.atleast_1d(tempo)[0])
            except ImportError:
                y, sr, total_dur = _load_audio_wav(audio_path)
                from scipy.signal import find_peaks
                hop = 512
                n_fft = 2048
                n_frames = 1 + (len(y) - n_fft) // hop
                onset_env = np.zeros(max(0, n_frames))
                prev_spec = np.zeros(n_fft // 2 + 1)
                for i in range(n_frames):
                    frame = y[i * hop: i * hop + n_fft]
                    if len(frame) < n_fft:
                        frame = np.pad(frame, (0, n_fft - len(frame)))
                    spec = np.abs(np.fft.rfft(frame * np.hanning(n_fft)))
                    flux = np.sum(np.maximum(0, spec - prev_spec))
                    onset_env[i] = flux
                    prev_spec = spec
                if onset_env.max() > 0:
                    onset_env = onset_env / onset_env.max()
                min_dist = int(sr / hop * 0.3)
                peaks, _ = find_peaks(onset_env, height=0.15, distance=max(1, min_dist))
                beat_times = (peaks * hop / sr).tolist()
                if len(beat_times) >= 2:
                    intervals = np.diff(beat_times)
                    tempo_val = round(60.0 / float(np.median(intervals)), 1)
                else:
                    tempo_val = 0.0

        return {
            "tempo": round(tempo_val, 1),
            "beatTimes": [round(b, 3) for b in beat_times],
            "totalDuration": round(total_dur, 3),
            "beatCount": len(beat_times),
            "mode": mode,
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/sections")
async def detect_bgm_sections(request: Request):
    """Detect structural sections (intro, buildup, highlight, bridge, outro) in an audio file."""
    body = await request.json()
    source = body.get("source", "")

    audio_path = _resolve_audio(source)
    if not audio_path or not audio_path.exists():
        return JSONResponse({"error": f"Audio not found: {source}"}, status_code=404)

    try:
        import librosa

        y, sr = librosa.load(str(audio_path), sr=22050, mono=True,
                             duration=MAX_AUDIO_DURATION)
        total_dur = len(y) / sr

        if total_dur < 1:
            return JSONResponse({"error": "Audio too short for analysis"}, status_code=400)

        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        tempo_val = float(np.atleast_1d(tempo)[0])

        chorus_starts = _get_chorus_starts(audio_path, total_dur)
        sections, novelty_data = _detect_sections(y, sr, chorus_starts)

        return {
            "sections": sections,
            "tempo": round(tempo_val, 1),
            "totalDuration": round(total_dur, 2),
            "chorusStarts": chorus_starts,
            "noveltyCurve": novelty_data,
        }
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


def _snap_to_beat(t, beat_times, tolerance=0.5):
    """Snap time t to nearest beat within tolerance. Returns snapped time."""
    if not beat_times:
        return t
    close = [b for b in beat_times if abs(b - t) < tolerance]
    if close:
        return min(close, key=lambda b: abs(b - t))
    return t


def snap_audio_start_to_beat(start: float, beat_times: list[float], tolerance: float = 0.3) -> float:
    """Snap an audio start time to the nearest beat for clean entry.

    Prefers snapping backward (earlier beat) for a tight musical start.
    """
    if not beat_times:
        return start
    candidates = [b for b in beat_times if abs(b - start) <= tolerance]
    if not candidates:
        return start
    # Prefer the beat that is at or just before the target
    before = [b for b in candidates if b <= start + 0.05]
    if before:
        return max(before)
    return min(candidates, key=lambda b: abs(b - start))


def _build_intro_to_highlight_clips(sections, video_duration, total_audio_dur, beat_times):
    """Build BGM clip list: intro→highlight with natural transitions.

    Strategy priority:
    1. Short-form (<=15s): highlight direct — single best clip
    2. Continuous run from intro: no cuts at all
    3. Intro + crossfade → highlight: 2 clips with crossfade info

    Returns list of {audioStart, duration, sectionType, crossfadeIn?, crossfadeOut?}.
    """
    SHORTFORM_THRESHOLD = 15.0
    CROSSFADE_DURATION = 1.5

    intros = [s for s in sections if s["type"] == "intro"]
    highlights = [s for s in sections if s["type"] == "highlight"]

    if not highlights:
        return [{"audioStart": 0, "duration": video_duration, "sectionType": "auto"}]

    best_hl = max(highlights, key=lambda h: h["energy"] * h["confidence"])

    # ── Strategy 3: Short-form → highlight direct ──
    if video_duration <= SHORTFORM_THRESHOLD:
        hl_start = _snap_to_beat(best_hl["start"], beat_times)
        hl_avail = best_hl["end"] - hl_start
        hl_dur = min(hl_avail, video_duration)
        # Snap end to beat too
        hl_end = _snap_to_beat(hl_start + hl_dur, beat_times)
        hl_dur = round(max(hl_end - hl_start, min(hl_avail, video_duration)), 2)
        return [{
            "audioStart": round(hl_start, 2),
            "duration": hl_dur,
            "sectionType": "highlight",
        }]

    # ── Strategy 1: Continuous run from intro ──
    if intros:
        intro_start = intros[0]["start"]
        # Check how far we can go continuously from intro start
        # Sections are sorted by start time — find contiguous chain
        continuous_end = intros[0]["end"]
        for s in sections:
            if s["start"] <= continuous_end + 0.5 and s["end"] > continuous_end:
                continuous_end = s["end"]

        continuous_avail = continuous_end - intro_start

        if continuous_avail >= video_duration:
            # Perfect: single continuous clip covers the whole video
            return [{
                "audioStart": round(intro_start, 2),
                "duration": round(video_duration, 2),
                "sectionType": "continuous",
            }]

        # ── Strategy 2: Intro continuous + crossfade to highlight ──
        # Use as much continuous audio from intro as possible
        intro_clip_dur = continuous_avail
        remaining = video_duration - intro_clip_dur + CROSSFADE_DURATION  # overlap

        # Highlight clip fills the rest
        hl_start = _snap_to_beat(best_hl["start"], beat_times)
        hl_avail = best_hl["end"] - hl_start
        hl_dur = min(hl_avail, remaining)

        # If highlight doesn't have enough, extend into next section
        if hl_dur < remaining:
            # Find sections after highlight and extend
            hl_end_extended = best_hl["end"]
            for s in sections:
                if s["start"] <= hl_end_extended + 0.5 and s["end"] > hl_end_extended:
                    hl_end_extended = s["end"]
            hl_dur = min(hl_end_extended - hl_start, remaining)

        # If still not enough, just use what we have
        hl_dur = max(hl_dur, min(remaining, total_audio_dur - hl_start))

        clips = [
            {
                "audioStart": round(intro_start, 2),
                "duration": round(intro_clip_dur, 2),
                "sectionType": "intro",
                "crossfadeOut": CROSSFADE_DURATION,
            },
            {
                "audioStart": round(hl_start, 2),
                "duration": round(hl_dur, 2),
                "sectionType": "highlight",
                "crossfadeIn": CROSSFADE_DURATION,
            },
        ]
        return clips

    # ── No intro detected: use pre-highlight slice + crossfade to highlight ──
    pre_start = max(0, best_hl["start"] - video_duration * 0.3)
    pre_start = _snap_to_beat(pre_start, beat_times)
    pre_dur = best_hl["start"] - pre_start
    if pre_dur < 1.0:
        # Not enough pre-highlight space, just go highlight direct
        hl_start = _snap_to_beat(best_hl["start"], beat_times)
        return [{
            "audioStart": round(hl_start, 2),
            "duration": round(min(best_hl["end"] - hl_start, video_duration), 2),
            "sectionType": "highlight",
        }]

    remaining = video_duration - pre_dur + CROSSFADE_DURATION
    hl_start = _snap_to_beat(best_hl["start"], beat_times)
    hl_dur = min(best_hl["end"] - hl_start, remaining)

    return [
        {
            "audioStart": round(pre_start, 2),
            "duration": round(pre_dur, 2),
            "sectionType": "pre-highlight",
            "crossfadeOut": CROSSFADE_DURATION,
        },
        {
            "audioStart": round(hl_start, 2),
            "duration": round(hl_dur, 2),
            "sectionType": "highlight",
            "crossfadeIn": CROSSFADE_DURATION,
        },
    ]


def _build_highlight_only_clips(sections, video_duration, beat_times):
    """Pick the best highlight section and return a single clip from it."""
    highlights = [s for s in sections if s["type"] == "highlight"]
    if not highlights:
        return [{"audioStart": 0, "duration": video_duration, "sectionType": "auto"}]

    best_hl = max(highlights, key=lambda h: h["energy"] * h["confidence"])
    hl_start = best_hl["start"]

    # Snap to beat
    if beat_times:
        close_beats = [b for b in beat_times if abs(b - hl_start) < 0.5]
        if close_beats:
            hl_start = min(close_beats, key=lambda b: abs(b - best_hl["start"]))

    hl_dur = min(best_hl["end"] - hl_start, video_duration)
    return [{"audioStart": round(hl_start, 2), "duration": round(hl_dur, 2),
             "sectionType": "highlight"}]


@router.post("/analyze")
async def analyze_bgm(request: Request):
    """Analyze audio file and find best segments for given video clip timing."""
    body = await request.json()
    source = body.get("source", "")
    clip_boundaries = body.get("clipBoundaries", [])  # [0, 5.0, 7.0, 9.0, ...]
    clips_data = body.get("clipsData", [])  # [{tlStart, duration, speed}, ...]
    video_duration = body.get("videoDuration", 15)
    top_n = body.get("topN", 3)
    mode = body.get("mode", "auto")  # 'auto', 'intro_to_highlight', 'highlight_only', 'highlight_direct'

    audio_path = _resolve_audio(source)
    if not audio_path or not audio_path.exists():
        return JSONResponse({"error": f"Audio not found: {source}"}, status_code=404)

    try:
        import librosa

        # Load audio (cap at MAX_AUDIO_DURATION to prevent CPU overload)
        y, sr = librosa.load(str(audio_path), sr=22050, mono=True,
                             duration=MAX_AUDIO_DURATION)
        total_dur = len(y) / sr

        if total_dur < video_duration:
            return {"segments": [{"start": 0, "end": total_dur, "score": 1.0, "reason": "음원이 영상보다 짧음"}]}

        # 1. Beat detection
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
        tempo_val = float(np.atleast_1d(tempo)[0])

        # 2. RMS energy (per frame)
        rms = librosa.feature.rms(y=y)[0]
        rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)

        # 3. Onset strength (musical change intensity)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        onset_times = librosa.frames_to_time(np.arange(len(onset_env)), sr=sr)

        # 4. Spectral contrast (tonal richness)
        contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
        contrast_mean = np.mean(contrast, axis=0)

        # 5. Chorus detection (pychorus) — find the most repeated/memorable part
        chorus_starts = _get_chorus_starts(audio_path, total_dur)

        # ── Mode: intro_to_highlight / highlight_only / highlight_direct ──
        if mode in ("intro_to_highlight", "highlight_only", "highlight_direct"):
            sections, novelty_data = _detect_sections(y, sr, chorus_starts)
            if mode == "intro_to_highlight":
                bgm_clips = _build_intro_to_highlight_clips(
                    sections, video_duration, total_dur, beat_times)
            elif mode == "highlight_direct":
                bgm_clips = _build_highlight_only_clips(
                    sections, video_duration, beat_times)
            else:
                bgm_clips = _build_highlight_only_clips(
                    sections, video_duration, beat_times)
            return {
                "mode": mode,
                "bgmClips": bgm_clips,
                "sections": sections,
                "tempo": round(tempo_val, 1),
                "totalDuration": round(total_dur, 1),
                "beatCount": len(beat_times),
                "chorusStarts": chorus_starts,
                "noveltyCurve": novelty_data,
            }

        # 6. Build video energy curve (mode='auto' — original behavior)
        video_energy = _build_video_energy_curve(clips_data, video_duration)

        # 7. Sliding window scoring
        # Dynamic hop: longer audio → bigger hop to cap computation
        scan_range = total_dur - video_duration
        hop_sec = max(0.5, scan_range / MAX_SLIDING_WINDOW_CANDIDATES)
        candidates = []

        for start_sec in np.arange(0, total_dur - video_duration, hop_sec):
            end_sec = start_sec + video_duration

            # Score components
            scores = {}

            # A. Energy curve matching (video ↔ audio shape similarity)
            mask = (rms_times >= start_sec) & (rms_times < end_sec)
            seg_rms = rms[mask]
            if len(seg_rms) < 4:
                continue
            curve_score = _match_energy_curves(video_energy, rms, rms_times, start_sec, video_duration)
            scores["curve_match"] = curve_score * 0.35

            # Dynamic range (variation = interesting)
            dyn_range = float(np.std(seg_rms) / (np.mean(seg_rms) + 1e-6))
            scores["dynamics"] = min(1, dyn_range * 3) * 0.10

            # Average energy (some baseline needed)
            avg_energy = float(np.mean(seg_rms))
            scores["energy_avg"] = min(1, avg_energy / (np.max(rms) + 1e-6)) * 0.05

            # B. Beat alignment with clip boundaries
            seg_beats = [b - start_sec for b in beat_times if start_sec <= b < end_sec]
            if clip_boundaries and seg_beats:
                alignment_score = 0
                for cb in clip_boundaries:
                    if cb <= 0 or cb >= video_duration:
                        continue
                    # Find closest beat
                    dists = [abs(b - cb) for b in seg_beats]
                    min_dist = min(dists) if dists else 999
                    # Within 0.2s = perfect, 0.5s = ok
                    if min_dist < 0.15:
                        alignment_score += 1.0
                    elif min_dist < 0.3:
                        alignment_score += 0.6
                    elif min_dist < 0.5:
                        alignment_score += 0.3
                n_boundaries = max(1, len([cb for cb in clip_boundaries if 0 < cb < video_duration]))
                scores["beat_align"] = (alignment_score / n_boundaries) * 0.30
            else:
                scores["beat_align"] = 0

            # C. Musical change / onset density (interesting parts have more onsets)
            onset_mask = (onset_times >= start_sec) & (onset_times < end_sec)
            seg_onset = onset_env[onset_mask]
            onset_density = float(np.mean(seg_onset)) if len(seg_onset) > 0 else 0
            scores["onset"] = min(1, onset_density / (np.max(onset_env) + 1e-6)) * 0.10

            # D. Natural start point bonus (near a beat after silence/low energy)
            start_rms_mask = (rms_times >= start_sec) & (rms_times < start_sec + 0.5)
            start_energy = float(np.mean(rms[start_rms_mask])) if np.any(start_rms_mask) else 0
            # Prefer starting on/near a beat
            beat_dist = min([abs(b - start_sec) for b in beat_times], default=999)
            start_bonus = 0
            if beat_dist < 0.15:
                start_bonus = 0.05
            elif beat_dist < 0.3:
                start_bonus = 0.03
            scores["start_natural"] = start_bonus

            # E. Natural end point bonus
            end_rms_mask = (rms_times >= end_sec - 0.5) & (rms_times < end_sec)
            end_beat_dist = min([abs(b - end_sec) for b in beat_times], default=999)
            end_bonus = 0
            if end_beat_dist < 0.15:
                end_bonus = 0.05
            elif end_beat_dist < 0.3:
                end_bonus = 0.03
            scores["end_natural"] = end_bonus

            # F. Chorus proximity bonus (pychorus)
            if chorus_starts:
                min_chorus_dist = min(abs(start_sec - cs) for cs in chorus_starts)
                if min_chorus_dist < 2:
                    scores["chorus"] = 0.20
                elif min_chorus_dist < 5:
                    scores["chorus"] = 0.12
                elif min_chorus_dist < 10:
                    scores["chorus"] = 0.05
                else:
                    scores["chorus"] = 0
            else:
                scores["chorus"] = 0

            total_score = sum(scores.values())
            candidates.append({
                "start": round(float(start_sec), 1),
                "end": round(float(end_sec), 1),
                "score": round(float(total_score), 4),
                "scores": {k: round(float(v), 4) for k, v in scores.items()},
            })

        # Sort by score, pick top N (with minimum distance between selections)
        candidates.sort(key=lambda c: c["score"], reverse=True)

        selected = []
        for c in candidates:
            if len(selected) >= top_n:
                break
            # Ensure at least 3s apart from already selected
            if all(abs(c["start"] - s["start"]) >= 3 for s in selected):
                # Generate reason
                top_factor = max(c["scores"], key=c["scores"].get)
                reason_map = {
                    "curve_match": "🎯 영상-음원 에너지 매칭",
                    "dynamics": "다이나믹 변화",
                    "energy_avg": "높은 에너지",
                    "beat_align": "비트-컷 정렬",
                    "onset": "음악적 변화 밀도",
                    "start_natural": "자연스러운 시작점",
                    "end_natural": "자연스러운 끝점",
                    "chorus": "🎤 코러스 (반복 하이라이트)",
                }
                c["reason"] = reason_map.get(top_factor, top_factor)
                selected.append(c)

        return {
            "segments": selected,
            "tempo": round(tempo_val, 1),
            "totalDuration": round(total_dur, 1),
            "beatCount": len(beat_times),
            "chorusStarts": chorus_starts,
        }

    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
