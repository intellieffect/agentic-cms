"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { AEO_ENGINES, ENGINE_LABEL, type AeoEngine } from "@/lib/aeo";

const ENGINE_COLORS: Record<AeoEngine, string> = {
  chatgpt: "#10a37f",
  perplexity: "#20c0c4",
  google_aio: "#4285f4",
  claude: "#d97706",
};

interface Props {
  data: Array<{ run_date: string } & Partial<Record<AeoEngine, number>>>;
}

export default function SovChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        측정 데이터 없음 — cron 첫 실행 후 표시
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="run_date"
          fontSize={12}
          tickFormatter={(s: string) => s.slice(5)}
        />
        <YAxis fontSize={12} unit="%" domain={[0, 100]} />
        <Tooltip
          formatter={(v: number) => `${v}%`}
          contentStyle={{
            background: "hsl(var(--background))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
          }}
        />
        <Legend formatter={(v: string) => ENGINE_LABEL[v as AeoEngine] ?? v} />
        {AEO_ENGINES.map((e) => (
          <Line
            key={e}
            type="monotone"
            dataKey={e}
            stroke={ENGINE_COLORS[e]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
