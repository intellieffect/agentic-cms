import {
  AEO_ENGINES,
  ENGINE_LABEL,
  computeAvgRepeatability,
  computeSovTimeseries,
  loadAeoQueries,
  loadFinalResultsLatest,
  loadFinalResultsRecent,
  loadTopCompetitors,
  pivotSovForChart,
} from "@/lib/aeo";
import SovChart from "./sov-chart";
import ResultsMatrix from "./results-matrix";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AeoPage() {
  // 데이터 fetch — 부재 시 빈 상태 그라풀.
  const [queries, recent, latest] = await Promise.all([
    loadAeoQueries().catch(() => []),
    loadFinalResultsRecent(30).catch(() => []),
    loadFinalResultsLatest().catch(() => ({ rows: [], runDate: null })),
  ]);

  const sovChart = pivotSovForChart(computeSovTimeseries(recent));
  const rep = computeAvgRepeatability(recent);
  const competitors = latest.runDate
    ? await loadTopCompetitors(latest.runDate, 10).catch(() => [])
    : [];

  return (
    <div className="space-y-6 p-6">
      {/* 헤더 */}
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AEO Visibility</h1>
        <p className="text-sm text-muted-foreground">
          AI 검색 엔진(ChatGPT · Perplexity · Gemini · Claude)에서 AWC 브랜드가
          어떻게 인용되는지 측정. 매일 KST 09시 cron 자동 실행 → Supabase 저장.
        </p>
      </header>

      {/* KPI 요약 */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard
          label="Active Prompts"
          value={queries.length.toString()}
          hint="aeo_queries · is_active"
        />
        <KpiCard
          label="Engines"
          value={AEO_ENGINES.length.toString()}
          hint={AEO_ENGINES.map((e) => ENGINE_LABEL[e]).join(" · ")}
        />
        <KpiCard
          label="Last Run"
          value={latest.runDate ?? "—"}
          hint={`${latest.rows.length} cells`}
        />
        <KpiCard
          label="Repeatability"
          value={`${Math.round(rep.avg * 100)}%`}
          hint="avg consistency · 최근 30일"
        />
      </section>

      {/* SoV 시계열 */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">Share of Voice — 30일</h2>
          <span className="text-xs text-muted-foreground">
            mention + citation + recommendation 비율
          </span>
        </div>
        <SovChart data={sovChart} />
      </section>

      {/* 엔진별 Repeatability */}
      {Object.keys(rep.byEngine).length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">엔진별 Repeatability</h2>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {AEO_ENGINES.map((e) => {
              const v = rep.byEngine[e] ?? null;
              return (
                <div key={e} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="text-xs text-muted-foreground">
                    {ENGINE_LABEL[e]}
                  </div>
                  <div className="mt-0.5 font-mono text-base">
                    {v != null ? `${Math.round(v * 100)}%` : "—"}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            10-run 다수결의 일관성. &gt;70% strong / 30~70% moderate / &lt;30% volatile
            (Maximus Labs SoV methodology).
          </p>
        </section>
      ) : null}

      {/* 경쟁자 co-mention */}
      {competitors.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Top Competitors (마지막 run)</h2>
          <div className="flex flex-wrap gap-2">
            {competitors.map((c) => (
              <span
                key={c.name}
                className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs"
              >
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">{c.count}</span>
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {/* 매트릭스 + 드릴다운 */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">
            Results Matrix
            {latest.runDate ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {latest.runDate}
              </span>
            ) : null}
          </h2>
          <span className="text-xs text-muted-foreground">
            cell 클릭 → 10 attempts raw response
          </span>
        </div>
        <ResultsMatrix
          queries={queries}
          finals={latest.rows}
          runDate={latest.runDate}
        />
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums">{value}</div>
      {hint ? (
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
