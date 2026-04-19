"""Rendering engine — extracted from original server.py.

All ffmpeg command building, clip processing, transition merging,
effects, Ken Burns, and subtitle overlay logic is preserved here.
"""
import json
import os
import re
import shutil
import subprocess


def _auto_resolve_source(original_source: str, dest: "Path") -> bool:
    """Try to find the source file in known directories and create a symlink."""
    from pathlib import Path

    fname = Path(original_source).name
    # Search directories: MEDIA_ROOT + LEGACY_MEDIA_DIRS env (comma-separated)
    search_dirs = []
    media_root = os.environ.get("MEDIA_ROOT", "")
    if media_root:
        search_dirs.append(Path(media_root))
    legacy_env = os.environ.get("LEGACY_MEDIA_DIRS", "")
    if legacy_env:
        search_dirs.extend([Path(d.strip()) for d in legacy_env.split(",") if d.strip()])
    for d in search_dirs:
        if not d.exists():
            continue
        # Direct match
        candidate = d / fname
        if candidate.exists():
            dest.symlink_to(candidate)
            return True
        # Recursive search
        try:
            for match in d.rglob(fname):
                dest.symlink_to(match)
                return True
        except Exception:
            pass
    return False
import sys
import threading
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

try:
    from pilmoji import Pilmoji
    HAS_PILMOJI = True
except ImportError:
    HAS_PILMOJI = False


W, H = 1080, 1920  # 9:16 vertical
FONT_PATH = os.path.expanduser("~/Library/Fonts/NotoSansKR-Bold.ttf")
CUTTER_SCRIPT = Path(os.path.expanduser("~/clawd/skills/thread-video-cutter/thread_video_cutter.py"))


# ─── Video metadata helpers ───

def get_color_space(path):
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries",
             "stream=color_space,color_transfer,color_primaries",
             "-of", "csv=p=0", path],
            capture_output=True, text=True, timeout=5
        )
        out = r.stdout.lower()
        if "bt2020" in out or "arib-std-b67" in out or "smpte2084" in out:
            return "hdr"
        if "smpte170m" in out or "bt470" in out:
            return "smpte170m"
    except Exception:
        pass
    return "bt709"


def get_video_duration(path):
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", path],
            capture_output=True, text=True
        )
        return float(json.loads(r.stdout)["format"]["duration"])
    except Exception:
        return 0.0


def get_video_dimensions(path):
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-show_entries", "stream=width,height",
             "-of", "csv=p=0", path],
            capture_output=True, text=True, timeout=5
        )
        parts = r.stdout.strip().split(",")
        if len(parts) >= 2:
            return int(parts[0]), int(parts[1])
    except Exception:
        pass
    return None, None


def is_video_landscape(path):
    try:
        r = subprocess.run(
            ["ffprobe", "-v", "quiet", "-select_streams", "v:0",
             "-show_entries", "stream=width,height", "-of", "csv=p=0", path],
            capture_output=True, text=True
        )
        parts = r.stdout.strip().split(",")
        if len(parts) >= 2:
            w, h = int(parts[0]), int(parts[1])
            return w > h
    except Exception:
        pass
    return False


def get_video_fps(path):
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


# ─── Effect filters ───

def build_effect_filters(effects, clip_duration=0):
    vf = []
    af = []
    for fx in (effects or []):
        t = fx.get("type", "")
        intensity = fx.get("intensity", 0.5)
        duration = fx.get("duration", 1.0)

        if t == "grain":
            strength = max(1, int(intensity * 30))
            vf.append(f"noise=c0s={strength}:c0f=t+u")
        elif t == "vhs":
            vf.append("curves=preset=lighter")
            strength = max(1, int(intensity * 15))
            vf.append(f"noise=c0s={strength}:c0f=t+u")
            shift = max(1, int(intensity * 6))
            vf.append(f"rgbashift=rh={shift}:bh=-{shift}")
        elif t == "glitch":
            shift = max(1, int(intensity * 10))
            vf.append(f"rgbashift=rh={shift}:gh=0:bh=-{shift}:rv={int(shift/2)}:bv=-{int(shift/2)}")
        elif t == "blur":
            radius = max(1, int(intensity * 10))
            vf.append(f"boxblur={radius}:1")
        elif t == "sharpen":
            amount = 0.5 + intensity * 2.5
            vf.append(f"unsharp=5:5:{amount:.1f}")
        elif t == "vignette":
            angle = 0.2 + intensity * 1.2
            vf.append(f"vignette={angle:.2f}")
        elif t == "bw":
            vf.append("hue=s=0")
        elif t == "sepia":
            vf.append("colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131")
        elif t == "fadeIn":
            vf.append(f"fade=t=in:st=0:d={duration:.2f}")
        elif t == "fadeOut":
            if clip_duration > 0:
                st = max(0, clip_duration - duration)
                vf.append(f"fade=t=out:st={st:.2f}:d={duration:.2f}")
        elif t == "slowmo":
            factor = 1 / max(0.1, intensity)
            vf.append(f"setpts={factor:.4f}*PTS")
            af.append(f"atempo={1/factor:.4f}")
        elif t == "speedup":
            factor = max(0.25, intensity)
            vf.append(f"setpts={factor:.4f}*PTS")
            af.append(f"atempo={1/factor:.4f}")

    return vf, af


# ─── Ken Burns ───

