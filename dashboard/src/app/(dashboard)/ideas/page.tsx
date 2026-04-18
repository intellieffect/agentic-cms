export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Main } from "@/components/layout/main";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineStepper } from "@/components/pipeline-stepper";
import { getIdeas, getTopics } from "@/lib/queries";
import { IdeasList } from "./ideas-list";

async function IdeasData() {
  const [ideas, topics] = await Promise.all([getIdeas(), getTopics()]);
  return <IdeasList ideas={ideas} topics={topics} />;
}

export default function IdeasPage() {
  return (
    <Main>
      <PipelineStepper currentStep="ideas" className="mb-4" />
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Ideas</h1>
        <p className="text-muted-foreground">Raw ideas waiting to become content.</p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        }
      >
        <IdeasData />
      </Suspense>
    </Main>
  );
}
