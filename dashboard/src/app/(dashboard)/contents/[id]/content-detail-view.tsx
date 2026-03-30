"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRightIcon, ExternalLinkIcon, HistoryIcon, BotIcon, UserIcon } from "lucide-react";
import type { Content, Revision, Publication } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/utils";

const statusVariant: Record<string, "secondary" | "info" | "success"> = {
  draft: "secondary",
  review: "info",
  published: "success",
};

interface ContentDetailViewProps {
  content: Content;
  revisions: Revision[];
  publications: Publication[];
}

export function ContentDetailView({ content, revisions, publications }: ContentDetailViewProps) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/contents" className="hover:text-foreground transition-colors">
          Contents
        </Link>
        <ChevronRightIcon className="h-3 w-3" />
        <span className="text-foreground font-medium truncate max-w-[300px]">{content.title}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Panel — Fields */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input defaultValue={content.title} readOnly />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input defaultValue={content.slug} readOnly className="font-mono text-sm" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Input defaultValue={content.category ?? ""} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Funnel Stage</Label>
                  <Input defaultValue={content.funnel_stage ?? ""} readOnly />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1">
                  {content.tags?.map((tag) => (
                    <Badge key={tag} variant="outline">{tag}</Badge>
                  )) ?? <span className="text-sm text-muted-foreground">No tags</span>}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Hook</Label>
                <Textarea defaultValue={content.hook ?? ""} readOnly rows={2} />
              </div>
              <div className="space-y-2">
                <Label>Core Message</Label>
                <Textarea defaultValue={content.core_message ?? ""} readOnly rows={2} />
              </div>
              <div className="space-y-2">
                <Label>CTA</Label>
                <Input defaultValue={content.cta ?? ""} readOnly />
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
                <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap">
                  {content.body_md ?? "No content"}
                </div>
              ) : (
                <Textarea
                  defaultValue={content.body_md ?? ""}
                  readOnly
                  rows={16}
                  className="font-mono text-sm"
                />
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
                <Badge variant={statusVariant[content.status] ?? "secondary"} className="text-sm">
                  {content.status}
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
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {revisions.map((rev) => (
                        <div key={rev.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
                          <HistoryIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">v{rev.version_number}</span>
                              {rev.actor_type === "agent" ? (
                                <BotIcon className="h-3 w-3 text-info" />
                              ) : (
                                <UserIcon className="h-3 w-3 text-warning" />
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {formatRelativeTime(rev.created_at)}
                            </span>
                          </div>
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
        </div>
      </div>
    </div>
  );
}