def apply_ken_burns(input_path, output_path, kb, fps):
    try:
        from moviepy import VideoFileClip
    except ImportError:
        print("[KB] moviepy not available, skipping Ken Burns")
        return False
    import numpy as np
    from PIL import Image as PILImage

    effect = kb.get("effect", "none")
    if effect == "none":
        return False
    intensity = kb.get("intensity", 15) / 100.0

    clip = VideoFileClip(str(input_path))
    w, h = clip.size
    duration = clip.duration

    def zoom_effect(get_frame, t):
        frame = get_frame(t)
        progress = t / duration if duration > 0 else 0
        if effect == "zoom-in":
            zoom = 1 + intensity * progress
        elif effect == "zoom-out":
            zoom = 1 + intensity * (1 - progress)
        elif effect == "pan-left":
            zoom = 1 + intensity
            offset_x = int((w - w / zoom) * (1 - progress))
            offset_y = int((h - h / zoom) / 2)
            nw, nh = int(w / zoom), int(h / zoom)
            cropped = frame[offset_y:offset_y + nh, offset_x:offset_x + nw]
            return np.array(PILImage.fromarray(cropped).resize((w, h), PILImage.LANCZOS))
        elif effect == "pan-right":
            zoom = 1 + intensity
            offset_x = int((w - w / zoom) * progress)
            offset_y = int((h - h / zoom) / 2)
            nw, nh = int(w / zoom), int(h / zoom)
            cropped = frame[offset_y:offset_y + nh, offset_x:offset_x + nw]
            return np.array(PILImage.fromarray(cropped).resize((w, h), PILImage.LANCZOS))
        else:
            return frame

        nw = int(w / zoom)
        nh = int(h / zoom)
        x1 = (w - nw) // 2
        y1 = (h - nh) // 2
        cropped = frame[y1:y1 + nh, x1:x1 + nw]
        return np.array(PILImage.fromarray(cropped).resize((w, h), PILImage.LANCZOS))

    zoomed = clip.transform(zoom_effect)
    zoomed.write_videofile(str(output_path), fps=fps, codec="libx264", preset="fast",
                           bitrate="8000k", logger=None, audio=False)
    clip.close()
    print(f"[KB] Applied {effect} {int(intensity * 100)}% to {output_path}")
    return True


def apply_global_ken_burns(input_path, output_path, kb_effects, fps):
    try:
        from moviepy import VideoFileClip
    except ImportError:
        print("[KB] moviepy not available, skipping global Ken Burns")
        return False
    import numpy as np
    from PIL import Image as PILImage

    clip = VideoFileClip(str(input_path))
    w, h = clip.size

    def global_zoom_effect(get_frame, t):
        frame = get_frame(t)
        active = None
        for kb in kb_effects:
            if t >= kb.get("start", 0) and t < kb.get("end", 0):
                active = kb
                break
        if not active:
            return frame

        effect = active.get("effect", "none")
        if effect == "none":
            return frame
        intensity = active.get("intensity", 15) / 100.0
        kb_start = active.get("start", 0)
        kb_end = active.get("end", 0)
        kb_dur = kb_end - kb_start
        progress = (t - kb_start) / kb_dur if kb_dur > 0 else 0
        progress = max(0.0, min(1.0, progress))

        if effect == "zoom-in":
            zoom = 1 + intensity * progress
        elif effect == "zoom-out":
            zoom = 1 + intensity * (1 - progress)
        elif effect == "pan-left":
            zoom = 1 + intensity
            offset_x = int((w - w / zoom) * (1 - progress))
            offset_y = int((h - h / zoom) / 2)
            nw, nh = int(w / zoom), int(h / zoom)
            cropped = frame[offset_y:offset_y + nh, offset_x:offset_x + nw]
            return np.array(PILImage.fromarray(cropped).resize((w, h), PILImage.LANCZOS))
        elif effect == "pan-right":
            zoom = 1 + intensity
            offset_x = int((w - w / zoom) * progress)
            offset_y = int((h - h / zoom) / 2)
            nw, nh = int(w / zoom), int(h / zoom)
            cropped = frame[offset_y:offset_y + nh, offset_x:offset_x + nw]
            return np.array(PILImage.fromarray(cropped).resize((w, h), PILImage.LANCZOS))
        else:
            return frame

        nw = int(w / zoom)
        nh = int(h / zoom)
        x1 = (w - nw) // 2
        y1 = (h - nh) // 2
        cropped = frame[y1:y1 + nh, x1:x1 + nw]
        return np.array(PILImage.fromarray(cropped).resize((w, h), PILImage.LANCZOS))

    zoomed = clip.transform(global_zoom_effect)
    zoomed.write_videofile(str(output_path), fps=fps, codec="libx264", preset="fast",
                           bitrate="8000k", logger=None, audio=False)
    clip.close()
    return True


# ─── Subtitle image rendering (Pillow fallback) ───

EMOJI_RE = re.compile(
    "["
    "\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF"
    "\U0001F1E0-\U0001F1FF\U0001F900-\U0001F9FF\U0001FA00-\U0001FA6F"
    "\U0001FA70-\U0001FAFF\U00002702-\U000027B0\U000024C2-\U000024FF"
    "\U00002600-\U000026FF\U00002640-\U00002642\U0000FE00-\U0000FE0F"
    "\U0000200D\U0000203C-\U00002049"
    "]+",
    re.UNICODE,
)


