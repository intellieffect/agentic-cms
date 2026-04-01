export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Main } from "@/components/layout/main";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getPipelineStats, getPublicationsByChannel, getActivityLogs } from "@/lib/queries";
import { LightbulbIcon, FileTextIcon, EyeIcon, SendIcon } from "lucide-react";
import { ActivityFeed } from "@/components/activity-feed";
import { PublicationsChart } from "./publications-chart";

async function StatsCards() {
  const stats = await getPipelineStats();
  const cards = [
    { title: "Ideas", value: stats.ideas, icon: LightbulbIcon, color: "text-warning" },
    { title: "Drafts", value: stats.drafts, icon: FileTextIcon, color: "text-muted-foreground" },
    { title: "In Review", value: stats.inReview, icon: EyeIcon, color: "text-info" },
    { title: "Published", value: stats.published, icon: SendIcon, color: "text-success" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatsCardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function ActivitySection() {
  const logs = await getActivityLogs({ limit: 15 });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ActivityFeed logs={logs} compact />
      </CardContent>
    </Card>
  );
}

async function ChartSection() {
  const channels = await getPublicationsByChannel();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Publications by Channel</CardTitle>
      </CardHeader>
      <CardContent>
        <PublicationsChart data={channels} />
      </CardContent>
    </Card>
  );
}

function SectionSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <Main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your AI-powered content pipeline at a glance.</p>
      </div>

      <div className="space-y-6">
        <Suspense fallback={<StatsCardsSkeleton />}>
          <StatsCards />
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <Suspense fallback={<SectionSkeleton />}>
              <ActivitySection />
            </Suspense>
          </div>
          <div className="lg:col-span-2">
            <Suspense fallback={<SectionSkeleton />}>
              <ChartSection />
            </Suspense>
          </div>
        </div>
      </div>
    </Main>
  );
}
