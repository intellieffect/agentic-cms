"use client";

import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import { resolveImageUrl } from "@/lib/blog/resolveImageUrl";
import { cn } from "@/lib/utils";

interface TextNode {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  strikethrough?: boolean;
  highlight?: boolean;
  url?: string;
}

interface PlateNode {
  id?: string;
  type?: string;
  level?: number;
  children?: (PlateNode | TextNode)[];
  url?: string;
  src?: string;
  alt?: string;
  lang?: string;
  language?: string;
  value?: string;
  width?: number | string;
  caption?: (TextNode | string)[] | string;
  icon?: string;
  variant?: string;
  calloutType?: string;
  [key: string]: unknown;
}

interface RenderContext {
  compact?: boolean;
}

function isTextNode(node: PlateNode | TextNode): node is TextNode {
  return "text" in node;
}

function normalizeImageUrl(src?: string) {
  if (!src) return "";
  const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/blog-images`
    : "";

  return storageUrl ? resolveImageUrl(src, storageUrl) : src;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(Number(num)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function getCodeContent(node: PlateNode): string {
  if (typeof node.value === "string") return node.value;
  if (!node.children) return "";

  return node.children
    .map((line) => {
      if (typeof line === "string") return line;
      if (isTextNode(line)) return line.text;
      if (Array.isArray(line.children)) {
        return line.children
          .map((child) => {
            if (typeof child === "string") return child;
            return isTextNode(child) ? child.text || "" : "";
          })
          .join("");
      }
      return "";
    })
    .join("\n");
}

function renderCaption(caption?: PlateNode["caption"]): string {
  if (!caption) return "";
  if (typeof caption === "string") return caption;

  return caption
    .map((item) => {
      if (typeof item === "string") return item;
      return item.text || "";
    })
    .join("")
    .trim();
}

function BlogImage({ node }: { node: PlateNode }) {
  const src = normalizeImageUrl((node.url as string) || (node.src as string) || "");
  const alt = (node.alt as string) || renderCaption(node.caption) || "";

  if (!src) {
    return (
      <div className="relative mb-4 flex h-96 w-full items-center justify-center rounded bg-secondary">
        <p className="text-sm text-muted-foreground">이미지를 불러올 수 없습니다</p>
      </div>
    );
  }

  return (
    <figure className="my-8 md:my-10">
      <div className="relative overflow-hidden rounded-lg">
        <Image
          src={src}
          alt={alt}
          width={1200}
          height={675}
          className="h-auto w-full object-cover"
          unoptimized
        />
      </div>
    </figure>
  );
}

const calloutVariants: Record<string, { icon: string; className: string }> = {
  info: { icon: "💡", className: "bg-blue-500/10 border-blue-500/30 text-foreground" },
  warning: { icon: "⚠️", className: "bg-yellow-500/10 border-yellow-500/30 text-foreground" },
  error: { icon: "🚫", className: "bg-red-500/10 border-red-500/30 text-foreground" },
  success: { icon: "✅", className: "bg-green-500/10 border-green-500/30 text-foreground" },
  note: { icon: "📝", className: "bg-muted border-border text-foreground" },
};

function CalloutElement({ node, children }: { node: PlateNode; children: ReactNode }) {
  const variant = (node.variant as string) || node.calloutType || "info";
  const icon = (node.icon as string) || calloutVariants[variant]?.icon || "💡";
  const cls = calloutVariants[variant]?.className || calloutVariants.info.className;

  return (
    <div className={cn("my-8 flex gap-3 rounded-lg border px-5 py-4 md:my-10", cls)}>
      <div className="text-xl leading-none">{icon}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function CodeBlockElement({ node }: { node: PlateNode }) {
  const language = (node.lang as string) || (node.language as string) || "plaintext";
  const codeContent = decodeHtmlEntities(getCodeContent(node));

  return (
    <div className="relative my-4 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-secondary px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">{language}</span>
      </div>
      <pre className="overflow-x-auto bg-card">
        <code className="block p-4 font-mono text-sm leading-relaxed text-foreground">{codeContent}</code>
      </pre>
    </div>
  );
}

function renderContent(
  nodes: (PlateNode | TextNode)[],
  context: RenderContext = {}
): ReactNode {
  if (!Array.isArray(nodes)) return null;

  return nodes.map((entry, index) => {
    if (isTextNode(entry)) return renderText(entry, index);

    const node = entry;
    const key = `node-${index}`;

    switch (node.type) {
      case "p":
      case "paragraph":
        return (
          <p
            key={key}
            className={context.compact
              ? "mb-3 text-base leading-7 text-foreground last:mb-0"
              : "mb-6 text-[17px] leading-8 text-foreground md:mb-7 last:mb-0"}
          >
            {renderChildren(node.children, context)}
          </p>
        );

      case "h1":
        return null;

      case "heading":
        if (node.level === 1) return null;
        if (node.level === 2) {
          return (
            <h2 key={key} className="mb-5 mt-14 text-2xl font-bold tracking-tight md:mt-16 md:mb-6">
              {renderChildren(node.children, context)}
            </h2>
          );
        }
        if (node.level === 3) {
          return (
            <h3 key={key} className="mb-4 mt-10 text-xl font-bold md:mt-12 md:mb-5">
              {renderChildren(node.children, context)}
            </h3>
          );
        }
        if (node.level === 4) {
          return (
            <h4 key={key} className="mb-3 mt-8 text-lg font-bold md:mt-9 md:mb-4">
              {renderChildren(node.children, context)}
            </h4>
          );
        }
        return (
          <h5 key={key} className="mb-3 mt-6 text-base font-bold md:mt-7">
            {renderChildren(node.children, context)}
          </h5>
        );

      case "h2":
        return (
          <h2 key={key} className="mb-5 mt-14 text-2xl font-bold tracking-tight md:mt-16 md:mb-6">
            {renderChildren(node.children, context)}
          </h2>
        );

      case "h3":
        return (
          <h3 key={key} className="mb-4 mt-10 text-xl font-bold md:mt-12 md:mb-5">
            {renderChildren(node.children, context)}
          </h3>
        );

      case "blockquote":
        return (
          <blockquote
            key={key}
            className="my-8 border-l-4 border-[#FF6B35] bg-secondary/50 px-5 py-4 italic text-foreground md:my-10"
          >
            {renderChildren(node.children, { compact: true })}
          </blockquote>
        );

      case "ul":
      case "bulletedList":
        return (
          <ul key={key} className="my-8 ml-6 list-disc space-y-3 text-foreground md:my-9">
            {renderChildren(node.children, { compact: true })}
          </ul>
        );

      case "ol":
      case "numberedList":
        return (
          <ol key={key} className="my-8 ml-6 list-decimal space-y-3 text-foreground md:my-9">
            {renderChildren(node.children, { compact: true })}
          </ol>
        );

      case "li":
      case "listItem":
        return (
          <li key={key} className="text-base leading-8 text-foreground marker:text-foreground">
            {renderChildren(node.children, { compact: true })}
          </li>
        );

      case "lic":
        return <Fragment key={key}>{renderChildren(node.children, context)}</Fragment>;

      case "hr":
      case "horizontalRule":
        return <hr key={key} className="my-10 border-border md:my-12" />;

      case "callout":
        return (
          <CalloutElement key={key} node={node}>
            {renderChildren(node.children, { compact: true })}
          </CalloutElement>
        );

      case "code":
      case "codeBlock":
      case "code_block":
        return <CodeBlockElement key={key} node={node} />;

      case "table":
        return (
          <div key={key} className="my-8 overflow-x-auto md:my-9">
            <table className="w-full border-collapse border border-border">
              <tbody>{renderChildren(node.children, { compact: true })}</tbody>
            </table>
          </div>
        );

      case "tr":
      case "tableRow":
        return (
          <tr key={key} className="border-b border-border">
            {renderChildren(node.children, { compact: true })}
          </tr>
        );

      case "td":
      case "tableCell":
        return (
          <td key={key} className="border border-border px-3 py-2 text-sm align-top">
            {renderChildren(node.children, { compact: true })}
          </td>
        );

      case "th":
      case "tableHeader":
        return (
          <th key={key} className="border border-border bg-secondary px-3 py-2 text-sm font-semibold align-top">
            {renderChildren(node.children, { compact: true })}
          </th>
        );

      case "column_group":
      case "columnGroup":
        return (
          <div key={key} className="my-8 flex gap-6 md:my-10">
            {renderChildren(node.children, { compact: true })}
          </div>
        );

      case "column": {
        const width = node.width || "50%";
        return (
          <div key={key} className="flex-1 px-3 first:pl-0 last:pr-0" style={{ width }}>
            {renderChildren(node.children, { compact: true })}
          </div>
        );
      }

      case "image":
      case "img":
        return <BlogImage key={key} node={node} />;

      case "a":
      case "link":
        return (
          <a
            key={key}
            href={(node.url as string) || "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground underline transition-colors hover:text-foreground/80"
          >
            {renderChildren(node.children, context)}
          </a>
        );

      default:
        if (node.children) return <div key={key}>{renderChildren(node.children, context)}</div>;
        return null;
    }
  });
}

function renderText(node: TextNode, i: number) {
  let text: ReactNode = node.text;
  if (!text && text !== "") return null;

  if (node.bold) text = <strong key={`strong-${i}`}>{text}</strong>;
  if (node.italic) text = <em key={`em-${i}`}>{text}</em>;
  if (node.underline) text = <u key={`u-${i}`}>{text}</u>;
  if (node.strikethrough) text = <s key={`s-${i}`}>{text}</s>;
  if (node.code) {
    text = (
      <code key={`code-${i}`} className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-sm">
        {text}
      </code>
    );
  }
  if (node.highlight) {
    text = <mark key={`mark-${i}`} className="bg-yellow-500/30 text-inherit">{text}</mark>;
  }

  if (node.url) {
    return (
      <a
        key={`link-${i}`}
        href={node.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground underline transition-colors hover:text-foreground/80"
      >
        {text}
      </a>
    );
  }

  if (!node.bold && !node.italic && !node.underline && !node.strikethrough && !node.code && !node.highlight) {
    return <span key={`span-${i}`}>{text}</span>;
  }

  return text;
}

function renderChildren(children?: (PlateNode | TextNode)[], context: RenderContext = {}) {
  if (!children) return null;
  if (!Array.isArray(children)) return children;

  return children.map((child, i) => {
    if (typeof child === "string") return child;
    if (isTextNode(child)) return renderText(child, i);
    return <Fragment key={`child-${i}`}>{renderContent([child], context)}</Fragment>;
  });
}

export function PlatePreview({ content }: { content: PlateNode[] }) {
  if (!content || content.length === 0) {
    return <p className="text-muted-foreground">콘텐츠가 없습니다.</p>;
  }

  return <div className="prose-like relative mx-auto max-w-2xl space-y-4 text-foreground">{renderContent(content)}</div>;
}
