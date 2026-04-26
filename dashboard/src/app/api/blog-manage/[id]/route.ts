import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { cleanupUploadedImages, EmbeddedImageNormalizationError, normalizeEmbeddedImagesInContent } from "@/lib/blog/normalizeEmbeddedImages";

/** GET /api/blog-manage/[id] */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sb = getSupabase();

    const { data, error } = await sb
      .from("blog_posts")
      .select(
        "*, blog_post_categories(blog_categories(id, name, slug)), blog_post_tags(blog_tags(id, name, slug))"
      )
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Post not found" },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const post = {
      ...data,
      categories: (data.blog_post_categories || [])
        .map((pc: any) => pc.blog_categories)
        .filter(Boolean),
      tags: (data.blog_post_tags || [])
        .map((pt: any) => pt.blog_tags)
        .filter(Boolean),
      blog_post_categories: undefined,
      blog_post_tags: undefined,
    };

    return NextResponse.json({ post });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/** PUT /api/blog-manage/[id] — update status */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    let body: Record<string, unknown>;
    try {
      const raw = await req.text();
      console.log(`[blog-manage PUT ${id}] body bytes: ${raw.length}`);
      body = JSON.parse(raw);
    } catch (e) {
      console.error(`[blog-manage PUT ${id}] body parse failed:`, e);
      const message = e instanceof Error ? e.message : "본문 파싱 실패";
      return NextResponse.json({ error: `본문 파싱 실패: ${message}` }, { status: 400 });
    }

    const VALID_STATUSES: ReadonlyArray<string> = ['draft', 'published', 'archived'];
    if (body.status !== undefined && (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status))) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const sb = getSupabase();
    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    let uploadedPaths: string[] = [];

    if (body.status !== undefined) update.status = body.status;
    if (body.title !== undefined) update.title = body.title;
    if (body.excerpt !== undefined) update.excerpt = body.excerpt;
    if (body.thumbnail_url !== undefined) update.thumbnail_url = body.thumbnail_url;

    if (body.content !== undefined) {
      try {
        const normalized = await normalizeEmbeddedImagesInContent(sb, id, body.content);
        update.content = normalized.content;
        uploadedPaths = normalized.uploadedPaths;
      } catch (error) {
        const pathsToCleanup = error instanceof EmbeddedImageNormalizationError ? error.uploadedPaths : uploadedPaths;
        await cleanupUploadedImages(sb, pathsToCleanup);
        const message = error instanceof Error ? error.message : "본문 이미지 처리에 실패했습니다.";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    }

    if (body.status === "published" && !body.skipPublishedAt) {
      update.published_at = new Date().toISOString();
    }

    const { error } = await sb
      .from("blog_posts")
      .update(update)
      .eq("id", id);

    if (error) {
      await cleanupUploadedImages(sb, uploadedPaths);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[blog-manage PUT] unexpected error:", e);
    const message = e instanceof Error ? e.message : "Internal server error";
    return NextResponse.json(
      {
        error: message,
        stack: process.env.NODE_ENV === "development" && e instanceof Error ? e.stack : undefined,
      },
      { status: 500 }
    );
  }
}

/** DELETE /api/blog-manage/[id] */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const sb = getSupabase();

    const { error } = await sb.from("blog_posts").delete().eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
