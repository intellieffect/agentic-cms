import { getSupabase } from "./supabase";
import type {
  Content,
  Idea,
  Publication,
  PipelineStats,
  ChannelCount,
} from "./types";

export async function getContents(): Promise<Content[]> {
  const { data, error } = await getSupabase()
    .from("contents")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getContentById(id: string): Promise<Content | null> {
  const { data, error } = await getSupabase()
    .from("contents")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

export async function getIdeas(): Promise<Idea[]> {
  const { data, error } = await getSupabase()
    .from("ideas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPublications(): Promise<Publication[]> {
  const { data, error } = await getSupabase()
    .from("publications")
    .select("*, contents(title)")
    .order("published_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPipelineStats(): Promise<PipelineStats> {
  const [ideas, contents] = await Promise.all([
    getSupabase().from("ideas").select("id", { count: "exact", head: true }),
    getSupabase().from("contents").select("id, status"),
  ]);

  const allContents = contents.data ?? [];

  return {
    ideas: ideas.count ?? 0,
    drafts: allContents.filter((c) => c.status === "draft").length,
    inReview: allContents.filter((c) => c.status === "review").length,
    published: allContents.filter((c) => c.status === "published").length,
  };
}

export async function getPublicationsByChannel(): Promise<ChannelCount[]> {
  const { data, error } = await getSupabase()
    .from("publications")
    .select("channel");
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.channel, (counts.get(row.channel) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([channel, count]) => ({
    channel,
    count,
  }));
}

export async function getRecentActivity(
  limit = 10
): Promise<Content[]> {
  const { data, error } = await getSupabase()
    .from("contents")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getQuickStats(): Promise<{
  totalContents: number;
  totalPublications: number;
  totalIdeas: number;
}> {
  const [contents, publications, ideas] = await Promise.all([
    getSupabase().from("contents").select("id", { count: "exact", head: true }),
    getSupabase().from("publications").select("id", { count: "exact", head: true }),
    getSupabase().from("ideas").select("id", { count: "exact", head: true }),
  ]);

  return {
    totalContents: contents.count ?? 0,
    totalPublications: publications.count ?? 0,
    totalIdeas: ideas.count ?? 0,
  };
}
