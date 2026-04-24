"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteGalleryItem } from "../actions";

export function GalleryDangerZone({
  itemId,
  title,
}: {
  itemId: string;
  title: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (
      !confirm(
        `정말 삭제할까요?\n"${title}"\n\ngallery_items + gallery_item_media link만 삭제됩니다. media row와 storage 파일은 보존.`
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteGalleryItem(itemId);
        router.push("/gallery");
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  return (
    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="text-xs text-destructive/90">
          <p className="font-medium">갤러리 아이템 삭제</p>
          <p className="mt-1 text-destructive/70">
            gallery_items 행 + gallery_item_media 링크만 제거 (cascade). 업로드된
            media row와 storage 파일은 보존되어 다른 곳에서 재사용 가능.
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={onDelete}
          className="shrink-0 gap-2"
        >
          <Trash2Icon className="h-4 w-4" />
          {pending ? "삭제 중…" : "삭제"}
        </Button>
      </div>
      {error && (
        <div className="mt-3 text-xs text-destructive">{error}</div>
      )}
    </div>
  );
}
