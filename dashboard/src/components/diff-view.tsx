"use client";

import { useMemo } from "react";
import { diffWords } from "diff";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface DiffViewProps {
  fieldName: string;
  from: string;
  to: string;
}

function renderDiff(from: string, to: string, side: "from" | "to") {
  const changes = diffWords(from, to);

  return changes.map((part, i) => {
    if (part.added) {
      return side === "to" ? (
        <span key={i} className="bg-success/20 text-success">{part.value}</span>
      ) : null;
    }
    if (part.removed) {
      return side === "from" ? (
        <span key={i} className="bg-destructive/20 text-destructive line-through">{part.value}</span>
      ) : null;
    }
    return <span key={i}>{part.value}</span>;
  });
}

export function DiffField({ fieldName, from, to }: DiffViewProps) {
  const fromRendered = useMemo(() => renderDiff(from, to, "from"), [from, to]);
  const toRendered = useMemo(() => renderDiff(from, to, "to"), [from, to]);

  if (from === to) return null;

  return (
    <div className="space-y-2">
      <Badge variant="outline" className="text-xs">{fieldName}</Badge>
      <div className="grid gap-3 md:grid-cols-2">
        {/* From (Payload FieldDiffContainer pattern) */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Agent Version</div>
          <div className="whitespace-pre-wrap text-sm">{fromRendered}</div>
        </div>
        {/* To */}
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="mb-1 text-xs font-medium text-muted-foreground">Human Edit</div>
          <div className="whitespace-pre-wrap text-sm">{toRendered}</div>
        </div>
      </div>
    </div>
  );
}

interface RevisionDiffViewProps {
  delta: Record<string, { from: unknown; to: unknown }>;
}

export function RevisionDiffView({ delta }: RevisionDiffViewProps) {
  const fields = Object.entries(delta);

  if (fields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">No changes in this revision.</div>
    );
  }

  return (
    <div className="space-y-4">
      {fields.map(([field, { from, to }]) => (
        <DiffField
          key={field}
          fieldName={field}
          from={String(from ?? "")}
          to={String(to ?? "")}
        />
      ))}
    </div>
  );
}
