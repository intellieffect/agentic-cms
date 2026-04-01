"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  if (!content) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        No content
      </div>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-invert max-w-none",
        "prose-headings:text-foreground prose-headings:font-semibold",
        "prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg",
        "prose-p:text-sm prose-p:text-foreground/90 prose-p:leading-relaxed",
        "prose-a:text-info prose-a:no-underline hover:prose-a:underline",
        "prose-strong:text-foreground prose-em:text-foreground/80",
        "prose-code:rounded prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:text-foreground",
        "prose-pre:bg-muted prose-pre:rounded-lg prose-pre:border prose-pre:border-border",
        "prose-blockquote:border-l-info prose-blockquote:text-muted-foreground",
        "prose-ul:text-sm prose-ol:text-sm prose-li:text-foreground/90",
        "prose-table:text-sm prose-th:text-foreground prose-td:text-foreground/90",
        "prose-hr:border-border",
        "prose-img:rounded-lg prose-img:border prose-img:border-border",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
