import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase();

    const status = req.nextUrl.searchParams.get("status") || "subscribed";
    const query = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() || "";

    let subscribersQuery = sb
      .from("subscribers")
      .select("id, email, status, subscribed_at")
      .order("subscribed_at", { ascending: false });

    if (status !== "all") {
      subscribersQuery = subscribersQuery.eq("status", status);
    }

    if (query) {
      subscribersQuery = subscribersQuery.ilike("email", `%${query}%`);
    }

    const { data, error } = await subscribersQuery;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ subscribers: data || [] });
  } catch (error) {
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
