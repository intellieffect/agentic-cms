"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
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

function EmptyRows({ label = "표시할 데이터가 없습니다." }: { label?: string }) {
  return <div className="px-4 py-10 text-center text-sm text-[#666]">{label}</div>;
}

function PeriodSelector({ days, onChange }: { days: Period; onChange: (days: Period) => void }) {
  return (
    <div className="flex gap-1">
      {([7, 30, 90] as Period[]).map((p) => (
        <button key={p} onClick={() => onChange(p)} className={`rounded px-3 py-1 text-xs font-medium transition-colors ${days === p ? "bg-[#333] text-white" : "text-[#888] hover:text-white"}`}>{p}일</button>
      ))}
    </div>
  );
}

function SourceGuide({ title, summary, items }: { title: string; summary: string; items: string[] }) {
  return (
    <div className="min-w-[280px] flex-1 rounded-xl border border-[#222] bg-[#141414] p-4">
      <div className="text-sm font-semibold text-[#f3f3f3]">{title}</div>
      <p className="mt-2 text-sm leading-6 text-[#9a9a9a]">{summary}</p>
      <div className="mt-4 grid gap-2 md:grid-cols-3">
        {items.map((item) => (
          <div key={item} className="rounded-lg border border-[#242424] bg-[#101010] px-3 py-2 text-xs leading-5 text-[#b8b8b8]">{item}</div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-xl border border-[#222] bg-[#141414] p-4">
      <div className="text-xs text-[#888]">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
      <div className="mt-2 text-xs leading-5 text-[#666]">{note}</div>
    </div>
  );
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <div className="text-sm font-semibold text-[#ddd]">{title}</div>
      <p className="mt-1 text-xs leading-5 text-[#777]">{description}</p>
    </div>
  );
}

export default function TrafficPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[#777]">트래픽 화면 로딩 중...</div>}>
      <TrafficPageContent />
    </Suspense>
  );
}

function TrafficPageContent() {
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SourceGuide
          title="GA4: 방문 이후의 행동 데이터"
          summary="사용자가 사이트에 들어온 뒤 어떤 페이지를 보고, 어떤 유입원에서 세션이 생기고, 어떤 이벤트와 전환을 남겼는지 확인합니다. 검색 노출이나 순위가 아니라 사이트 내부 행동을 판단하는 탭입니다."
          items={[
            "콘텐츠 소비: 페이지뷰, 사용자, 평균 체류",
            "유입 품질: 세션, 소스별 이탈률",
            "전환 행동: 뉴스레터, 부킹, CTA, 커스텀 이벤트",
          ]}
        />
        <PeriodSelector days={days} onChange={setDays} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="페이지뷰" value={fmtNum(data.overview.pageViews)} note="화면/페이지가 조회된 총량입니다." />
        <MetricCard label="사용자" value={fmtNum(data.overview.users)} note="기간 내 이벤트를 남긴 고유 사용자입니다." />
        <MetricCard label="세션" value={fmtNum(data.overview.sessions)} note="사이트 방문 흐름이 시작된 횟수입니다." />
        <MetricCard label="평균 세션 시간" value={`${Math.round(data.overview.avgSessionDuration)}s`} note="방문당 머무른 평균 시간입니다." />
        <MetricCard label="이탈률" value={`${(data.overview.bounceRate * 100).toFixed(1)}%`} note="참여 조건을 충족하지 못한 세션 비율입니다." />
      </div>

      <div className="bg-[#141414] border border-[#222] rounded-xl p-4">
        <SectionHeader title="콘텐츠 소비 추이" description="일별 페이지뷰와 사용자를 함께 보며 콘텐츠 소비량이 실제 방문자 증가를 동반했는지 확인합니다." />
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
        <div className="p-4">
          <SectionHeader title="어떤 유입원이 질 좋은 방문을 만들었는가" description="소스별 세션과 사용자를 보고, 이탈률로 유입 품질을 비교합니다. 캠페인/검색/소셜/직접 유입의 방문 이후 행동을 보는 영역입니다." />
        </div>
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
            {data.sources.length > 0 ? data.sources.map((s) => (
              <tr key={s.source} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                <td className="px-4 py-2 text-[#ccc]">{s.source}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtNum(s.sessions)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtNum(s.users)}</td>
                <td className="px-4 py-2 text-right text-[#888]">{(s.bounceRate * 100).toFixed(1)}%</td>
              </tr>
            )) : (
              <tr><td colSpan={4}><EmptyRows /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-[#141414] border border-[#222] rounded-xl overflow-hidden">
        <div className="p-4">
          <SectionHeader title="어떤 페이지가 방문 후 소비되는가" description="페이지별 조회와 사용자, 평균 체류를 비교해 콘텐츠가 실제로 읽히는지 확인합니다." />
        </div>
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
            {data.pages.length > 0 ? data.pages.map((p) => (
              <tr key={p.path} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
                <td className="px-4 py-2 text-[#ccc] max-w-[300px] truncate">{p.path}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtNum(p.pageViews)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{fmtNum(p.users)}</td>
                <td className="px-4 py-2 text-right text-[#888]">{Math.round(p.avgDuration)}s</td>
              </tr>
            )) : (
              <tr><td colSpan={4}><EmptyRows /></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 전환 퍼널 */}
      {data.conversions && (
        <>
          <SectionHeader title="어떤 행동이 전환으로 이어졌는가" description="GA4 커스텀 이벤트로 수집한 뉴스레터, 부킹, 가입, 로그인 흐름입니다. 이벤트가 누락되면 실제 전환보다 낮게 보일 수 있습니다." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="뉴스레터 전환" value={`${(data.conversions.newsletter.rate * 100).toFixed(1)}%`} note={`폼 뷰 ${fmtNum(data.conversions.newsletter.formViews)} -> 제출 ${fmtNum(data.conversions.newsletter.submits)}`} />
            <MetricCard label="부킹 전환" value={`${(data.conversions.booking.rate * 100).toFixed(1)}%`} note={`뷰 ${fmtNum(data.conversions.booking.pageViews)} -> 제출 ${fmtNum(data.conversions.booking.submits)} -> 완료 ${fmtNum(data.conversions.booking.completes)}`} />
            <MetricCard label="회원가입" value={fmtNum(data.conversions.signups)} note="sign_up 이벤트 수입니다." />
            <MetricCard label="로그인" value={fmtNum(data.conversions.logins)} note="login 이벤트 수입니다." />
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
            <SectionHeader title="블로그 내부 참여" description="글 조회, 공유, 검색, 카테고리 클릭처럼 CMS 콘텐츠 운영에 직접 연결되는 이벤트입니다." />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {blogEvents.map((e) => (
                <MetricCard key={e.eventName} label={BLOG_LABEL[e.eventName] || e.eventName} value={fmtNum(e.count)} note={e.eventName} />
              ))}
            </div>
          </>
        );
      })()}

      {/* 커스텀 이벤트 테이블 */}
      {data.events && data.events.length > 0 && (
        <div className="bg-[#141414] border border-[#222] rounded-xl overflow-hidden">
          <div className="p-4">
            <SectionHeader title="수집 중인 커스텀 이벤트" description="운영 이벤트가 GA4에 정상 수집되는지 확인하는 검증용 목록입니다. 전환 판단은 위 퍼널과 CTA 영역을 우선 봅니다." />
          </div>
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
          <div className="p-4">
            <SectionHeader title="어떤 CTA가 반응을 만들었는가" description="cta_id 커스텀 차원으로 묶은 클릭 수입니다. CTA 문구와 위치별 실험 결과를 비교하는 데 사용합니다." />
          </div>
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

// GSC 는 country 를 ISO 3166 alpha-3 소문자 (예: "kor", "usa") 로 반환.
// 자주 나올 만한 국가만 한국어로 매핑하고 그 외는 원본 코드 유지.
const COUNTRY_NAME_KO: Record<string, string> = {
  kor: "대한민국", usa: "미국", jpn: "일본", chn: "중국", hkg: "홍콩", twn: "대만",
  vnm: "베트남", tha: "태국", idn: "인도네시아", phl: "필리핀", mys: "말레이시아",
  sgp: "싱가포르", ind: "인도", gbr: "영국", deu: "독일", fra: "프랑스", ita: "이탈리아",
  esp: "스페인", nld: "네덜란드", swe: "스웨덴", nor: "노르웨이", fin: "핀란드",
  pol: "폴란드", ukr: "우크라이나", rus: "러시아", tur: "튀르키예", can: "캐나다",
  mex: "멕시코", bra: "브라질", arg: "아르헨티나", aus: "호주", nzl: "뉴질랜드",
  are: "아랍에미리트", sau: "사우디아라비아", zaf: "남아프리카공화국", egy: "이집트",
};
const formatCountry = (code: string): string => {
  const key = code.toLowerCase();
  const name = COUNTRY_NAME_KO[key];
  return name ? `${name} (${key.toUpperCase()})` : key.toUpperCase();
};

// GSC 는 device 를 대문자 (DESKTOP / MOBILE / TABLET) 로 반환.
const DEVICE_NAME_KO: Record<string, string> = {
  DESKTOP: "데스크톱",
  MOBILE: "모바일",
  TABLET: "태블릿",
};
const formatDevice = (code: string): string => DEVICE_NAME_KO[code.toUpperCase()] ?? code;

interface GSCData {
  meta?: { startDate: string; endDate: string; siteUrl: string; rowLimit: number };
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <SourceGuide
          title="Search Console: Google 검색결과의 발견 데이터"
          summary="사용자가 사이트에 들어오기 전, Google 검색결과에서 어떤 검색어와 페이지가 노출되고 클릭됐는지 확인합니다. 사이트 내부 체류나 전환이 아니라 검색 수요, SERP 노출, CTR, 평균 순위를 판단하는 탭입니다."
          items={[
            "검색 수요: 검색어별 노출과 클릭",
            "SEO 성과: 페이지별 CTR과 평균 순위",
            "검색 환경: 국가와 기기별 검색 반응",
          ]}
        />
        <PeriodSelector days={days} onChange={setDays} />
      </div>
      {data.meta && (
        <div className="text-xs text-[#666]">
          기준 기간: {data.meta.startDate} ~ {data.meta.endDate} · 사이트: {data.meta.siteUrl} · 표는 클릭수 상위 {data.meta.rowLimit}개
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="총 클릭수" value={fmtNum(data.overview.totalClicks)} note="Google 검색결과에서 사이트로 들어온 클릭입니다." />
        <MetricCard label="총 노출수" value={fmtNum(data.overview.totalImpressions)} note="검색결과에 사이트가 표시된 횟수입니다." />
        <MetricCard label="평균 CTR" value={`${(data.overview.avgCtr * 100).toFixed(1)}%`} note="클릭수 / 노출수입니다. 제목과 스니펫 반응을 봅니다." />
        <MetricCard label="평균 순위" value={data.overview.avgPosition.toFixed(1)} note="검색결과에서 사이트의 평균 게재 위치입니다." />
      </div>

      <div className="bg-[#141414] border border-[#222] rounded-xl p-4">
        <SectionHeader title="검색 노출이 클릭으로 이어지는가" description="일별 노출과 클릭을 함께 봅니다. 노출은 늘지만 클릭이 따라오지 않으면 제목, 메타 설명, 검색 의도 정합성을 먼저 점검합니다." />
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
        <div className="p-4">
          <SectionHeader
            title={
              view === "queries" ? "어떤 검색어가 수요를 만드는가" :
              view === "pages" ? "어떤 페이지가 검색에서 선택되는가" :
              view === "countries" ? "어느 국가에서 검색 반응이 오는가" :
              "어떤 기기에서 검색 반응이 오는가"
            }
            description={
              view === "queries" ? "검색어별 노출은 수요, CTR은 검색결과 매력도, 순위는 SEO 경쟁력을 보는 기준입니다." :
              view === "pages" ? "페이지별 클릭과 CTR로 검색 유입을 만드는 콘텐츠와 개선이 필요한 페이지를 구분합니다." :
              view === "countries" ? "국가별 검색 반응으로 언어, 지역 콘텐츠, 배포 우선순위를 판단합니다." :
              "기기별 CTR과 순위 차이로 모바일/데스크톱 검색 경험 개선 우선순위를 판단합니다."
            }
          />
        </div>
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
              if (rows.length === 0) {
                return <tr><td colSpan={5}><EmptyRows /></td></tr>;
              }
              return rows.map((r) => {
                const rawKey =
                  view === "queries" ? (r as GSCData["queries"][0]).query :
                  view === "pages" ? (r as GSCData["pages"][0]).page :
                  view === "countries" ? ((r as NonNullable<GSCData["countries"]>[0]).country) :
                  ((r as NonNullable<GSCData["devices"]>[0]).device);
                const label =
                  view === "countries" ? formatCountry(rawKey) :
                  view === "devices" ? formatDevice(rawKey) :
                  rawKey;
                return (
                  <tr key={rawKey} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a]">
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
