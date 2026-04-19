"""Carousel reference posts API — ref_posts / ref_slides / ref_accounts."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse, RedirectResponse
from src.server.table_config import TABLE_REF_POSTS, TABLE_REF_ACCOUNTS, TABLE_REF_SLIDES

router = APIRouter(prefix="/api/ref-posts", tags=["ref-posts"])


def _get_sb():
    try:
        from src.db.supabase import get_client
        return get_client()
    except Exception:
        return None


# ---------- GET /api/ref-posts/accounts ----------

@router.get("/accounts")
async def list_accounts(platform: str = "instagram"):
    sb = _get_sb()
    if not sb:
        return {"accounts": []}
    try:
        q = sb.table(TABLE_REF_ACCOUNTS).select("*")
        if platform:
            q = q.eq("platform", platform)
        resp = q.execute()
        return JSONResponse(
            content={"accounts": resp.data or []},
            headers={"Cache-Control": "public, max-age=300"},
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- GET /api/ref-posts ----------

@router.get("")
async def list_posts(
    account_id: str | None = None,
    post_type: str = "carousel",
    layout_pattern: str | None = None,
    hook_type: str | None = None,
    cta_type: str | None = None,
    sort: str = "latest",
    limit: int = 60,
    offset: int = 0,
):
    sb = _get_sb()
    if not sb:
        return {"posts": [], "total": 0}
    try:
        q = sb.table(TABLE_REF_POSTS).select("*", count="exact")
        if post_type:
            q = q.eq("post_type", post_type)
        if account_id:
            q = q.eq("account_id", account_id)
        if layout_pattern:
            q = q.eq("layout_pattern", layout_pattern)
        if hook_type:
            q = q.eq("hook_type", hook_type)
        if cta_type:
            q = q.eq("cta_type", cta_type)

        if sort == "likes":
            q = q.order("like_count", desc=True)
        elif sort == "comments":
            q = q.order("comment_count", desc=True)
        else:
            q = q.order("post_date", desc=True)

        q = q.range(offset, offset + limit - 1)
        resp = q.execute()
        return {"posts": resp.data or [], "total": resp.count or 0}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- GET /api/ref-posts/{post_id} ----------

@router.get("/{post_id}")
async def get_post(post_id: str):
    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "no db"}, status_code=500)
    try:
        resp = sb.table(TABLE_REF_POSTS).select("*").eq("id", post_id).single().execute()
        post = resp.data
        if not post:
            return JSONResponse({"error": "not found"}, status_code=404)
        # Attach slides
        slides_resp = (
            sb.table(TABLE_REF_SLIDES)
            .select("*")
            .eq("post_id", post_id)
            .order("slide_index")
            .execute()
        )
        post["slides"] = slides_resp.data or []
        return post
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- GET /api/ref-posts/{post_id}/slides ----------

@router.get("/{post_id}/slides")
async def list_slides(post_id: str):
    sb = _get_sb()
    if not sb:
        return {"slides": []}
    try:
        resp = (
            sb.table(TABLE_REF_SLIDES)
            .select("*")
            .eq("post_id", post_id)
            .order("slide_index")
            .execute()
        )
        return {"slides": resp.data or []}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- GET /api/ref-posts/{post_id}/slides/{slide_index}/image ----------

@router.get("/{post_id}/slides/{slide_index}/image")
async def get_slide_image(post_id: str, slide_index: int):
    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "no db"}, status_code=500)
    try:
        resp = (
            sb.table(TABLE_REF_SLIDES)
            .select("media_url")
            .eq("post_id", post_id)
            .eq("slide_index", slide_index)
            .single()
            .execute()
        )
        slide = resp.data
        if not slide or not slide.get("media_url"):
            return JSONResponse({"error": "not found"}, status_code=404)

        url = slide["media_url"]
        # media_url이 이미 풀 public URL이면 바로 리다이렉트
        if url.startswith("http"):
            return RedirectResponse(url)
        # 상대 경로면 signed URL 생성
        signed = sb.storage.from_("references").create_signed_url(url, 3600)
        signed_url = signed.get("signedURL") or signed.get("signedUrl", "")
        if not signed_url:
            return JSONResponse({"error": "storage error"}, status_code=500)
        return RedirectResponse(signed_url)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)


# ---------- PATCH /api/ref-posts/{post_id} ----------

@router.patch("/{post_id}")
async def update_post(post_id: str, request: dict):
    sb = _get_sb()
    if not sb:
        return JSONResponse({"error": "no db"}, status_code=500)
    allowed = {"layout_pattern", "hook_type", "cta_type", "topic_tags", "notes", "style_tags"}
    patch = {k: v for k, v in request.items() if k in allowed}
    if not patch:
        return JSONResponse({"error": "no valid fields"}, status_code=400)
    try:
        resp = sb.table(TABLE_REF_POSTS).update(patch).eq("id", post_id).execute()
        return resp.data[0] if resp.data else {"ok": True}
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
