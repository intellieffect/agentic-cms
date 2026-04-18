"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  HistoryIcon,
  BotIcon,
  UserIcon,
  SaveIcon,
  SendIcon,
  FileTextIcon,
  Loader2Icon,
  PenSquareIcon,
  LayersIcon,
  VideoIcon,
  MailIcon,
  SplitIcon,
  ArrowRightIcon,
} from "lucide-react";
import type { Content, Revision, Publication, VariantWithDerivatives } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatRelativeTime } from "@/lib/utils";
import { MarkdownPreview } from "@/components/markdown-preview";
import { updateContent, publishContent, unpublishContent } from "./actions";
import { RevisionDiffView } from "@/components/diff-view";

const statusConfig: Record<string, { variant: "secondary" | "info" | "success"; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  review: { variant: "info", label: "In Review" },
  published: { variant: "success", label: "Published" },
};

interface ContentDetailViewProps {
  content: Content;
  revisions: Revision[];
  publications: Publication[];
  variants: VariantWithDerivatives[];
}

// 각 format 별 스튜디오/상세 페이지 링크 + 아이콘 구성.
// 데이터 없으면 (variant 만 있고 파생 레코드 없으면) link 는 null 로 두고 "아직 제작 안 됨"으로 표기.
//
// 전제: blog_posts / carousels / video_projects 에 걸린 partial UNIQUE index 로
// 한 variant 에는 최대 하나의 파생 레코드만 붙는다. 따라서 아래 if 체인은 우선순위가 아니라
// "있으면 하나"의 분기 — 만약 둘 이상 연결되는 사례가 보인다면 DB 무결성을 먼저 점검할 것.
// 진단 편의를 위해 그런 상황이면 개발 모드에서 console.warn.
function getDerivativeAction(variant: VariantWithDerivatives): {
  icon: typeof PenSquareIcon;
  label: string;
  href: string | null;
  status: string | null;
} {
  if (process.env.NODE_ENV !== "production") {
    const linked = [variant.blog_post, variant.carousel, variant.video_project].filter(Boolean).length;
    if (linked > 1) {
      console.warn(
        `[Variant ${variant.id}] 하나의 variant 에 여러 파생 레코드가 연결됨 (${linked} 개). 1:1 UNIQUE 위반 가능.`
      );
    }
  }
  if (variant.blog_post) {
    return {
      icon: PenSquareIcon,
      label: `Blog: ${variant.blog_post.title}`,
      href: `/blog-manage/${variant.blog_post.id}`,
      status: variant.blog_post.status,
    };
  }
  if (variant.carousel) {
    return {
      icon: LayersIcon,
      label: `Carousel: ${variant.carousel.title}`,
      href: `/carousel/${variant.carousel.id}`,
      status: null,
    };
  }
  if (variant.video_project) {
    return {
      icon: VideoIcon,
      label: `Video: ${variant.video_project.name}`,
      href: `/video/projects`,
      status: variant.video_project.status,
    };
  }
  // 파생 레코드 아직 없음 — format 기반 fallback
  const fallbackByFormat: Record<string, { icon: typeof PenSquareIcon; label: string; href: string | null }> = {
    blog: { icon: PenSquareIcon, label: "Blog (아직 생성 안 됨)", href: "/blog-manage" },
    carousel: { icon: LayersIcon, label: "Carousel (아직 생성 안 됨)", href: "/carousel" },
    video: { icon: VideoIcon, label: "Video (아직 생성 안 됨)", href: "/video/projects" },
    reel: { icon: VideoIcon, label: "Reel (아직 생성 안 됨)", href: "/video/projects" },
    short: { icon: VideoIcon, label: "Short (아직 생성 안 됨)", href: "/video/projects" },
  };
  const fb = fallbackByFormat[variant.format];
  if (fb) {
    return { ...fb, status: null };
  }
  return {
    icon: SplitIcon,
    label: `${variant.platform} ${variant.format}`,
    href: null,
    status: null,
  };
}

