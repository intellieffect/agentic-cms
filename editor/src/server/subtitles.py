"""
Playwright-based subtitle renderer.
Renders subtitles as transparent PNGs using the same CSS as the editor preview.
This ensures pixel-perfect match between preview and final output.

Copied from original subtitle_renderer.py with import path adjustments.
"""

import re
from pathlib import Path

# Fonts directory — check both possible locations
_BASE = Path(__file__).resolve().parent.parent
FONTS_DIR = _BASE / "editor" / "_fonts"
if not FONTS_DIR.exists():
    FONTS_DIR = _BASE.parent / "assets" / "fonts"

# Thread-local Playwright browser (Playwright can't switch threads)
import threading
_tls = threading.local()


def _get_browser():
    """Get thread-local headless Chromium (Playwright is not thread-safe)."""
    if not hasattr(_tls, "browser") or _tls.browser is None:
        from playwright.sync_api import sync_playwright
        _tls.playwright = sync_playwright().start()
        _tls.browser = _tls.playwright.chromium.launch(headless=True)
    return _tls.browser


def _build_font_faces():
    """Build @font-face CSS from _fonts/ directory + system fonts."""
    faces = []

    font_map = {
        "ComingSoon-Regular.ttf": "Coming Soon",
        "IndieFlower-Regular.ttf": "Indie Flower",
        "Caveat-Regular.ttf": "Caveat",
        "BMDOHYEON.ttf": "BMDOHYEON",
        "BMHANNAPro.ttf": "BMHANNAPro",
        "BMJUA.ttf": "BMJUA",
        "Cafe24Ssurround.ttf": "Cafe24 Ssurround",
        "Cafe24SsurroundAir.ttf": "Cafe24 Ssurround Air",
        "GmarketSansBold.ttf": "GmarketSans",
        "CookieRun-Bold.ttf": "CookieRun",
        "Jalnan.ttf": "Jalnan",
        "LINESeedKR-Bold.woff2": "LINESeedKR",
        "MaruBuri-Bold.ttf": "MaruBuri",
        "Paperlogy-ExtraBold.ttf": "Paperlogy",
        "SUITE-Bold.ttf": "SUITE",
    }

    for filename, family in font_map.items():
        fpath = FONTS_DIR / filename
        if fpath.exists():
            fmt = "woff2" if filename.endswith(".woff2") else "truetype"
            faces.append(
                f"@font-face{{font-family:'{family}';src:url('file://{fpath}') format('{fmt}');}}"
            )

    system_fonts = [
        ("Montserrat", "Montserrat ExtraBold"),
        ("Jost", "Jost ExtraBold"),
        ("Oswald", "Oswald Bold"),
        ("Anton", "Anton Regular"),
        ("Inter", "Inter ExtraBold"),
        ("Nunito", "Nunito ExtraBold"),
        ("Bebas Neue", "Bebas Neue Regular"),
        ("Pretendard", "Pretendard ExtraBold"),
        ("MapoBackpacking", "MapoBackpacking"),
        ("MapoPeacefull", "MapoPeacefull"),
        ("MapoDPP", "MapoDPP"),
    ]
    for family, local_name in system_fonts:
        faces.append(f"@font-face{{font-family:'{family}';src:local('{local_name}');}}")

    return "\n".join(faces)


_FONT_FACES_CSS = None


def _get_font_faces():
    global _FONT_FACES_CSS
    if _FONT_FACES_CSS is None:
        _FONT_FACES_CSS = _build_font_faces()
    return _FONT_FACES_CSS


def render_subtitle_png(text, style, out_path, frame_w=1080, frame_h=1920):
    """
    Render a subtitle as a transparent PNG using headless Chromium.

    Args:
        text: Subtitle text (supports \\n for line breaks)
        style: Dict with size, font, color, bg, bgColor, bgAlpha, stroke, strokeColor, strokeWidth,
               lineHeight, textAlign, boxWidth
        out_path: Output PNG file path
        frame_w: Output video width (for scaling)
        frame_h: Output video height (for scaling)

    Returns:
        (width, height) of the rendered PNG
    """
    style = style or {}

    PREVIEW_W = 432
    PREVIEW_H = 768
    SCALE = frame_w / PREVIEW_W

    font_size = style.get("size", 16)
    font_family = style.get("font", "'Apple SD Gothic Neo',sans-serif")
    color = style.get("color", "#ffffff")
    line_height = style.get("lineHeight", 140)
    text_align = style.get("textAlign", "left")
    box_width = style.get("boxWidth", 0)

    show_bg = style.get("bg", True)
    bg_color = style.get("bgColor", "#000000")
    bg_alpha = style.get("bgAlpha", 0.6) if show_bg else 0

    show_stroke = style.get("stroke", False)
    stroke_color = style.get("strokeColor", "#000000")
    stroke_width = style.get("strokeWidth", 2) if show_stroke else 0

    display_text = text.replace("\\n", "\n")
    html_text = (
        display_text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br>")
    )

    bc = bg_color.lstrip("#")
    if len(bc) == 6:
        br, bg, bb = int(bc[0:2], 16), int(bc[2:4], 16), int(bc[4:6], 16)
    else:
        br, bg, bb = 0, 0, 0
    bg_rgba = f"rgba({br},{bg},{bb},{bg_alpha})"

    stroke_css = ""
    if show_stroke and stroke_width > 0:
        stroke_css = f"-webkit-text-stroke: {stroke_width}px {stroke_color}; paint-order: stroke fill;"

    width_css = (
        f"width: {box_width}%; max-width: {box_width}%; word-break: break-word;"
        if box_width and box_width > 0
        else "max-width: 90%;"
    )

    pad_h = 0
    pad_v = 0
    border_radius = 0

    sx = style.get("x", 50)
    sy = style.get("y", 80)

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
{_get_font_faces()}
body {{
    margin: 0;
    padding: 0;
    background: transparent;
    width: {PREVIEW_W}px;
    height: {PREVIEW_H}px;
    position: relative;
    overflow: hidden;
}}
.sub {{
    position: absolute;
    left: {sx}%;
    top: {sy}%;
    transform: translate(-50%, -50%);
    display: inline-block;
    font-family: {font_family};
    font-size: {font_size}px;
    font-weight: 700;
    color: {color};
    line-height: {line_height}%;
    text-align: {text_align};
    letter-spacing: 0.5px;
    padding: {pad_v}px {pad_h}px;
    border-radius: {border_radius}px;
    background: {bg_rgba};
    white-space: pre-line;
    word-break: keep-all;
    max-width: 90%;
    {width_css}
    {stroke_css}
}}
</style>
</head>
<body>
<span class="sub">{html_text}</span>
</body>
</html>"""

    browser = _get_browser()
    page = browser.new_page(
        viewport={"width": PREVIEW_W, "height": PREVIEW_H},
        device_scale_factor=SCALE,
    )

    page.set_content(html, wait_until="load")
    page.evaluate("() => document.fonts.ready")
    page.screenshot(path=out_path, omit_background=True, full_page=False)
    page.close()

    return frame_w, frame_h


def cleanup():
    """Cleanup thread-local browser on shutdown."""
    if hasattr(_tls, "browser") and _tls.browser:
        _tls.browser.close()
        _tls.browser = None
    if hasattr(_tls, "playwright") and _tls.playwright:
        _tls.playwright.stop()
        _tls.playwright = None