def resolve_font_path(font_family, text=""):
    """Resolve CSS font-family string to actual font file path."""
    HOME = Path.home()
    UFONTS = HOME / "Library" / "Fonts"
    FONTS_DIR = Path(__file__).resolve().parent.parent / "editor" / "_fonts"
    # Check assets/fonts as alternative
    ASSETS_FONTS = Path(__file__).resolve().parent.parent.parent / "assets" / "fonts"
    has_cjk = bool(re.search(r"[\uAC00-\uD7AF\u3130-\u318F\u4E00-\u9FFF]", text))

    def _font_paths(name):
        """Return paths for bundled fonts, checking both locations."""
        paths = []
        for d in [FONTS_DIR, ASSETS_FONTS]:
            p = d / name
            if p.exists():
                paths.append(str(p))
        return paths

    FONT_MAP_RESOLVE = {
        "Apple SD": ["/System/Library/Fonts/AppleSDGothicNeo.ttc"],
        "Noto Sans KR": [str(UFONTS / "NotoSansKR-Bold.ttf"), str(UFONTS / "NotoSansKR-Medium.ttf")],
        "Binggrae": [str(UFONTS / "Binggrae.otf")],
        "Samanco": [str(UFONTS / "BinggraeSamanco.otf")],
        "ONE Mobile": [str(UFONTS / "ONE Mobile OTF Bold.otf")],
        "HDharmony": [str(UFONTS / "현대하모니+B.ttf"), str(UFONTS / "현대하모니+M.ttf")],
        "Myungjo": ["/System/Library/Fonts/AppleMyungjo.ttc"],
        "Gowun Batang": [str(UFONTS / "GowunBatang-Bold.ttf")],
        "Batang": ["/System/Library/Fonts/Supplemental/Batang.ttc"],
        "Montserrat": [str(UFONTS / "Montserrat-ExtraBold.ttf"), str(UFONTS / "Montserrat-Bold.ttf")],
        "Jost": [str(UFONTS / "Jost-ExtraBold.ttf"), str(UFONTS / "Jost-Bold.ttf")],
        "Inter": [str(UFONTS / "Inter-ExtraBold.ttf"), str(UFONTS / "Inter-Bold.ttf")],
        "Oswald": [str(UFONTS / "Oswald-Bold.ttf")],
        "Anton": [str(UFONTS / "Anton-Regular.ttf")],
        "Bebas Neue": [str(UFONTS / "BebasNeue-Regular.ttf")],
        "Coming Soon": _font_paths("ComingSoon-Regular.ttf"),
        "Indie Flower": _font_paths("IndieFlower-Regular.ttf"),
        "Caveat": _font_paths("Caveat-Regular.ttf"),
        "BMDOHYEON": _font_paths("BMDOHYEON.ttf"),
        "BMHANNAPro": _font_paths("BMHANNAPro.ttf"),
        "BMJUA": _font_paths("BMJUA.ttf"),
        "Cafe24 Ssurround": _font_paths("Cafe24Ssurround.ttf"),
        "Cafe24 Air": _font_paths("Cafe24SsurroundAir.ttf"),
        "GmarketSans": _font_paths("GmarketSansBold.ttf"),
        "CookieRun": _font_paths("CookieRun-Bold.ttf"),
        "Jalnan": _font_paths("Jalnan.ttf"),
        "MaruBuri": _font_paths("MaruBuri-Bold.ttf"),
        "Paperlogy": _font_paths("Paperlogy-ExtraBold.ttf"),
        "SUITE": _font_paths("SUITE-Bold.ttf"),
        "MapoBackpacking": [str(UFONTS / "MapoBackpacking.otf")],
        "MapoPeacefull": [str(UFONTS / "MapoPeacefull.otf")],
        "MapoDPP": [str(UFONTS / "MapoDPP.otf")],
        "Pretendard": [str(UFONTS / "Pretendard-ExtraBold.otf"), str(UFONTS / "Pretendard-Bold.otf")],
        "Impact": ["/System/Library/Fonts/Supplemental/Impact.ttf"],
        "Courier": ["/System/Library/Fonts/Courier.ttc"],
        "Georgia": ["/System/Library/Fonts/Supplemental/Georgia.ttf"],
        "Arial": ["/System/Library/Fonts/Supplemental/Arial.ttf"],
    }
    NO_CJK = {"Impact", "Courier", "Georgia", "Arial", "Montserrat", "Jost", "Nunito", "Inter", "Oswald", "Anton", "Bebas Neue", "Coming Soon", "Indie Flower", "Caveat"}

    match_map = [
        ("Samanco", "Samanco"), ("Binggrae", "Binggrae"),
        ("ONE Mobile", "ONE Mobile"), ("HDharmony", "HDharmony"), ("현대하모니", "HDharmony"),
        ("Gowun Batang", "Gowun Batang"), ("Batang", "Batang"),
        ("Myungjo", "Myungjo"),
        ("Apple SD", "Apple SD"), ("AppleSD", "Apple SD"),
        ("Noto Sans KR", "Noto Sans KR"), ("Noto", "Noto Sans KR"),
        ("Pretendard", "Pretendard"),
        ("BMDOHYEON", "BMDOHYEON"), ("BMHANNAPro", "BMHANNAPro"), ("BMJUA", "BMJUA"),
        ("GmarketSans", "GmarketSans"), ("Gmarket", "GmarketSans"),
        ("SUITE", "SUITE"), ("Paperlogy", "Paperlogy"),
        ("Cafe24 Ssurround Air", "Cafe24 Air"), ("Cafe24 Air", "Cafe24 Air"),
        ("Cafe24 Ssurround", "Cafe24 Ssurround"),
        ("CookieRun", "CookieRun"), ("Jalnan", "Jalnan"), ("MaruBuri", "MaruBuri"),
        ("MapoBackpacking", "MapoBackpacking"), ("MapoPeacefull", "MapoPeacefull"), ("MapoDPP", "MapoDPP"),
        ("Montserrat", "Montserrat"), ("Jost", "Jost"), ("Inter", "Inter"),
        ("Oswald", "Oswald"), ("Anton", "Anton"), ("Bebas", "Bebas Neue"),
        ("Coming Soon", "Coming Soon"), ("Indie Flower", "Indie Flower"), ("Caveat", "Caveat"),
        ("Impact", "Impact"), ("Courier", "Courier"), ("Georgia", "Georgia"), ("Arial", "Arial"),
    ]

    default_path = os.path.expanduser("~/Library/Fonts/NotoSansKR-Bold.ttf")
    for keyword, key in match_map:
        if keyword in font_family:
            if key in NO_CJK and has_cjk:
                return default_path
            for p in FONT_MAP_RESOLVE.get(key, []):
                if Path(p).exists():
                    return p
            break
    return default_path if Path(default_path).exists() else "/System/Library/Fonts/AppleSDGothicNeo.ttc"


