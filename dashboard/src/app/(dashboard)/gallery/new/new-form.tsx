"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  GalleryKind,
  GalleryCoverAspect,
  GalleryItemStatus,
  GalleryVisibility,
} from "@/lib/types";
import {
  GALLERY_IMAGE_MAX,
  GALLERY_VIDEO_MAX,
  GALLERY_KINDS as KIND_OPTIONS,
  GALLERY_COVER_ASPECTS as ASPECT_OPTIONS,
} from "@/lib/gallery-constants";

const STATUS_OPTIONS: GalleryItemStatus[] = ["draft", "published", "archived"];
const VISIBILITY_OPTIONS: GalleryVisibility[] = ["public", "member", "internal"];

function toKebab(s: string): string {
  return s
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function NewGalleryForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [kinds, setKinds] = useState<GalleryKind[]>(["image"]);
  const [coverAspect, setCoverAspect] = useState<GalleryCoverAspect>("16:9");
  const [subtitle, setSubtitle] = useState("");
  const [summary, setSummary] = useState("");
  const [author, setAuthor] = useState("");
  const [tags, setTags] = useState("");
  const [duration, setDuration] = useState("");
  const [status, setStatus] = useState<GalleryItemStatus>("draft");
  const [visibility, setVisibility] = useState<GalleryVisibility>("public");

  const isVideo = file?.type.startsWith("video/") ?? false;
  const sizeCap = isVideo ? GALLERY_VIDEO_MAX : GALLERY_IMAGE_MAX;
  const sizeOver = file ? file.size > sizeCap : false;

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // title 입력 시 slug 자동 생성 (사용자가 수동 편집한 적 없을 때만)
  const autoSlug = useMemo(() => toKebab(title), [title]);

  const onTitle = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(toKebab(v));
  };

  const onFile = (f: File | null) => {
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
    if (f?.type.startsWith("video/")) {
      setKinds((prev) =>
        prev.includes("video") ? prev : ["video", ...prev.filter((k) => k !== "image")]
      );
    }
  };

  const toggleKind = (k: GalleryKind) => {
    setKinds((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    );
  };

  const canSubmit =
    !!file && !sizeOver && title.trim() && slug.trim() && kinds.length > 0 && !pending;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !file) return;
    setError(null);

    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", "new");
    fd.set("slug", slug.trim());
    fd.set("title", title.trim());
    fd.set("kinds", kinds.join(","));
    fd.set("cover_aspect", coverAspect);
    fd.set("status", status);
    fd.set("visibility", visibility);
    if (subtitle.trim()) fd.set("subtitle", subtitle.trim());
    if (summary.trim()) fd.set("summary", summary.trim());
    if (author.trim()) fd.set("author", author.trim());
    if (tags.trim()) fd.set("tags", tags.trim());
    if (duration.trim()) fd.set("duration_minutes", duration.trim());

    startTransition(async () => {
      try {
        const res = await fetch("/api/gallery/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        router.push(`/gallery/${json.item_id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]"
    >
      <div className="space-y-4">
        <Field label="File (이미지 ≤10MB / 비디오 ≤100MB)">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
          />
          {file && (
            <div className="mt-2 text-xs text-muted-foreground">
              {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB · {file.type}
            </div>
          )}
          {sizeOver && (
            <div className="mt-1 text-xs text-destructive">
              파일이 너무 큽니다. ({isVideo ? "비디오 ≤100MB" : "이미지 ≤10MB"})
            </div>
          )}
        </Field>

        <Field label="Title">
          <Input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            placeholder="예: AWC · Member Dashboard"
            required
          />
        </Field>

        <Field label="Slug">
          <Input
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(toKebab(e.target.value));
            }}
            placeholder={autoSlug || "auto-from-title"}
            required
          />
          <div className="mt-1 text-[10px] text-muted-foreground">
            /gallery/item/{slug || "—"} (lowercase + kebab만)
          </div>
        </Field>

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

        <div className="grid grid-cols-2 gap-4">
          <Field label="Cover Aspect">
            <Select value={coverAspect} onValueChange={(v) => setCoverAspect(v as GalleryCoverAspect)}>
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
          <Field label="Duration (min)">
            <Input
              type="number"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="0"
            />
          </Field>
        </div>

        <Field label="Subtitle (1줄)">
          <Input
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="예: 게이미피케이션 멤버십 시안"
          />
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
          <Field label="Status">
            <Select value={status} onValueChange={(v) => setStatus(v as GalleryItemStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Visibility">
            <Select
              value={visibility}
              onValueChange={(v) => setVisibility(v as GalleryVisibility)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VISIBILITY_OPTIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Tags (쉼표 구분)">
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="landing, ad, beauty"
          />
        </Field>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={!canSubmit}>
            {pending ? "업로드 중…" : "등록"}
          </Button>
          <span className="text-xs text-muted-foreground">
            등록 후 상세 페이지로 이동 — 추가 미디어 업로드 가능
          </span>
        </div>
      </div>

      <aside className="rounded-lg border border-border bg-muted/10 p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Cover Preview
        </div>
        {previewUrl ? (
          isVideo ? (
            <video src={previewUrl} controls muted className="w-full rounded-md" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="preview" className="w-full rounded-md" />
          )
        ) : (
          <div className="flex h-48 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
            파일 선택 시 미리보기
          </div>
        )}
      </aside>
    </form>
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
