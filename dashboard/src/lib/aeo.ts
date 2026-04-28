import { getSupabase } from "./supabase";

// brxce.ai/packages/aeo 의 EngineKey 와 동일. 신규 엔진 추가 시 양쪽 동기.
// (DB CHECK constraint: aeo_results_engine_check)
export const AEO_ENGINES = ["chatgpt", "perplexity", "google_aio", "claude"] as const;
export type AeoEngine = (typeof AEO_ENGINES)[number];

export const ENGINE_LABEL: Record<AeoEngine, string> = {
  chatgpt: "ChatGPT",
  perplexity: "Perplexity",
  google_aio: "Gemini",
  claude: "Claude",
};

// 5단계 판정 (brxce.ai/packages/aeo/src/judge.ts).
export type AeoJudgmentType =
  | "negative"
  | "none"
  | "mention"
  | "citation"
  | "recommendation";

export interface AeoQuery {
  id: string;
  keyword: string;
  keyword_type: "market" | "brand";
  query_text: string;
  query_type: "info" | "recommend" | "compare" | "problem" | "case";
  language: string;
  is_active: boolean;
}

export interface AeoFinalRow {
  id: string;
  query_id: string;
  engine: AeoEngine;
  run_date: string;
  final_judgment: AeoJudgmentType;
  final_score: number;
  consistency: number | null;
  prev_judgment: AeoJudgmentType | null;
  changed: boolean;
  first_detected_at: string | null;
  attempt_judgments: { type: AeoJudgmentType; score: number }[] | null;
}

export interface AeoResultRow {
  id: string;
  query_id: string;
  engine: AeoEngine;
  run_id: string;
  run_date: string;
  attempt: number;
  response_text: string | null;
  citations: string[] | null;
  judgment: AeoJudgmentType;
  score: number;
  matched_brands: string[] | null;
  matched_urls: string[] | null;
  match_context: string | null;
  competitor_mentions: { name: string }[] | null;
  api_latency_ms: number | null;
  error: string | null;
  created_at: string;
}