def render_subtitle_image(text, font_size, out_path, frame_w=1080, frame_h=1920, style=None):
    """Render subtitle as transparent PNG with Pillow (fallback renderer)."""
    style = style or {}
    text = text.replace("\\n", "\n")
    has_cjk = bool(re.search(r"[\uAC00-\uD7AF\u3130-\u318F\u4E00-\u9FFF]", text))

    font_family = style.get("font", "")
    font_path = resolve_font_path(font_family, text)

    try:
        font = ImageFont.truetype(font_path, font_size)
    except Exception:
        font = ImageFont.load_default()

    def hex_to_rgba(hex_color, alpha=1.0):
        hex_color = hex_color.lstrip("#")
        if len(hex_color) == 6:
            r, g, b = int(hex_color[0:2], 16), int(hex_color[2:4], 16), int(hex_color[4:6], 16)
            return (r, g, b, int(alpha * 255))
        return (255, 255, 255, 255)

    text_color = hex_to_rgba(style.get("color", "#ffffff"))
    show_bg = style.get("bg", True)
    if isinstance(show_bg, str):
        show_bg = True
    bg_color_hex = style.get("bgColor", "#000000")
    bg_alpha = style.get("bgAlpha", 0.6)
    if not isinstance(bg_alpha, (int, float)):
        bg_alpha = 0.6
    bg_color = hex_to_rgba(bg_color_hex, bg_alpha) if show_bg else (0, 0, 0, 0)

    line_height_pct = style.get("lineHeight", 140)
    if not isinstance(line_height_pct, (int, float)):
        line_height_pct = 140
    line_spacing = int(font_size * (line_height_pct / 100 - 1))
    text_align = style.get("textAlign", "left")
    if text_align not in ("left", "center", "right"):
        text_align = "left"

    has_emoji = bool(EMOJI_RE.search(text))
    dummy = Image.new("RGBA", (1, 1))
    dd = ImageDraw.Draw(dummy)

    if has_emoji and HAS_PILMOJI:
        with Pilmoji(dummy) as pilmoji:
            tw = pilmoji.getsize(text, font=font)[0]
            th = font_size + 10
        bbox = (0, 0, tw, th)
    else:
        bbox = dd.multiline_textbbox((0, 0), text, font=font, spacing=line_spacing)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]

    pad_h = 0
    pad_v = 0
    img_w = tw + pad_h * 2
    img_h = th + pad_v * 2

    img = Image.new("RGBA", (img_w, img_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    if show_bg:
        draw.rounded_rectangle([(0, 0), (img_w - 1, img_h - 1)], radius=0, fill=bg_color)

    tx = pad_h - bbox[0]
    ty = pad_v - bbox[1]

    show_stroke = style.get("stroke", False)
    stroke_color = hex_to_rgba(style.get("strokeColor", "#000000")) if show_stroke else None
    stroke_width = max(int(style.get("strokeWidth", 2) / 2 * 2.5), 1) if show_stroke else 0

    if has_emoji and HAS_PILMOJI:
        if show_stroke:
            draw.multiline_text((tx, ty), text, font=font, fill=text_color,
                                stroke_width=stroke_width, stroke_fill=stroke_color,
                                spacing=line_spacing, align=text_align)
            with Pilmoji(img) as pilmoji:
                pilmoji.text((tx, ty), text, font=font, fill=text_color)
        else:
            with Pilmoji(img) as pilmoji:
                pilmoji.text((tx, ty), text, font=font, fill=text_color)
    else:
        if show_stroke:
            draw.multiline_text((tx, ty), text, font=font, fill=text_color,
                                stroke_width=stroke_width, stroke_fill=stroke_color,
                                spacing=line_spacing, align=text_align)
        else:
            draw.multiline_text((tx, ty), text, font=font, fill=text_color,
                                spacing=line_spacing, align=text_align)

    img.save(out_path, "PNG")
    return img_w, img_h


# ─── Subtitle generation (AI) ───

def generate_context_subs(clips, context, api_key_from_client=""):
    import urllib.request

    clip_info = []
    for i, c in enumerate(clips):
        dur = c["end"] - c["start"]
        clip_info.append(f"클립{i+1}: {c['source']} ({c['start']:.1f}~{c['end']:.1f}초, {dur:.1f}초)")

    prompt = f"""다음은 영상 편집 프로젝트의 클립 목록입니다.

사용자 설명: {context}

클립 목록:
{chr(10).join(clip_info)}

각 클립에 맞는 자막을 생성해주세요.
규칙:
- 각 클립당 정확히 1줄 자막
- 짧고 임팩트 있게 (한 문장)
- 사용자가 설명한 톤/분위기에 맞게
- {len(clips)}줄을 정확히 출력 (클립 수와 동일)
- 번호 없이 자막 텍스트만 한 줄씩 출력
- 이모지(emoji)는 절대 사용하지 마세요. 텍스트만 작성하세요.
- 자막 전체 흐름은 기승전결 구조를 따르세요

자막:"""

    client_key = api_key_from_client or ""

    # Try OpenAI
    api_key = client_key if client_key.startswith("sk-") and not client_key.startswith("sk-ant-") else os.environ.get("OPENAI_API_KEY", "")
    if api_key and not api_key.startswith("sk-ant-"):
        try:
            import urllib.request
            data = json.dumps({
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.8
            }).encode()
            req = urllib.request.Request(
                "https://api.openai.com/v1/chat/completions",
                data=data,
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read())
                text = result["choices"][0]["message"]["content"].strip()
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                while len(lines) < len(clips):
                    lines.append("")
                return lines[:len(clips)]
        except Exception as e:
            print(f"[Subs] OpenAI API failed: {e}")

    # Try Anthropic
    api_key = client_key if client_key.startswith("sk-ant-") else os.environ.get("ANTHROPIC_API_KEY", "")
    if api_key:
        try:
            import urllib.request
            data = json.dumps({
                "model": "claude-sonnet-4-20250514",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}]
            }).encode()
            req = urllib.request.Request(
                "https://api.anthropic.com/v1/messages",
                data=data,
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                }
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                result = json.loads(resp.read())
                text = result["content"][0]["text"].strip()
                lines = [l.strip() for l in text.split("\n") if l.strip()]
                while len(lines) < len(clips):
                    lines.append("")
                return lines[:len(clips)]
        except Exception as e:
            print(f"[Subs] Anthropic API failed: {e}")

    # Fallback: ollama
    try:
        import urllib.request
        data = json.dumps({"model": "llama3", "prompt": prompt, "stream": False}).encode()
        req = urllib.request.Request(
            "http://localhost:11434/api/generate",
            data=data,
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read())
            text = result.get("response", "").strip()
            lines = [l.strip() for l in text.split("\n") if l.strip()]
            while len(lines) < len(clips):
                lines.append("")
            return lines[:len(clips)]
    except Exception:
        pass

    return ["" for _ in clips]


def generate_auto_subs(clips, language, BASE):
    subs = []
    try:
        import whisper
        model = whisper.load_model("base")

        for i, clip in enumerate(clips):
            src = BASE / Path(clip["source"]).name
            tmp_wav = BASE / f"_tmp_sub_{i}.wav"
            subprocess.run(
                ["ffmpeg", "-y", "-ss", str(clip["start"]), "-t", str(clip["end"] - clip["start"]),
                 "-i", str(src), "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
                 str(tmp_wav)],
                capture_output=True,
            )
            if tmp_wav.exists():
                result = model.transcribe(str(tmp_wav), language=language)
                text = result.get("text", "").strip()
                subs.append(text)
                tmp_wav.unlink(missing_ok=True)
            else:
                subs.append("")
    except ImportError:
        print("[Analyze] Whisper not available")
        subs = [""] * len(clips)
    except Exception as e:
        print(f"[Analyze] Whisper error: {e}")
        subs = [""] * len(clips)
    return subs


# ─── Main render function ───

