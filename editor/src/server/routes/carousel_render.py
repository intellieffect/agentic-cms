"""Server-side carousel rendering — PNG ZIP & PDF via Playwright."""
import io
import logging
import os
import zipfile
from urllib.parse import quote

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse
from playwright.async_api import async_playwright

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/carousels", tags=["carousel-render"])

NEXT_URL = os.environ.get("NEXT_URL", "http://localhost:3100")
SLIDE_W = 1080
SLIDE_H = 1350
# Playwright 대기 시간 (ms) — 슬라이드 렌더 완료 대기
RENDER_WAIT_MS = 2000


async def _get_carousel(carousel_id: str) -> dict:
    """캐러셀 데이터를 API에서 조회."""
    import httpx

    async with httpx.AsyncClient() as client:
        r = await client.get(f"http://localhost:8092/api/carousels/{carousel_id}")
        if r.status_code != 200:
            raise ValueError(f"캐러셀 조회 실패: {r.status_code}")
        return r.json()


@router.post("/{carousel_id}/render")
async def render_carousel_png(carousel_id: str):
    """각 슬라이드를 PNG로 캡처하여 ZIP으로 반환."""
    try:
        data = await _get_carousel(carousel_id)
        slides = data.get("slides", [])
        total = len(slides)
        if total == 0:
            return JSONResponse({"error": "슬라이드가 없습니다"}, status_code=400)
        title = data.get("title", carousel_id)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=404)

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": SLIDE_W, "height": SLIDE_H})

            buf = io.BytesIO()
            with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for i in range(total):
                    url = f"{NEXT_URL}/carousel/{carousel_id}/render?slide={i}"
                    await page.goto(url, wait_until="networkidle")
                    await page.wait_for_timeout(RENDER_WAIT_MS)

                    png_bytes = await page.screenshot(
                        type="png",
                        clip={"x": 0, "y": 0, "width": SLIDE_W, "height": SLIDE_H},
                    )
                    zf.writestr(f"slide_{i + 1:02d}.png", png_bytes)

            await browser.close()

        buf.seek(0)
        safe_title = "".join(c for c in title if c.isalnum() or c in " _-").strip() or carousel_id
        ascii_name = f"{carousel_id}_slides.zip"
        utf8_name = quote(f"{safe_title}_slides.zip")
        return StreamingResponse(
            buf,
            media_type="application/zip",
            headers={"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{utf8_name}"},
        )
    except Exception as e:
        logger.exception("render_carousel_png failed for %s", carousel_id)
        return JSONResponse({"error": f"렌더링 실패: {e}"}, status_code=500)


@router.post("/{carousel_id}/render/pdf")
async def render_carousel_pdf(carousel_id: str):
    """모든 슬라이드를 한 페이지에 렌더 → PDF로 반환."""
    try:
        data = await _get_carousel(carousel_id)
        slides = data.get("slides", [])
        total = len(slides)
        if total == 0:
            return JSONResponse({"error": "슬라이드가 없습니다"}, status_code=400)
        title = data.get("title", carousel_id)
    except ValueError as e:
        return JSONResponse({"error": str(e)}, status_code=404)

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page(viewport={"width": SLIDE_W, "height": SLIDE_H})

            url = f"{NEXT_URL}/carousel/{carousel_id}/render?slide=all"
            await page.goto(url, wait_until="networkidle")
            await page.wait_for_timeout(RENDER_WAIT_MS)

            # 각 슬라이드를 1080x1350 한 페이지로 — px → inches (96dpi)
            w_in = SLIDE_W / 96
            h_in = SLIDE_H / 96

            pdf_bytes = await page.pdf(
                width=f"{w_in}in",
                height=f"{h_in}in",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )

            await browser.close()

        safe_title = "".join(c for c in title if c.isalnum() or c in " _-").strip() or carousel_id
        ascii_name = f"{carousel_id}.pdf"
        utf8_name = quote(f"{safe_title}.pdf")
        return StreamingResponse(
            io.BytesIO(pdf_bytes),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{utf8_name}"},
        )
    except Exception as e:
        logger.exception("render_carousel_pdf failed for %s", carousel_id)
        return JSONResponse({"error": f"PDF 렌더링 실패: {e}"}, status_code=500)
