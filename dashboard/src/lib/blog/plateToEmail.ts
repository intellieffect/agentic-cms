import { resolveImageUrl } from "./resolveImageUrl";

const calloutVariants: Record<string, { icon: string; bg: string; border: string }> = {
  info: { icon: "💡", bg: "#0d2238", border: "#2e5f93" },
  warning: { icon: "⚠️", bg: "#2c2410", border: "#8a6a1f" },
  error: { icon: "🚫", bg: "#311617", border: "#9c3a3d" },
  success: { icon: "✅", bg: "#11281a", border: "#2f7d4d" },
  note: { icon: "📝", bg: "#111111", border: "#333333" },
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

function getCodeContent(node: any): string {
  if (node.value) return node.value;
  if (!node.children) return "";
  return node.children
    .map((line: any) => {
      if (typeof line === "string") return line;
      if (line.text) return line.text;
      if (line.children) {
        return line.children.map((c: any) => (typeof c === "string" ? c : c.text || "")).join("");
      }
      return "";
    })
    .join("\n");
}

function resolveAbsoluteImageUrl(src: string, siteUrl: string, storageBaseUrl: string): string {
  const resolved = resolveImageUrl(src, storageBaseUrl);
  if (!resolved) return "";
  if (resolved.startsWith("data:")) return "";
  if (resolved.startsWith("http")) return resolved;
  return `${siteUrl}${resolved.startsWith("/") ? "" : "/"}${resolved}`;
}

function renderChildrenToHtml(children: any[], siteUrl: string, storageBaseUrl: string): string {
  if (!children || !Array.isArray(children)) return "";

  return children
    .map((child) => {
      if (typeof child === "string") return escapeHtml(child);
      if (!child) return "";

      if (child.text !== undefined) {
        let html = escapeHtml(child.text);
        if (!html && html !== "") return "";

        if (child.bold) html = `<strong>${html}</strong>`;
        if (child.italic) html = `<em>${html}</em>`;
        if (child.underline) html = `<u>${html}</u>`;
        if (child.strikethrough) html = `<s>${html}</s>`;
        if (child.code) {
          html = `<code style="background:#171717;border:1px solid #2f2f2f;padding:2px 6px;border-radius:4px;font-family:SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:#f3f3f3;">${html}</code>`;
        }
        if (child.highlight) {
          html = `<mark style="background:#6b4f00;color:#fff7d6;">${html}</mark>`;
        }
        if (child.url) {
          html = `<a href="${escapeHtml(child.url)}" style="color:#f5f5f5;text-decoration:underline;">${html}</a>`;
        }
        return html;
      }

      if (Array.isArray(child.children) && !child.type) {
        return renderChildrenToHtml(child.children, siteUrl, storageBaseUrl);
      }

      if (child.type === "lic") {
        return renderChildrenToHtml(child.children, siteUrl, storageBaseUrl);
      }

      if (child.type) return renderNodesToHtml([child], siteUrl, storageBaseUrl);
      return "";
    })
    .join("");
}

function wrapBlock(innerHtml: string, padding = "0 0 24px") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:${padding};">${innerHtml}</td></tr></table>`;
}


