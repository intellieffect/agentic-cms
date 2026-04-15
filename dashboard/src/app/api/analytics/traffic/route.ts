import { NextRequest, NextResponse } from "next/server";
import { requireAnalyticsAdmin } from "@/lib/analytics/admin";
import {
  buildBreakdown,
  buildSummary,
  buildTodayTrends,
  buildTrends,
  parseTrafficApiQuery,
  resolveTrafficCompareRanges,
  resolveTrafficTodayRanges,
  TRAFFIC_TIMEZONE,
  type AnalyticsEvent,
  type TrafficCompareApiResponse,
  type TrafficTodayApiResponse,
} from "@/lib/analytics/traffic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" } as const;

export async function GET(req: NextRequest) {
  const auth = await requireAnalyticsAdmin();
  if (!auth.ok) {
    auth.response.headers.set("Cache-Control", "private, no-store");
    return auth.response;
  }

  const { sbAdmin } = auth;

  const parsed = parseTrafficApiQuery(req.nextUrl.searchParams);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const ranges =
    parsed.data.mode === "today"
      ? resolveTrafficTodayRanges()
      : resolveTrafficCompareRanges(parsed.data.preset, parsed.data.compare);

  const PAGE_SIZE = 1000;
  const events: AnalyticsEvent[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await sbAdmin
      .from("analytics_events")
      .select("session_id,event_name,url,referrer,props,created_at")
      .gte("created_at", ranges.queryStartIso)
      .lt("created_at", ranges.queryEndIso)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      return NextResponse.json(
        { error: "Failed to load analytics data" },
        { status: 500, headers: NO_STORE_HEADERS },
      );
    }
    const batch = (data ?? []) as AnalyticsEvent[];
    events.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (parsed.data.mode === "today") {
    const todayRanges = ranges as {
      current: TrafficTodayApiResponse["meta"]["current"];
      previous: TrafficTodayApiResponse["meta"]["previous"];
    };
    const payload: TrafficTodayApiResponse = {
      meta: {
        mode: "today",
        timezone: TRAFFIC_TIMEZONE,
        current: todayRanges.current,
        previous: todayRanges.previous,
      },
      summary: buildSummary(events, todayRanges.current, todayRanges.previous),
      trends: buildTodayTrends(events, todayRanges.current, todayRanges.previous),
      breakdown: buildBreakdown(events, todayRanges.current, todayRanges.previous, parsed.data.topN),
    };
    return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
  }

  const compareRanges = ranges as ReturnType<typeof resolveTrafficCompareRanges>;
  const payload: TrafficCompareApiResponse = {
    meta: {
      mode: "compare",
      timezone: TRAFFIC_TIMEZONE,
      compareMode: compareRanges.compareMode,
      current: compareRanges.current,
      previous: compareRanges.previous,
    },
    summary: buildSummary(events, compareRanges.current, compareRanges.previous),
    trends: buildTrends(events, compareRanges.current, compareRanges.previous),
    breakdown: buildBreakdown(events, compareRanges.current, compareRanges.previous, parsed.data.topN),
  };
  return NextResponse.json(payload, { headers: NO_STORE_HEADERS });
}
