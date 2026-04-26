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
  GalleryItem,
  GalleryItemWithCover,
  GalleryItemStatus,
  GalleryKind,
  GalleryItemDetail,
  GalleryItemMediaLink,
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

  // 파생 쿼리 에러 처리:
  //   - "variant_id 컬럼이 존재하지 않음"(PG 42703) 은 #17 마이그레이션이 아직 실제 DB 에
  //     적용되지 않은 transitional 상태로 간주하고 "파생 없음"으로 관대하게 처리.
  //     (이 가드가 없으면 variants 는 있는데 FK 컬럼은 없는 배포 구간에 페이지가 깨진다)
  //   - 그 외 에러(RLS, 테이블 누락, 타임아웃 등) 는 throw 해서 원인 파악 가능하게 남긴다.
  const isColumnMissing = (err: { code?: string } | null | undefined) => err?.code === "42703";
  const safeRows = <T,>(res: { data: T[] | null; error: { code?: string; message?: string } | null }, label: string): T[] => {
    if (!res.error) return res.data ?? [];
    if (isColumnMissing(res.error)) {
      console.warn(`[getVariantsWithDerivatives] ${label}: variant_id column missing (migration pending) — treating as no derivatives.`);
      return [];
    }
    throw res.error;
  };
  const blogRows = safeRows(blogsRes, "blog_posts");
  const carouselRows = safeRows(carouselsRes, "carousels");
  const videoRows = safeRows(videosRes, "video_projects");
  const emailRows = safeRows(emailsRes, "email_logs");

  const blogByVariant = new Map<string, VariantBlogPost>();
  for (const b of blogRows as (VariantBlogPost & { variant_id: string })[]) {
    blogByVariant.set(b.variant_id, { id: b.id, title: b.title, slug: b.slug, status: b.status });
  }
  const carouselByVariant = new Map<string, VariantCarousel>();
  for (const c of carouselRows as (VariantCarousel & { variant_id: string })[]) {
    carouselByVariant.set(c.variant_id, { id: c.id, title: c.title, caption: c.caption });
  }
  const videoByVariant = new Map<string, VariantVideoProject>();
  for (const v of videoRows as (VariantVideoProject & { variant_id: string })[]) {
    videoByVariant.set(v.variant_id, { id: v.id, name: v.name, status: v.status });
  }
  const emailsByVariant = new Map<string, VariantEmailLog[]>();
  for (const e of emailRows as (VariantEmailLog & { variant_id: string })[]) {
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

// ─── Gallery (AWC Web + APP 페어링) ─────────────────────────
// 대시보드는 service_role 로 전체 조회 (RLS bypass). cover_url 은 media join 으로 채움.

interface GalleryListOptions {
  status?: GalleryItemStatus;
  kind?: GalleryKind;
  is_featured?: boolean;
}

export async function getGalleryItems(
  opts: GalleryListOptions = {}
): Promise<GalleryItemWithCover[]> {
  let q = getSupabase()
    .from("gallery_items")
    .select("*, media:cover_media_id(url, mime_type)");

  if (opts.status) q = q.eq("status", opts.status);
  // 다중 카테고리 도입 후 단일 컬럼 .eq 는 누락 위험 → kinds[] contains 매칭으로 정정.
  if (opts.kind) q = q.contains("kinds", [opts.kind]);
  if (typeof opts.is_featured === "boolean") q = q.eq("is_featured", opts.is_featured);

  const { data, error } = await q
    .order("is_featured", { ascending: false })
    .order("featured_rank", { ascending: true, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const { media, ...rest } = row;
    return {
      ...rest,
      cover_url: media?.url ?? null,
      cover_mime: media?.mime_type ?? null,
    } as GalleryItemWithCover;
  });
}

export async function getGalleryItemById(
  id: string
): Promise<GalleryItemWithCover | null> {
  const { data, error } = await getSupabase()
    .from("gallery_items")
    .select("*, media:cover_media_id(url, mime_type)")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const { media, ...rest } = data as any;
  return {
    ...rest,
    cover_url: media?.url ?? null,
    cover_mime: media?.mime_type ?? null,
  } as GalleryItemWithCover;
}

export async function getGalleryItemDetail(
  id: string
): Promise<GalleryItemDetail | null> {
  const { data, error } = await getSupabase()
    .from("gallery_items")
    .select(
      "*, cover:cover_media_id(url, mime_type), gallery_item_media(id, item_id, media_id, role, sort_order, created_at, media:media_id(url, mime_type, filename))"
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  const { cover, gallery_item_media, ...rest } = data as any;

  const media_links: GalleryItemMediaLink[] = (gallery_item_media ?? [])
    .map((row: any) => {
      const { media, ...linkRest } = row;
      return {
        ...linkRest,
        media_url: media?.url ?? null,
        media_mime: media?.mime_type ?? null,
        media_filename: media?.filename ?? null,
      } as GalleryItemMediaLink;
    })
    .sort((a: GalleryItemMediaLink, b: GalleryItemMediaLink) =>
      a.role === b.role ? a.sort_order - b.sort_order : a.role.localeCompare(b.role)
    );

  return {
    ...rest,
    cover_url: cover?.url ?? null,
    cover_mime: cover?.mime_type ?? null,
    media_links,
  };
}