def run_render(data, BASE, render_status, render_lock):
    """Main render pipeline — preserved from original server.py."""
    clips = data["clips"]
    output_fps = data.get("fps", 30)
    tmp_dir = BASE / "_render_tmp"
    tmp_dir.mkdir(exist_ok=True)
    tmp_files = []

    try:
        # ─── Phase 1: Encode individual clips ───
        for i, clip in enumerate(clips):
            src = BASE / Path(clip["source"]).name
            if not src.exists():
                # Auto-resolve: try to find and symlink from known source directories
                _resolved = _auto_resolve_source(clip["source"], src)
                if not _resolved:
                    raise FileNotFoundError(f"Source not found: {src}")

            speed = clip.get("speed", 1)
            crop = clip.get("crop", {"x": 0, "y": 0, "w": 100, "h": 100})
            zoom = clip.get("zoom", {"scale": 1, "panX": 0, "panY": 0})
            clip_effects_data = clip.get("effects", [])
            start = clip["start"]
            end = clip["end"]
            dur = (end - start) / speed
            tmp_out = tmp_dir / f"clip_{i:03d}.mp4"
            tmp_files.append(tmp_out)

            is_landscape = is_video_landscape(str(src))
            filters = []

            src_cs = get_color_space(str(src))
            if src_cs == "hdr":
                filters.append("colorspace=all=bt709:iall=bt2020:fast=1")
            elif src_cs == "smpte170m":
                filters.append("colorspace=all=bt709:iall=bt601-6-625:fast=1")

            if speed != 1:
                filters.append(f"setpts={1/speed:.4f}*PTS")

            filters.append(f"fps={output_fps}")

            if is_landscape:
                speed_filter = f"setpts={1/speed:.4f}*PTS," if speed != 1 else ""
                zoom_filter = ""
                if zoom["scale"] != 1 or zoom["panX"] != 0 or zoom["panY"] != 0:
                    zw = int(W * zoom["scale"])
                    zh = int(H * zoom["scale"])
                    zx = max(0, min(zw - W, int((zw - W) / 2 - (zoom["panX"] / 100) * zw)))
                    zy = max(0, min(zh - H, int((zh - H) / 2 - (zoom["panY"] / 100) * zh)))
                    zoom_filter = f",scale={zw}:{zh},crop={W}:{H}:{zx}:{zy}"

                cs_filter = ""
                if src_cs == "hdr":
                    cs_filter = "colorspace=all=bt709:iall=bt2020:fast=1,"
                elif src_cs == "smpte170m":
                    cs_filter = "colorspace=all=bt709:iall=bt601-6-625:fast=1,"

                effect_vf, _ = build_effect_filters(clip_effects_data, dur)
                effect_suffix = ("," + ",".join(effect_vf)) if effect_vf else ""

                fc = (
                    f"{cs_filter}{speed_filter}fps={output_fps},"
                    f"scale={W}:{H}:force_original_aspect_ratio=decrease,"
                    f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:black{zoom_filter}{effect_suffix}"
                )
                cmd = [
                    "ffmpeg", "-y",
                    "-ss", f"{start:.3f}", "-t", f"{end-start:.3f}",
                    "-i", str(src),
                    "-filter_complex", fc,
                    "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p",
                    "-an", "-t", f"{dur:.3f}",
                    str(tmp_out)
                ]
                r = subprocess.run(cmd, capture_output=True, text=True)
                if r.returncode != 0:
                    raise RuntimeError(f"Clip {i+1} failed: {r.stderr[-500:]}")
                with render_lock:
                    render_status["progress"] = i + 1
                continue
            else:
                filters.append(f"scale={W}:{H}:force_original_aspect_ratio=increase")
                filters.append(f"crop={W}:{H}")

            if zoom["scale"] != 1 or zoom["panX"] != 0 or zoom["panY"] != 0:
                zw = int(W * zoom["scale"])
                zh = int(H * zoom["scale"])
                zx = max(0, min(zw - W, int((zw - W) / 2 - (zoom["panX"] / 100) * zw)))
                zy = max(0, min(zh - H, int((zh - H) / 2 - (zoom["panY"] / 100) * zh)))
                filters.append(f"scale={zw}:{zh}")
                filters.append(f"crop={W}:{H}:{zx}:{zy}")

            effect_vf, _ = build_effect_filters(clip_effects_data, dur)
            filters.extend(effect_vf)

            has_crop = crop["x"] != 0 or crop["y"] != 0 or crop["w"] != 100 or crop["h"] != 100
            if has_crop:
                cx = int(crop["x"] / 100 * W)
                cy = int(crop["y"] / 100 * H)
                cw = int(crop["w"] / 100 * W)
                ch = int(crop["h"] / 100 * H)
                pre = ",".join(filters) + "," if filters else ""
                fc = (
                    f"{pre}split[orig][bg];"
                    f"[bg]drawbox=x=0:y=0:w={W}:h={H}:c=black:t=fill[black];"
                    f"[orig]crop={cw}:{ch}:{cx}:{cy}[cropped];"
                    f"[black][cropped]overlay={cx}:{cy}"
                )
                cmd = [
                    "ffmpeg", "-y",
                    "-ss", f"{start:.3f}", "-t", f"{end-start:.3f}",
                    "-i", str(src),
                    "-filter_complex", fc,
                    "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p",
                    "-an", "-t", f"{dur:.3f}",
                    str(tmp_out)
                ]
            else:
                vf = ",".join(filters)
                cmd = [
                    "ffmpeg", "-y",
                    "-ss", f"{start:.3f}", "-t", f"{end-start:.3f}",
                    "-i", str(src),
                    "-vf", vf,
                    "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p",
                    "-an", "-t", f"{dur:.3f}",
                    str(tmp_out)
                ]

            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode != 0:
                raise RuntimeError(f"Clip {i+1} failed: {r.stderr[-500:]}")
            with render_lock:
                render_status["progress"] = i + 1

        # ─── Phase 2: Transitions & concat ───
        VALID_XFADE = {"fade", "fadeblack", "fadewhite", "wipeleft", "wiperight", "wipeup", "wipedown", "slideleft", "slideright"}
        payload_transitions = data.get("transitions", [])
        transitions = []
        for i in range(len(clips) - 1):
            t = payload_transitions[i] if i < len(payload_transitions) else {}
            tr = t.get("type", "none") if isinstance(t, dict) else "none"
            td = t.get("duration", 0.5) if isinstance(t, dict) else 0.5
            if isinstance(td, str):
                td = float(td) if td else 0.5
            if tr == "none" and i + 1 < len(clips):
                legacy_tr = clips[i + 1].get("transition", "none")
                legacy_td = clips[i + 1].get("transDur", 0.5)
                if legacy_tr and legacy_tr != "none":
                    tr = legacy_tr
                    td = float(legacy_td) if legacy_td else 0.5
            if tr not in VALID_XFADE:
                tr = "none"
            transitions.append((tr, float(td)))

        has_transitions = any(tr != "none" for tr, _ in transitions)
        merged = tmp_dir / "merged.mp4"

        # Fade in/out
        fade_in = data.get("fadeIn", {})
        fade_out = data.get("fadeOut", {})
        if fade_in.get("enabled"):
            fd = fade_in.get("duration", 1.0)
            fade_cmd = ["ffmpeg", "-y", "-i", str(tmp_files[0]),
                        "-vf", f"fade=t=in:st=0:d={fd:.3f}",
                        "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p",
                        "-an", str(tmp_dir / "clip_000_fi.mp4")]
            r = subprocess.run(fade_cmd, capture_output=True, text=True)
            if r.returncode == 0:
                shutil.move(str(tmp_dir / "clip_000_fi.mp4"), str(tmp_files[0]))
        if fade_out.get("enabled") and tmp_files:
            last = tmp_files[-1]
            last_dur = get_video_duration(str(last))
            fd = fade_out.get("duration", 1.0)
            st = max(0, last_dur - fd)
            fade_cmd = ["ffmpeg", "-y", "-i", str(last),
                        "-vf", f"fade=t=out:st={st:.3f}:d={fd:.3f}",
                        "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p",
                        "-an", str(tmp_dir / "clip_last_fo.mp4")]
            r = subprocess.run(fade_cmd, capture_output=True, text=True)
            if r.returncode == 0:
                shutil.move(str(tmp_dir / "clip_last_fo.mp4"), str(last))

        if has_transitions and len(tmp_files) > 1:
            clip_durations = []
            for i, clip in enumerate(clips):
                speed = clip.get("speed", 1)
                d = (clip["end"] - clip["start"]) / speed
                clip_durations.append(d)

            inputs = []
            for tf in tmp_files:
                inputs.extend(["-i", str(tf)])

            fc_parts = []
            accumulated_offset = clip_durations[0]
            prev_label = "[0:v]"
            all_none = True

            for i in range(1, len(tmp_files)):
                idx = i - 1
                tr, td = transitions[idx] if idx < len(transitions) else ("none", 0)
                if tr != "none" and td > 0:
                    all_none = False
                    td = min(td, clip_durations[i - 1] * 0.8, clip_durations[i] * 0.8)
                    offset = max(0, accumulated_offset - td)
                    out_label = f"[xf{i}]"
                    fc_parts.append(f"{prev_label}[{i}:v]xfade=transition={tr}:duration={td:.3f}:offset={offset:.3f}{out_label}")
                    accumulated_offset = offset + clip_durations[i]
                    prev_label = out_label
                else:
                    offset = accumulated_offset
                    out_label = f"[xf{i}]"
                    fc_parts.append(f"{prev_label}[{i}:v]concat=n=2:v=1:a=0{out_label}")
                    accumulated_offset = offset + clip_durations[i]
                    prev_label = out_label

            if all_none:
                has_transitions = False
            else:
                fc = ";".join(fc_parts)
                final_label = prev_label
                cmd = [
                    "ffmpeg", "-y", *inputs,
                    "-filter_complex", fc,
                    "-map", final_label,
                    "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p",
                    "-r", str(output_fps), "-an", str(merged)
                ]
                r = subprocess.run(cmd, capture_output=True, text=True)
                if r.returncode != 0:
                    has_transitions = False

        if not has_transitions or len(tmp_files) <= 1:
            concat_file = tmp_dir / "concat.txt"
            with open(concat_file, "w") as f:
                for tf in tmp_files:
                    f.write(f"file '{tf}'\n")
            cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file),
                   "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p",
                   "-r", str(output_fps), "-pix_fmt", "yuv420p", str(merged)]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode != 0:
                raise RuntimeError(f"Concat failed: {r.stderr[-500:]}")

        # ─── Phase 3: Global effects ───
        global_effects = data.get("globalEffects", [])
        if global_effects:
            merged_duration = get_video_duration(str(merged))
            gfx_vf, _ = build_effect_filters(global_effects, merged_duration)
            if gfx_vf:
                gfx_output = tmp_dir / "merged_gfx.mp4"
                gfx_cmd = [
                    "ffmpeg", "-y", "-i", str(merged),
                    "-vf", ",".join(gfx_vf),
                    "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p",
                    "-an", str(gfx_output)
                ]
                r = subprocess.run(gfx_cmd, capture_output=True, text=True)
                if r.returncode == 0 and gfx_output.exists():
                    shutil.move(str(gfx_output), str(merged))

        # ─── Phase 4: Global Ken Burns ───
        global_kb = data.get("globalKB", [])
        active_kb = [kb for kb in global_kb if kb.get("effect", "none") != "none"]
        if active_kb:
            kb_output = tmp_dir / "merged_kb.mp4"
            if apply_global_ken_burns(merged, kb_output, active_kb, output_fps):
                shutil.move(str(kb_output), str(merged))

        # ─── Phase 5: Subtitles ───
        subs = []
        subtitles_enabled = data.get("subtitlesEnabled", True)

        if subtitles_enabled:
            global_subs = data.get("globalSubs", [])
            if global_subs:
                for gs in global_subs:
                    text = gs.get("text", "")
                    style = gs.get("style", {"size": 16, "x": 50, "y": 80})
                    s_start = max(0, gs.get("start", 0))
                    s_end = gs.get("end", 0)
                    if text and s_end > s_start:
                        subs.append((s_start, s_end, text, style))
            else:
                t_offset = 0
                for i, clip in enumerate(clips):
                    speed = clip.get("speed", 1)
                    d = (clip["end"] - clip["start"]) / speed
                    clip_subs = clip.get("subtitles", [])
                    legacy_sub = clip.get("subtitle", "")
                    if not clip_subs and legacy_sub:
                        clip_subs = [{"text": legacy_sub, "style": None}]
                    for sub_entry in clip_subs:
                        if isinstance(sub_entry, str):
                            sub_text = sub_entry
                            sub_style = clip.get("subStyle", {"size": 16, "x": 50, "y": 80})
                        elif isinstance(sub_entry, dict):
                            sub_text = sub_entry.get("text", "")
                            sub_style = sub_entry.get("style") or clip.get("subStyle", {"size": 16, "x": 50, "y": 80})
                        else:
                            continue
                        if sub_text:
                            subs.append((t_offset, t_offset + d, sub_text, sub_style))
                    t_offset += d

        max_dur = data.get("maxDuration", 0)
        output_name = data.get("outputName", "edited_output")
        output_name = re.sub(r'[/\\:*?"<>|]', "_", output_name)
        if not output_name:
            output_name = "edited_output"
        suffix = f"_{max_dur}s" if max_dur else ""
        output = BASE / f"{output_name}{suffix}.mp4"

        if subs:
            SCALE = 2.5

            # Try Playwright renderer
            use_playwright = True
            try:
                from src.server.subtitles import render_subtitle_png
            except Exception:
                use_playwright = False

            all_overlay_inputs = []
            all_png_overlays = []

            for idx, (st, en, text, ss) in enumerate(subs):
                sx = ss.get("x", 50)
                sy = ss.get("y", 80)
                png_path = tmp_dir / f"sub_{idx:03d}.png"

                is_fullframe = False
                if use_playwright:
                    try:
                        img_w, img_h = render_subtitle_png(text, ss, str(png_path), W, H)
                        is_fullframe = (img_w == W and img_h == H)
                    except Exception:
                        font_size = int(ss.get("size", 16) * SCALE)
                        img_w, img_h = render_subtitle_image(text, font_size, str(png_path), W, H, style=ss)
                else:
                    font_size = int(ss.get("size", 16) * SCALE)
                    img_w, img_h = render_subtitle_image(text, font_size, str(png_path), W, H, style=ss)

                if is_fullframe:
                    ox, oy = 0, 0
                else:
                    ox = int(sx / 100 * W - img_w / 2)
                    oy = int(sy / 100 * H - img_h / 2)
                    ox = max(-img_w + 10, min(W - 10, ox))
                    oy = max(-img_h + 10, min(H - 10, oy))

                all_overlay_inputs.extend(["-i", str(png_path)])
                all_png_overlays.append((ox, oy, st, en))

            overlay_chain = []
            for pidx, (ox, oy, st, en) in enumerate(all_png_overlays):
                inp_idx = pidx + 1
                prev = "0:v" if pidx == 0 else f"ov{pidx}"
                out_label = f"ov{pidx + 1}"
                overlay_chain.append(
                    f"[{prev}][{inp_idx}:v]overlay={ox}:{oy}:enable='between(t,{st:.3f},{en:.3f})'[{out_label}]"
                )

            fc = ";".join(overlay_chain)
            final_label = f"ov{len(all_png_overlays)}"

            cmd = [
                "ffmpeg", "-y", "-i", str(merged),
                *all_overlay_inputs,
                "-filter_complex", fc,
                "-map", f"[{final_label}]",
                "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p",
                str(output)
            ]
            r = subprocess.run(cmd, capture_output=True, text=True)
            if r.returncode != 0:
                raise RuntimeError(f"Subtitle burn failed: {r.stderr[-500:]}")
        else:
            shutil.copy2(merged, output)

        # ─── Phase 6: BGM Audio Mix ───
        # Support both legacy single BGM and new multi-clip BGM_CLIPS
        bgm_clips = data.get("bgmClips", [])
        if not bgm_clips:
            legacy = data.get("bgm", {})
            if legacy and legacy.get("source"):
                bgm_clips = [legacy]

        if bgm_clips:
            # Get video duration
            dur_result = subprocess.run(
                ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", str(output)],
                capture_output=True, text=True
            )
            video_dur = float(dur_result.stdout.strip()) if dur_result.stdout.strip() else 30.0

            # Build per-clip audio segments, then mix all together
            audio_segments = []  # list of temp wav files with correct timing
            seg_dir = Path(str(output) + "_bgm_segs")
            seg_dir.mkdir(exist_ok=True)

            for ci, bc in enumerate(bgm_clips):
                src_name = bc.get("source", "")
                if not src_name:
                    continue
                bgm_path = BASE / Path(src_name).name
                if not bgm_path.exists():
                    _auto_resolve_source(src_name, bgm_path)
                if not bgm_path.exists():
                    continue

                vol = bc.get("volume", 100) / 100.0
                a_start = bc.get("audioStart", 0)
                tl_start = bc.get("start", 0)
                dur = bc.get("duration", 0)
                if not dur:
                    dur = video_dur - tl_start
                trim_dur = min(dur, video_dur - tl_start)
                if trim_dur <= 0:
                    continue

                seg_file = seg_dir / f"seg_{ci}.wav"
                # Extract audio segment with correct offset and volume
                seg_cmd = [
                    "ffmpeg", "-y",
                    "-ss", f"{a_start:.3f}",
                    "-i", str(bgm_path),
                    "-t", f"{trim_dur:.3f}",
                    "-af", f"volume={vol:.2f}",
                    "-ar", "44100", "-ac", "2",
                    str(seg_file)
                ]
                r = subprocess.run(seg_cmd, capture_output=True, text=True)
                if r.returncode == 0 and seg_file.exists():
                    audio_segments.append((tl_start, seg_file))

            if audio_segments:
                # Merge all segments with correct timing using amerge/amix
                bgm_tmp = Path(str(output) + ".bgm_tmp.mp4")
                cmd = ["ffmpeg", "-y", "-i", str(output)]
                filter_parts = []

                for si, (tl_start, seg_file) in enumerate(audio_segments):
                    cmd.extend(["-i", str(seg_file)])
                    inp_idx = si + 1
                    if tl_start > 0.01:
                        filter_parts.append(f"[{inp_idx}:a]adelay={int(tl_start*1000)}|{int(tl_start*1000)}[a{si}]")
                    else:
                        filter_parts.append(f"[{inp_idx}:a]acopy[a{si}]")

                mix_inputs = "".join(f"[a{si}]" for si in range(len(audio_segments)))
                filter_parts.append(f"{mix_inputs}amix=inputs={len(audio_segments)}:duration=longest:normalize=0[bgm]")
                fc = ";".join(filter_parts)

                cmd.extend([
                    "-filter_complex", fc,
                    "-map", "0:v", "-map", "[bgm]",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-shortest",
                    str(bgm_tmp)
                ])
                r = subprocess.run(cmd, capture_output=True, text=True)
                if r.returncode == 0:
                    shutil.move(str(bgm_tmp), str(output))
                    print(f"[Render] BGM mixed: {len(audio_segments)} clip(s)")
                else:
                    print(f"[Render] BGM mix failed: {r.stderr[-300:]}")
                    try:
                        bgm_tmp.unlink(missing_ok=True)
                    except Exception:
                        pass

            # Cleanup
            shutil.rmtree(seg_dir, ignore_errors=True)

        with render_lock:
            render_status.update(state="done", output=str(output))
        print(f"[Render] Done: {output}")

    except Exception as e:
        with render_lock:
            render_status.update(state="error", error=str(e))
        print(f"[Render] Error: {e}")
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


