import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { GALLERY_IMAGE_MAX, GALLERY_VIDEO_MAX } from "@/lib/gallery-constants";

const BUCKET = "content-media";

type Mode = "new" | "attach" | "replace_cover";
type Role = "cover" | "gallery" | "detail" | "hero_video";

const ALLOWED_KINDS = new Set([
  "landing",
  "video",
  "ad",
  "image",
  "carousel",
  "case_study",
  "ai_influencer",
  "other",
]);
const ALLOWED_ASPECTS = new Set(["1:1", "16:9", "9:16", "4:5", "3:4"]);
const ALLOWED_ROLES = new Set<Role>(["cover", "gallery", "detail", "hero_video"]);

function safeName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function publicUrlFor(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

export async function POST(req: Request) {
  let storageCleanup: string | null = null;
  let mediaCleanup: string | null = null;

  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    const mode = (fd.get("mode") as Mode | null) ?? "new";

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    if (!["new", "attach", "replace_cover"].includes(mode)) {
      return NextResponse.json({ error: `invalid mode: ${mode}` }, { status: 400 });
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: "이미지 또는 비디오 파일만 업로드 가능합니다." },
        { status: 400 }
      );
    }
    const sizeCap = isImage ? GALLERY_IMAGE_MAX : GALLERY_VIDEO_MAX;
    if (file.size > sizeCap) {
      return NextResponse.json(
        { error: `파일이 너무 큽니다. (max ${(sizeCap / 1024 / 1024).toFixed(0)}MB)` },
        { status: 400 }
      );
    }

    const sb = getSupabase();

    // ── mode별 사전 파라미터 검증 ──
    let itemId: string | null = null;
    let slugForPath: string;
    let role: Role;

    if (mode === "new") {
      const slug = (fd.get("slug") as string | null)?.trim();
      const title = (fd.get("title") as string | null)?.trim();
      const kindsRaw =
        (fd.get("kinds") as string | null) ?? (fd.get("kind") as string | null) ?? "image";
      const kinds = kindsRaw
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

      if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return NextResponse.json(
          { error: "invalid slug (lowercase kebab-case only, no slashes / dots / traversal)" },
          { status: 400 }
        );
      }
      if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
      if (kinds.length === 0) {
        return NextResponse.json({ error: "kinds required (at least one)" }, { status: 400 });
      }
      const invalidKind = kinds.find((k) => !ALLOWED_KINDS.has(k));
      if (invalidKind) {
        return NextResponse.json({ error: `invalid kind: ${invalidKind}` }, { status: 400 });
      }
      slugForPath = slug;
      role = "cover";

      // slug 중복 사전 체크
      const { data: dup } = await sb
        .from("gallery_items")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (dup?.id) {
        return NextResponse.json(
          { error: `slug already exists: ${slug}` },
          { status: 409 }
        );
      }
    } else {
      itemId = (fd.get("item_id") as string | null)?.trim() ?? null;
      if (!itemId) {
        return NextResponse.json({ error: "item_id required" }, { status: 400 });
      }
      const { data: item } = await sb
        .from("gallery_items")
        .select("id, slug, cover_media_id")
        .eq("id", itemId)
        .maybeSingle();
      if (!item) {
        return NextResponse.json({ error: "item not found" }, { status: 404 });
      }
      slugForPath = item.slug;

      if (mode === "replace_cover") {
        role = "cover";
      } else {
        const requested = (fd.get("role") as Role | null) ?? "gallery";
        if (!ALLOWED_ROLES.has(requested)) {
          return NextResponse.json({ error: `invalid role: ${requested}` }, { status: 400 });
        }
        role = requested;
      }
    }

    // ── Storage 업로드 ──
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const stem = safeName(file.name.replace(/\.[^.]+$/, "")) || "file";
    const storagePath = `gallery/${slugForPath}/${Date.now()}-${stem}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadErr } = await sb.storage
      .from(BUCKET)
      .upload(storagePath, buffer, {
        cacheControl: "3600",
        contentType: file.type,
        upsert: false,
      });
    if (uploadErr) {
      return NextResponse.json(
        { error: `storage: ${uploadErr.message}` },
        { status: 500 }
      );
    }
    storageCleanup = storagePath;

    // ── media row insert ──
    const url = publicUrlFor(storagePath);
    const { data: mediaRow, error: mediaErr } = await sb
      .from("media")
      .insert({
        filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        url,
        storage_path: storagePath,
        alt_text: (fd.get("alt_text") as string | null) ?? null,
        caption: (fd.get("caption") as string | null) ?? null,
        created_by: "dashboard:gallery-upload",
      })
      .select("id")
      .single();
    if (mediaErr) {
      throw new Error(`media insert: ${mediaErr.message}`);
    }
    mediaCleanup = mediaRow.id;
    const mediaId = mediaRow.id;

    // ── mode 분기 처리 ──
    if (mode === "new") {
      const slug = fd.get("slug") as string;
      const title = fd.get("title") as string;
      const kindsRaw =
        (fd.get("kinds") as string | null) ?? (fd.get("kind") as string | null) ?? "image";
      const kinds = kindsRaw
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      const subtitle = (fd.get("subtitle") as string | null) || null;
      const summary = (fd.get("summary") as string | null) || null;
      const author = (fd.get("author") as string | null) || null;
      const cover_aspect = (fd.get("cover_aspect") as string | null) ?? "16:9";
      const status = (fd.get("status") as string | null) ?? "draft";
      const visibility = (fd.get("visibility") as string | null) ?? "public";
      const durationStr = fd.get("duration_minutes") as string | null;
      const duration_minutes = durationStr ? Number.parseInt(durationStr, 10) : null;
      const tagsStr = fd.get("tags") as string | null;
      const tags = tagsStr
        ? tagsStr
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      if (!ALLOWED_ASPECTS.has(cover_aspect)) {
        throw new Error(`invalid cover_aspect: ${cover_aspect}`);
      }

      const { data: itemRow, error: itemErr } = await sb
        .from("gallery_items")
        .insert({
          slug,
          title,
          subtitle,
          summary,
          kinds,
          cover_media_id: mediaId,
          cover_aspect,
          status,
          visibility,
          tags,
          author,
          duration_minutes,
          brand: "awc",
          source_label: "Agentic CMS",
          published_at: status === "published" ? new Date().toISOString() : null,
        })
        .select("id, slug")
        .single();
      if (itemErr) throw new Error(`gallery_items insert: ${itemErr.message}`);

      // gallery_item_media link (role=cover)
      const { error: linkErr } = await sb.from("gallery_item_media").insert({
        item_id: itemRow.id,
        media_id: mediaId,
        role: "cover",
        sort_order: 0,
      });
      if (linkErr) throw new Error(`gallery_item_media insert: ${linkErr.message}`);

      revalidatePath("/gallery");
      return NextResponse.json({
        ok: true,
        mode,
        item_id: itemRow.id,
        slug: itemRow.slug,
        media_id: mediaId,
        url,
      });
    }

    if (mode === "replace_cover") {
      // 이전 cover link 삭제 (있으면)
      await sb
        .from("gallery_item_media")
        .delete()
        .eq("item_id", itemId!)
        .eq("role", "cover");

      // 신규 link + cover_media_id 갱신
      const { error: linkErr } = await sb.from("gallery_item_media").insert({
        item_id: itemId,
        media_id: mediaId,
        role: "cover",
        sort_order: 0,
      });
      if (linkErr) throw new Error(`gallery_item_media insert: ${linkErr.message}`);

      const { error: updErr } = await sb
        .from("gallery_items")
        .update({ cover_media_id: mediaId })
        .eq("id", itemId!);
      if (updErr) throw new Error(`gallery_items update cover: ${updErr.message}`);

      revalidatePath("/gallery");
      revalidatePath(`/gallery/${itemId}`);
      return NextResponse.json({ ok: true, mode, item_id: itemId, media_id: mediaId, url });
    }

    // mode === "attach"
    // 다음 sort_order 계산 (같은 role 안에서 max + 1, 없으면 0)
    const { data: maxRow } = await sb
      .from("gallery_item_media")
      .select("sort_order")
      .eq("item_id", itemId!)
      .eq("role", role)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSort = (maxRow?.sort_order ?? -1) + 1;

    const { error: linkErr } = await sb.from("gallery_item_media").insert({
      item_id: itemId,
      media_id: mediaId,
      role,
      sort_order: nextSort,
    });
    if (linkErr) throw new Error(`gallery_item_media insert: ${linkErr.message}`);

    revalidatePath(`/gallery/${itemId}`);
    return NextResponse.json({
      ok: true,
      mode,
      item_id: itemId,
      media_id: mediaId,
      role,
      sort_order: nextSort,
      url,
    });
  } catch (e) {
    const sb = getSupabase();
    await Promise.all([
      mediaCleanup ? sb.from("media").delete().eq("id", mediaCleanup) : null,
      storageCleanup ? sb.storage.from(BUCKET).remove([storageCleanup]) : null,
    ]);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
