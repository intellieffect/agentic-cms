export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Main } from "@/components/layout/main";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineStepper } from "@/components/pipeline-stepper";
import { getPublications } from "@/lib/queries";
import { PublicationsTable } from "./publications-table";

async function PublicationsData() {
  const publications = await getPublications();
  return <PublicationsTable data={publications} />;
}

export default function PublicationsPage() {
  return (
    <Main>
      <PipelineStepper currentStep="publish" className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Publications</h1>
        <p className="text-muted-foreground">Track where your content has been published.</p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-8 w-[250px]" />
            <Skeleton className="h-[400px] w-full rounded-md" />
          </div>
        }
      >
        <PublicationsData />
      </Suspense>
    </Main>
  );
}