// ── Queries (정적 마스터) ─────────────────────────────────
export async function loadAeoQueries(): Promise<AeoQuery[]> {
  const supa = getSupabase();
  const { data, error } = await supa
    .from("aeo_queries")
    .select("*")
    .eq("is_active", true)
    .order("keyword", { ascending: true })
    .order("query_type", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AeoQuery[];
}

// ── Final results (다수결 확정) ────────────────────────────
// 최근 N일 final results — 시계열 차트 source.
export async function loadFinalResultsRecent(days = 30): Promise<AeoFinalRow[]> {
  const supa = getSupabase();
  const since = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data, error } = await supa
    .from("aeo_final_results")
    .select(
      "id, query_id, engine, run_date, final_judgment, final_score, consistency, prev_judgment, changed, first_detected_at, attempt_judgments",
    )
    .gte("run_date", since)
    .order("run_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AeoFinalRow[];
}

// 마지막 run_date 의 모든 final results — 매트릭스 source.
export async function loadFinalResultsLatest(): Promise<{
  rows: AeoFinalRow[];
  runDate: string | null;
}> {
  const supa = getSupabase();
  const { data: dates, error: dErr } = await supa
    .from("aeo_final_results")
    .select("run_date")
    .order("run_date", { ascending: false })
    .limit(1);
  if (dErr) throw dErr;
  const runDate = dates?.[0]?.run_date ?? null;
  if (!runDate) return { rows: [], runDate: null };

  const { data, error } = await supa
    .from("aeo_final_results")
    .select(
      "id, query_id, engine, run_date, final_judgment, final_score, consistency, prev_judgment, changed, first_detected_at, attempt_judgments",
    )
    .eq("run_date", runDate);
  if (error) throw error;
  return { rows: (data ?? []) as AeoFinalRow[], runDate };
}

// ── Raw results (드릴다운) ─────────────────────────────────
export async function loadResultsForCell(
  queryId: string,
  engine: AeoEngine,
  runDate: string,
): Promise<AeoResultRow[]> {
  const supa = getSupabase();
  const { data, error } = await supa
    .from("aeo_results")
    .select(
      "id, query_id, engine, run_id, run_date, attempt, response_text, citations, judgment, score, matched_brands, matched_urls, match_context, competitor_mentions, api_latency_ms, error, created_at",
    )
    .eq("query_id", queryId)
    .eq("engine", engine)
    .eq("run_date", runDate)
    .order("attempt", { ascending: true });
  if (error) throw error;
  return (data ?? []) as AeoResultRow[];
}

// ── Aggregations ───────────────────────────────────────────

// Share of Voice — N×Q 표본에서 brand-present(mention/citation/recommendation) 비율.
// 엔진별 × run_date별. 시계열 차트에 그대로 쓰임.
export interface SovPoint {
  run_date: string;
  engine: AeoEngine;
  sov: number; // 0~1
  presentCount: number;
  totalCount: number;
}

export function computeSovTimeseries(rows: AeoFinalRow[]): SovPoint[] {
  const buckets = new Map<string, { present: number; total: number }>();
  for (const r of rows) {
    const k = `${r.run_date}::${r.engine}`;
    const b = buckets.get(k) ?? { present: 0, total: 0 };
    b.total += 1;
    if (
      r.final_judgment === "mention" ||
      r.final_judgment === "citation" ||
      r.final_judgment === "recommendation"
    ) {
      b.present += 1;
    }
    buckets.set(k, b);
  }
  const points: SovPoint[] = [];
  for (const [k, v] of buckets) {
    const [run_date, engine] = k.split("::") as [string, AeoEngine];
    points.push({
      run_date,
      engine,
      sov: v.total > 0 ? v.present / v.total : 0,
      presentCount: v.present,
      totalCount: v.total,
    });
  }
  return points.sort((a, b) =>
    a.run_date < b.run_date ? -1 : a.run_date > b.run_date ? 1 : 0,
  );
}

// recharts 친화적 wide-format. 한 행에 run_date + 엔진별 sov 컬럼.
export function pivotSovForChart(
  points: SovPoint[],
): Array<{ run_date: string } & Partial<Record<AeoEngine, number>>> {
  const map = new Map<
    string,
    { run_date: string } & Partial<Record<AeoEngine, number>>
  >();
  for (const p of points) {
    const row = map.get(p.run_date) ?? { run_date: p.run_date };
    row[p.engine] = Math.round(p.sov * 1000) / 10; // 백분율 1자리
    map.set(p.run_date, row);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.run_date < b.run_date ? -1 : a.run_date > b.run_date ? 1 : 0,
  );
}

// Repeatability 평균 (consistency 평균).
export function computeAvgRepeatability(rows: AeoFinalRow[]): {
  avg: number; // 0~1
  byEngine: Partial<Record<AeoEngine, number>>;
} {
  let sum = 0;
  let count = 0;
  const eng = new Map<AeoEngine, { sum: number; count: number }>();
  for (const r of rows) {
    if (r.consistency == null) continue;
    sum += r.consistency;
    count += 1;
    const b = eng.get(r.engine) ?? { sum: 0, count: 0 };
    b.sum += r.consistency;
    b.count += 1;
    eng.set(r.engine, b);
  }
  const byEngine: Partial<Record<AeoEngine, number>> = {};
  for (const [k, v] of eng) {
    byEngine[k] = v.count > 0 ? v.sum / v.count : 0;
  }
  return { avg: count > 0 ? sum / count : 0, byEngine };
}

// 경쟁자 co-mention top N — final_results 에는 competitor 정보가 없어 raw results
// (aeo_results.competitor_mentions) 에서 집계 필요. 최근 run 기준.
export async function loadTopCompetitors(
  runDate: string,
  limit = 10,
): Promise<{ name: string; count: number }[]> {
  const supa = getSupabase();
  const { data, error } = await supa
    .from("aeo_results")
    .select("competitor_mentions")
    .eq("run_date", runDate);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const ms = (row as { competitor_mentions?: unknown[] }).competitor_mentions;
    if (!Array.isArray(ms)) continue;
    for (const m of ms) {
      const name =
        typeof m === "string"
          ? m
          : typeof (m as { name?: unknown })?.name === "string"
            ? (m as { name: string }).name
            : null;
      if (!name) continue;
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
