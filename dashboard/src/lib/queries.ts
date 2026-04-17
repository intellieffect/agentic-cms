import { getSupabase } from "./supabase";
import type {
  Content,
  Idea,
  Publication,
  Topic,
  Variant,
  VariantBlogPost,
  VariantCarousel,
  VariantVideoProject,
  VariantEmailLog,
  VariantWithDerivatives,
  PipelineStats,
  ChannelCount,
  ActivityLog,
  ActivityAction,
  ActorType,
  Revision,
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

export async function getTopics(): Promise<Topic[]> {
  const { data, error } = await getSupabase()
    .from("topics")
    .select("*")
    .order("sort_order", { ascending: true });
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

export async function getVariants(contentId: string): Promise<Variant[]> {
  const { data, error } = await getSupabase()
    .from("variants")
    .select("*")
    .eq("content_id", contentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Content 에 연결된 variants + 각 variant 의 format 별 파생 레코드.
// PostgREST nested select 대신 별도 쿼리 + 클라이언트 조인을 쓰는 이유:
//   variant_id FK 를 최근 (#17) 추가했을 때 PostgREST schema cache 가 즉시
//   반영되지 않아 nested select 가 PGRST200 으로 실패하는 경우가 있었음.
//   테이블별 IN 쿼리는 언제나 안전.
export async function getVariantsWithDerivatives(
  contentId: string
): Promise<VariantWithDerivatives[]> {
  const sb = getSupabase();
  const { data: variants, error } = await sb
    .from("variants")
    .select("*")
    .eq("content_id", contentId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const variantList = (variants ?? []) as Variant[];
  if (variantList.length === 0) return [];

  const variantIds = variantList.map((v) => v.id);

  const [blogsRes, carouselsRes, videosRes, emailsRes] = await Promise.all([
    sb.from("blog_posts").select("id, title, slug, status, variant_id").in("variant_id", variantIds),
    sb.from("carousels").select("id, title, caption, variant_id").in("variant_id", variantIds),
    sb.from("video_projects").select("id, name, status, variant_id").in("variant_id", variantIds),
    sb.from("email_logs").select("id, subject, status, sent_at, sent_to_count, variant_id").in("variant_id", variantIds),
  ]);

  const blogByVariant = new Map<string, VariantBlogPost>();
  for (const b of (blogsRes.data ?? []) as (VariantBlogPost & { variant_id: string })[]) {
    blogByVariant.set(b.variant_id, { id: b.id, title: b.title, slug: b.slug, status: b.status });
  }
  const carouselByVariant = new Map<string, VariantCarousel>();
  for (const c of (carouselsRes.data ?? []) as (VariantCarousel & { variant_id: string })[]) {
    carouselByVariant.set(c.variant_id, { id: c.id, title: c.title, caption: c.caption });
  }
  const videoByVariant = new Map<string, VariantVideoProject>();
  for (const v of (videosRes.data ?? []) as (VariantVideoProject & { variant_id: string })[]) {
    videoByVariant.set(v.variant_id, { id: v.id, name: v.name, status: v.status });
  }
  const emailsByVariant = new Map<string, VariantEmailLog[]>();
  for (const e of (emailsRes.data ?? []) as (VariantEmailLog & { variant_id: string })[]) {
    const arr = emailsByVariant.get(e.variant_id) ?? [];
    arr.push({ id: e.id, subject: e.subject, status: e.status, sent_at: e.sent_at, sent_to_count: e.sent_to_count });
    emailsByVariant.set(e.variant_id, arr);
  }

  return variantList.map((v) => ({
    ...v,
    blog_post: blogByVariant.get(v.id) ?? null,
    carousel: carouselByVariant.get(v.id) ?? null,
    video_project: videoByVariant.get(v.id) ?? null,
    emails: emailsByVariant.get(v.id) ?? [],
  }));
}

export async function getAllVariants(): Promise<Variant[]> {
  const { data, error } = await getSupabase()
    .from("variants")
    .select("*, contents(title)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getPipelineStats(): Promise<PipelineStats> {
  const [topics, ideas, variants, contents] = await Promise.all([
    getSupabase().from("topics").select("id", { count: "exact", head: true }),
    getSupabase().from("ideas").select("id", { count: "exact", head: true }),
    getSupabase().from("variants").select("id", { count: "exact", head: true }),
    getSupabase().from("contents").select("id, status"),
  ]);

  const allContents = contents.data ?? [];

  return {
    topics: topics.count ?? 0,
    ideas: ideas.count ?? 0,
    variants: variants.count ?? 0,
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

// ─── Phase 2: Activity Logs ────────────────────────────────

export async function getActivityLogs(opts?: {
  action?: ActivityAction;
  actor_type?: ActorType;
  limit?: number;
}): Promise<ActivityLog[]> {
  let query = getSupabase().from("activity_logs").select("*");

  if (opts?.action) {
    query = query.eq("action", opts.action);
  }
  if (opts?.actor_type) {
    query = query.eq("actor_type", opts.actor_type);
  }

  const limit = opts?.limit ?? 50;
  query = query.order("timestamp", { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ActivityLog[];
}

// ─── Phase 2: Revisions ────────────────────────────────────

export async function getRevisions(contentId: string): Promise<Revision[]> {
  const { data, error } = await getSupabase()
    .from("revisions")
    .select("*")
    .eq("content_id", contentId)
    .order("version_number", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Revision[];
}
