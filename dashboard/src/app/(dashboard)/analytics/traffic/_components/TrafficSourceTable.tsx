import type { SourceBreakdownRow } from "@/lib/analytics/traffic";

const fmtNum = (value: number) => value.toLocaleString();
const fmtPct = (value: number | null) => (value == null ? "-" : `${value.toFixed(1)}%`);

function DeltaCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[#555]">-</span>;
  if (value === 0) return <span className="text-[#666]">0</span>;
  return <span className={value > 0 ? "text-emerald-400" : "text-orange-400"}>{value > 0 ? "+" : ""}{fmtNum(value)}</span>;
}

export function TrafficSourceTable({ rows, compareLabel }: { rows: SourceBreakdownRow[]; compareLabel: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#222] bg-[#141414]">
      <div className="border-b border-[#222] px-4 py-3">
        <div className="text-sm font-medium">유입 소스 상세</div>
        <div className="text-xs text-[#666]">세션별 최초 page_view 기준으로 1개 소스만 귀속</div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-[#111] text-[#777]">
            <tr>
              <th className="px-4 py-3 text-left font-medium">소스</th>
              <th className="px-4 py-3 text-left font-medium">채널</th>
              <th className="px-4 py-3 text-right font-medium">현재 세션</th>
              <th className="px-4 py-3 text-right font-medium">{compareLabel} 세션</th>
              <th className="px-4 py-3 text-right font-medium">세션 증감</th>
              <th className="px-4 py-3 text-right font-medium">현재 전환</th>
              <th className="px-4 py-3 text-right font-medium">{compareLabel} 전환</th>
              <th className="px-4 py-3 text-right font-medium">현재 전환율</th>
              <th className="px-4 py-3 text-right font-medium">{compareLabel} 전환율</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[#666]">소스 데이터가 없습니다.</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.sourceKey} className="border-t border-[#1d1d1d]">
                  <td className="px-4 py-3 align-top text-white">
                    <div className="font-medium">{row.sourceLabel}</div>
                    <div className="text-xs text-[#666]">{row.sourceDomain ?? row.sourceKey}</div>
                  </td>
                  <td className="px-4 py-3 align-top text-[#bbb]">{row.channel}</td>
                  <td className="px-4 py-3 text-right text-white">{fmtNum(row.sessionsCurrent)}</td>
                  <td className="px-4 py-3 text-right text-[#999]">{row.sessionsPrevious == null ? "-" : fmtNum(row.sessionsPrevious)}</td>
                  <td className="px-4 py-3 text-right"><DeltaCell value={row.sessionsDelta} /></td>
                  <td className="px-4 py-3 text-right text-white">{fmtNum(row.conversionsCurrent)}</td>
                  <td className="px-4 py-3 text-right text-[#999]">{row.conversionsPrevious == null ? "-" : fmtNum(row.conversionsPrevious)}</td>
                  <td className="px-4 py-3 text-right text-white">{fmtPct(row.conversionRateCurrent)}</td>
                  <td className="px-4 py-3 text-right text-[#999]">{fmtPct(row.conversionRatePrevious)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
