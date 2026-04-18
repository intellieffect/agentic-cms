"use client";

import Link from "next/link";
import { type ColumnDef } from "@tanstack/react-table";
import { ExternalLinkIcon } from "lucide-react";
import type { Publication } from "@/lib/types";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

const channelIcons: Record<string, string> = {
  blog: "📝",
  twitter: "𝕏",
  linkedin: "💼",
  newsletter: "📧",
};

const columns: ColumnDef<Publication, unknown>[] = [
  {
    accessorKey: "contents",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Content" />,
    cell: ({ row }) => {
      const contents = row.original.contents;
      const contentId = row.original.content_id;
      if (!contents?.title) {
        return <span className="font-medium text-muted-foreground">Unknown</span>;
      }
      return (
        <Link
          href={`/contents/${contentId}`}
          className="font-medium transition-colors hover:text-info hover:underline"
        >
          {contents.title}
        </Link>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "channel",
    header: "Channel",
    cell: ({ row }) => {
      const channel = row.getValue("channel") as string;
      return (
        <Badge variant="outline" className="gap-1">
          <span>{channelIcons[channel] ?? "📤"}</span>
          {channel}
        </Badge>
      );
    },
    filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    enableSorting: false,
  },
  {
    accessorKey: "url",
    header: "URL",
    cell: ({ row }) => {
      const url = row.getValue("url") as string | null;
      if (!url) return <span className="text-muted-foreground">—</span>;
      return (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-info hover:underline"
        >
          <ExternalLinkIcon className="h-3 w-3" />
          <span className="max-w-[200px] truncate">{url}</span>
        </a>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "published_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Published" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatRelativeTime(row.getValue("published_at"))}
      </span>
    ),
  },
  {
    accessorKey: "metrics",
    header: "Metrics",
    cell: ({ row }) => {
      const metrics = row.original.metrics;
      if (!metrics || Object.keys(metrics).length === 0) {
        return <span className="text-muted-foreground">—</span>;
      }
      return (
        <div className="flex gap-1">
          {Object.entries(metrics).slice(0, 3).map(([key, value]) => (
            <Badge key={key} variant="secondary" className="text-xs">
              {key}: {String(value)}
            </Badge>
          ))}
        </div>
      );
    },
    enableSorting: false,
  },
];

interface PublicationsTableProps {
  data: Publication[];
}

export function PublicationsTable({ data }: PublicationsTableProps) {
  const channels = Array.from(new Set(data.map((p) => p.channel)));

  return (
    <DataTable
      columns={columns}
      data={data}
      searchPlaceholder="Search publications..."
      filters={
        channels.length > 0
          ? [
              {
                columnId: "channel",
                title: "Channel",
                options: channels.map((c) => ({ label: c, value: c })),
              },
            ]
          : []
      }
    />
  );
}
