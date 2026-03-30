"use client";

import { useState, useMemo } from "react";
import type { Publication } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { formatDate, truncate } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface PublicationsTableProps {
  publications: Publication[];
}

export function PublicationsTable({ publications }: PublicationsTableProps) {
  const [channelFilter, setChannelFilter] = useState("");

  const channels = useMemo(() => {
    const set = new Set<string>();
    publications.forEach((p) => set.add(p.channel));
    return Array.from(set).sort();
  }, [publications]);

  const filtered = channelFilter
    ? publications.filter((p) => p.channel === channelFilter)
    : publications;

  return (
    <>
      <div className="mb-4">
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Channels</option>
          {channels.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No publications yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-3 font-medium text-muted-foreground">Content</th>
                <th className="pb-3 font-medium text-muted-foreground">Channel</th>
                <th className="pb-3 font-medium text-muted-foreground">Published</th>
                <th className="pb-3 font-medium text-muted-foreground">URL</th>
                <th className="pb-3 font-medium text-muted-foreground">Metrics</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pub) => (
                <tr key={pub.id} className="border-b border-border/50">
                  <td className="py-3 pr-4">
                    {pub.contents?.title
                      ? truncate(pub.contents.title, 40)
                      : "—"}
                  </td>
                  <td className="py-3 pr-4">
                    <Badge variant="secondary">{pub.channel}</Badge>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {formatDate(pub.published_at)}
                  </td>
                  <td className="py-3 pr-4">
                    {pub.url ? (
                      <a
                        href={pub.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Link
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-3">
                    {pub.metrics ? (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(pub.metrics).map(([key, value]) => (
                          <Badge key={key} variant="secondary">
                            {key}: {String(value)}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
