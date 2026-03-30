"use client";

import { useState, useMemo } from "react";
import type { Content, ContentStatus } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { truncate, formatDate } from "@/lib/utils";
import { FileText, Eye, Globe } from "lucide-react";
interface PipelineBoardProps {
  drafts: Content[];
  inReview: Content[];
  published: Content[];
}

const columns: { key: ContentStatus; label: string; icon: typeof FileText; color: string }[] = [
  { key: "draft", label: "Draft", icon: FileText, color: "text-muted-foreground" },
  { key: "review", label: "In Review", icon: Eye, color: "text-info" },
  { key: "published", label: "Published", icon: Globe, color: "text-success" },
];

function ContentCard({
  content,
  onClick,
}: {
  content: Content;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-border bg-background p-4 hover:border-primary/50 transition-colors"
    >
      <p className="font-medium text-sm">{truncate(content.title, 40)}</p>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {content.category && (
          <Badge variant="secondary">{content.category}</Badge>
        )}
        {content.tags?.slice(0, 2).map((tag) => (
          <Badge key={tag} variant="secondary">
            {tag}
          </Badge>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        {formatDate(content.updated_at)}
      </p>
    </button>
  );
}

function ContentDetail({ content }: { content: Content }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
          Status
        </p>
        <Badge
          variant={
            content.status === "published"
              ? "success"
              : content.status === "review"
              ? "default"
              : "secondary"
          }
        >
          {content.status}
        </Badge>
      </div>

      {content.category && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Category
          </p>
          <p className="text-sm">{content.category}</p>
        </div>
      )}

      {content.hook && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Hook
          </p>
          <p className="text-sm">{content.hook}</p>
        </div>
      )}

      {content.core_message && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Core Message
          </p>
          <p className="text-sm">{content.core_message}</p>
        </div>
      )}

      {content.tags && content.tags.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Tags
          </p>
          <div className="flex flex-wrap gap-1">
            {content.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {content.funnel_stage && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Funnel Stage
          </p>
          <p className="text-sm">{content.funnel_stage}</p>
        </div>
      )}

      {content.cta && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            CTA
          </p>
          <p className="text-sm">{content.cta}</p>
        </div>
      )}

      {content.body_md && (
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Body
          </p>
          <div className="prose prose-invert prose-sm max-w-none mt-2 text-sm leading-relaxed">
            {content.body_md}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
        <p>Created: {formatDate(content.created_at)}</p>
        <p>Updated: {formatDate(content.updated_at)}</p>
        <p>Slug: {content.slug}</p>
      </div>
    </div>
  );
}

export function PipelineBoard({ drafts, inReview, published }: PipelineBoardProps) {
  const [selected, setSelected] = useState<Content | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  const allContents = useMemo(
    () => [...drafts, ...inReview, ...published],
    [drafts, inReview, published]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    allContents.forEach((c) => {
      if (c.category) set.add(c.category);
    });
    return Array.from(set).sort();
  }, [allContents]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    allContents.forEach((c) => {
      c.tags?.forEach((t) => set.add(t));
    });
    return Array.from(set).sort();
  }, [allContents]);

  function filterContents(contents: Content[]): Content[] {
    return contents.filter((c) => {
      if (categoryFilter && c.category !== categoryFilter) return false;
      if (tagFilter && !c.tags?.includes(tagFilter)) return false;
      return true;
    });
  }

  const columnData: Record<ContentStatus, Content[]> = {
    draft: filterContents(drafts),
    review: filterContents(inReview),
    published: filterContents(published),
  };

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All Tags</option>
          {allTags.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      {/* Kanban Board */}
      <div className="grid lg:grid-cols-3 gap-6">
        {columns.map((col) => (
          <div key={col.key}>
            <div className="flex items-center gap-2 mb-4">
              <col.icon className={`h-4 w-4 ${col.color}`} />
              <h2 className="font-semibold text-sm">{col.label}</h2>
              <span className="text-xs text-muted-foreground ml-auto">
                {columnData[col.key].length}
              </span>
            </div>
            <div className="space-y-3">
              {columnData[col.key].length === 0 ? (
                <p className="text-xs text-muted-foreground py-8 text-center">
                  No items
                </p>
              ) : (
                columnData[col.key].map((content) => (
                  <ContentCard
                    key={content.id}
                    content={content}
                    onClick={() => setSelected(content)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Detail Sheet */}
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={selected?.title}
      >
        {selected && <ContentDetail content={selected} />}
      </Sheet>
    </>
  );
}
