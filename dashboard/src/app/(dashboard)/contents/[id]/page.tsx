export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Main } from "@/components/layout/main";
import { Skeleton } from "@/components/ui/skeleton";
import { getContentById, getRevisions, getPublications } from "@/lib/queries";
import { ContentDetailView } from "./content-detail-view";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function ContentData({ id }: { id: string }) {
  const [content, revisions, allPublications] = await Promise.all([
    getContentById(id),
    getRevisions(id),
    getPublications(),
  ]);

  if (!content) notFound();

  const publications = allPublications.filter((p) => p.content_id === id);

  return (
    <ContentDetailView
      content={content}
      revisions={revisions}
      publications={publications}
    />
  );
}

export default async function ContentDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <Main>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-8 w-[300px]" />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="space-y-4 lg:col-span-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-[300px] w-full" />
              </div>
              <div className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-[200px] w-full" />
              </div>
            </div>
          </div>
        }
      >
        <ContentData id={id} />
      </Suspense>
    </Main>
  );
}
