import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// PATCH /api/newsletter/subscribers/[id] — 구독 해지 등 상태 변경
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  if (!status || !["subscribed", "unsubscribed"].includes(status)) {
    return NextResponse.json(
      { error: "유효한 status를 입력하세요. (subscribed | unsubscribed)" },
      { status: 400 }
    );
  }

  const sb = getSupabase();
  const { error } = await sb
    .from("subscribers")
    .update({ status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// DELETE /api/newsletter/subscribers/[id] — 구독자 삭제
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabase();
  const { error } = await sb.from("subscribers").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
