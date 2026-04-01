export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense } from "react";
import { Main } from "@/components/layout/main";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getAllVariants } from "@/lib/queries";

function formatLabel(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function truncateText(value: string | null, maxLength: number) {
  if (!value) {
    return "No body text available.";
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function getStatusVariant(status: string) {
  if (status === "published") {
    return "success" as const;
  }

  if (status === "ready") {
    return "info" as const;
  }

  return "secondary" as const;
}

async function VariantsData() {
  const variants = await getAllVariants();

  if (variants.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No variants found
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {variants.map((variant) => (
        <Card key={variant.id}>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{formatLabel(variant.platform)}</Badge>
              <Badge variant="outline">{formatLabel(variant.format)}</Badge>
            </div>
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-base leading-6">
                {truncateText(variant.body_text, 100)}
              </CardTitle>
              <Badge variant={getStatusVariant(variant.status)}>{formatLabel(variant.status)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {variant.character_count?.toLocaleString() ?? 0} characters
            </p>
            {variant.contents?.title ? (
              <Link
                href={`/contents/${variant.content_id}`}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {variant.contents.title}
              </Link>
            ) : (
              <p className="text-sm text-muted-foreground">No linked content</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function VariantsPage() {
  return (
    <Main>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Variants</h1>
        <p className="text-muted-foreground">Platform-specific content adaptations</p>
      </div>
      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-48 rounded-xl" />
            ))}
          </div>
        }
      >
        <VariantsData />
      </Suspense>
    </Main>
  );
}
