import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** GET /api/analytics/events?since=ISO&limit=20000 */
export async function GET(req: Request) {
  const sb = getSupabase();

  const { searchParams } = new URL(req.url);
  const since = searchParams.get("since");
  const rawLimit = parseInt(searchParams.get("limit") ?? "20000", 10);
  const limit = Math.max(1, Math.min(isNaN(rawLimit) ? 20000 : rawLimit, 20000));

  if (!since || isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "valid ISO since required" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("analytics_events")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data });
}
