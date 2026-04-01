"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";

export interface ContentUpdatePayload {
  title?: string;
  body_md?: string;
  hook?: string;
  core_message?: string;
  cta?: string;
  category?: string;
  funnel_stage?: string;
  tags?: string[];
  status?: "draft" | "review" | "published";
}

export async function updateContent(id: string, payload: ContentUpdatePayload) {
  const supabase = getSupabase();

  // Fetch current version for diff
  const { data: current } = await supabase
    .from("contents")
    .select("*")
    .eq("id", id)
    .single();

  if (!current) throw new Error("Content not found");

  // Build delta (only changed fields)
  const delta: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (current[key] !== value) {
      delta[key] = { from: current[key], to: value };
    }
  }

  // Nothing changed
  if (Object.keys(delta).length === 0) {
    return { success: true, changed: false };
  }

  // Update content
  const { error: updateError } = await supabase
    .from("contents")
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateError) throw updateError;

  // Get latest version number
  const { data: latestRev } = await supabase
    .from("revisions")
    .select("version_number")
    .eq("content_id", id)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();

  const nextVersion = (latestRev?.version_number ?? 0) + 1;

  // Create revision with actor_type=human
  await supabase.from("revisions").insert({
    content_id: id,
    version_number: nextVersion,
    data: { ...current, ...payload },
    delta,
    created_by: "Human Editor",
    actor_type: "human",
  });

  // Log activity
  await supabase.from("activity_logs").insert({
    action: "update",
    collection: "contents",
    item_id: id,
    actor: "Human Editor",
    actor_type: "human",
    payload: { delta, status: payload.status },
  });

  revalidatePath(`/contents/${id}`);
  revalidatePath("/contents");
  revalidatePath("/");

  return { success: true, changed: true };
}

export async function publishContent(id: string) {
  return updateContent(id, { status: "published" });
}

export async function unpublishContent(id: string) {
  return updateContent(id, { status: "draft" });
}
