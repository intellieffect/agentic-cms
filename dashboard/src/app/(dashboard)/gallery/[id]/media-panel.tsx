"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlayCircleIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  GalleryItemMediaLink,
  GalleryMediaRole,
} from "@/lib/types";
import { GALLERY_IMAGE_MAX, GALLERY_VIDEO_MAX } from "@/lib/gallery-constants";
import {
  removeGalleryMedia,
  reorderGalleryMedia,
} from "../actions";

const ROLE_OPTIONS: GalleryMediaRole[] = ["cover", "gallery", "detail", "hero_video"];

function roleVariant(role: GalleryMediaRole) {
  if (role === "cover") return "warning" as const;
  if (role === "hero_video") return "destructive" as const;
  if (role === "detail") return "info" as const;
  return "secondary" as const;
}

export function GalleryMediaPanel({
  itemId,
  links,
}: {
  itemId: string;
  links: GalleryItemMediaLink[];
}) {
  const router = useRouter();
  const replaceCoverInput = useRef<HTMLInputElement>(null);
  const attachInput = useRef<HTMLInputElement>(null);
  const [attachRole, setAttachRole] = useState<GalleryMediaRole>("gallery");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // role별 그룹 + sort_order 정렬
  const grouped: Record<GalleryMediaRole, GalleryItemMediaLink[]> = {
    cover: [],
    gallery: [],
    detail: [],
    hero_video: [],
  };
  for (const l of links) grouped[l.role]?.push(l);
  for (const k of Object.keys(grouped) as GalleryMediaRole[]) {
    grouped[k].sort((a, b) => a.sort_order - b.sort_order);
  }

  function uploadFile(
    file: File,
    mode: "attach" | "replace_cover",
    role?: GalleryMediaRole
  ) {
    setError(null);
    const isVideo = file.type.startsWith("video/");
    const cap = isVideo ? GALLERY_VIDEO_MAX : GALLERY_IMAGE_MAX;
    if (file.size > cap) {
      setError(`파일이 너무 큽니다. (max ${(cap / 1024 / 1024).toFixed(0)}MB)`);
      return;
    }

    const fd = new FormData();
    fd.set("file", file);
    fd.set("mode", mode);
    fd.set("item_id", itemId);
    if (mode === "attach" && role) fd.set("role", role);

    startTransition(async () => {
      try {
        const res = await fetch("/api/gallery/upload", { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok || !json.ok) {
          throw new Error(json.error ?? `HTTP ${res.status}`);
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function onDelete(linkId: string) {
    if (!confirm("이 미디어 link를 삭제할까요? (media row는 보존됩니다)")) return;
    startTransition(async () => {
      try {
        await removeGalleryMedia(linkId, itemId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  function onMove(role: GalleryMediaRole, index: number, dir: -1 | 1) {
    const list = grouped[role];
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    const a = list[index];
    const b = list[j];
    startTransition(async () => {
      try {
        await reorderGalleryMedia(itemId, [
          { id: a.id, sort_order: b.sort_order },
          { id: b.id, sort_order: a.sort_order },
        ]);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* 액션 바 */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/10 p-3">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => replaceCoverInput.current?.click()}
          className="gap-2"
        >
          <UploadIcon className="h-3.5 w-3.5" />
          Cover 교체
        </Button>
        <input
          ref={replaceCoverInput}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f, "replace_cover");
            e.target.value = "";
          }}
        />

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Role</span>
          <Select value={attachRole} onValueChange={(v) => setAttachRole(v as GalleryMediaRole)}>
            <SelectTrigger className="h-8 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => attachInput.current?.click()}
            className="gap-2"
          >
            <UploadIcon className="h-3.5 w-3.5" />
            미디어 추가
          </Button>
          <input
            ref={attachInput}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f, "attach", attachRole);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* role별 그룹 */}
      {(Object.keys(grouped) as GalleryMediaRole[]).map((role) => {
        const list = grouped[role];
        if (list.length === 0) return null;
        return (
          <div key={role}>
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={roleVariant(role)}>{role}</Badge>
              <span className="text-xs text-muted-foreground">{list.length}건</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((link, i) => (
                <MediaCard
                  key={link.id}
                  link={link}
                  canMoveUp={i > 0}
                  canMoveDown={i < list.length - 1}
                  pending={pending}
                  onUp={() => onMove(role, i, -1)}
                  onDown={() => onMove(role, i, 1)}
                  onDelete={() => onDelete(link.id)}
                />
              ))}
            </div>
          </div>
        );
      })}

      {links.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          연결된 미디어가 없습니다. 위 "미디어 추가" 또는 "Cover 교체"로 등록.
        </div>
      )}
    </div>
  );
}

function MediaCard({
  link,
  canMoveUp,
  canMoveDown,
  pending,
  onUp,
  onDown,
  onDelete,
}: {
  link: GalleryItemMediaLink;
  canMoveUp: boolean;
  canMoveDown: boolean;
  pending: boolean;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const isVideo = link.media_mime?.startsWith("video/");
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative aspect-video bg-black/80">
        {link.media_url ? (
          isVideo ? (
            <>
              <video src={link.media_url} className="h-full w-full object-cover" muted />
              <PlayCircleIcon className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-white/80" />
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={link.media_url}
              alt={link.media_filename ?? "media"}
              className="h-full w-full object-cover"
            />
          )
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            no preview
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 px-2 py-1.5">
        <div className="truncate text-[10px] text-muted-foreground" title={link.media_filename ?? ""}>
          {link.media_filename ?? link.media_id.slice(0, 8)}
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={!canMoveUp || pending}
            onClick={onUp}
          >
            <ChevronUpIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            disabled={!canMoveDown || pending}
            onClick={onDown}
          >
            <ChevronDownIcon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            disabled={pending}
            onClick={onDelete}
          >
            <Trash2Icon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
