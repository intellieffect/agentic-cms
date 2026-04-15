import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChannelBreakdownRow, MetricComparison, PageBreakdownRow, TrafficCompareApiResponse } from "@/lib/analytics/traffic";
import { TrafficSourceTable } from "./TrafficSourceTable";

const fmtNum = (value: number) => value.toLocaleString();
const fmtPct = (value: number) => `${value.toFixed(1)}%`;
const fmtSigned = (value: number) => `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
const fmtMetric = (metric: MetricComparison, kind: "number" | "rate" | "ratio" = "number") => {
  if (kind === "rate") return fmtPct(metric.current);
  if (kind === "ratio") return metric.current.toFixed(1);
  return fmtNum(metric.current);
};

function DeltaBadge({ metric, kind = "number" }: { metric: MetricComparison; kind?: "number" | "rate" | "ratio" }) {
  if (metric.delta == null) return <span className="text-xs text-[#555]">비교 안 함</span>;
  if (metric.delta === 0) return <span className="text-xs text-[#555]">변화 없음</span>;
  const label = kind === "rate"
    ? `${metric.delta > 0 ? "+" : ""}${metric.delta.toFixed(1)}%p`
    : kind === "ratio"
      ? `${metric.delta > 0 ? "+" : ""}${metric.delta.toFixed(1)}`
      : `${metric.delta > 0 ? "+" : ""}${fmtNum(metric.delta)}`;
  return (
    <span className={`text-xs font-medium ${metric.delta > 0 ? "text-emerald-400" : "text-orange-400"}`}>
      {metric.delta > 0 ? "↑" : "↓"} {label}
      {metric.deltaPct != null && kind === "number" ? ` (${fmtSigned(metric.deltaPct)})` : ""}
    </span>
  );
}

function StatCard({ title, metric, kind = "number" }: { title: string; metric: MetricComparison; kind?: "number" | "rate" | "ratio" }) {
  return (
    <div className="rounded-xl border border-[#222] bg-[#141414] p-5">
      <div className="mb-1 text-xs text-[#888]">{title}</div>
      <div className="text-3xl font-bold text-white">{fmtMetric(metric, kind)}</div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <DeltaBadge metric={metric} kind={kind} />
        <span className="text-xs text-[#666]">
          {metric.previous == null ? "" : `이전 ${kind === "rate" ? fmtPct(metric.previous) : kind === "ratio" ? metric.previous.toFixed(1) : fmtNum(metric.previous)}`}
        </span>
      </div>
    </div>
  );
}

function SimpleCompareTable({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Array<PageBreakdownRow | ChannelBreakdownRow>;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#222] bg-[#141414]">
      <div className="border-b border-[#222] px-4 py-3">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-[#666]">{subtitle}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#111] text-[#777]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">이름</th>
              <th className="px-4 py-3 text-right font-medium">현재 세션</th>
              <th className="px-4 py-3 text-right font-medium">이전 세션</th>
              <th className="px-4 py-3 text-right font-medium">현재 전환</th>
              <th className="px-4 py-3 text-right font-medium">이전 전환</th>
              <th className="px-4 py-3 text-right font-medium">현재 전환율</th>
              <th className="px-4 py-3 text-right font-medium">이전 전환율</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#666]">데이터가 없습니다.</td>
              </tr>
            ) : (
              rows.map((row) => {
                const label = "url" in row ? row.title : row.channel;
                const sublabel = "url" in row ? row.url : null;
                return (
                  <tr key={"url" in row ? row.key : row.channel} className="border-t border-[#1d1d1d]">
                    <td className="px-4 py-3 align-top text-white">
                      <div className="font-medium">{label}</div>
                      {sublabel ? <div className="text-xs text-[#666]">{sublabel}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-right text-white">{fmtNum(row.sessionsCurrent)}</td>
                    <td className="px-4 py-3 text-right text-[#999]">{row.sessionsPrevious == null ? "-" : fmtNum(row.sessionsPrevious)}</td>
                    <td className="px-4 py-3 text-right text-white">{fmtNum(row.conversionsCurrent)}</td>
                    <td className="px-4 py-3 text-right text-[#999]">{row.conversionsPrevious == null ? "-" : fmtNum(row.conversionsPrevious)}</td>
                    <td className="px-4 py-3 text-right text-white">{fmtPct(row.conversionRateCurrent)}</td>
                    <td className="px-4 py-3 text-right text-[#999]">{row.conversionRatePrevious == null ? "-" : fmtPct(row.conversionRatePrevious)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TrafficCompareView({ data }: { data: TrafficCompareApiResponse }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <StatCard title="방문 세션" metric={data.summary.sessions} />
        <StatCard title="순방문자" metric={data.summary.visitors} />
        <StatCard title="전환 수" metric={data.summary.conversions} />
        <StatCard title="전환율" metric={data.summary.conversionRate} kind="rate" />
        <StatCard title="읽힘률" metric={data.summary.readRate} kind="rate" />
        <StatCard title="세션당 평균 페이지 수" metric={data.summary.pagesPerSession} kind="ratio" />
      </div>

      <section className="rounded-xl border border-[#222] bg-[#141414] p-4">
        <div className="mb-4">
          <div className="text-sm font-medium">기간 비교 추세</div>
          <div className="text-xs text-[#666]">세션 · 전환 수 · 전환율</div>
        </div>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={data.trends}>
            <CartesianGrid stroke="#222" strokeDasharray="3 3" />
            <XAxis dataKey="currentLabel" stroke="#666" tick={{ fill: "#888", fontSize: 11 }} />
            <YAxis yAxisId="count" stroke="#666" tick={{ fill: "#888", fontSize: 11 }} allowDecimals={false} />
            <YAxis yAxisId="rate" orientation="right" stroke="#666" tick={{ fill: "#888", fontSize: 11 }} domain={[0, "auto"]} />
            <Tooltip contentStyle={{ backgroundColor: "#111", border: "1px solid #333", borderRadius: 12 }} labelStyle={{ color: "#bbb" }} />
            <Legend />
            <Line yAxisId="count" type="monotone" dataKey="sessionsCurrent" name="현재 세션" stroke="#82ca9d" strokeWidth={2.5} dot={false} />
            <Line yAxisId="count" type="monotone" dataKey="conversionsCurrent" name="현재 전환" stroke="#8884d8" strokeWidth={2.5} dot={false} />
            <Line yAxisId="rate" type="monotone" dataKey="conversionRateCurrent" name="현재 전환율" stroke="#4ECDC4" strokeWidth={2} dot={false} />
            {data.meta.compareMode === "previous" ? (
              <>
                <Line yAxisId="count" type="monotone" dataKey="sessionsPrevious" name="이전 세션" stroke="#82ca9d" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                <Line yAxisId="count" type="monotone" dataKey="conversionsPrevious" name="이전 전환" stroke="#8884d8" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
                <Line yAxisId="rate" type="monotone" dataKey="conversionRatePrevious" name="이전 전환율" stroke="#4ECDC4" strokeWidth={1.5} dot={false} strokeDasharray="5 5" />
              </>
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SimpleCompareTable title="상위 페이지" subtitle="세션 기준 상위 랜딩/방문 페이지" rows={data.breakdown.pages} />
        <SimpleCompareTable title="채널 요약" subtitle="기존 채널 분류 요약" rows={data.breakdown.channels} />
      </div>

      <TrafficSourceTable rows={data.breakdown.sources} compareLabel="이전" />
    </div>
  );
}
