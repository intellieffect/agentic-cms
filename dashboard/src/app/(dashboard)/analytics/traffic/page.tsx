"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrafficCompareView } from "./_components/TrafficCompareView";
import { TrafficTodayView } from "./_components/TrafficTodayView";
import { getTodayRangeComparisonCaption, type CompareMode, type TrafficApiResponse, type TrafficCompareApiResponse, type TrafficPreset, type TrafficTodayApiResponse } from "@/lib/analytics/traffic";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Period = 7 | 30 | 90;

const DEFAULT_PRESET: TrafficPreset = "7d";
const DEFAULT_COMPARE: CompareMode = "previous";
const PRESET_OPTIONS: Array<{ value: TrafficPreset; label: string }> = [{ value: "7d", label: "최근 7일" }, { value: "30d", label: "최근 30일" }, { value: "90d", label: "최근 90일" }, { value: "this_month", label: "이번 달" }, { value: "last_month", label: "지난 달" }];
const COMPARE_OPTIONS: Array<{ value: CompareMode; label: string }> = [{ value: "previous", label: "직전 동일 기간" }, { value: "none", label: "비교 안 함" }];
const getMode = (value: string | null) =>
  value === "today" ? "today" :
  value === "ga4" ? "ga4" :
  value === "gsc" ? "gsc" :
  "compare";
const getPreset = (value: string | null): TrafficPreset => value === "30d" || value === "90d" || value === "this_month" || value === "last_month" ? value : "7d";
const getCompare = (value: string | null): CompareMode => value === "none" ? "none" : "previous";

function fmtNum(n: number) {
  return n.toLocaleString();
}

