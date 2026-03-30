export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Main } from "@/components/layout/main";
import { Skeleton } from "@/components/ui/skeleton";
import { getIdeas } from "@/lib/queries";
import { IdeasList } from "./ideas-list";

async function IdeasData() {
  const ideas = await getIdeas();
  return <IdeasList ideas={ideas} />;
}

export default function IdeasPage() {
  return (
    <Main>
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
