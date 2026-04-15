import { z } from "zod";

export const TRAFFIC_TIMEZONE = "Asia/Seoul";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type CompareMode = "previous" | "none";
export type TrafficMode = "compare" | "today";
export type TrafficPreset = "7d" | "30d" | "90d" | "this_month" | "last_month";

export interface AnalyticsEvent {
  session_id: string;
  event_name: string;
  url: string;
  referrer: string | null;
  props: Record<string, unknown> | null;
  created_at: string;
}

export interface DateRange {
  start: string;
  end: string;
  label: string;
  days: number;
}

export interface MetricComparison {
  current: number;
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
}

export interface RateComparison {
  current: number;
  previous: number | null;
  delta: number | null;
  deltaPct: number | null;
}

export interface CompareTrendPoint {
  key: string;
  currentLabel: string;
  previousLabel: string | null;
  sessionsCurrent: number;
  sessionsPrevious: number | null;
  conversionsCurrent: number;
  conversionsPrevious: number | null;
  conversionRateCurrent: number;
  conversionRatePrevious: number | null;
}

export interface TodayTrendPoint {
  key: string;
  label: string;
  cumulativeSessionsCurrent: number;
  cumulativeSessionsPrevious: number;
  cumulativeConversionsCurrent: number;
  cumulativeConversionsPrevious: number;
}

export interface PageBreakdownRow {
  key: string;
  title: string;
  url: string;
  sessionsCurrent: number;
  sessionsPrevious: number | null;
  sessionsDelta: number | null;
  conversionsCurrent: number;
  conversionsPrevious: number | null;
  conversionsDelta: number | null;
  conversionRateCurrent: number;
  conversionRatePrevious: number | null;
}

export interface ChannelBreakdownRow {
  channel: string;
  sessionsCurrent: number;
  sessionsPrevious: number | null;
  sessionsDelta: number | null;
  conversionsCurrent: number;
  conversionsPrevious: number | null;
  conversionRateCurrent: number;
  conversionRatePrevious: number | null;
}

export interface TrafficSource {
  channel: string;
  sourceDomain: string | null;
  sourceLabel: string;
  sourceKey: string;
}

export interface SourceBreakdownRow {
  sourceKey: string;
  channel: string;
  sourceDomain: string | null;
  sourceLabel: string;
  sessionsCurrent: number;
  sessionsPrevious: number | null;
  sessionsDelta: number | null;
  conversionsCurrent: number;
  conversionsPrevious: number | null;
  conversionsDelta: number | null;
  conversionRateCurrent: number;
  conversionRatePrevious: number | null;
}

export interface TrafficSummary {
  sessions: MetricComparison;
  visitors: MetricComparison;
  conversions: MetricComparison;
  conversionSessions: MetricComparison;
  conversionRate: RateComparison;
  readRate: RateComparison;
  pagesPerSession: MetricComparison;
}

export interface TrafficBreakdown {
  pages: PageBreakdownRow[];
  channels: ChannelBreakdownRow[];
  sources: SourceBreakdownRow[];
}

export interface TrafficCompareApiResponse {
  meta: {
    mode: "compare";
    timezone: typeof TRAFFIC_TIMEZONE;
    compareMode: CompareMode;
    current: DateRange;
    previous: DateRange | null;
  };
  summary: TrafficSummary;
  trends: CompareTrendPoint[];
  breakdown: TrafficBreakdown;
}

export interface TrafficTodayApiResponse {
  meta: {
    mode: "today";
    timezone: typeof TRAFFIC_TIMEZONE;
    current: DateRange;
    previous: DateRange;
  };
  summary: TrafficSummary;
  trends: TodayTrendPoint[];
  breakdown: TrafficBreakdown;
}

export type TrafficApiResponse = TrafficCompareApiResponse | TrafficTodayApiResponse;

export interface ResolvedTrafficCompareRanges {
  mode: "compare";
  compareMode: CompareMode;
  current: DateRange;
  previous: DateRange | null;
  queryStartIso: string;
  queryEndIso: string;
}

export interface ResolvedTrafficTodayRanges {
  mode: "today";
  current: DateRange;
  previous: DateRange;
  queryStartIso: string;
  queryEndIso: string;
}

interface WindowMetrics {
  sessions: number;
  visitors: number;
  conversions: number;
  conversionSessions: number;
  readSessions: number;
  pageViews: number;
}

