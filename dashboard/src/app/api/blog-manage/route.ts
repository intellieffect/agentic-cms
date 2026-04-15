import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** GET /api/blog-manage?status=draft&sort=created_at&order=desc */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const validSorts = ["created_at", "updated_at", "published_at", "title"];
    const rawSort = searchParams.get("sort") || "created_at";
    const sort = validSorts.includes(rawSort) ? rawSort : "created_at";
    const order = searchParams.get("order") || "desc";

    const sb = getSupabase();

    let query = sb
      .from("blog_posts")
      .select(
        "id, title, slug, status, excerpt, view_count, reading_time, created_at, updated_at, published_at, blog_post_categories(blog_categories(id, name, slug))"
      )
      .order(sort, { ascending: order === "asc" });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rawPosts = data || [];
    const postIds = rawPosts.map((post: any) => post.id).filter(Boolean);

    let newsletterByPostId = new Map<string, {
      status: string;
      sent_at: string | null;
      sent_to_count: number;
      attempted_count: number;
      failed_count: number;
    }>();

    if (postIds.length > 0) {
      const { data: newsletterLogs, error: newsletterError } = await sb
        .from("email_logs")
        .select("post_id, status, sent_at, sent_to_count, attempted_count, failed_count, created_at")
        .in("post_id", postIds)
        .neq("status", "draft")
        .order("created_at", { ascending: false });

      if (newsletterError) {
        // newsletter summary fetch failed, continue without it
      } else {
        newsletterByPostId = new Map(
          (newsletterLogs || [])
            .filter((log) => log.post_id)
            .filter((log, index, list) => list.findIndex((item) => item.post_id === log.post_id) === index)
            .map((log) => [
              log.post_id as string,
              {
                status: log.status,
                sent_at: log.sent_at,
                sent_to_count: log.sent_to_count ?? 0,
                attempted_count: log.attempted_count ?? 0,
                failed_count: log.failed_count ?? 0,
              },
            ])
        );
      }
    }

    const posts = rawPosts.map((post: any) => {
      const newsletter = newsletterByPostId.get(post.id) || null;
      return {
        ...post,
        categories: (post.blog_post_categories || [])
          .map((pc: any) => pc.blog_categories)
          .filter(Boolean),
        newsletter_status: newsletter?.status ?? null,
        newsletter_last_sent_at: newsletter?.sent_at ?? null,
        newsletter_sent_to_count: newsletter?.sent_to_count ?? 0,
        newsletter_attempted_count: newsletter?.attempted_count ?? 0,
        newsletter_failed_count: newsletter?.failed_count ?? 0,
        blog_post_categories: undefined,
      };
    });

    return NextResponse.json({ posts, total: posts.length });
  } catch (error: unknown) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