# ─── Analyze function ───

def run_analyze(files, options, BASE, analyze_status, analyze_lock):
    """Run clip analysis + subtitle generation."""
    try:
        paths = []
        for f in files:
            p = BASE / f
            if not p.exists():
                raise FileNotFoundError(f"파일 없음: {f}")
            paths.append(str(p))

        max_dur = options.get("maxDuration", 60)
        clip_min = options.get("clipMin", 1.5)
        clip_max = options.get("clipMax", 8)
        scene_threshold = options.get("sceneThreshold", 0.3)
        num_sources = len(paths)

        avg_clip_dur = (clip_min + clip_max) / 2
        total_clips_needed = int(max_dur / avg_clip_dur) + 1
        top_n = max(2, total_clips_needed // num_sources)

        if max_dur <= 15:
            clip_max = min(clip_max, 3)
        elif max_dur <= 30:
            clip_max = min(clip_max, 4)

        with analyze_lock:
            analyze_status["progress"] = f"장면 분석 중... ({num_sources}개 영상, 소스당 {top_n}클립)"

        cmd = [
            sys.executable, str(CUTTER_SCRIPT),
            "--dry-run", "-d", str(max_dur),
            "--clip-min", str(clip_min), "--clip-max", str(clip_max),
            "--scene-threshold", str(scene_threshold),
            "--top-n", str(top_n),
            *paths
        ]

        r = subprocess.run(cmd, capture_output=True, text=True, cwd=str(BASE))
        if r.returncode != 0:
            raise RuntimeError(f"분석 실패: {r.stderr[-500:]}")

        clips = []
        subs = []
        output = r.stdout.strip()
        json_start = output.find("[")
        if json_start >= 0:
            json_str = output[json_start:]
            try:
                clips = json.loads(json_str)
            except json.JSONDecodeError:
                bracket_count = 0
                for i, ch in enumerate(json_str):
                    if ch == "[":
                        bracket_count += 1
                    elif ch == "]":
                        bracket_count -= 1
                    if bracket_count == 0:
                        try:
                            clips = json.loads(json_str[:i + 1])
                        except Exception:
                            pass
                        break

        if not clips:
            for line in output.split("\n"):
                m = re.match(r'\s*\d+\.\s+\[(.+?)\]\s+([\d.]+)s?\s*~\s*([\d.]+)s?\s*\(.*?score[=:]?\s*([\d.]+)', line)
                if m:
                    clips.append({
                        "source": m.group(1).strip(),
                        "start": float(m.group(2)),
                        "end": float(m.group(3)),
                        "score": float(m.group(4)),
                        "source_idx": 0
                    })

        # Post-processing: ensure all sources represented
        source_names = [Path(p).name for p in paths]
        sources_in_clips = set(c["source"] for c in clips)
        missing = [s for s in source_names if s not in sources_in_clips]

        if missing:
            with analyze_lock:
                analyze_status["progress"] = f"누락 소스 보충 중... ({len(missing)}개)"
            for ms in missing:
                ms_path = str(BASE / ms)
                cmd2 = [
                    sys.executable, str(CUTTER_SCRIPT),
                    "--dry-run", "-d", str(clip_max * 2),
                    "--clip-min", str(clip_min), "--clip-max", str(clip_max),
                    "--top-n", "2", ms_path
                ]
                r2 = subprocess.run(cmd2, capture_output=True, text=True, cwd=str(BASE))
                out2 = r2.stdout.strip()
                js2 = out2.find("[")
                if js2 >= 0:
                    try:
                        extra = json.loads(out2[js2:])
                        clips.extend(extra[:2])
                    except Exception:
                        pass

        # Round-robin interleave
        with analyze_lock:
            analyze_status["progress"] = "클립 배치 최적화 중..."

        by_source = {}
        for c in clips:
            by_source.setdefault(c["source"], []).append(c)

        interleaved = []
        source_order = [Path(p).name for p in paths]
        source_iters = {s: iter(by_source.get(s, [])) for s in source_order}

        total_dur = 0
        rounds = 0
        while total_dur < max_dur and rounds < 20:
            added = False
            for s in source_order:
                if total_dur >= max_dur:
                    break
                try:
                    c = next(source_iters[s])
                    d = c["end"] - c["start"]
                    if total_dur + d <= max_dur + 2:
                        interleaved.append(c)
                        total_dur += d
                        added = True
                except StopIteration:
                    continue
            if not added:
                break
            rounds += 1

        clips = interleaved

        src_names = list(dict.fromkeys(c["source"] for c in clips))
        for c in clips:
            c["source_idx"] = src_names.index(c["source"]) if c["source"] in src_names else 0

        # Subtitles
        sub_mode = options.get("subtitleMode", "0")
        context = options.get("context", "")
        client_api_key = options.get("apiKey", "")

        if sub_mode == "context" and context:
            with analyze_lock:
                analyze_status["progress"] = "자막 생성 중 (AI)..."
            try:
                subs = generate_context_subs(clips, context, client_api_key)
            except Exception:
                subs = [""] * len(clips)
        elif sub_mode == "whisper":
            with analyze_lock:
                analyze_status["progress"] = "자막 생성 중 (Whisper)..."
            try:
                subs = generate_auto_subs(clips, options.get("subLang", "ko"), BASE)
            except Exception:
                subs = [""] * len(clips)
        else:
            subs = [""] * len(clips)

        with analyze_lock:
            analyze_status.update(state="done", progress="완료", result={"clips": clips, "subs": subs})

    except Exception as e:
        with analyze_lock:
            analyze_status.update(state="error", error=str(e))
        print(f"[Analyze] Error: {e}")
