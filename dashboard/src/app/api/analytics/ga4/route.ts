import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const PROPERTY_ID = "530816613";

async function getClient() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set");
  }
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY.replace(/\n/g, '\\n')),
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
  return google.analyticsdata({ version: "v1beta", auth });
}

export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days") || "7");
  const startDate = `${days}daysAgo`;

  try {
    const client = await getClient();

    const [overviewRes, pagesRes, sourcesRes, dailyRes] = await Promise.all([
      client.properties.runReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate, endDate: "today" }],
          metrics: [
            { name: "screenPageViews" },
            { name: "totalUsers" },
            { name: "sessions" },
            { name: "averageSessionDuration" },
            { name: "bounceRate" },
          ],
        },
      }),
      client.properties.runReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate, endDate: "today" }],
          dimensions: [{ name: "pagePath" }],
          metrics: [
            { name: "screenPageViews" },
            { name: "totalUsers" },
            { name: "averageSessionDuration" },
          ],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: "20",
        },
      }),
      client.properties.runReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate, endDate: "today" }],
          dimensions: [{ name: "sessionSource" }],
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "bounceRate" },
          ],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "10",
        },
      }),
      client.properties.runReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate, endDate: "today" }],
          dimensions: [{ name: "date" }],
          metrics: [
            { name: "screenPageViews" },
            { name: "totalUsers" },
          ],
          orderBys: [{ dimension: { dimensionName: "date" } }],
        },
      }),
    ]);

    const ov = overviewRes.data.rows?.[0]?.metricValues || [];
    const overview = {
      pageViews: Number(ov[0]?.value || 0),
      users: Number(ov[1]?.value || 0),
      sessions: Number(ov[2]?.value || 0),
      avgSessionDuration: Number(ov[3]?.value || 0),
      bounceRate: Number(ov[4]?.value || 0),
    };

    const pages = (pagesRes.data.rows || []).map((r) => ({
      path: r.dimensionValues?.[0]?.value || "",
      pageViews: Number(r.metricValues?.[0]?.value || 0),
      users: Number(r.metricValues?.[1]?.value || 0),
      avgDuration: Number(r.metricValues?.[2]?.value || 0),
    }));

    const sources = (sourcesRes.data.rows || []).map((r) => ({
      source: r.dimensionValues?.[0]?.value || "",
      sessions: Number(r.metricValues?.[0]?.value || 0),
      users: Number(r.metricValues?.[1]?.value || 0),
      bounceRate: Number(r.metricValues?.[2]?.value || 0),
    }));

    const daily = (dailyRes.data.rows || []).map((r) => {
      const raw = r.dimensionValues?.[0]?.value || "";
      const date = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
      return {
        date,
        pv: Number(r.metricValues?.[0]?.value || 0),
        uv: Number(r.metricValues?.[1]?.value || 0),
      };
    });

    return NextResponse.json({ overview, pages, sources, daily });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
