import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

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

  try {
    const client = await getClient();

    const [queriesRes, pagesRes, dailyRes, countriesRes, devicesRes] = await Promise.all([
      client.searchanalytics.query({
        siteUrl: SITE_URL,
        requestBody: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ["query"],
          rowLimit: 20,
        },
      }),
      client.searchanalytics.query({
        siteUrl: SITE_URL,
        requestBody: {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          dimensions: ["page"],
          rowLimit: 20,
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

    return NextResponse.json({
      meta: {
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
        siteUrl: SITE_URL,
        rowLimit: 20,
      },
      overview: { totalClicks, totalImpressions, avgCtr, avgPosition },
      queries,
      pages,
      daily,
      countries,
      devices,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
