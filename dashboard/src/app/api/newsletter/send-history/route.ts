import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase();

    const postId = req.nextUrl.searchParams.get("postId");
    if (!postId) {
      return NextResponse.json({ error: "postId required" }, { status: 400 });
    }

    const { data: sendLog } = await sb
      .from("email_logs")
      .select("sent_at, status, sent_to_count, attempted_count, failed_count")
      .eq("post_id", postId)
      .neq("status", "draft")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      lastSentAt: sendLog?.sent_at || null,
      lastStatus: sendLog?.status || null,
      sentToCount: sendLog?.sent_to_count ?? 0,
      attemptedCount: sendLog?.attempted_count ?? 0,
      failedCount: sendLog?.failed_count ?? 0,
    });
  } catch (error) {
    return NextResponse.json({
      lastSentAt: null,
      lastStatus: null,
      sentToCount: 0,
      attemptedCount: 0,
      failedCount: 0,
    });
  }
}