export default function TrafficPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = getMode(searchParams.get("mode"));
  const preset = getPreset(searchParams.get("preset"));
  const compare = getCompare(searchParams.get("compare"));
  const [data, setData] = useState<TrafficApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCompareState, setLastCompareState] = useState<{ preset: TrafficPreset; compare: CompareMode }>({ preset: DEFAULT_PRESET, compare: DEFAULT_COMPARE });

  useEffect(() => { if (mode === "compare") setLastCompareState({ preset, compare }); }, [mode, preset, compare]);

  useEffect(() => {
    if (mode === "ga4" || mode === "gsc") return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ mode, topN: "10" });
        if (mode === "compare") { params.set("preset", preset); params.set("compare", compare); }
        const res = await fetch(`/api/analytics/traffic?${params.toString()}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "트래픽 데이터를 불러오지 못했습니다.");
        if (!cancelled) setData(json as TrafficApiResponse);
      } catch (err) {
        if (!cancelled) { setError(err instanceof Error ? err.message : "트래픽 데이터를 불러오지 못했습니다."); setData(null); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [mode, preset, compare]);

  const replaceQuery = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const nextQuery = params.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const rangeCaption = useMemo(() => !data ? null : data.meta.mode === "today" ? getTodayRangeComparisonCaption(data.meta.current, data.meta.previous) : { current: `현재: ${data.meta.current.label}`, previous: data.meta.previous ? `비교: ${data.meta.previous.label}` : "비교: 없음" }, [data]);

  let content: ReactNode;
  if (mode === "ga4") {
    content = <GA4Tab />;
  } else if (mode === "gsc") {
    content = <GSCTab />;
  } else if (loading) {
    content = <div className="rounded-xl border border-[#222] bg-[#141414] px-6 py-14 text-center text-sm text-[#777]">데이터 로딩 중...</div>;
  } else if (error) {
    content = <div className="rounded-xl border border-red-900/40 bg-red-950/30 px-6 py-10 text-sm text-red-200">{error}</div>;
  } else if (!data) {
    content = <div className="rounded-xl border border-[#222] bg-[#141414] px-6 py-14 text-center text-sm text-[#777]">데이터가 없습니다.</div>;
  } else if (data.meta.mode === "today") {
    content = <TrafficTodayView data={data as TrafficTodayApiResponse} />;
  } else {
    content = <TrafficCompareView data={data as TrafficCompareApiResponse} />;
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-3">
        <h1 className="text-2xl font-bold">트래픽</h1>
        <Tabs value={mode} onValueChange={(nextMode) => {
          if (nextMode === "today") {
            setLastCompareState({ preset, compare });
            replaceQuery((params) => { params.set("mode", "today"); params.delete("preset"); params.delete("compare"); });
          } else if (nextMode === "compare") {
            replaceQuery((params) => { params.set("mode", "compare"); params.set("preset", lastCompareState.preset); params.set("compare", lastCompareState.compare); });
          } else if (nextMode === "ga4" || nextMode === "gsc") {
            replaceQuery((params) => { params.set("mode", nextMode); params.delete("preset"); params.delete("compare"); });
          }
        }}>
          <TabsList className="h-auto rounded-xl border border-[#222] bg-[#141414] p-1">
            <TabsTrigger value="today" className="rounded-lg px-4 py-2 data-[state=active]:bg-[#25213d] data-[state=active]:text-[#efeeff]">오늘</TabsTrigger>
            <TabsTrigger value="compare" className="rounded-lg px-4 py-2 data-[state=active]:bg-[#25213d] data-[state=active]:text-[#efeeff]">비교</TabsTrigger>
            <TabsTrigger value="ga4" className="rounded-lg px-4 py-2 data-[state=active]:bg-[#25213d] data-[state=active]:text-[#efeeff]">GA4</TabsTrigger>
            <TabsTrigger value="gsc" className="rounded-lg px-4 py-2 data-[state=active]:bg-[#25213d] data-[state=active]:text-[#efeeff]">Search Console</TabsTrigger>
          </TabsList>
        </Tabs>
        {mode === "compare" && (
          <>
            <div className="flex flex-wrap gap-2">
              {PRESET_OPTIONS.map((option) => (
                <button key={option.value} onClick={() => replaceQuery((params) => { params.set("mode", "compare"); params.set("preset", option.value); params.set("compare", compare); })} className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${preset === option.value ? "border-[#4ECDC4] bg-[#1a2e2d] text-[#d9fffb]" : "border-[#2b2b2b] bg-[#141414] text-[#999] hover:text-white"}`}>{option.label}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {COMPARE_OPTIONS.map((option) => (
                <button key={option.value} onClick={() => replaceQuery((params) => { params.set("mode", "compare"); params.set("preset", preset); params.set("compare", option.value); })} className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${compare === option.value ? "border-[#8884d8] bg-[#25213d] text-[#efeeff]" : "border-[#2b2b2b] bg-[#141414] text-[#999] hover:text-white"}`}>{option.label}</button>
              ))}
            </div>
          </>
        )}
        {rangeCaption && (
          <div className="flex flex-col gap-1 text-sm text-[#777]">
            <span>{rangeCaption.current}</span>
            <span>{rangeCaption.previous}</span>
          </div>
        )}
      </div>
      {content}
    </div>
  );
}

/* ─── GA4 Tab ─── */
interface GA4Data {
  overview: {
    pageViews: number;
    users: number;
    sessions: number;
    avgSessionDuration: number;
    bounceRate: number;
  };
  pages: { path: string; pageViews: number; users: number; avgDuration: number }[];
  sources: { source: string; sessions: number; users: number; bounceRate: number }[];
  daily: { date: string; pv: number; uv: number }[];
  events: { eventName: string; count: number }[];
  conversions: {
    newsletter: { formViews: number; submits: number; rate: number };
    booking: { pageViews: number; submits: number; completes: number; rate: number };
    signups: number;
    logins: number;
  };
  ctaClicks: { ctaId: string; count: number }[];
}

function GA4Tab() {
  const [data, setData] = useState<GA4Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<Period>(7);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics/ga4?days=${days}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!cancelled) setData(json);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#555]">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#555] border-t-white" />
        <span className="ml-3 text-sm">GA4 데이터 로딩 중...</span>
      </div>
    );
  }
  if (error) {
    return <div className="text-center py-20 text-red-400 text-sm">{error}</div>;
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1">
        {([7, 30, 90] as Period[]).map((p) => (
          <button key={p} onClick={() => setDays(p)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${days === p ? "bg-[#333] text-white" : "text-[#888] hover:text-white"}`}>{p}일</button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "페이지뷰", value: fmtNum(data.overview.pageViews) },
          { label: "사용자", value: fmtNum(data.overview.users) },
          { label: "세션", value: fmtNum(data.overview.sessions) },
          { label: "평균 세션 시간", value: `${Math.round(data.overview.avgSessionDuration)}s` },
          { label: "이탈률", value: `${(data.overview.bounceRate * 100).toFixed(1)}%` },
        ].map((c) => (
          <div key={c.label} className="p-4 bg-[#141414] border border-[#222] rounded-xl">
            <div className="text-xs text-[#888] mb-1">{c.label}</div>
            <div className="text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-[#141414] border border-[#222] rounded-xl p-4">
        <div className="text-sm font-medium mb-4">GA4 일별 PV / 사용자</div>
        {data.daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="date" stroke="#555" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis stroke="#555" tick={{ fill: "#888", fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#888" }} />
              <Line type="monotone" dataKey="pv" name="PV" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="uv" name="Users" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-10 text-[#555] text-sm">차트 데이터 없음</div>
        )}
      </div>
      <div className="bg-[#141414] border border-[#222] rounded-xl overflow-hidden">
        <div className="p-4 text-sm font-medium">트래픽 소스</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#222] text-[#888]">
              <th className="px-4 py-3 text-left">소스</th>
              <th className="px-4 py-3 text-right">세션</th>
              <th className="px-4 py-3 text-right">사용자</th>
              <th className="px-4 py-3 text-right">이탈률</th>
            </tr>
          </thead>
          <tbody>
            {data.sources.map((s) => (
              <tr key={s.source} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                <td className="px-4 py-2 text-[#ccc]">{s.source}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtNum(s.sessions)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtNum(s.users)}</td>
                <td className="px-4 py-2 text-right text-[#888]">{(s.bounceRate * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="bg-[#141414] border border-[#222] rounded-xl overflow-hidden">
        <div className="p-4 text-sm font-medium">인기 페이지</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#222] text-[#888]">
              <th className="px-4 py-3 text-left">페이지</th>
              <th className="px-4 py-3 text-right">페이지뷰</th>
              <th className="px-4 py-3 text-right">사용자</th>
              <th className="px-4 py-3 text-right">평균 체류</th>
            </tr>
          </thead>
          <tbody>
            {data.pages.map((p) => (
              <tr key={p.path} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                <td className="px-4 py-2 text-[#ccc] max-w-[300px] truncate">{p.path}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtNum(p.pageViews)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtNum(p.users)}</td>
                <td className="px-4 py-2 text-right text-[#888]">{Math.round(p.avgDuration)}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 전환 퍼널 */}
      {data.conversions && (
        <>
          <div className="text-sm font-medium text-[#ccc] mt-2">전환 퍼널</div>
          <div className="grid grid-cols-4 gap-3">
            <div className="p-4 bg-[#141414] border border-[#222] rounded-xl">
              <div className="text-xs text-[#888] mb-1">뉴스레터 전환</div>
              <div className="text-2xl font-bold">{(data.conversions.newsletter.rate * 100).toFixed(1)}%</div>
              <div className="text-xs text-[#555] mt-1">
                뷰 {fmtNum(data.conversions.newsletter.formViews)} → 제출 {fmtNum(data.conversions.newsletter.submits)}
              </div>
            </div>
            <div className="p-4 bg-[#141414] border border-[#222] rounded-xl">
              <div className="text-xs text-[#888] mb-1">부킹 전환</div>
              <div className="text-2xl font-bold">{(data.conversions.booking.rate * 100).toFixed(1)}%</div>
              <div className="text-xs text-[#555] mt-1">
                뷰 {fmtNum(data.conversions.booking.pageViews)} → 제출 {fmtNum(data.conversions.booking.submits)} → 완료 {fmtNum(data.conversions.booking.completes)}
              </div>
            </div>
            <div className="p-4 bg-[#141414] border border-[#222] rounded-xl">
              <div className="text-xs text-[#888] mb-1">회원가입</div>
              <div className="text-2xl font-bold">{fmtNum(data.conversions.signups)}</div>
            </div>
            <div className="p-4 bg-[#141414] border border-[#222] rounded-xl">
              <div className="text-xs text-[#888] mb-1">로그인</div>
              <div className="text-2xl font-bold">{fmtNum(data.conversions.logins)}</div>
            </div>
          </div>
        </>
      )}

      {/* 블로그 참여도 */}
      {data.events && data.events.length > 0 && (() => {
        const blogEvents = data.events.filter((e) =>
          ["blog_article_view", "blog_share", "blog_search", "blog_category_click"].includes(e.eventName)
        );
        if (blogEvents.length === 0) return null;
        const BLOG_LABEL: Record<string, string> = {
          blog_article_view: "글 조회",
          blog_share: "공유",
          blog_search: "검색",
          blog_category_click: "카테고리 클릭",
        };
        return (
          <>
            <div className="text-sm font-medium text-[#ccc] mt-2">블로그 참여도</div>
            <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${blogEvents.length}, minmax(0, 1fr))` }}>
              {blogEvents.map((e) => (
                <div key={e.eventName} className="p-4 bg-[#141414] border border-[#222] rounded-xl">
                  <div className="text-xs text-[#888] mb-1">{BLOG_LABEL[e.eventName] || e.eventName}</div>
                  <div className="text-2xl font-bold">{fmtNum(e.count)}</div>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* 커스텀 이벤트 테이블 */}
      {data.events && data.events.length > 0 && (
        <div className="bg-[#141414] border border-[#222] rounded-xl overflow-hidden">
          <div className="p-4 text-sm font-medium">커스텀 이벤트</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#222] text-[#888]">
                <th className="px-4 py-3 text-left">이벤트</th>
                <th className="px-4 py-3 text-right">횟수</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((e) => (
                <tr key={e.eventName} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                  <td className="px-4 py-2 text-[#ccc]">{e.eventName}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtNum(e.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CTA 클릭 테이블 */}
      {data.ctaClicks && data.ctaClicks.length > 0 && (
        <div className="bg-[#141414] border border-[#222] rounded-xl overflow-hidden">
          <div className="p-4 text-sm font-medium">CTA 클릭</div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#222] text-[#888]">
                <th className="px-4 py-3 text-left">CTA ID</th>
                <th className="px-4 py-3 text-right">클릭수</th>
              </tr>
            </thead>
            <tbody>
              {data.ctaClicks.map((c) => (
                <tr key={c.ctaId} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                  <td className="px-4 py-2 text-[#ccc]">{c.ctaId}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtNum(c.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── GSC Tab ─── */
interface GSCData {
  overview: { totalClicks: number; totalImpressions: number; avgCtr: number; avgPosition: number };
  queries: { query: string; clicks: number; impressions: number; ctr: number; position: number }[];
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[];
  daily: { date: string; clicks: number; impressions: number }[];
  countries?: { country: string; clicks: number; impressions: number; ctr: number; position: number }[];
  devices?: { device: string; clicks: number; impressions: number; ctr: number; position: number }[];
}

function GSCTab() {
  const [data, setData] = useState<GSCData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<Period>(7);
  const [view, setView] = useState<"queries" | "pages" | "countries" | "devices">("queries");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/analytics/gsc?days=${days}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        if (!cancelled) setData(json);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[#555]">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#555] border-t-white" />
        <span className="ml-3 text-sm">Search Console 데이터 로딩 중...</span>
      </div>
    );
  }
  if (error) {
    return <div className="text-center py-20 text-red-400 text-sm">{error}</div>;
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-1">
        {([7, 30, 90] as Period[]).map((p) => (
          <button key={p} onClick={() => setDays(p)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${days === p ? "bg-[#333] text-white" : "text-[#888] hover:text-white"}`}>{p}일</button>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "총 클릭수", value: fmtNum(data.overview.totalClicks) },
          { label: "총 노출수", value: fmtNum(data.overview.totalImpressions) },
          { label: "평균 CTR", value: `${(data.overview.avgCtr * 100).toFixed(1)}%` },
          { label: "평균 순위", value: data.overview.avgPosition.toFixed(1) },
        ].map((c) => (
          <div key={c.label} className="p-4 bg-[#141414] border border-[#222] rounded-xl">
            <div className="text-xs text-[#888] mb-1">{c.label}</div>
            <div className="text-2xl font-bold">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="bg-[#141414] border border-[#222] rounded-xl p-4">
        <div className="text-sm font-medium mb-4">일별 클릭 / 노출</div>
        {data.daily.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.daily}>
              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
              <XAxis dataKey="date" stroke="#555" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
              <YAxis yAxisId="left" stroke="#555" tick={{ fill: "#888", fontSize: 11 }} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" stroke="#555" tick={{ fill: "#888", fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid #333", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "#888" }} />
              <Line yAxisId="left" type="monotone" dataKey="clicks" name="클릭" stroke="#10b981" strokeWidth={2} dot={false} />
              <Line yAxisId="right" type="monotone" dataKey="impressions" name="노출" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-10 text-[#555] text-sm">차트 데이터 없음</div>
        )}
      </div>
      <div className="flex gap-1">
        {([["queries", "검색어"], ["pages", "페이지"], ["countries", "국가"], ["devices", "기기"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setView(key)} className={`px-3 py-1 rounded text-xs font-medium transition-colors ${view === key ? "bg-[#333] text-white" : "text-[#888] hover:text-white"}`}>{label}</button>
        ))}
      </div>
      <div className="bg-[#141414] border border-[#222] rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#222] text-[#888]">
              <th className="px-4 py-3 text-left">{view === "queries" ? "검색어" : view === "pages" ? "페이지" : view === "countries" ? "국가" : "기기"}</th>
              <th className="px-4 py-3 text-right">클릭</th>
              <th className="px-4 py-3 text-right">노출</th>
              <th className="px-4 py-3 text-right">CTR</th>
              <th className="px-4 py-3 text-right">순위</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const rows =
                view === "queries" ? data.queries :
                view === "pages" ? data.pages :
                view === "countries" ? (data.countries ?? []) :
                (data.devices ?? []);
              return rows.map((r) => {
                const label =
                  view === "queries" ? (r as GSCData["queries"][0]).query :
                  view === "pages" ? (r as GSCData["pages"][0]).page :
                  view === "countries" ? ((r as NonNullable<GSCData["countries"]>[0]).country) :
                  ((r as NonNullable<GSCData["devices"]>[0]).device);
                return (
                  <tr key={label} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                    <td className="px-4 py-2 text-[#ccc] max-w-[300px] truncate">{label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtNum(r.clicks)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtNum(r.impressions)}</td>
                    <td className="px-4 py-2 text-right text-[#4ECDC4]">{(r.ctr * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2 text-right text-[#888]">{r.position.toFixed(1)}</td>
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>
      </div>
    </div>
  );
}
