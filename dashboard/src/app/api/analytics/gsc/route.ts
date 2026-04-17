import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const SITE_URL = "https://agenticworkflows.club";

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
  const days = Number(req.nextUrl.searchParams.get("days") || "7");
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

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
    }));

    const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
    const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
    const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
    const avgPosition =
      queries.length > 0
        ? queries.reduce((s, q) => s + q.position, 0) / queries.length
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