interface SourceRule {
  hosts: string[];
  channel: string;
  sourceLabel: string;
  sourceKey: string;
}

const modeSchema = z.enum(["compare", "today"]);
const presetSchema = z.enum(["7d", "30d", "90d", "this_month", "last_month"]);
const compareSchema = z.enum(["previous", "none"]);
const topNSchema = z.coerce.number().int().min(1).max(25).default(10);

const compareQuerySchema = z.object({
  mode: z.literal("compare").default("compare"),
  preset: presetSchema.default("7d"),
  compare: compareSchema.default("previous"),
  topN: topNSchema,
});

const DIRECT_TRAFFIC_SOURCE: TrafficSource = { channel: "직접", sourceDomain: null, sourceLabel: "Direct", sourceKey: "direct" };
const UNKNOWN_REFERRER_TRAFFIC_SOURCE: TrafficSource = { channel: "레퍼럴", sourceDomain: null, sourceLabel: "unknown-referrer", sourceKey: "unknown-referrer" };
const SELF_REFERRER_ALLOWLIST = [
  "agenticworkflows.club",
  "studio.agenticworkflows.club",
  "brxce.ai",
  "studio.brxce.ai",
  "localhost",
  "127.0.0.1",
];
const SOURCE_RULES: SourceRule[] = [
  { hosts: ["threads.net", "threads.com"], channel: "SNS", sourceLabel: "Threads", sourceKey: "threads" },
  { hosts: ["t.co", "x.com", "twitter.com"], channel: "SNS", sourceLabel: "X", sourceKey: "x" },
  { hosts: ["linkedin.com"], channel: "SNS", sourceLabel: "LinkedIn", sourceKey: "linkedin" },
  { hosts: ["facebook.com", "m.facebook.com", "lm.facebook.com"], channel: "SNS", sourceLabel: "Facebook", sourceKey: "facebook" },
  { hosts: ["instagram.com", "l.instagram.com"], channel: "SNS", sourceLabel: "Instagram", sourceKey: "instagram" },
  { hosts: ["google.com", "google.co.kr", "news.google.com"], channel: "검색", sourceLabel: "Google", sourceKey: "google" },
  { hosts: ["naver.com"], channel: "검색", sourceLabel: "Naver", sourceKey: "naver" },
  { hosts: ["bing.com"], channel: "검색", sourceLabel: "Bing", sourceKey: "bing" },
  { hosts: ["daum.net", "search.daum.net"], channel: "검색", sourceLabel: "Daum", sourceKey: "daum" },
  { hosts: ["yahoo.com", "search.yahoo.com"], channel: "검색", sourceLabel: "Yahoo", sourceKey: "yahoo" },
];

function matchesHostname(hostname: string, expectedHost: string) {
  return hostname === expectedHost || hostname.endsWith(`.${expectedHost}`);
}

const todayQuerySchema = z
  .object({
    mode: z.literal("today"),
    preset: z.undefined().optional(),
    compare: z.undefined().optional(),
    topN: topNSchema,
  })
  .superRefine((value, ctx) => {
    if (value.preset !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["preset"], message: "preset is not allowed when mode=today" });
    }
    if (value.compare !== undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["compare"], message: "compare is not allowed when mode=today" });
    }
  });

export type ParsedTrafficApiQuery = z.infer<typeof compareQuerySchema> | z.infer<typeof todayQuerySchema>;

function shiftToKst(date: Date) {
  return new Date(date.getTime() + KST_OFFSET_MS);
}

function unshiftFromKst(date: Date) {
  return new Date(date.getTime() - KST_OFFSET_MS);
}

function kstStartOfDay(date: Date) {
  const shifted = shiftToKst(date);
  shifted.setUTCHours(0, 0, 0, 0);
  return unshiftFromKst(shifted);
}

function kstStartOfHour(date: Date) {
  const shifted = shiftToKst(date);
  shifted.setUTCMinutes(0, 0, 0);
  return unshiftFromKst(shifted);
}

function kstStartOfMonth(date: Date) {
  const shifted = shiftToKst(date);
  shifted.setUTCDate(1);
  shifted.setUTCHours(0, 0, 0, 0);
  return unshiftFromKst(shifted);
}

function addKstDays(date: Date, days: number) {
  const shifted = shiftToKst(date);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return unshiftFromKst(shifted);
}

