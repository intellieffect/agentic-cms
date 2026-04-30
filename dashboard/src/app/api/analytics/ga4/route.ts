import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

const PROPERTY_ID = "530816613";

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
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
  return google.analyticsdata({ version: "v1beta", auth });
}

export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get("days") || "7");
  const startDate = `${days}daysAgo`;

  try {
    const client = await getClient();

    const CUSTOM_EVENT_NAMES = [
      "newsletter_submit", "newsletter_form_view",
      "blog_article_view", "blog_share", "blog_search", "blog_category_click",
      "cta_click",
      "booking_page_view", "booking_form_submit", "booking_complete",
      "sign_up", "login",
      "page_not_found", "outbound_click",
    ];

    const [overviewRes, pagesRes, sourcesRes, dailyRes, eventsRes, ctaRes, channelsRes, organicLandingRes] = await Promise.all([
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
      // 커스텀 이벤트 카운트
      client.properties.runReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate, endDate: "today" }],
          dimensions: [{ name: "eventName" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: {
            filter: {
              fieldName: "eventName",
              inListFilter: {
                values: CUSTOM_EVENT_NAMES,
              },
            },
          },
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        },
      }),
      // CTA별 클릭 수 (커스텀 차원 등록됨)
      client.properties.runReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate, endDate: "today" }],
          dimensions: [{ name: "customEvent:cta_id" }],
          metrics: [{ name: "eventCount" }],
          dimensionFilter: {
            filter: {
              fieldName: "eventName",
              stringFilter: { value: "cta_click" },
            },
          },
          orderBys: [{ metric: { metricName: "eventCount" }, desc: true }],
        },
      }),
      // 채널별 세션·참여 — Organic Search 비중과 전환 funnel 분석용.
      client.properties.runReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate, endDate: "today" }],
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [
            { name: "sessions" },
            { name: "engagedSessions" },
            { name: "engagementRate" },
            { name: "averageSessionDuration" },
            { name: "keyEvents" },
          ],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "10",
        },
      }),
      // Organic Search 만 필터한 landing page 별 engagement — 검색 유입 콘텐츠 품질 측정.
      client.properties.runReport({
        property: `properties/${PROPERTY_ID}`,
        requestBody: {
          dateRanges: [{ startDate, endDate: "today" }],
          dimensions: [{ name: "landingPage" }],
          metrics: [
            { name: "sessions" },
            { name: "engagedSessions" },
            { name: "engagementRate" },
            { name: "averageSessionDuration" },
            { name: "keyEvents" },
          ],
          dimensionFilter: {
            filter: {
              fieldName: "sessionDefaultChannelGroup",
              stringFilter: { value: "Organic Search" },
            },
          },
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: "20",
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

    // 커스텀 이벤트 파싱
    const events = (eventsRes.data.rows || []).map((r) => ({
      eventName: r.dimensionValues?.[0]?.value || "",
      count: Number(r.metricValues?.[0]?.value || 0),
    }));

    const eventMap = new Map<string, number>(events.map((e) => [e.eventName, e.count]));
    const get = (name: string): number => eventMap.get(name) || 0;

    const newsletterFormViews = get("newsletter_form_view");
    const newsletterSubmits = get("newsletter_submit");
    const bookingPageViews = get("booking_page_view");
    const bookingSubmits = get("booking_form_submit");
    const bookingCompletes = get("booking_complete");

    const conversions = {
      newsletter: {
        formViews: newsletterFormViews,
        submits: newsletterSubmits,
        rate: newsletterFormViews > 0 ? newsletterSubmits / newsletterFormViews : 0,
      },
      booking: {
        pageViews: bookingPageViews,
        submits: bookingSubmits,
        completes: bookingCompletes,
        rate: bookingPageViews > 0 ? bookingCompletes / bookingPageViews : 0,
      },
      signups: get("sign_up"),
      logins: get("login"),
    };

    // CTA 클릭 — cta_id별 분석 (GA4 커스텀 차원 등록됨)
    const ctaClicks = (ctaRes.data.rows || []).map((r) => ({
      ctaId: r.dimensionValues?.[0]?.value || "",
      count: Number(r.metricValues?.[0]?.value || 0),
    }));

    const channels = (channelsRes.data.rows || []).map((r) => ({
      channel: r.dimensionValues?.[0]?.value || "(unknown)",
      sessions: Number(r.metricValues?.[0]?.value || 0),
      engagedSessions: Number(r.metricValues?.[1]?.value || 0),
      engagementRate: Number(r.metricValues?.[2]?.value || 0),
      avgSessionDuration: Number(r.metricValues?.[3]?.value || 0),
      keyEvents: Number(r.metricValues?.[4]?.value || 0),
    }));

    const organicLanding = (organicLandingRes.data.rows || []).map((r) => ({
      path: r.dimensionValues?.[0]?.value || "",
      sessions: Number(r.metricValues?.[0]?.value || 0),
      engagedSessions: Number(r.metricValues?.[1]?.value || 0),
      engagementRate: Number(r.metricValues?.[2]?.value || 0),
      avgSessionDuration: Number(r.metricValues?.[3]?.value || 0),
      keyEvents: Number(r.metricValues?.[4]?.value || 0),
    }));

    return NextResponse.json({ overview, pages, sources, daily, events, conversions, ctaClicks, channels, organicLanding });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
