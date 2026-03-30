import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPipelineStats,
  getRecentActivity,
  getPublicationsByChannel,
  getQuickStats,
} from "@/lib/queries";
import { timeAgo, truncate } from "@/lib/utils";
import { Lightbulb, FileText, Eye, Globe, BarChart3, Hash, Layers } from "lucide-react";
import { ChannelChart } from "./channel-chart";

export const dynamic = "force-dynamic";

async function StatsCards() {
  const stats = await getPipelineStats();

  const cards = [
    { label: "Ideas", value: stats.ideas, icon: Lightbulb, color: "text-warning" },
    { label: "Drafts", value: stats.drafts, icon: FileText, color: "text-muted-foreground" },
    { label: "In Review", value: stats.inReview, icon: Eye, color: "text-info" },
    { label: "Published", value: stats.published, icon: Globe, color: "text-success" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="flex items-center gap-4">
            <div className={`${card.color}`}>
              <card.icon className="h-8 w-8" />
            </div>
            <div>
              <p className="text-3xl font-bold">{card.value}</p>
              <p className="text-sm text-muted-foreground">{card.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function RecentActivity() {
  const contents = await getRecentActivity(10);

  if (contents.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity yet.</p>
    );
  }

  return (
    <div className="space-y-3">
      {contents.map((content) => (
        <div
          key={content.id}
          className="flex items-center justify-between py-2 border-b border-border last:border-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Badge
              variant={
                content.status === "published"
                  ? "success"
                  : content.status === "review"
                  ? "default"
                  : "secondary"
              }
            >
              {content.status}
            </Badge>
            <span className="text-sm truncate">{truncate(content.title, 50)}</span>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
            {timeAgo(content.updated_at)}
          </span>
        </div>
      ))}
    </div>
  );
}

async function ChannelChartWrapper() {
  const data = await getPublicationsByChannel();

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No publications yet.</p>
    );
  }

  return <ChannelChart data={data} />;
}

async function QuickStats() {
  const stats = await getQuickStats();

  const items = [
    { label: "Total Contents", value: stats.totalContents, icon: Layers },
    { label: "Total Publications", value: stats.totalPublications, icon: BarChart3 },
    { label: "Total Ideas", value: stats.totalIdeas, icon: Hash },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <item.icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xl font-semibold">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of your AI-driven content pipeline"
      />
      <Suspense fallback={<LoadingSkeleton />}>
        <div className="space-y-6">
          <StatsCards />

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<Skeleton className="h-48" />}>
                  <RecentActivity />
                </Suspense>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Publications by Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <Suspense fallback={<Skeleton className="h-48" />}>
                  <ChannelChartWrapper />
                </Suspense>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense fallback={<Skeleton className="h-16" />}>
                <QuickStats />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </Suspense>
    </>
  );
}
