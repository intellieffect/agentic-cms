export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Main } from "@/components/layout/main";
import { Skeleton } from "@/components/ui/skeleton";
import { getActivityLogs } from "@/lib/queries";
import { ActivityPageClient } from "./activity-client";

async function ActivityData() {
  const logs = await getActivityLogs({ limit: 100 });
  return <ActivityPageClient logs={logs} />;
}

export default function ActivityPage() {
  return (
    <Main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-muted-foreground">See what agents and humans are doing in your CMS.</p>
      </div>
      <Suspense
        fallback={
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        }
      >
        <ActivityData />
      </Suspense>
    </Main>
  );
}
