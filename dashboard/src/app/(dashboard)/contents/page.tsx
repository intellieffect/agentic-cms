export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Main } from "@/components/layout/main";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineStepper } from "@/components/pipeline-stepper";
import { getContents } from "@/lib/queries";
import { ContentsTable } from "./contents-table";

async function ContentsData() {
  const contents = await getContents();
  return <ContentsTable data={contents} />;
}

export default function ContentsPage() {
  return (
    <Main>
      <PipelineStepper currentStep="contents" className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Contents</h1>
        <p className="text-muted-foreground">Manage your content pipeline.</p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-4">
            <Skeleton className="h-8 w-[250px]" />
            <Skeleton className="h-[400px] w-full rounded-md" />
          </div>
        }
      >
        <ContentsData />
      </Suspense>
    </Main>
  );
}
