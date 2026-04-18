export const dynamic = "force-dynamic";

import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRightIcon,
  PenSquareIcon,
  LayersIcon,
  VideoIcon,
  MailIcon,
  SplitIcon,
} from "lucide-react";
import { Main } from "@/components/layout/main";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PipelineStepper } from "@/components/pipeline-stepper";
import { getAllVariants } from "@/lib/queries";
import type { Variant } from "@/lib/types";

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

// format 기반 스튜디오 링크. 실제 파생 레코드(blog_posts/carousels/...)와 variant_id 로
// 연결된 항목은 Contents 상세의 Derivatives 카드에서 우선 보이므로, 여기 list 화면에서는
// "이 format 을 다루는 스튜디오의 진입점"만 간단히 연결한다.
const studioByFormat: Record<string, { icon: typeof PenSquareIcon; label: string; href: string }> = {
  blog: { icon: PenSquareIcon, label: "Blog 스튜디오", href: "/blog-manage" },
  carousel: { icon: LayersIcon, label: "Carousel 스튜디오", href: "/carousel" },
  video: { icon: VideoIcon, label: "Video 스튜디오", href: "/video/projects" },
  reel: { icon: VideoIcon, label: "Video 스튜디오", href: "/video/projects" },
  short: { icon: VideoIcon, label: "Video 스튜디오", href: "/video/projects" },
};
function getStudioLink(variant: Variant) {
  const format = studioByFormat[variant.format];
  if (format) return format;
  if (variant.platform === "email") {
    return { icon: MailIcon, label: "Newsletter", href: "/newsletter" };
  }
  // 소셜 variant(single_post/article/thread/story) 는 Publications 쪽에서 추적.
  return { icon: SplitIcon, label: "원본 Content 열기", href: null as string | null };
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
      {variants.map((variant) => {
        const studio = getStudioLink(variant);
        const StudioIcon = studio.icon;
        const studioHref = studio.href ?? `/contents/${variant.content_id}`;
        return (
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
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={studioHref}>
                  <StudioIcon aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
                  {studio.label}
                  <ArrowRightIcon aria-hidden="true" className="ml-auto h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default function VariantsPage() {
  return (
    <Main>
      <PipelineStepper currentStep="variants" className="mb-4" />
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
