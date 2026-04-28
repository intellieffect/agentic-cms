"use client";

import { useState } from "react";
import {
  AEO_ENGINES,
  ENGINE_LABEL,
  type AeoEngine,
  type AeoFinalRow,
  type AeoQuery,
  type AeoResultRow,
} from "@/lib/aeo";
import { fetchCellResults } from "./actions";

const JUDGMENT_BADGE: Record<string, { label: string; cls: string }> = {
  recommendation: {
    label: "추천",
    cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  },
  citation: {
    label: "인용",
    cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  },
  mention: {
    label: "언급",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  },
  none: {
    label: "—",
    cls: "bg-muted text-muted-foreground",
  },
  negative: {
    label: "부정",
    cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
  },
};

interface Props {
  queries: AeoQuery[];
  finals: AeoFinalRow[];
  runDate: string | null;
}

export default function ResultsMatrix({ queries, finals, runDate }: Props) {
  // (queryId, engine) → final
  const finalIdx = new Map<string, AeoFinalRow>();
  for (const f of finals) finalIdx.set(`${f.query_id}::${f.engine}`, f);

  const [open, setOpen] = useState<{
    queryId: string;
    engine: AeoEngine;
    query: AeoQuery;
  } | null>(null);
  const [drill, setDrill] = useState<AeoResultRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  if (!runDate) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        측정 결과 없음 — cron 첫 실행 후 표시
      </div>
    );
  }

  const onDrill = async (q: AeoQuery, engine: AeoEngine) => {
    if (!runDate) return;
    setOpen({ queryId: q.id, engine, query: q });
    setDrill(null);
    setLoading(true);
    try {
      const rows = await fetchCellResults(q.id, engine, runDate);
      setDrill(rows);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Keyword</th>
              <th className="px-3 py-2 text-left font-medium">Type</th>
              <th className="px-3 py-2 text-left font-medium">Query</th>
              {AEO_ENGINES.map((e) => (
                <th key={e} className="px-3 py-2 text-center font-medium">
                  {ENGINE_LABEL[e]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queries.map((q) => (
              <tr key={q.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="px-3 py-2 font-medium">{q.keyword}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {q.query_type}
                </td>
                <td
                  className="max-w-[420px] truncate px-3 py-2 text-muted-foreground"
                  title={q.query_text}
                >
                  {q.query_text}
                </td>
                {AEO_ENGINES.map((e) => {
                  const fr = finalIdx.get(`${q.id}::${e}`);
                  const badge = fr
                    ? JUDGMENT_BADGE[fr.final_judgment] ?? JUDGMENT_BADGE.none
                    : null;
                  return (
                    <td key={e} className="px-2 py-2 text-center">
                      {fr ? (
                        <button
                          type="button"
                          onClick={() => onDrill(q, e)}
                          className={`inline-flex min-w-[3.2rem] items-center justify-center rounded px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80 ${badge!.cls}`}
                          title={`consistency=${fr.consistency != null ? Math.round(fr.consistency * 100) + "%" : "?"}${fr.changed ? " · 변동" : ""}`}
                        >
                          {badge!.label}
                          {fr.changed ? " ↑" : ""}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">·</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4"
          onClick={() => setOpen(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg border bg-card p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {open.query.keyword} · {open.query.query_type} ·{" "}
                  {ENGINE_LABEL[open.engine]}
                </div>
                <div className="mt-1 text-sm">{open.query.query_text}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label="close"
              >
                ✕
              </button>
            </div>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                로딩…
              </div>
            ) : drill && drill.length > 0 ? (
              <div className="space-y-3">
                {drill.map((r) => {
                  const badge =
                    JUDGMENT_BADGE[r.judgment] ?? JUDGMENT_BADGE.none;
                  return (
                    <div
                      key={r.id}
                      className="rounded border bg-background/60 p-3 text-sm"
                    >
                      <div className="mb-2 flex items-center gap-2 text-xs">
                        <span className="font-mono text-muted-foreground">
                          attempt {r.attempt}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                        {r.api_latency_ms != null ? (
                          <span className="text-muted-foreground">
                            {r.api_latency_ms}ms
                          </span>
                        ) : null}
                        {r.error ? (
                          <span className="text-rose-500">err: {r.error}</span>
                        ) : null}
                      </div>
                      {r.match_context ? (
                        <div className="mb-2 rounded bg-muted/40 px-2 py-1 text-xs italic text-muted-foreground">
                          ±100자: {r.match_context}
                        </div>
                      ) : null}
                      <pre className="whitespace-pre-wrap text-xs leading-relaxed">
                        {r.response_text ?? "(empty)"}
                      </pre>
                      {r.citations && r.citations.length > 0 ? (
                        <div className="mt-2 border-t pt-2 text-xs">
                          <div className="mb-1 text-muted-foreground">
                            citations ({r.citations.length})
                          </div>
                          <ul className="space-y-1">
                            {r.citations.map((u, i) => (
                              <li key={i} className="truncate">
                                <a
                                  href={u}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="text-blue-500 hover:underline"
                                >
                                  {u}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                해당 cell raw row 없음
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
