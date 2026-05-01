import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const revalidate = 300;

/** GET /api/blog-manage/categories — list all blog categories for filter UI */
export async function GET() {
  try {
    const sb = getSupabase();
    const { data, error } = await sb
      .from("blog_categories")
      .select("id, name, slug")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ categories: data || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