function addKstHours(date: Date, hours: number) {
  const shifted = shiftToKst(date);
  shifted.setUTCHours(shifted.getUTCHours() + hours);
  return unshiftFromKst(shifted);
}

function addKstMonths(date: Date, months: number) {
  const shifted = shiftToKst(date);
  shifted.setUTCMonth(shifted.getUTCMonth() + months);
  return unshiftFromKst(shifted);
}

function diffCalendarDays(start: Date, end: Date) {
  const startShifted = shiftToKst(start);
  startShifted.setUTCHours(0, 0, 0, 0);
  const endShifted = shiftToKst(end);
  endShifted.setUTCHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((endShifted.getTime() - startShifted.getTime()) / DAY_MS) + 1);
}

function formatDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TRAFFIC_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { year: get("year"), month: get("month"), day: get("day") };
}

function formatTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TRAFFIC_TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return { hour: get("hour"), minute: get("minute") };
}

function formatShortKst(date: Date) {
  const { month, day } = formatDateParts(date);
  return `${month}.${day}`;
}

function formatHourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatRangeLabel(start: Date, endExclusive: Date) {
  const safeEnd = endExclusive.getTime() <= start.getTime() ? start : new Date(endExclusive.getTime() - 1);
  const formatter = new Intl.DateTimeFormat("ko-KR", { timeZone: TRAFFIC_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  return `${formatter.format(start)}–${formatter.format(safeEnd)}`;
}

function makeRange(start: Date, endExclusive: Date): DateRange {
  const safeEnd = endExclusive.getTime() <= start.getTime() ? start : new Date(endExclusive.getTime() - 1);
  return { start: start.toISOString(), end: endExclusive.toISOString(), label: formatRangeLabel(start, endExclusive), days: diffCalendarDays(start, safeEnd) };
}

export function parseTrafficApiQuery(query: URLSearchParams | Record<string, string | undefined>) {
  const read = (key: string) => query instanceof URLSearchParams ? (query.has(key) ? query.get(key) ?? undefined : undefined) : query[key];
  const modeRaw = read("mode");
  const mode = modeRaw == null ? "compare" : modeRaw;
  const modeParsed = modeSchema.safeParse(mode);
  if (!modeParsed.success) return modeParsed;
  const payload = { mode: modeParsed.data, preset: read("preset"), compare: read("compare"), topN: read("topN") };
  return modeParsed.data === "today" ? todayQuerySchema.safeParse(payload) : compareQuerySchema.safeParse(payload);
}

export function resolveTrafficCompareRanges(preset: TrafficPreset, compareMode: CompareMode, now = new Date()): ResolvedTrafficCompareRanges {
  const currentStartOfToday = kstStartOfDay(now);
  let currentStart: Date;
  let currentEnd: Date;
  switch (preset) {
    case "7d": currentEnd = now; currentStart = addKstDays(currentStartOfToday, -6); break;
    case "30d": currentEnd = now; currentStart = addKstDays(currentStartOfToday, -29); break;
    case "90d": currentEnd = now; currentStart = addKstDays(currentStartOfToday, -89); break;
    case "this_month": currentEnd = now; currentStart = kstStartOfMonth(now); break;
    case "last_month": currentEnd = kstStartOfMonth(now); currentStart = addKstMonths(currentEnd, -1); break;
  }
  const current = makeRange(currentStart, currentEnd);
  if (compareMode === "none") {
    return { mode: "compare", compareMode, current, previous: null, queryStartIso: current.start, queryEndIso: current.end };
  }
  let previousStart: Date;
  let previousEnd: Date;
  if (preset === "this_month") {
    previousStart = addKstMonths(currentStart, -1);
    previousEnd = new Date(Math.min(previousStart.getTime() + (currentEnd.getTime() - currentStart.getTime()), currentStart.getTime()));
  } else if (preset === "last_month") {
    previousEnd = currentStart;
    previousStart = addKstMonths(currentStart, -1);
  } else {
    previousStart = addKstDays(currentStart, -current.days);
    previousEnd = new Date(currentEnd.getTime() - current.days * DAY_MS);
  }
  const previous = makeRange(previousStart, previousEnd);
  return { mode: "compare", compareMode, current, previous, queryStartIso: previous.start, queryEndIso: current.end };
}

export function resolveTrafficTodayRanges(now = new Date()): ResolvedTrafficTodayRanges {
  const currentStart = kstStartOfDay(now);
  const previousStart = addKstDays(currentStart, -1);
  const previousEnd = new Date(previousStart.getTime() + (now.getTime() - currentStart.getTime()));
  return { mode: "today", current: makeRange(currentStart, now), previous: makeRange(previousStart, previousEnd), queryStartIso: previousStart.toISOString(), queryEndIso: now.toISOString() };
}

export function resolveTrafficRanges(preset: TrafficPreset, compareMode: CompareMode, now = new Date()) {
  return resolveTrafficCompareRanges(preset, compareMode, now);
}

function inRange(createdAt: string, range: DateRange) {
  const time = new Date(createdAt).getTime();
  return time >= new Date(range.start).getTime() && time < new Date(range.end).getTime();
}

export function slugToTitle(url: string) {
  const slug = url.replace(/^\/+|\/+$/g, "");
  if (!slug) return "홈";
  return slug.replace(/-/g, " ").replace(/\//g, " / ");
}

export function getPageTitle(event: AnalyticsEvent | undefined, url: string) {
  const pageTitle = event?.props?.page_title;
  if (typeof pageTitle === "string" && pageTitle.trim()) return pageTitle.trim();
  return slugToTitle(url);
}

export function isConversion(event: AnalyticsEvent) {
  return event.event_name === "newsletter_submit" || (event.event_name === "outbound_click" && typeof event.props?.url === "string" && event.props.url.includes("open.kakao"));
}

export function extractNormalizedHostname(referrer: string | null) {
  const trimmed = referrer?.trim();
  if (!trimmed) return null;
  try {
    const value = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const hostname = new URL(value).hostname.trim().toLowerCase().replace(/\.+$/g, "").replace(/^www\./, "");
    return hostname || null;
  } catch {
    return null;
  }
}

function isSelfReferrerHost(hostname: string) {
  if (SELF_REFERRER_ALLOWLIST.some((allowedHost) => matchesHostname(hostname, allowedHost))) return true;
  if (hostname.endsWith(".vercel.app") && (hostname.includes("agenticworkflows") || hostname.includes("awc") || hostname.includes("brxce"))) return true;
  return false;
}

export function classifyTrafficSource(referrer: string | null): TrafficSource {
  const trimmed = referrer?.trim() ?? "";
  if (!trimmed) return DIRECT_TRAFFIC_SOURCE;
  const hostname = extractNormalizedHostname(trimmed);
  if (!hostname) return UNKNOWN_REFERRER_TRAFFIC_SOURCE;
  if (isSelfReferrerHost(hostname)) return DIRECT_TRAFFIC_SOURCE;
  for (const rule of SOURCE_RULES) {
    if (rule.hosts.some((host) => matchesHostname(hostname, host))) {
      return { channel: rule.channel, sourceDomain: hostname, sourceLabel: rule.sourceLabel, sourceKey: rule.sourceKey };
    }
  }
  return { channel: "레퍼럴", sourceDomain: hostname, sourceLabel: hostname, sourceKey: hostname };
}

const SEARCH_REFERRER_HOSTS = ["google.com", "naver.com", "bing.com", "daum.net", "yahoo.com"];
const SOCIAL_REFERRER_HOSTS = [
  "t.co",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "threads.net",
];

export function classifyReferrer(referrer: string | null) {
  if (!referrer) return "직접";
  const hostname = extractNormalizedHostname(referrer);
  if (!hostname) return "레퍼럴";
  if (SEARCH_REFERRER_HOSTS.some((host) => matchesHostname(hostname, host))) return "검색";
  if (SOCIAL_REFERRER_HOSTS.some((host) => matchesHostname(hostname, host))) return "SNS";
  return "레퍼럴";
}

function computeWindowMetrics(events: AnalyticsEvent[]): WindowMetrics {
  const allSessions = new Set<string>();
  const visitorSessions = new Set<string>();
  const conversionSessions = new Set<string>();
  const readSessions = new Set<string>();
  let conversions = 0;
  let pageViews = 0;
  for (const event of events) {
    allSessions.add(event.session_id);
    if (event.event_name === "page_view") { visitorSessions.add(event.session_id); pageViews += 1; }
    const scrollDepth = event.props?.scroll_depth ?? event.props?.depth;
    if (event.event_name === "scroll_depth" && Number(scrollDepth) >= 75) readSessions.add(event.session_id);
    if (isConversion(event)) { conversions += 1; conversionSessions.add(event.session_id); }
  }
  return { sessions: allSessions.size, visitors: visitorSessions.size, conversions, conversionSessions: conversionSessions.size, readSessions: readSessions.size, pageViews };
}

function compareMetric(current: number, previous: number | null): MetricComparison {
  if (previous == null) return { current, previous: null, delta: null, deltaPct: null };
  const delta = current - previous;
  return { current, previous, delta, deltaPct: previous === 0 ? (current === 0 ? 0 : null) : (delta / previous) * 100 };
}

function round1(value: number) { return Number(value.toFixed(1)); }

export function buildSummary(events: AnalyticsEvent[], current: DateRange, previous: DateRange | null): TrafficSummary {
  const currentMetrics = computeWindowMetrics(events.filter((event) => inRange(event.created_at, current)));
  const previousMetrics = previous ? computeWindowMetrics(events.filter((event) => inRange(event.created_at, previous))) : null;
  const currentConversionRate = currentMetrics.sessions > 0 ? (currentMetrics.conversionSessions / currentMetrics.sessions) * 100 : 0;
  const previousConversionRate = previousMetrics ? (previousMetrics.sessions > 0 ? (previousMetrics.conversionSessions / previousMetrics.sessions) * 100 : 0) : null;
  const currentReadRate = currentMetrics.sessions > 0 ? (currentMetrics.readSessions / currentMetrics.sessions) * 100 : 0;
  const previousReadRate = previousMetrics ? (previousMetrics.sessions > 0 ? (previousMetrics.readSessions / previousMetrics.sessions) * 100 : 0) : null;
  const currentPagesPerSession = currentMetrics.sessions > 0 ? currentMetrics.pageViews / currentMetrics.sessions : 0;
  const previousPagesPerSession = previousMetrics ? (previousMetrics.sessions > 0 ? previousMetrics.pageViews / previousMetrics.sessions : 0) : null;
  return {
    sessions: compareMetric(currentMetrics.sessions, previousMetrics?.sessions ?? null),
    visitors: compareMetric(currentMetrics.visitors, previousMetrics?.visitors ?? null),
    conversions: compareMetric(currentMetrics.conversions, previousMetrics?.conversions ?? null),
    conversionSessions: compareMetric(currentMetrics.conversionSessions, previousMetrics?.conversionSessions ?? null),
    conversionRate: compareMetric(round1(currentConversionRate), previousConversionRate == null ? null : round1(previousConversionRate)),
    readRate: compareMetric(round1(currentReadRate), previousReadRate == null ? null : round1(previousReadRate)),
    pagesPerSession: compareMetric(round1(currentPagesPerSession), previousPagesPerSession == null ? null : round1(previousPagesPerSession)),
  };
}

export function buildTrends(events: AnalyticsEvent[], current: DateRange, previous: DateRange | null): CompareTrendPoint[] {
  const currentStart = new Date(current.start);
  const previousStart = previous ? new Date(previous.start) : null;
  const slots = current.days;
  const currentBuckets = Array.from({ length: slots }, (_, index) => ({ label: formatShortKst(addKstDays(currentStart, index)), sessions: new Set<string>(), conversions: 0, conversionSessions: new Set<string>() }));
  const previousBuckets = Array.from({ length: slots }, (_, index) => ({ label: previousStart ? formatShortKst(addKstDays(previousStart, index)) : null, sessions: new Set<string>(), conversions: 0, conversionSessions: new Set<string>() }));
  for (const event of events) {
    if (inRange(event.created_at, current)) {
      const idx = Math.floor((kstStartOfDay(new Date(event.created_at)).getTime() - kstStartOfDay(currentStart).getTime()) / DAY_MS);
      if (idx >= 0 && idx < slots) { currentBuckets[idx].sessions.add(event.session_id); if (isConversion(event)) { currentBuckets[idx].conversions += 1; currentBuckets[idx].conversionSessions.add(event.session_id); } }
    }
    if (previous && inRange(event.created_at, previous) && previousStart) {
      const idx = Math.floor((kstStartOfDay(new Date(event.created_at)).getTime() - kstStartOfDay(previousStart).getTime()) / DAY_MS);
      if (idx >= 0 && idx < slots) { previousBuckets[idx].sessions.add(event.session_id); if (isConversion(event)) { previousBuckets[idx].conversions += 1; previousBuckets[idx].conversionSessions.add(event.session_id); } }
    }
  }
  return Array.from({ length: slots }, (_, index) => {
    const currentSessions = currentBuckets[index].sessions.size;
    const previousSessions = previous ? previousBuckets[index].sessions.size : null;
    return {
      key: `${index}`,
      currentLabel: currentBuckets[index].label,
      previousLabel: previous ? previousBuckets[index].label : null,
      sessionsCurrent: currentSessions,
      sessionsPrevious: previous ? previousSessions : null,
      conversionsCurrent: currentBuckets[index].conversions,
      conversionsPrevious: previous ? previousBuckets[index].conversions : null,
      conversionRateCurrent: currentSessions > 0 ? round1((currentBuckets[index].conversionSessions.size / currentSessions) * 100) : 0,
      conversionRatePrevious: previous ? (previousSessions && previousSessions > 0 ? round1((previousBuckets[index].conversionSessions.size / previousSessions) * 100) : 0) : null,
    };
  });
}

export function buildTodayTrends(events: AnalyticsEvent[], current: DateRange, previous: DateRange): TodayTrendPoint[] {
  const currentStart = new Date(current.start);
  const currentEnd = new Date(current.end);
  const previousStart = new Date(previous.start);
  const currentHourStart = kstStartOfHour(currentEnd);
  const currentHour = shiftToKst(currentEnd).getUTCHours();
  const hasPartialHour = currentEnd.getTime() > currentHourStart.getTime();
  const slotCount = hasPartialHour ? currentHour + 1 : Math.max(1, currentHour);
  const currentEnds = Array.from({ length: slotCount }, (_, index) => {
    const nominalEnd = addKstHours(currentStart, index + 1);
    return nominalEnd.getTime() < currentEnd.getTime() ? nominalEnd : currentEnd;
  });
  const previousEnds = currentEnds.map((end) => new Date(previousStart.getTime() + (end.getTime() - currentStart.getTime())));
  const currentEvents = events.filter((event) => inRange(event.created_at, current)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const previousEvents = events.filter((event) => inRange(event.created_at, previous)).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const currentSessions = new Set<string>();
  const previousSessions = new Set<string>();
  let currentConversions = 0;
  let previousConversions = 0;
  let currentIndex = 0;
  let previousIndex = 0;
  return Array.from({ length: slotCount }, (_, index) => {
    while (currentIndex < currentEvents.length && new Date(currentEvents[currentIndex].created_at).getTime() < currentEnds[index].getTime()) { currentSessions.add(currentEvents[currentIndex].session_id); if (isConversion(currentEvents[currentIndex])) currentConversions += 1; currentIndex += 1; }
    while (previousIndex < previousEvents.length && new Date(previousEvents[previousIndex].created_at).getTime() < previousEnds[index].getTime()) { previousSessions.add(previousEvents[previousIndex].session_id); if (isConversion(previousEvents[previousIndex])) previousConversions += 1; previousIndex += 1; }
    return { key: `${index}`, label: formatHourLabel(index), cumulativeSessionsCurrent: currentSessions.size, cumulativeSessionsPrevious: previousSessions.size, cumulativeConversionsCurrent: currentConversions, cumulativeConversionsPrevious: previousConversions };
  });
}

export function buildBreakdown(events: AnalyticsEvent[], current: DateRange, previous: DateRange | null, topN: number): TrafficBreakdown {
  const currentEvents = events.filter((event) => inRange(event.created_at, current));
  const previousEvents = previous ? events.filter((event) => inRange(event.created_at, previous)) : [];

  const buildPageMap = (rows: AnalyticsEvent[]) => {
    const map = new Map<string, { title: string; sessions: Set<string>; conversions: number; conversionSessions: Set<string> }>();
    const pagesBySession = new Map<string, Set<string>>();
    for (const event of rows) {
      if (event.event_name !== "page_view") continue;
      const bucket = map.get(event.url) ?? { title: getPageTitle(event, event.url), sessions: new Set<string>(), conversions: 0, conversionSessions: new Set<string>() };
      bucket.sessions.add(event.session_id);
      map.set(event.url, bucket);
      if (!pagesBySession.has(event.session_id)) pagesBySession.set(event.session_id, new Set<string>());
      pagesBySession.get(event.session_id)?.add(event.url);
    }
    for (const event of rows) {
      if (!isConversion(event)) continue;
      for (const url of pagesBySession.get(event.session_id) ?? []) {
        const bucket = map.get(url);
        if (bucket) {
          bucket.conversions += 1;
          bucket.conversionSessions.add(event.session_id);
        }
      }
    }
    return map;
  };

  const buildChannelMap = (rows: AnalyticsEvent[]) => {
    const map = new Map<string, { sessions: Set<string>; conversions: number; conversionSessions: Set<string> }>();
    const channelsBySession = new Map<string, Set<string>>();
    for (const event of rows) {
      if (event.event_name !== "page_view") continue;
      const channel = classifyReferrer(event.referrer);
      const bucket = map.get(channel) ?? { sessions: new Set<string>(), conversions: 0, conversionSessions: new Set<string>() };
      bucket.sessions.add(event.session_id);
      map.set(channel, bucket);
      if (!channelsBySession.has(event.session_id)) channelsBySession.set(event.session_id, new Set<string>());
      channelsBySession.get(event.session_id)?.add(channel);
    }
    for (const event of rows) {
      if (!isConversion(event)) continue;
      for (const channel of channelsBySession.get(event.session_id) ?? []) {
        const bucket = map.get(channel);
        if (bucket) {
          bucket.conversions += 1;
          bucket.conversionSessions.add(event.session_id);
        }
      }
    }
    return map;
  };

  const buildSourceMap = (rows: AnalyticsEvent[]) => {
    const map = new Map<string, { source: TrafficSource; sessions: Set<string>; conversions: number; conversionSessions: Set<string> }>();
    const sourceBySession = new Map<string, TrafficSource>();
    const sortedRows = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
    for (const event of sortedRows) {
      if (event.event_name !== "page_view" || sourceBySession.has(event.session_id)) continue;
      const source = classifyTrafficSource(event.referrer);
      sourceBySession.set(event.session_id, source);
      const bucket = map.get(source.sourceKey) ?? { source, sessions: new Set<string>(), conversions: 0, conversionSessions: new Set<string>() };
      bucket.sessions.add(event.session_id);
      map.set(source.sourceKey, bucket);
    }
    for (const event of sortedRows) {
      if (!isConversion(event)) continue;
      const source = sourceBySession.get(event.session_id);
      if (!source) continue;
      const bucket = map.get(source.sourceKey);
      if (!bucket) continue;
      bucket.conversions += 1;
      bucket.conversionSessions.add(event.session_id);
    }
    return map;
  };

  const currentPages = buildPageMap(currentEvents);
  const previousPages = buildPageMap(previousEvents);
  const pages = Array.from(new Set([...currentPages.keys(), ...previousPages.keys()]))
    .map((key) => {
      const currentBucket = currentPages.get(key);
      const previousBucket = previous ? previousPages.get(key) : undefined;
      const sessionsCurrent = currentBucket?.sessions.size ?? 0;
      const sessionsPrevious = previous ? previousBucket?.sessions.size ?? 0 : null;
      const conversionsCurrent = currentBucket?.conversions ?? 0;
      const conversionsPrevious = previous ? previousBucket?.conversions ?? 0 : null;
      const conversionSessionsCurrent = currentBucket?.conversionSessions.size ?? 0;
      const conversionSessionsPrevious = previous ? previousBucket?.conversionSessions.size ?? 0 : null;
      const conversionRatePrevious = previous ? (sessionsPrevious && sessionsPrevious > 0 ? round1(((conversionSessionsPrevious ?? 0) / sessionsPrevious) * 100) : 0) : null;
      return {
        key,
        title: currentBucket?.title ?? previousBucket?.title ?? slugToTitle(key),
        url: key,
        sessionsCurrent,
        sessionsPrevious,
        sessionsDelta: previous ? sessionsCurrent - (sessionsPrevious ?? 0) : null,
        conversionsCurrent,
        conversionsPrevious,
        conversionsDelta: previous ? conversionsCurrent - (conversionsPrevious ?? 0) : null,
        conversionRateCurrent: sessionsCurrent > 0 ? round1((conversionSessionsCurrent / sessionsCurrent) * 100) : 0,
        conversionRatePrevious,
      };
    })
    .sort((a, b) => b.sessionsCurrent - a.sessionsCurrent)
    .slice(0, topN);

  const currentChannels = buildChannelMap(currentEvents);
  const previousChannels = buildChannelMap(previousEvents);
  const channels = Array.from(new Set([...currentChannels.keys(), ...previousChannels.keys()]))
    .map((channel) => {
      const currentBucket = currentChannels.get(channel);
      const previousBucket = previousChannels.get(channel);
      const sessionsCurrent = currentBucket?.sessions.size ?? 0;
      const sessionsPrevious = previous ? previousBucket?.sessions.size ?? 0 : null;
      const conversionsCurrent = currentBucket?.conversions ?? 0;
      const conversionsPrevious = previous ? previousBucket?.conversions ?? 0 : null;
      const conversionSessionsCurrent = currentBucket?.conversionSessions.size ?? 0;
      const conversionSessionsPrevious = previous ? previousBucket?.conversionSessions.size ?? 0 : null;
      const conversionRatePrevious = previous ? (sessionsPrevious && sessionsPrevious > 0 ? round1(((conversionSessionsPrevious ?? 0) / sessionsPrevious) * 100) : 0) : null;
      return {
        channel,
        sessionsCurrent,
        sessionsPrevious,
        sessionsDelta: previous ? sessionsCurrent - (sessionsPrevious ?? 0) : null,
        conversionsCurrent,
        conversionsPrevious,
        conversionRateCurrent: sessionsCurrent > 0 ? round1((conversionSessionsCurrent / sessionsCurrent) * 100) : 0,
        conversionRatePrevious,
      };
    })
    .sort((a, b) => b.sessionsCurrent - a.sessionsCurrent)
    .slice(0, topN);

  const currentSources = buildSourceMap(currentEvents);
  const previousSources = buildSourceMap(previousEvents);
  const sources = Array.from(new Set([...currentSources.keys(), ...previousSources.keys()]))
    .map((sourceKey) => {
      const currentBucket = currentSources.get(sourceKey);
      const previousBucket = previousSources.get(sourceKey);
      const source = currentBucket?.source ?? previousBucket?.source ?? { channel: "레퍼럴", sourceDomain: null, sourceLabel: sourceKey, sourceKey };
      const sessionsCurrent = currentBucket?.sessions.size ?? 0;
      const sessionsPrevious = previous ? previousBucket?.sessions.size ?? 0 : null;
      const conversionsCurrent = currentBucket?.conversions ?? 0;
      const conversionsPrevious = previous ? previousBucket?.conversions ?? 0 : null;
      const conversionSessionsCurrent = currentBucket?.conversionSessions.size ?? 0;
      const conversionSessionsPrevious = previous ? previousBucket?.conversionSessions.size ?? 0 : null;
      const conversionRatePrevious = previous ? (sessionsPrevious && sessionsPrevious > 0 ? round1(((conversionSessionsPrevious ?? 0) / sessionsPrevious) * 100) : 0) : null;
      return {
        sourceKey,
        channel: source.channel,
        sourceDomain: source.sourceDomain,
        sourceLabel: source.sourceLabel,
        sessionsCurrent,
        sessionsPrevious,
        sessionsDelta: previous ? sessionsCurrent - (sessionsPrevious ?? 0) : null,
        conversionsCurrent,
        conversionsPrevious,
        conversionsDelta: previous ? conversionsCurrent - (conversionsPrevious ?? 0) : null,
        conversionRateCurrent: sessionsCurrent > 0 ? round1((conversionSessionsCurrent / sessionsCurrent) * 100) : 0,
        conversionRatePrevious,
      };
    })
    .sort((a, b) => b.sessionsCurrent - a.sessionsCurrent || b.conversionsCurrent - a.conversionsCurrent || a.sourceLabel.localeCompare(b.sourceLabel))
    .slice(0, topN);

  return { pages, channels, sources };
}

export function getTodayRangeComparisonCaption(current: DateRange, previous: DateRange) {
  const currentTime = formatTimeParts(new Date(current.end));
  const previousTime = formatTimeParts(new Date(previous.end));
  return { current: `현재: ${current.label} ${currentTime.hour}:${currentTime.minute} 기준`, previous: `비교: ${previous.label} ${previousTime.hour}:${previousTime.minute} 기준` };
}
