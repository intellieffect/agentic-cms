export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, LightbulbIcon } from "lucide-react";
import { Main } from "@/components/layout/main";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTopics } from "@/lib/queries";

function getIntentVariant(intent: string) {
  const normalized = intent.toLowerCase();

  if (normalized.includes("transaction") || normalized.includes("conversion")) {
    return "success" as const;
  }

  if (normalized.includes("commercial") || normalized.includes("consideration")) {
    return "warning" as const;
  }

  if (normalized.includes("informational") || normalized.includes("awareness")) {
    return "info" as const;
  }

  return "secondary" as const;
}

function formatIntent(intent: string) {
  return intent
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

async function TopicsData() {
  const topics = await getTopics();

  if (topics.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No topics found
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {topics.map((topic) => (
        <Card key={topic.id}>
          <CardHeader className="gap-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base">{topic.name}</CardTitle>
              <Badge variant={getIntentVariant(topic.intent)}>{formatIntent(topic.intent)}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {topic.keywords.map((keyword) => (
                <Badge key={keyword} variant="outline">
                  {keyword}
                </Badge>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {topic.description ?? "No description provided."}
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={`/ideas?topic_id=${topic.id}`}>
                <LightbulbIcon aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />이 토픽의 아이디어
                <ArrowRightIcon aria-hidden="true" className="ml-auto h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function TopicsPage() {
  return (
    <Main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Topics</h1>
        <p className="text-muted-foreground">Content themes for keyword authority</p>
      </div>
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        }
      >
        <TopicsData />
      </Suspense>
    </Main>
  );
}
