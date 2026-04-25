"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { PlayCircleIcon, ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  GalleryItemWithCover,
  GalleryItemStatus,
  GalleryKind,
  GalleryVisibility,
} from "@/lib/types";
import { GALLERY_KIND_FILTERS as KIND_FILTER } from "@/lib/gallery-constants";
import {
  setGalleryFeatured,
  updateGalleryRank,
  updateGalleryStatus,
  updateGalleryVisibility,
  pingAwcWebRevalidate,
} from "./actions";

const STATUS_OPTIONS: GalleryItemStatus[] = ["draft", "published", "archived"];
const VISIBILITY_OPTIONS: GalleryVisibility[] = ["public", "member", "internal"];

function kindVariant(kind: GalleryKind) {
  if (kind === "video") return "destructive" as const;
  if (kind === "landing") return "warning" as const;
  if (kind === "ad") return "success" as const;
  if (kind === "case_study") return "info" as const;
  if (kind === "ai_influencer") return "info" as const;
  return "secondary" as const;
}

function statusVariant(status: GalleryItemStatus) {
  if (status === "published") return "success" as const;
  if (status === "draft") return "warning" as const;
  return "secondary" as const;
}

export function GalleryTable({ items }: { items: GalleryItemWithCover[] }) {
  const [kindFilter, setKindFilter] = useState<(typeof KIND_FILTER)[number]>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | GalleryItemStatus>("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);

  const filtered = items.filter((i) => {
    const itemKinds = i.kinds && i.kinds.length > 0 ? i.kinds : [i.kind];
    if (kindFilter !== "all" && !itemKinds.includes(kindFilter as GalleryKind)) return false;
    if (statusFilter !== "all" && i.status !== statusFilter) return false;
    if (featuredOnly && !i.is_featured) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* 필터 바 */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/10 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Kind</span>
          <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as any)}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KIND_FILTER.map((k) => (
                <SelectItem key={k} value={k}>
                  {k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Status</span>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">all</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs">
          <Switch
            checked={featuredOnly}
            onCheckedChange={(v: boolean) => setFeaturedOnly(v)}
          />
          <span>Featured only</span>
        </label>
        <div className="ml-auto">
          <RevalidateButton />
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-[88px] px-3 py-3">Cover</th>
              <th className="px-3 py-3">Title</th>
              <th className="w-[110px] px-3 py-3">Kind</th>
              <th className="w-[130px] px-3 py-3">Status</th>
              <th className="w-[130px] px-3 py-3">Visibility</th>
              <th className="w-[80px] px-3 py-3">Featured</th>
              <th className="w-[90px] px-3 py-3">Rank</th>
              <th className="w-[100px] px-3 py-3">Updated</th>
              <th className="w-[70px] px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-12 text-center text-muted-foreground">
                  조건에 맞는 항목이 없습니다.
                </td>
              </tr>
            )}
            {filtered.map((item) => (
              <GalleryRow key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GalleryRow({ item }: { item: GalleryItemWithCover }) {
  const [isPending, startTransition] = useTransition();
  const [rank, setRank] = useState<string>(
    item.featured_rank?.toString() ?? ""
  );
  const isVideo = item.cover_mime?.startsWith("video/");

  const commitRank = () => {
    const parsed = rank.trim() === "" ? null : Number.parseInt(rank, 10);
    if (parsed !== null && Number.isNaN(parsed)) return;
    startTransition(() => {
      updateGalleryRank(item.id, parsed).catch(console.error);
    });
  };

  return (
    <tr className="border-t border-border/60 hover:bg-muted/10">
      <td className="px-3 py-3">
        {item.cover_url ? (
          isVideo ? (
            <div className="relative h-12 w-20 overflow-hidden rounded-md bg-black">
              <video src={item.cover_url} className="h-full w-full object-cover" muted />
              <PlayCircleIcon className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-white/90" />
            </div>
          ) : (
            <div className="relative h-12 w-20 overflow-hidden rounded-md bg-muted">
              <Image
                src={item.cover_url}
                alt={item.title}
                fill
                sizes="80px"
                className="object-cover"
                unoptimized
              />
            </div>
          )
        ) : (
          <div className="flex h-12 w-20 items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
            —
          </div>
        )}
      </td>

      <td className="px-3 py-3">
        <div className="font-medium">{item.title}</div>
        {item.subtitle && (
          <div className="text-xs text-muted-foreground">{item.subtitle}</div>
        )}
        <div className="mt-1 flex flex-wrap gap-1">
          <span className="text-[10px] text-muted-foreground">/{item.slug}</span>
          {item.tags.slice(0, 3).map((t) => (
            <span key={t} className="text-[10px] text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      </td>

      <td className="px-3 py-3">
        <div className="flex flex-wrap gap-1">
          {(item.kinds && item.kinds.length > 0 ? item.kinds : [item.kind]).map((k) => (
            <Badge key={k} variant={kindVariant(k)}>
              {k}
            </Badge>
          ))}
        </div>
      </td>

      <td className="px-3 py-3">
        <Select
          value={item.status}
          onValueChange={(v) => {
            startTransition(() => {
              updateGalleryStatus(item.id, v as GalleryItemStatus).catch(console.error);
            });
          }}
        >
          <SelectTrigger className="h-8">
            <SelectValue>
              <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      <td className="px-3 py-3">
        <Select
          value={item.visibility}
          onValueChange={(v) => {
            startTransition(() => {
              updateGalleryVisibility(item.id, v as GalleryVisibility).catch(console.error);
            });
          }}
        >
          <SelectTrigger className="h-8">
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
      </td>

      <td className="px-3 py-3">
        <Switch
          checked={item.is_featured}
          disabled={isPending}
          onCheckedChange={(v: boolean) => {
            startTransition(() => {
              setGalleryFeatured(
                item.id,
                v,
                v ? item.featured_rank ?? 100 : null
              ).catch(console.error);
            });
          }}
        />
      </td>

      <td className="px-3 py-3">
        <Input
          type="number"
          className="h-8 w-20"
          value={rank}
          placeholder="—"
          disabled={!item.is_featured || isPending}
          onChange={(e) => setRank(e.target.value)}
          onBlur={commitRank}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
        />
      </td>

      <td className="px-3 py-3 text-xs text-muted-foreground">
        {new Date(item.updated_at).toLocaleDateString("ko-KR", {
          month: "2-digit",
          day: "2-digit",
        })}
      </td>

      <td className="px-3 py-3">
        <Link href={`/gallery/${item.id}`}>
          <Button variant="ghost" size="sm" className="gap-1">
            Edit
            <ExternalLinkIcon className="h-3 w-3" />
          </Button>
        </Link>
      </td>
    </tr>
  );
}

function RevalidateButton() {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<string | null>(null);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        setStatus(null);
        startTransition(async () => {
          const r = await pingAwcWebRevalidate();
          setStatus(r.ok ? "AWC Web 갱신 요청 OK" : `실패: ${r.reason ?? r.status}`);
          setTimeout(() => setStatus(null), 4000);
        });
      }}
    >
      {pending ? "요청 중…" : status ?? "AWC Web 랜딩 갱신"}
    </Button>
  );
}
