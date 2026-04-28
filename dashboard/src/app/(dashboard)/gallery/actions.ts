"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import type {
  GalleryItemStatus,
  GalleryCoverAspect,
  GalleryVisibility,
  GalleryKind,
} from "@/lib/types";

// ── status 변경 ─────────────────────────────────────────
export async function updateGalleryStatus(id: string, status: GalleryItemStatus) {
  const patch: Record<string, unknown> = { status };
  if (status === "published") patch.published_at = new Date().toISOString();

  const { error } = await getSupabase()
    .from("gallery_items")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/gallery");
  revalidatePath(`/gallery/${id}`);
}

// ── featured 토글 ───────────────────────────────────────
export async function setGalleryFeatured(
  id: string,
  is_featured: boolean,
  featured_rank?: number | null
) {
  const patch: Record<string, unknown> = {
    is_featured,
    featured_rank: is_featured ? featured_rank ?? null : null,
    featured_at: is_featured ? new Date().toISOString() : null,
  };
  const { error } = await getSupabase()
    .from("gallery_items")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/gallery");
}

// ── featured_rank inline 수정 ────────────────────────────
export async function updateGalleryRank(id: string, featured_rank: number | null) {
  const { error } = await getSupabase()
    .from("gallery_items")
    .update({ featured_rank })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/gallery");
}

// ── visibility 변경 ──────────────────────────────────────
export async function updateGalleryVisibility(id: string, visibility: GalleryVisibility) {
  const { error } = await getSupabase()
    .from("gallery_items")
    .update({ visibility })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/gallery");
}

// ── 메타 편집 (title / subtitle / summary / tags / duration / cover_aspect / kinds + SEO 메타) ─────────
export interface GalleryMetaPatch {
  title?: string;
  subtitle?: string | null;
  summary?: string | null;
  tags?: string[];
  duration_minutes?: number | null;
  cover_aspect?: GalleryCoverAspect;
  author?: string | null;
  kinds?: GalleryKind[];
  // SEO/AEO 메타 확장 (migration 20260426000000)
  is_ai_generated?: boolean;
  ai_model?: string | null;
  transcript?: string | null;
  duration_seconds?: number | null;
  cover_poster_url?: string | null;
}

export async function updateGalleryMeta(id: string, patch: GalleryMetaPatch) {
  const { error } = await getSupabase()
    .from("gallery_items")
    .update(patch)
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/gallery");
  revalidatePath(`/gallery/${id}`);
}

// ── 미디어 link 삭제 (gallery_item_media row만, media row는 보존) ─────
export async function removeGalleryMedia(linkId: string, itemId: string) {
  const { error } = await getSupabase()
    .from("gallery_item_media")
    .delete()
    .eq("id", linkId);
  if (error) throw new Error(error.message);
  revalidatePath(`/gallery/${itemId}`);
}

// ── 미디어 sort_order 일괄 변경 ─────────────────────────────
export async function reorderGalleryMedia(
  itemId: string,
  updates: { id: string; sort_order: number }[]
) {
  const sb = getSupabase();
  const results = await Promise.all(
    updates.map((u) =>
      sb
        .from("gallery_item_media")
        .update({ sort_order: u.sort_order })
        .eq("id", u.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(failed.error.message);
  revalidatePath(`/gallery/${itemId}`);
}

// ── 갤러리 아이템 자체 삭제 (gallery_item_media는 cascade) ─────
// underlying media row + storage 파일은 보존 (다른 item이 참조 가능)
export async function deleteGalleryItem(id: string) {
  const { error } = await getSupabase()
    .from("gallery_items")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/gallery");
}

// ── AWC Web 랜딩 갱신 (수동 트리거) ─────────────────────────
// 대시보드는 agentic-cms 별도 배포라 AWC Web의 revalidateTag 직접 불가 — HTTP 경유.
export async function pingAwcWebRevalidate() {
  const endpoint = process.env.AWC_WEB_REVALIDATE_URL;
  const secret = process.env.AWC_WEB_REVALIDATE_SECRET;
  if (!endpoint || !secret) {
    return { ok: false, reason: "AWC_WEB_REVALIDATE_URL or SECRET not configured" };
  }
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "x-admin-secret": secret, "content-type": "application/json" },
      body: JSON.stringify({ tag: "acms-gallery" }),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
