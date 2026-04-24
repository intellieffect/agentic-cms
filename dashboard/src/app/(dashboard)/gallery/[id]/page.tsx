export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { Main } from "@/components/layout/main";
import { Button } from "@/components/ui/button";
import { getGalleryItemDetail } from "@/lib/queries";
import { GalleryMetaForm } from "./meta-form";
import { GalleryMediaPanel } from "./media-panel";
import { GalleryDangerZone } from "./danger-zone";

export default async function GalleryItemEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getGalleryItemDetail(id);
  if (!item) notFound();

  return (
    <Main>
      <div className="mb-6 flex items-center gap-3">
        <Link href="/gallery">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeftIcon className="h-4 w-4" />
            목록으로
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{item.title}</h1>
          <p className="text-muted-foreground">/{item.slug} · {item.kind}</p>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Meta
        </h2>
        <GalleryMetaForm item={item} />
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Media ({item.media_links.length})
        </h2>
        <GalleryMediaPanel itemId={item.id} links={item.media_links} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-destructive">
          Danger Zone
        </h2>
        <GalleryDangerZone itemId={item.id} title={item.title} />
      </section>
    </Main>
  );
}
