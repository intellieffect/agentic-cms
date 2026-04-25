"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  GalleryItemWithCover,
  GalleryCoverAspect,
  GalleryKind,
} from "@/lib/types";
import {
  GALLERY_KINDS as KIND_OPTIONS,
  GALLERY_COVER_ASPECTS as ASPECT_OPTIONS,
} from "@/lib/gallery-constants";
import { updateGalleryMeta } from "../actions";

export function GalleryMetaForm({ item }: { item: GalleryItemWithCover }) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(item.title);
  const [subtitle, setSubtitle] = useState(item.subtitle ?? "");
  const [summary, setSummary] = useState(item.summary ?? "");
  const [author, setAuthor] = useState(item.author ?? "");
  const [duration, setDuration] = useState(
    item.duration_minutes?.toString() ?? ""
  );
  const [aspect, setAspect] = useState<GalleryCoverAspect>(item.cover_aspect);
  const [tagsInput, setTagsInput] = useState(item.tags.join(", "));
  const [kinds, setKinds] = useState<GalleryKind[]>(
    item.kinds && item.kinds.length > 0 ? item.kinds : [item.kind]
  );
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const toggleKind = (k: GalleryKind) => {
    setKinds((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
  };

  const save = () => {
    if (kinds.length === 0) return;
    startTransition(async () => {
      await updateGalleryMeta(item.id, {
        title,
        subtitle: subtitle || null,
        summary: summary || null,
        author: author || null,
        duration_minutes: duration ? Number.parseInt(duration, 10) : null,
        cover_aspect: aspect,
        kinds,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      setSavedAt(new Date().toLocaleTimeString("ko-KR"));
    });
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      {/* 편집 영역 */}
      <div className="space-y-4">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Subtitle (1줄)">
          <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </Field>
        <Field label="Summary">
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={3}
          />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Author">
            <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
          </Field>
          <Field label="Duration (min)">
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </Field>
          <Field label="Cover Aspect">
            <Select value={aspect} onValueChange={(v) => setAspect(v as GalleryCoverAspect)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_OPTIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <Field label="Kinds (다중 선택, 첫 번째가 primary ★)">
          <div className="flex flex-wrap gap-2">
            {KIND_OPTIONS.map((k) => {
              const active = kinds.includes(k);
              const isPrimary = active && kinds[0] === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggleKind(k)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    active
                      ? isPrimary
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {k}
                  {isPrimary && <span className="ml-1 opacity-70">★</span>}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Tags (쉼표 구분)">
          <Input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="landing, ad, beauty"
          />
        </Field>

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending}>
            {pending ? "저장 중…" : "저장"}
          </Button>
          {savedAt && (
            <span className="text-xs text-muted-foreground">
              저장됨 · {savedAt}
            </span>
          )}
        </div>
      </div>

      {/* 미리보기 */}
      <aside className="rounded-lg border border-border bg-muted/10 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Cover Preview
        </div>
        {item.cover_url ? (
          item.cover_mime?.startsWith("video/") ? (
            <video
              src={item.cover_url}
              controls
              muted
              className="w-full rounded-md"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.cover_url} alt={item.title} className="w-full rounded-md" />
          )
        ) : (
          <div className="flex h-40 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
            cover 없음
          </div>
        )}

        <dl className="mt-4 space-y-2 text-xs">
          <MetaRow label="ID" value={item.id} />
          <MetaRow label="Kind" value={item.kind} />
          <MetaRow label="Status" value={item.status} />
          <MetaRow label="Visibility" value={item.visibility} />
          <MetaRow label="Featured" value={item.is_featured ? `rank ${item.featured_rank ?? "—"}` : "no"} />
          <MetaRow label="Published" value={item.published_at?.slice(0, 10) ?? "—"} />
          <MetaRow label="Updated" value={item.updated_at.slice(0, 10)} />
        </dl>
      </aside>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-right">{value}</dd>
    </div>
  );
}