function renderNodesToHtml(nodes: any[], siteUrl: string, storageBaseUrl: string): string {
  if (!Array.isArray(nodes)) return "";

  return nodes
    .map((node) => {
      switch (node.type) {
        case "p":
        case "paragraph": {
          const inner = renderChildrenToHtml(node.children, siteUrl, storageBaseUrl);
          if (!inner.trim()) return "";
          return wrapBlock(
            `<p style="margin:0;font-size:17px;line-height:2;color:#f0f0f0;">${inner}</p>`
          );
        }

        case "h1":
          return "";

        case "heading":
          if (node.level === 1) return "";
          if (node.level === 2) {
            return wrapBlock(
              `<h2 style="margin:0;font-size:26px;line-height:1.35;font-weight:700;letter-spacing:-0.02em;color:#fafafa;">${renderChildrenToHtml(node.children, siteUrl, storageBaseUrl)}</h2>`,
              "48px 0 20px"
            );
          }
          if (node.level === 3) {
            return wrapBlock(
              `<h3 style="margin:0;font-size:20px;line-height:1.45;font-weight:700;color:#fafafa;">${renderChildrenToHtml(node.children, siteUrl, storageBaseUrl)}</h3>`,
              "40px 0 16px"
            );
          }
          if (node.level === 4) {
            return wrapBlock(
              `<h4 style="margin:0;font-size:17px;line-height:1.5;font-weight:700;color:#fafafa;">${renderChildrenToHtml(node.children, siteUrl, storageBaseUrl)}</h4>`,
              "32px 0 12px"
            );
          }
          return wrapBlock(
            `<h5 style="margin:0;font-size:15px;line-height:1.5;font-weight:700;color:#fafafa;">${renderChildrenToHtml(node.children, siteUrl, storageBaseUrl)}</h5>`,
            "24px 0 12px"
          );

        case "h2":
          return wrapBlock(
            `<h2 style="margin:0;font-size:26px;line-height:1.35;font-weight:700;letter-spacing:-0.02em;color:#fafafa;">${renderChildrenToHtml(node.children, siteUrl, storageBaseUrl)}</h2>`,
            "48px 0 20px"
          );

        case "h3":
          return wrapBlock(
            `<h3 style="margin:0;font-size:20px;line-height:1.45;font-weight:700;color:#fafafa;">${renderChildrenToHtml(node.children, siteUrl, storageBaseUrl)}</h3>`,
            "40px 0 16px"
          );

        case "blockquote":
          return wrapBlock(
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-left:4px solid #FF6B35;background:#141414;padding:18px 20px;font-style:italic;color:#f0f0f0;font-size:17px;line-height:2;">${renderChildrenToHtml(node.children, siteUrl, storageBaseUrl)}</td></tr></table>`,
            "32px 0 32px"
          );

        case "ul":
        case "bulletedList":
          return wrapBlock(
            `<ul style="margin:0;padding-left:24px;color:#f0f0f0;">${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</ul>`,
            "32px 0 32px"
          );

        case "ol":
        case "numberedList":
          return wrapBlock(
            `<ol style="margin:0;padding-left:24px;color:#f0f0f0;">${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</ol>`,
            "32px 0 32px"
          );

        case "li":
        case "listItem":
          return `<li style="margin:0 0 12px;font-size:17px;line-height:2;color:#f0f0f0;">${renderChildrenToHtml(node.children, siteUrl, storageBaseUrl)}</li>`;

        case "hr":
        case "horizontalRule":
          return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:40px 0;"><div style="height:1px;line-height:1px;background:#2c2c2c;">&nbsp;</div></td></tr></table>`;

        case "callout": {
          const rawVariant =
            typeof node.variant === "string"
              ? node.variant
              : typeof node.calloutType === "string"
                ? node.calloutType
                : "info";
          const config = Object.prototype.hasOwnProperty.call(calloutVariants, rawVariant)
            ? calloutVariants[rawVariant]
            : calloutVariants.info;
          const icon = escapeHtml(String(node.icon || config.icon));
          return wrapBlock(
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:${config.bg};border:1px solid ${config.border};border-radius:10px;padding:18px 20px;color:#f0f0f0;font-size:17px;line-height:2;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="28" valign="top" style="font-size:18px;line-height:1.4;padding-right:12px;">${icon}</td><td valign="top">${renderChildrenToHtml(node.children, siteUrl, storageBaseUrl)}</td></tr></table></td></tr></table>`,
            "32px 0 32px"
          );
        }

        case "code":
        case "codeBlock":
        case "code_block": {
          const decoded = decodeHtmlEntities(getCodeContent(node));
          return wrapBlock(
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border:1px solid #2f2f2f;border-radius:10px;background:#101010;padding:18px 20px;"><pre style="margin:0;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;"><code style="font-family:SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.7;color:#e7e7e7;">${escapeHtml(decoded)}</code></pre></td></tr></table>`,
            "16px 0 16px"
          );
        }

        case "image":
        case "img": {
          const src = node.url || node.src || "";
          const imgUrl = resolveAbsoluteImageUrl(src, siteUrl, storageBaseUrl);
          if (!imgUrl) return "";
          const alt = node.alt ? escapeHtml(node.alt) : "";
          return wrapBlock(
            `<img src="${escapeHtml(imgUrl)}" alt="${alt}" style="width:100%;max-width:600px;height:auto;border-radius:10px;display:block;" />`,
            "32px 0 32px"
          );
        }

        case "table":
          return wrapBlock(
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #303030;"><tbody>${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</tbody></table>`,
            "32px 0 32px"
          );

        case "tr":
        case "tableRow":
          return `<tr>${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</tr>`;

        case "td":
        case "tableCell":
          return `<td style="border:1px solid #303030;padding:10px 14px;font-size:14px;line-height:1.7;color:#f0f0f0;vertical-align:top;">${renderChildrenToHtml(node.children, siteUrl, storageBaseUrl)}</td>`;

        case "th":
        case "tableHeader":
          return `<th style="border:1px solid #303030;padding:10px 14px;font-size:14px;line-height:1.7;font-weight:600;background:#161616;color:#fafafa;vertical-align:top;text-align:left;">${renderChildrenToHtml(node.children, siteUrl, storageBaseUrl)}</th>`;

        case "column_group":
        case "columnGroup":
          return wrapBlock(
            `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</tr></table>`,
            "32px 0 32px"
          );

        case "column": {
          const width = node.width || "50%";
          return `<td width="${escapeHtml(String(width))}" style="padding:0 12px;vertical-align:top;">${renderNodesToHtml(node.children, siteUrl, storageBaseUrl)}</td>`;
        }

        default:
          if (node.children) return renderNodesToHtml(node.children, siteUrl, storageBaseUrl);
          return "";
      }
    })
    .join("");
}

export function plateToEmailHtml(nodes: any[], siteUrl: string, storageBaseUrl: string): string {
  if (!nodes || !Array.isArray(nodes)) return "";
  return renderNodesToHtml(nodes, siteUrl, storageBaseUrl);
}
