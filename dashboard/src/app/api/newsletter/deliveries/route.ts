import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const sb = getSupabase();

    const emailLogId = req.nextUrl.searchParams.get("emailLogId");
    if (!emailLogId) {
      return NextResponse.json({ error: "emailLogId required" }, { status: 400 });
    }

    const { data, error } = await sb
      .from("newsletter_deliveries")
      .select("id, recipient_email, status, error_message, provider_message_id, attempted_at, subscriber_id")
      .eq("email_log_id", emailLogId)
      .order("attempted_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deliveries: data || [] });
  } catch (error) {
    console.error("[GET /api/newsletter/deliveries]", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
