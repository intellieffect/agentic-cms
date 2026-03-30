"use client";

import { useRouter } from "next/navigation";
import { type ColumnDef } from "@tanstack/react-table";
import type { Content } from "@/lib/types";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table/column-header";
import { Badge } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

const statusVariant: Record<string, "secondary" | "info" | "success"> = {
  draft: "secondary",
  review: "info",
  published: "success",
};

const columns: ColumnDef<Content, unknown>[] = [
  {
    accessorKey: "title",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Title" />,
    cell: ({ row }) => (
      <div className="max-w-[300px]">
        <div className="truncate font-medium">{row.getValue("title")}</div>
        <div className="truncate text-xs text-muted-foreground">{row.original.slug}</div>
      </div>
    ),
  },
  {
    accessorKey: "slug",
    header: () => null,
    cell: () => null,
    enableHiding: true,
    enableSorting: false,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={statusVariant[status] ?? "secondary"}>
          {status}
        </Badge>
      );
    },
    filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    enableSorting: false,
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <span className="text-sm">{row.getValue("category") ?? "—"}</span>
    ),
    filterFn: (row, id, value: string[]) => value.includes(row.getValue(id) as string),
    enableSorting: false,
  },
  {
    accessorKey: "tags",
    header: "Tags",
    cell: ({ row }) => {
      const rawTags = row.original.tags;
      const tags = Array.isArray(rawTags) ? rawTags : [];
      if (!tags.length) return <span className="text-muted-foreground">—</span>;
      return (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {tags.length > 3 && (
            <Badge variant="outline" className="text-xs">+{tags.length - 3}</Badge>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    accessorKey: "updated_at",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Updated" />,
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {formatRelativeTime(row.getValue("updated_at"))}
      </span>
    ),
  },
];

interface ContentsTableProps {
  data: Content[];
}

export function ContentsTable({ data }: ContentsTableProps) {
  const router = useRouter();

  // Derive unique categories for faceted filter
  const categories = Array.from(new Set(data.map((c) => c.category).filter(Boolean))) as string[];

  return (
    <DataTable
      columns={columns}
      data={data}
      initialColumnVisibility={{ slug: false }}
      searchPlaceholder="Search contents..."
      filters={[
        {
          columnId: "status",
          title: "Status",
          options: [
            { label: "Draft", value: "draft" },
            { label: "Review", value: "review" },
            { label: "Published", value: "published" },
          ],
        },
        ...(categories.length > 0
          ? [
              {
                columnId: "category",
                title: "Category",
                options: categories.map((c) => ({ label: c, value: c })),
              },
            ]
          : []),
      ]}
      onRowClick={(row) => router.push(`/contents/${row.id}`)}
    />
  );
}
