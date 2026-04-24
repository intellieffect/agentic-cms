export const dynamic = "force-dynamic";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { Main } from "@/components/layout/main";
import { Button } from "@/components/ui/button";
import { getGalleryItems } from "@/lib/queries";
import { GalleryTable } from "./gallery-table";

export default async function GalleryAdminPage() {
  const items = await getGalleryItems();

  const counts = {
    total: items.length,
    published: items.filter((i) => i.status === "published").length,
    draft: items.filter((i) => i.status === "draft").length,
    featured: items.filter((i) => i.is_featured).length,
  };

  return (
    <Main>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gallery</h1>
          <p className="text-muted-foreground">
            AWC Web(랜딩+/my) · APP Gallery 공용 전시물. Featured 토글 = 랜딩 노출.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-xs text-muted-foreground">
            <div>전체 {counts.total} · 공개 {counts.published} · 드래프트 {counts.draft}</div>
            <div>Featured {counts.featured} / 권장 9</div>
          </div>
          <Link href="/gallery/new">
            <Button size="sm" className="gap-1.5">
              <PlusIcon className="h-4 w-4" />
              New
            </Button>
          </Link>
        </div>
      </div>

      <p className="mb-4 text-xs text-muted-foreground">
        <strong>Tip.</strong> <code>featured_rank</code>가 낮을수록 랜딩에서 먼저 노출.
        커버 교체·추가 미디어는 각 항목 Edit 화면에서.
      </p>

      <GalleryTable items={items} />
    </Main>
  );
}
