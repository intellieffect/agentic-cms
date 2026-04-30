import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

// GSC searchanalytics.query 호출이 한 요청 당 9회 (queries/pages/daily/countries
// /devices + tracked 키워드 수만큼). 사용자 토글마다 GSC quota 가 비례 증가하므로
// 5분 segment 캐시로 burst 차단. GSC 데이터는 일 단위 갱신이라 5분 stale 영향 없음.
export const revalidate = 300;

// GSC 분석 대상 site URL. NEXT_PUBLIC_GSC_SITE_URL (optional) 이 있으면 우선,
// 없으면 NEXT_PUBLIC_SITE_URL 로 fallback. 둘 다 없으면 runtime error.
const SITE_URL =
  process.env.NEXT_PUBLIC_GSC_SITE_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "";

async function getClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set");
  }
  let credentials;
  try {
    credentials = JSON.parse(raw.replace(/\n/g, '\\n'));
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON");
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  return google.searchconsole({ version: "v1", auth });
}

function formatDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!SITE_URL) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_GSC_SITE_URL or NEXT_PUBLIC_SITE_URL must be set for GSC analytics" },
      { status: 500 },
    );
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days") || "7");
  const days = [7, 30, 90].includes(daysParam) ? daysParam : 7;
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - (days - 1));

  // AWC SEO tracker 4 추적 키워드 — 일별 노출/클릭/위치 추이를 별도 응답으로 노출.
  // 추후 키워드 추가는 이 배열만 늘리면 자동 반영. dashboard 환경변수로 옮기는 건 추후.
  const TRACKED_QUERIES = ["에이전틱 워크플로우", "AX 전환", "agentic workflow", "AX 자동화"];

  try {
    const client = await getClient();

    // 추적 키워드는 GSC dimensionFilterGroups 가 OR 를 지원하지 않으므로
    // 키워드별로 equals filter + 단일 query 호출을 병렬 실행.
    const trackedQueriesPromise = Promise.all(
      TRACKED_QUERIES.map((q) =>
        client.searchanalytics.query({
          siteUrl: SITE_URL,
          requestBody: {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            dimensions: ["date"],
            dimensionFilterGroups: [
              {
                filters: [{ dimension: "query", operator: "equals", expression: q }],
              },
            ],
            rowLimit: 500,
          },
        }).then((res) => ({ query: q, rows: res.data.rows || [] })),
      ),
    );

    const [queriesRes, pagesRes, dailyRes, countriesRes, devicesRes, trackedRes] = await Promise.all([
      client.searchanalytics.query({
        siteUrl: SITE_URL,
        requestBody: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ["query"],
          rowLimit: 50,
        },
      }),
      client.searchanalytics.query({
        siteUrl: SITE_URL,
        requestBody: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ["page"],
          rowLimit: 50,
        },
      }),
      client.searchanalytics.query({
        siteUrl: SITE_URL,
        requestBody: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ["date"],
        },
      }),
      client.searchanalytics.query({
        siteUrl: SITE_URL,
        requestBody: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ["country"],
          rowLimit: 20,
        },
      }),
      client.searchanalytics.query({
        siteUrl: SITE_URL,
        requestBody: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ["device"],
          rowLimit: 10,
        },
      }),
      trackedQueriesPromise,
    ]);

    const queries = (queriesRes.data.rows || []).map((r) => ({
      query: r.keys?.[0] || "",
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    }));

    const pages = (pagesRes.data.rows || []).map((r) => ({
      page: (r.keys?.[0] || "").replace(SITE_URL, ""),
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    }));

    const daily = (dailyRes.data.rows || []).map((r) => ({
      date: r.keys?.[0] || "",
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    })).sort((a, b) => a.date.localeCompare(b.date));

    const totalClicks = daily.reduce((sum, row) => sum + row.clicks, 0);
    const totalImpressions = daily.reduce((sum, row) => sum + row.impressions, 0);
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition = totalImpressions > 0
      ? daily.reduce((sum, row) => sum + row.position * row.impressions, 0) / totalImpressions
      : 0;

    const countries = (countriesRes.data.rows || []).map((r) => ({
      country: r.keys?.[0] || "",
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    }));

    const devices = (devicesRes.data.rows || []).map((r) => ({
      device: r.keys?.[0] || "",
      clicks: r.clicks || 0,
      impressions: r.impressions || 0,
      ctr: r.ctr || 0,
      position: r.position || 0,
    }));

    // 추적 키워드: query 별 daily 시리즈로 정리.
    const tracked = trackedRes.map(({ query, rows }) => {
      const series = rows.map((r) => ({
        date: r.keys?.[0] || "",
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr || 0,
        position: r.position || 0,
      })).sort((a, b) => a.date.localeCompare(b.date));
      const totalImpressions = series.reduce((s, r) => s + r.impressions, 0);
      const totalClicks = series.reduce((s, r) => s + r.clicks, 0);
      const avgPosition = totalImpressions > 0
        ? series.reduce((s, r) => s + r.position * r.impressions, 0) / totalImpressions
        : 0;
      return {
        query,
        rows: series,
        totals: {
          clicks: totalClicks,
          impressions: totalImpressions,
          avgPosition,
          avgCtr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
        },
      };
    });

    return NextResponse.json({
      meta: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        siteUrl: SITE_URL,
        rowLimit: 50,
      },
      overview: { totalClicks, totalImpressions, avgCtr, avgPosition },
      queries,
      pages,
      daily,
      countries,
      devices,
      tracked,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