export function ContentDetailView({ content, revisions, publications, variants }: ContentDetailViewProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedRevision, setSelectedRevision] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState(content.title);
  const [bodyMd, setBodyMd] = useState(content.body_md ?? "");
  const [hook, setHook] = useState(content.hook ?? "");
  const [coreMessage, setCoreMessage] = useState(content.core_message ?? "");
  const [cta, setCta] = useState(content.cta ?? "");
  const [category, setCategory] = useState(content.category ?? "");
  const [funnelStage, setFunnelStage] = useState(content.funnel_stage ?? "");

  const hasChanges =
    title !== content.title ||
    bodyMd !== (content.body_md ?? "") ||
    hook !== (content.hook ?? "") ||
    coreMessage !== (content.core_message ?? "") ||
    cta !== (content.cta ?? "") ||
    category !== (content.category ?? "") ||
    funnelStage !== (content.funnel_stage ?? "");

  const handleSave = () => {
    startTransition(async () => {
      await updateContent(content.id, {
        title,
        body_md: bodyMd,
        hook,
        core_message: coreMessage,
        cta,
        category,
        funnel_stage: funnelStage,
      });
    });
  };

  const handlePublish = () => {
    startTransition(async () => {
      if (hasChanges) {
        await updateContent(content.id, {
          title,
          body_md: bodyMd,
          hook,
          core_message: coreMessage,
          cta,
          category,
          funnel_stage: funnelStage,
          status: "published",
        });
      } else {
        await publishContent(content.id);
      }
    });
  };

  const handleUnpublish = () => {
    startTransition(async () => {
      await unpublishContent(content.id);
    });
  };

  const config = statusConfig[content.status] ?? statusConfig.draft;

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Actions (Payload DocumentControls pattern) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/contents" className="hover:text-foreground transition-colors">
            Contents
          </Link>
          <ChevronRightIcon aria-hidden="true" className="h-3 w-3" />
          <span className="text-foreground font-medium truncate max-w-[300px]">{content.title}</span>
        </nav>

        {/* Document Controls */}
        <div className="flex items-center gap-2">
          <Badge variant={config.variant}>{config.label}</Badge>

          {content.status === "published" && (
            <Button variant="outline" size="sm" onClick={handleUnpublish} disabled={isPending}>
              <FileTextIcon className="mr-1.5 h-3.5 w-3.5" />
              Unpublish
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={handleSave} disabled={isPending || !hasChanges}>
            {isPending ? (
              <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <SaveIcon className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save Draft
          </Button>

          <Button asChild variant="outline" size="sm">
            <Link href={`/variants?content_id=${content.id}`}>
              → Generate Variants
            </Link>
          </Button>

          {content.status !== "published" && (
            <Button size="sm" onClick={handlePublish} disabled={isPending}>
              {isPending ? (
                <Loader2Icon className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <SendIcon className="mr-1.5 h-3.5 w-3.5" />
              )}
              Publish
            </Button>
          )}
        </div>
      </div>

      {hasChanges && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 px-4 py-2 text-sm text-warning">
          Unsaved changes — your edits will be recorded as a human revision.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Panel — Editable Fields */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input defaultValue={content.slug} readOnly className="font-mono text-sm text-muted-foreground" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Funnel Stage</Label>
                  <Input value={funnelStage} onChange={(e) => setFunnelStage(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(content.tags) ? content.tags : []).map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  ))}
                  {(!content.tags || (Array.isArray(content.tags) && content.tags.length === 0)) && (
                    <span className="text-sm text-muted-foreground">No tags</span>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Hook</Label>
                <Textarea value={hook} onChange={(e) => setHook(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Core Message</Label>
                <Textarea value={coreMessage} onChange={(e) => setCoreMessage(e.target.value)} rows={2} />
              </div>
              <div className="space-y-2">
                <Label>CTA</Label>
                <Input value={cta} onChange={(e) => setCta(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Body (Markdown)</CardTitle>
              <div className="flex items-center gap-2">
                <Label htmlFor="preview-toggle" className="text-xs text-muted-foreground">Preview</Label>
                <Switch id="preview-toggle" checked={showPreview} onCheckedChange={setShowPreview} />
              </div>
            </CardHeader>
            <CardContent>
              {showPreview ? (
                <MarkdownPreview content={bodyMd} />
              ) : (
                <Textarea
                  value={bodyMd}
                  onChange={(e) => setBodyMd(e.target.value)}
                  rows={16}
                  className="font-mono text-sm"
                />
              )}
            </CardContent>
          </Card>

          {/* Variants & Derivatives — 이 마스터에서 파생된 모든 포맷 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Variants & Derivatives
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {variants.length}
                </span>
              </CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href={`/variants?content_id=${content.id}`}>
                  <SplitIcon className="mr-1.5 h-3.5 w-3.5" />
                  Manage Variants
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {variants.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  아직 파생물이 없습니다. 상단의{" "}
                  <Link href={`/variants?content_id=${content.id}`} className="text-info underline">
                    → Generate Variants
                  </Link>{" "}
                  로 포맷별 파생을 시작하세요.
                </div>
              ) : (
                <div className="space-y-2">
                  {variants.map((variant) => {
                    const action = getDerivativeAction(variant);
                    const Icon = action.icon;
                    return (
                      <div
                        key={variant.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs uppercase">
                                {variant.platform}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {variant.format}
                              </Badge>
                              <Badge
                                variant={variant.status === "published" ? "success" : variant.status === "ready" ? "info" : "secondary"}
                                className="text-xs"
                              >
                                {variant.status}
                              </Badge>
                              {variant.emails.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  <MailIcon className="mr-1 h-3 w-3" />
                                  {variant.emails.length} 발송
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm truncate text-foreground">{action.label}</p>
                          </div>
                        </div>
                        {action.href ? (
                          <Button asChild variant="ghost" size="sm" aria-label={`열기: ${action.label}`}>
                            <Link href={action.href}>
                              <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">{action.label}</span>
                            </Link>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">파생 링크 없음</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar — Meta */}
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge variant={config.variant} className="text-sm">
                  {config.label}
                </Badge>
              </div>
              <Separator className="my-4" />
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{new Date(content.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated</span>
                  <span>{formatRelativeTime(content.updated_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Fact Checked</span>
                  <Switch checked={content.fact_checked ?? false} disabled />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Tabs */}
          <Card>
            <CardContent className="pt-6">
              <Tabs defaultValue="versions">
                <TabsList className="w-full">
                  <TabsTrigger value="versions" className="flex-1">Versions</TabsTrigger>
                  <TabsTrigger value="publications" className="flex-1">Published</TabsTrigger>
                </TabsList>
                <TabsContent value="versions" className="mt-4">
                  {revisions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No revisions yet</p>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {revisions.map((rev) => (
                        <div key={rev.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedRevision(selectedRevision === rev.id ? null : rev.id)}
                            className={cn(
                              "flex w-full items-start gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                              selectedRevision === rev.id ? "border-info bg-muted/30" : "border-border"
                            )}
                          >
                            <HistoryIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">v{rev.version_number}</span>
                                {rev.actor_type === "agent" ? (
                                  <BotIcon className="h-3 w-3 text-info" />
                                ) : (
                                  <UserIcon className="h-3 w-3 text-warning" />
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {rev.actor_type === "agent" ? "Agent" : "Human"}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(rev.created_at)}
                              </span>
                              {rev.delta && Object.keys(rev.delta).length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {Object.keys(rev.delta).map((field) => (
                                    <Badge key={field} variant="outline" className="text-xs">
                                      {field}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </button>
                          {selectedRevision === rev.id && rev.delta && Object.keys(rev.delta).length > 0 && (
                            <div className="mt-2 rounded-lg border border-border bg-background p-4">
                              <RevisionDiffView delta={rev.delta as Record<string, { from: unknown; to: unknown }>} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="publications" className="mt-4">
                  {publications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Not published yet</p>
                  ) : (
                    <div className="space-y-3">
                      {publications.map((pub) => (
                        <div key={pub.id} className="flex items-center gap-2 rounded-lg border border-border p-3">
                          <Badge variant="outline">{pub.channel}</Badge>
                          <span className="text-xs text-muted-foreground flex-1">
                            {formatRelativeTime(pub.published_at)}
                          </span>
                          {pub.url && (
                            <a href={pub.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLinkIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="border-warning/30 bg-warning/5">
            <CardHeader>
              <CardTitle className="text-base">Agent Learning Notes</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground">
                Based on your previous edits, the agent has learned:
              </p>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
                <li>CTA: prefers soft tone (3 edits)</li>
                <li>Hook: prefers data-first opening (2 edits)</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
